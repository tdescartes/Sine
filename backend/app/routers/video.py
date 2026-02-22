"""
Video REST API — start / chunk / complete / trim / list / get endpoints.

v2 additions:
  - codec stored on start
  - trim_end auto-applied on complete ("Smart Stop")
  - PATCH /video/{id}/trim for metadata-based instant trimming
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database import get_db
from app.models import VIDEOS_COLLECTION
from app.s3 import (
    abort_upload,
    complete_upload,
    generate_s3_key,
    get_presigned_url,
    initiate_upload,
    upload_chunk,
)
from app.schemas import (
    ChunkUploadResponse,
    TrimUpdateRequest,
    VideoCompleteRequest,
    VideoListResponse,
    VideoResponse,
    VideoStartRequest,
    VideoStartResponse,
)

router = APIRouter(prefix="/video", tags=["video"])

# In-memory part tracking (production: use Redis or DB)
_upload_parts: dict[str, list[dict]] = {}


def _doc_to_response(doc: dict, playback_url: str | None = None) -> VideoResponse:
    return VideoResponse(
        id=uuid.UUID(doc["_id"]),
        title=doc.get("title"),
        status=doc["status"],
        duration=doc.get("duration"),
        codec=doc.get("codec"),
        trim_start=doc.get("trim_start"),
        trim_end=doc.get("trim_end"),
        created_at=doc["created_at"],
        playback_url=playback_url,
    )


@router.post("/start", response_model=VideoStartResponse)
async def start_recording(
    body: VideoStartRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Initialise a new video recording and S3 multipart upload."""
    video_id = uuid.uuid4()
    s3_key = generate_s3_key(str(video_id))
    s3_upload_id = initiate_upload(s3_key)

    doc = {
        "_id": str(video_id),
        "title": body.title,
        "s3_key": s3_key,
        "status": "recording",
        "upload_id": s3_upload_id,
        "codec": body.codec,
        "duration": None,
        "trim_start": None,
        "trim_end": None,
        "created_at": datetime.now(timezone.utc),
    }
    await db[VIDEOS_COLLECTION].insert_one(doc)
    _upload_parts[str(video_id)] = []

    return VideoStartResponse(
        video_id=video_id,
        upload_id=s3_upload_id,
        s3_key=s3_key,
    )


