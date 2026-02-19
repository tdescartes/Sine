"""
Scene Markers router — v2 context-aware markers.

Markers are captured during recording (focus switches, visibility changes,
manual keystrokes) and stored as lightweight metadata. Viewers see them as
diamond-shaped timeline markers for quick navigation.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import SceneMarker, Video
from app.schemas import (
    SceneMarkerBatchCreate,
    SceneMarkerCreate,
    SceneMarkerResponse,
)

router = APIRouter(prefix="/markers", tags=["markers"])


# ─── Create a single marker ──────────────────────────────────────────────────

@router.post("/", response_model=SceneMarkerResponse, status_code=201)
async def create_marker(
    data: SceneMarkerCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a single scene marker during or after recording."""
    # Verify video exists
    video = await db.get(Video, data.video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    # Determine order (next sequential)
    result = await db.execute(
        select(SceneMarker)
        .where(SceneMarker.video_id == data.video_id)
        .order_by(SceneMarker.order.desc())
        .limit(1)
    )
    last = result.scalar_one_or_none()
    next_order = (last.order + 1) if last else 0

    marker = SceneMarker(
        video_id=data.video_id,
        timestamp=data.timestamp,
        label=data.label,
        source=data.source,
        order=next_order,
    )
    db.add(marker)
    await db.commit()
    await db.refresh(marker)
    return marker


# ─── Batch create markers (at recording completion) ──────────────────────────

@router.post("/batch", response_model=list[SceneMarkerResponse], status_code=201)
async def create_markers_batch(
    data: SceneMarkerBatchCreate,
    db: AsyncSession = Depends(get_db),
):
    """Batch-create scene markers — typically called when recording ends."""
    video = await db.get(Video, data.video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    markers = []
    for i, m in enumerate(data.markers):
        marker = SceneMarker(
            video_id=data.video_id,
            timestamp=m.timestamp,
            label=m.label,
            source=m.source,
            order=i,
        )
        db.add(marker)
        markers.append(marker)

    await db.commit()
    for marker in markers:
        await db.refresh(marker)

    return markers


# ─── List markers for a video ────────────────────────────────────────────────

@router.get("/video/{video_id}", response_model=list[SceneMarkerResponse])
async def list_markers(
    video_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get all scene markers for a video, ordered by timestamp."""
    result = await db.execute(
        select(SceneMarker)
        .where(SceneMarker.video_id == video_id)
        .order_by(SceneMarker.timestamp)
    )
    return result.scalars().all()


# ─── Delete a marker ─────────────────────────────────────────────────────────

@router.delete("/{marker_id}", status_code=204)
async def delete_marker(
    marker_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a single scene marker."""
    marker = await db.get(SceneMarker, marker_id)
    if not marker:
        raise HTTPException(status_code=404, detail="Marker not found")
    await db.delete(marker)
    await db.commit()
