"""Pydantic schemas for request/response serialisation."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ─── Video ────────────────────────────────────────────────────────────────────


class VideoStartRequest(BaseModel):
    title: Optional[str] = None


class VideoStartResponse(BaseModel):
    video_id: uuid.UUID
    upload_id: str
    s3_key: str


class VideoCompleteRequest(BaseModel):
    video_id: uuid.UUID
    duration: Optional[float] = None


class VideoResponse(BaseModel):
    id: uuid.UUID
    title: Optional[str]
    status: str
    duration: Optional[float]
    created_at: datetime
    playback_url: Optional[str] = None

    model_config = {"from_attributes": True}


class VideoListResponse(BaseModel):
    videos: list[VideoResponse]
    total: int


# ─── Annotation ───────────────────────────────────────────────────────────────


class AnnotationCreate(BaseModel):
    video_id: uuid.UUID
    timestamp: float = Field(..., ge=0, description="Time in video (seconds)")
    content: str
    type: str = "comment"


class AnnotationResponse(BaseModel):
    id: int
    video_id: uuid.UUID
    timestamp: float
    content: Optional[str]
    type: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Chunk (REST fallback) ────────────────────────────────────────────────────


class ChunkUploadResponse(BaseModel):
    part_number: int
    etag: str
