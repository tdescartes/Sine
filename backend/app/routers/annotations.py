"""Annotations REST API — CRUD for video annotations/comments."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Annotation, Video
from app.schemas import AnnotationCreate, AnnotationResponse

router = APIRouter(prefix="/annotations", tags=["annotations"])


@router.post("/", response_model=AnnotationResponse, status_code=201)
async def create_annotation(
    body: AnnotationCreate,
    db: AsyncSession = Depends(get_db),
):
    """Add a comment / annotation at a specific timestamp in a video."""
    # Verify video exists
    result = await db.execute(select(Video).where(Video.id == body.video_id))
    video = result.scalar_one_or_none()
    if video is None:
        raise HTTPException(404, "Video not found")

    annotation = Annotation(
        video_id=body.video_id,
        timestamp=body.timestamp,
        content=body.content,
        type=body.type,
    )
    db.add(annotation)
    await db.flush()
    await db.refresh(annotation)

    return AnnotationResponse.model_validate(annotation)


@router.get("/video/{video_id}", response_model=list[AnnotationResponse])
async def list_annotations(
    video_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get all annotations for a video, ordered by timestamp."""
    result = await db.execute(
        select(Annotation)
        .where(Annotation.video_id == video_id)
        .order_by(Annotation.timestamp)
    )
    annotations = result.scalars().all()
    return [AnnotationResponse.model_validate(a) for a in annotations]


@router.delete("/{annotation_id}", status_code=204)
async def delete_annotation(
    annotation_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a single annotation."""
    result = await db.execute(
        select(Annotation).where(Annotation.id == annotation_id)
    )
    annotation = result.scalar_one_or_none()
    if annotation is None:
        raise HTTPException(404, "Annotation not found")

    await db.delete(annotation)
    await db.flush()
