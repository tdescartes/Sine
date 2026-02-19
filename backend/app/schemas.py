"""
Pydantic schemas for request/response serialisation — Sine v2.

New in v2:
  - VideoResponse includes codec, trim_start, trim_end
  - TrimUpdateRequest for metadata-based instant trimming
  - SceneMarkerCreate / SceneMarkerResponse for context-aware markers
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ─── Video ────────────────────────────────────────────────────────────────────


class VideoStartRequest(BaseModel):
    title: Optional[str] = None
    codec: Optional[str] = None  # v2: negotiated codec (av1, vp9, vp8)


class VideoStartResponse(BaseModel):
    video_id: uuid.UUID
    upload_id: str
    s3_key: str


class VideoCompleteRequest(BaseModel):
    video_id: uuid.UUID
    duration: Optional[float] = None
    trim_end: Optional[float] = None  # v2: smart-stop auto-trim


class VideoResponse(BaseModel):
    id: uuid.UUID
    title: Optional[str]
    status: str
    duration: Optional[float]
    codec: Optional[str] = None
    trim_start: Optional[float] = None
    trim_end: Optional[float] = None
    created_at: datetime
    playback_url: Optional[str] = None

    model_config = {"from_attributes": True}


class VideoListResponse(BaseModel):
    videos: list[VideoResponse]
    total: int


class TrimUpdateRequest(BaseModel):
    """Metadata-only trim — no re-encoding required."""
    trim_start: Optional[float] = Field(None, ge=0)
    trim_end: Optional[float] = Field(None, ge=0)


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


# ─── Scene Markers (v2) ──────────────────────────────────────────────────────


class SceneMarkerCreate(BaseModel):
    video_id: uuid.UUID
    timestamp: float = Field(..., ge=0)
    label: str = Field(..., max_length=128)
    source: str = Field("focus_switch", pattern=r"^(focus_switch|visibility|manual)$")


class SceneMarkerBatchCreate(BaseModel):
    """Batch-create markers at recording completion."""
    video_id: uuid.UUID
    markers: list[SceneMarkerCreate]


class SceneMarkerResponse(BaseModel):
    id: int
    video_id: uuid.UUID
    timestamp: float
    label: str
    source: str
    order: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Chunk (REST fallback) ────────────────────────────────────────────────────


class ChunkUploadResponse(BaseModel):
    part_number: int
    etag: str
