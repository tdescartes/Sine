"""Video REST API — start / chunk / complete / list / get endpoints."""

from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy import select, func as sqlfunc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Video
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
    VideoCompleteRequest,
    VideoListResponse,
    VideoResponse,
    VideoStartRequest,
    VideoStartResponse,
)

router = APIRouter(prefix="/video", tags=["video"])

# In-memory part tracking (production: use Redis or DB)
_upload_parts: dict[str, list[dict]] = {}


@router.post("/start", response_model=VideoStartResponse)
async def start_recording(
    body: VideoStartRequest,
    db: AsyncSession = Depends(get_db),
):
    """Initialise a new video recording and S3 multipart upload."""
    video_id = uuid.uuid4()
    s3_key = generate_s3_key(str(video_id))
    s3_upload_id = initiate_upload(s3_key)

    video = Video(
        id=video_id,
        title=body.title,
        s3_key=s3_key,
        status="recording",
        upload_id=s3_upload_id,
    )
    db.add(video)
    await db.flush()

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
    db: AsyncSession = Depends(get_db),
):
    """Upload a single binary chunk for an in-progress recording (REST fallback)."""
    result = await db.execute(select(Video).where(Video.id == video_id))
    video = result.scalar_one_or_none()
    if video is None:
        raise HTTPException(404, "Video not found")
    if video.status != "recording":
        raise HTTPException(400, "Video is not in recording state")

    data = await chunk.read()
    if len(data) == 0:
        raise HTTPException(400, "Empty chunk")

    part = upload_chunk(video.s3_key, video.upload_id, part_number, data)

    vid_key = str(video_id)
    if vid_key not in _upload_parts:
        _upload_parts[vid_key] = []
    _upload_parts[vid_key].append(part)

    return ChunkUploadResponse(part_number=part["PartNumber"], etag=part["ETag"])


@router.post("/complete", response_model=VideoResponse)
async def complete_recording(
    body: VideoCompleteRequest,
    db: AsyncSession = Depends(get_db),
):
    """Finalise the multipart upload after the client stops recording."""
    result = await db.execute(select(Video).where(Video.id == body.video_id))
    video = result.scalar_one_or_none()
    if video is None:
        raise HTTPException(404, "Video not found")
    if video.status != "recording":
        raise HTTPException(400, "Video is not in recording state")

    vid_key = str(body.video_id)
    parts = _upload_parts.get(vid_key, [])
    if not parts:
        raise HTTPException(400, "No chunks uploaded")

    complete_upload(video.s3_key, video.upload_id, parts)

    video.status = "processing"
    video.duration = body.duration
    await db.flush()

    # Clean up in-memory tracking
    _upload_parts.pop(vid_key, None)

    # Mark as ready (in production, a background worker would do transcoding first)
    video.status = "ready"
    await db.flush()

    playback_url = get_presigned_url(video.s3_key)

    return VideoResponse(
        id=video.id,
        title=video.title,
        status=video.status,
        duration=video.duration,
        created_at=video.created_at,
        playback_url=playback_url,
    )


@router.post("/abort/{video_id}")
async def abort_recording(
    video_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Cancel an in-progress upload and clean up S3 parts."""
    result = await db.execute(select(Video).where(Video.id == video_id))
    video = result.scalar_one_or_none()
    if video is None:
        raise HTTPException(404, "Video not found")

    if video.upload_id and video.s3_key:
        try:
            abort_upload(video.s3_key, video.upload_id)
        except Exception:
            pass  # best-effort cleanup

    video.status = "cancelled"
    await db.flush()
    _upload_parts.pop(str(video_id), None)
    return {"status": "aborted"}


@router.get("/{video_id}", response_model=VideoResponse)
async def get_video(
    video_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve a single video by ID with a fresh pre-signed URL."""
    result = await db.execute(select(Video).where(Video.id == video_id))
    video = result.scalar_one_or_none()
    if video is None:
        raise HTTPException(404, "Video not found")

    playback_url = None
    if video.status == "ready" and video.s3_key:
        playback_url = get_presigned_url(video.s3_key)

    return VideoResponse(
        id=video.id,
        title=video.title,
        status=video.status,
        duration=video.duration,
        created_at=video.created_at,
        playback_url=playback_url,
    )


@router.get("/", response_model=VideoListResponse)
async def list_videos(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List all videos (newest first)."""
    count_result = await db.execute(select(sqlfunc.count(Video.id)))
    total = count_result.scalar() or 0

    result = await db.execute(
        select(Video).order_by(Video.created_at.desc()).limit(limit).offset(offset)
    )
    videos = result.scalars().all()

    items = []
    for v in videos:
        playback_url = None
        if v.status == "ready" and v.s3_key:
            playback_url = get_presigned_url(v.s3_key)
        items.append(
            VideoResponse(
                id=v.id,
                title=v.title,
                status=v.status,
                duration=v.duration,
                created_at=v.created_at,
                playback_url=playback_url,
            )
        )

    return VideoListResponse(videos=items, total=total)