@router.post("/chunk/{video_id}", response_model=ChunkUploadResponse)
async def upload_video_chunk(
    video_id: uuid.UUID,
    part_number: int = Query(..., ge=1),
    chunk: UploadFile = File(...),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Upload a single binary chunk for an in-progress recording (REST fallback)."""
    doc = await db[VIDEOS_COLLECTION].find_one({"_id": str(video_id)})
    if doc is None:
        raise HTTPException(404, "Video not found")
    if doc["status"] != "recording":
        raise HTTPException(400, "Video is not in recording state")

    data = await chunk.read()
    if len(data) == 0:
        raise HTTPException(400, "Empty chunk")

    part = upload_chunk(doc["s3_key"], doc["upload_id"], part_number, data)

    vid_key = str(video_id)
    _upload_parts.setdefault(vid_key, []).append(part)

    return ChunkUploadResponse(part_number=part["PartNumber"], etag=part["ETag"])


@router.post("/complete", response_model=VideoResponse)
async def complete_recording(
    body: VideoCompleteRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Finalise the multipart upload after the client stops recording."""
    vid_key = str(body.video_id)
    doc = await db[VIDEOS_COLLECTION].find_one({"_id": vid_key})
    if doc is None:
        raise HTTPException(404, "Video not found")
    if doc["status"] != "recording":
        raise HTTPException(400, "Video is not in recording state")

    parts = _upload_parts.get(vid_key, [])
    if not parts:
        raise HTTPException(400, "No chunks uploaded")

    complete_upload(doc["s3_key"], doc["upload_id"], parts)

    update: dict = {"status": "ready", "duration": body.duration}
    if body.trim_end is not None:
        update["trim_end"] = body.trim_end

    await db[VIDEOS_COLLECTION].update_one({"_id": vid_key}, {"$set": update})
    _upload_parts.pop(vid_key, None)

    updated = await db[VIDEOS_COLLECTION].find_one({"_id": vid_key})
    playback_url = get_presigned_url(updated["s3_key"])
    return _doc_to_response(updated, playback_url)


@router.patch("/{video_id}/trim", response_model=VideoResponse)
async def update_trim(
    video_id: uuid.UUID,
    body: TrimUpdateRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Update trim boundaries — metadata-based instant trimming.
    No re-encoding. Pass null to clear a boundary.
    """
    doc = await db[VIDEOS_COLLECTION].find_one({"_id": str(video_id)})
    if doc is None:
        raise HTTPException(404, "Video not found")

    set_fields: dict = {}
    unset_fields: dict = {}

    if "trim_start" in body.model_fields_set:
        if body.trim_start is not None:
            if doc.get("duration") and body.trim_start > doc["duration"]:
                raise HTTPException(400, "trim_start exceeds video duration")
            set_fields["trim_start"] = body.trim_start
        else:
            unset_fields["trim_start"] = ""

    if "trim_end" in body.model_fields_set:
        if body.trim_end is not None:
            if doc.get("duration") and body.trim_end > doc["duration"]:
                raise HTTPException(400, "trim_end exceeds video duration")
            set_fields["trim_end"] = body.trim_end
        else:
            unset_fields["trim_end"] = ""

    mongo_op: dict = {}
    if set_fields:
        mongo_op["$set"] = set_fields
    if unset_fields:
        mongo_op["$unset"] = unset_fields
    if mongo_op:
        await db[VIDEOS_COLLECTION].update_one({"_id": str(video_id)}, mongo_op)

    updated = await db[VIDEOS_COLLECTION].find_one({"_id": str(video_id)})
    playback_url = None
    if updated["status"] == "ready" and updated.get("s3_key"):
        playback_url = get_presigned_url(updated["s3_key"])
    return _doc_to_response(updated, playback_url)


@router.post("/abort/{video_id}")
async def abort_recording(
    video_id: uuid.UUID,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Cancel an in-progress upload and clean up S3 parts."""
    doc = await db[VIDEOS_COLLECTION].find_one({"_id": str(video_id)})
    if doc is None:
        raise HTTPException(404, "Video not found")

    if doc.get("upload_id") and doc.get("s3_key"):
        try:
            abort_upload(doc["s3_key"], doc["upload_id"])
        except Exception:
            pass  # best-effort cleanup

    await db[VIDEOS_COLLECTION].update_one(
        {"_id": str(video_id)}, {"$set": {"status": "cancelled"}}
    )
    _upload_parts.pop(str(video_id), None)
    return {"status": "aborted"}


@router.get("/{video_id}", response_model=VideoResponse)
async def get_video(
    video_id: uuid.UUID,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Retrieve a single video by ID with a fresh pre-signed URL."""
    doc = await db[VIDEOS_COLLECTION].find_one({"_id": str(video_id)})
    if doc is None:
        raise HTTPException(404, "Video not found")

    playback_url = None
    if doc["status"] == "ready" and doc.get("s3_key"):
        playback_url = get_presigned_url(doc["s3_key"])

    return _doc_to_response(doc, playback_url)


@router.get("/", response_model=VideoListResponse)
async def list_videos(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """List all videos (newest first)."""
    total = await db[VIDEOS_COLLECTION].count_documents({})

    cursor = (
        db[VIDEOS_COLLECTION]
        .find()
        .sort("created_at", -1)
        .skip(offset)
        .limit(limit)
    )
    docs = await cursor.to_list(length=limit)

    items = []
    for d in docs:
        playback_url = None
        if d["status"] == "ready" and d.get("s3_key"):
            playback_url = get_presigned_url(d["s3_key"])
        items.append(_doc_to_response(d, playback_url))

    return VideoListResponse(videos=items, total=total)

