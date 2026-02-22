"""Sine — FastAPI application entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import get_database
from app.models import ANNOTATIONS_COLLECTION, SCENE_MARKERS_COLLECTION, VIDEOS_COLLECTION
from app.routers import annotations, markers, video, ws


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Ensure MongoDB indexes exist on startup."""
    db = get_database()
    await db[VIDEOS_COLLECTION].create_index("s3_key", unique=True, sparse=True)
    await db[ANNOTATIONS_COLLECTION].create_index([("video_id", 1), ("timestamp", 1)])
    await db[SCENE_MARKERS_COLLECTION].create_index([("video_id", 1), ("order", 1)])
    yield


settings = get_settings()

app = FastAPI(
    title="Sine — VideoFlow API",
    description="Intelligent video capture with QUIC-ready transport, AV1 encoding, metadata trimming, and context-aware scene markers.",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS — allow the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# REST routers
app.include_router(video.router)
app.include_router(annotations.router)
app.include_router(markers.router)

# WebSocket router
app.include_router(ws.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "sine-api"}
