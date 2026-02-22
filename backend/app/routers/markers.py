"""
Scene Markers router — v2 context-aware markers.

Markers are captured during recording (focus switches, visibility changes,
manual keystrokes) and stored as lightweight metadata. Viewers see them as
diamond-shaped timeline markers for quick navigation.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database import get_db
from app.models import SCENE_MARKERS_COLLECTION, VIDEOS_COLLECTION
from app.schemas import (
    SceneMarkerBatchCreate,
    SceneMarkerCreate,
    SceneMarkerResponse,
)

router = APIRouter(prefix="/markers", tags=["markers"])


def _doc_to_response(doc: dict) -> SceneMarkerResponse:
    return SceneMarkerResponse(
        id=str(doc["_id"]),
        video_id=uuid.UUID(doc["video_id"]),
        timestamp=doc["timestamp"],
        label=doc["label"],
        source=doc.get("source", "focus_switch"),
        order=doc.get("order", 0),
        created_at=doc["created_at"],
    )


@router.post("/", response_model=SceneMarkerResponse, status_code=201)
async def create_marker(
    data: SceneMarkerCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Create a single scene marker during or after recording."""
    video = await db[VIDEOS_COLLECTION].find_one({"_id": str(data.video_id)})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    last = await (
        db[SCENE_MARKERS_COLLECTION]
        .find({"video_id": str(data.video_id)})
        .sort("order", -1)
        .limit(1)
        .to_list(length=1)
    )
    next_order = (last[0]["order"] + 1) if last else 0

    doc = {
        "video_id": str(data.video_id),
        "timestamp": data.timestamp,
        "label": data.label,
        "source": data.source,
        "order": next_order,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db[SCENE_MARKERS_COLLECTION].insert_one(doc)
    created = await db[SCENE_MARKERS_COLLECTION].find_one({"_id": result.inserted_id})
    return _doc_to_response(created)


@router.post("/batch", response_model=list[SceneMarkerResponse], status_code=201)
async def create_markers_batch(
    data: SceneMarkerBatchCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Batch-create scene markers — typically called when recording ends."""
    video = await db[VIDEOS_COLLECTION].find_one({"_id": str(data.video_id)})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    docs = [
        {
            "video_id": str(data.video_id),
            "timestamp": m.timestamp,
            "label": m.label,
            "source": m.source,
            "order": i,
            "created_at": datetime.now(timezone.utc),
        }
        for i, m in enumerate(data.markers)
    ]
    result = await db[SCENE_MARKERS_COLLECTION].insert_many(docs)
    created = await (
        db[SCENE_MARKERS_COLLECTION]
        .find({"_id": {"$in": result.inserted_ids}})
        .sort("order", 1)
        .to_list(length=None)
    )
    return [_doc_to_response(d) for d in created]


@router.get("/video/{video_id}", response_model=list[SceneMarkerResponse])
async def list_markers(
    video_id: uuid.UUID,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get all scene markers for a video, ordered by timestamp."""
    docs = await (
        db[SCENE_MARKERS_COLLECTION]
        .find({"video_id": str(video_id)})
        .sort("timestamp", 1)
        .to_list(length=None)
    )
    return [_doc_to_response(d) for d in docs]


@router.delete("/{marker_id}", status_code=204)
async def delete_marker(
    marker_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Delete a single scene marker."""
    try:
        oid = ObjectId(marker_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Marker not found")

    result = await db[SCENE_MARKERS_COLLECTION].delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Marker not found")



