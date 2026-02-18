"""Background task: trigger OCR processing when a video becomes ready."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session, get_db
from app.models import Annotation, Video
from app.workers.ocr import process_video_ocr

router = APIRouter(prefix="/ocr", tags=["ocr"])


async def _run_ocr_task(video_id: uuid.UUID, s3_key: str) -> None:
    """Background task — runs OCR and saves annotations."""
    annotations = process_video_ocr(s3_key, video_id)

    async with async_session() as db:
        for ann_data in annotations:
            db.add(Annotation(**ann_data))
        await db.commit()


@router.post("/process/{video_id}")
async def trigger_ocr(
    video_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Manually trigger OCR processing for a video."""
    result = await db.execute(select(Video).where(Video.id == video_id))
    video = result.scalar_one_or_none()
    if video is None:
        raise HTTPException(404, "Video not found")
    if video.status != "ready":
        raise HTTPException(400, "Video must be in 'ready' state for OCR")

    background_tasks.add_task(_run_ocr_task, video.id, video.s3_key)
    return {"status": "ocr_queued", "video_id": str(video_id)}
