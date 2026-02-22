"""Annotations REST API — CRUD for video annotations/comments."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database import get_db
from app.models import ANNOTATIONS_COLLECTION, VIDEOS_COLLECTION
from app.schemas import AnnotationCreate, AnnotationResponse

router = APIRouter(prefix="/annotations", tags=["annotations"])


def _doc_to_response(doc: dict) -> AnnotationResponse:
    return AnnotationResponse(
        id=str(doc["_id"]),
        video_id=uuid.UUID(doc["video_id"]),
        timestamp=doc["timestamp"],
        content=doc.get("content"),
        type=doc.get("type", "comment"),
        created_at=doc["created_at"],
    )


@router.post("/", response_model=AnnotationResponse, status_code=201)
async def create_annotation(
    body: AnnotationCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Add a comment / annotation at a specific timestamp in a video."""
    video = await db[VIDEOS_COLLECTION].find_one({"_id": str(body.video_id)})
    if video is None:
        raise HTTPException(404, "Video not found")

    doc = {
        "video_id": str(body.video_id),
        "timestamp": body.timestamp,
        "content": body.content,
        "type": body.type,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db[ANNOTATIONS_COLLECTION].insert_one(doc)
    created = await db[ANNOTATIONS_COLLECTION].find_one({"_id": result.inserted_id})
    return _doc_to_response(created)


@router.get("/video/{video_id}", response_model=list[AnnotationResponse])
async def list_annotations(
    video_id: uuid.UUID,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get all annotations for a video, ordered by timestamp."""
    cursor = (
        db[ANNOTATIONS_COLLECTION]
        .find({"video_id": str(video_id)})
        .sort("timestamp", 1)
    )
    docs = await cursor.to_list(length=None)
    return [_doc_to_response(d) for d in docs]


@router.delete("/{annotation_id}", status_code=204)
async def delete_annotation(
    annotation_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Delete a single annotation."""
    try:
        oid = ObjectId(annotation_id)
    except Exception:
        raise HTTPException(404, "Annotation not found")

    result = await db[ANNOTATIONS_COLLECTION].delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(404, "Annotation not found")

