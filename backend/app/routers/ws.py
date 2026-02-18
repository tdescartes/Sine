"""WebSocket endpoint for real-time chunk ingestion.

Protocol (binary frames with JSON control messages):
  1. Client connects to  ws://.../ws/upload/{video_id}
  2. Client sends binary frames (video chunks)
  3. Server streams each frame directly to S3 (upload_part)
  4. Client sends JSON  {"action": "complete", "duration": 42.5}  to finalise
  5. Server responds with  {"status": "ready", "playback_url": "..."}
"""

from __future__ import annotations

import json
import uuid
from typing import Any

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models import Video
from app.s3 import complete_upload, get_presigned_url, upload_chunk

router = APIRouter()


@router.websocket("/ws/upload/{video_id}")
async def ws_upload(websocket: WebSocket, video_id: uuid.UUID):
    """Accept streaming binary chunks over WebSocket and push to S3."""
    await websocket.accept()

    # Load video record
    async with async_session() as db:
        result = await db.execute(select(Video).where(Video.id == video_id))
        video = result.scalar_one_or_none()

        if video is None or video.status != "recording":
            await websocket.close(code=4000, reason="Invalid video or state")
            return

        s3_key = video.s3_key
        upload_id = video.upload_id

    part_number = 1
    parts: list[dict[str, Any]] = []

    try:
        while True:
            message = await websocket.receive()

            # Binary frame → upload chunk to S3
            if "bytes" in message and message["bytes"]:
                data = message["bytes"]
                part = upload_chunk(s3_key, upload_id, part_number, data)
                parts.append(part)

                await websocket.send_json(
                    {"event": "chunk_ack", "part_number": part_number}
                )
                part_number += 1

            # Text frame → control message
            elif "text" in message and message["text"]:
                try:
                    payload = json.loads(message["text"])
                except json.JSONDecodeError:
                    await websocket.send_json({"error": "Invalid JSON"})
                    continue

                action = payload.get("action")

                if action == "complete":
                    if not parts:
                        await websocket.send_json({"error": "No chunks uploaded"})
                        continue

                    complete_upload(s3_key, upload_id, parts)

                    duration = payload.get("duration")

                    async with async_session() as db:
                        result = await db.execute(
                            select(Video).where(Video.id == video_id)
                        )
                        video = result.scalar_one_or_none()
                        if video:
                            video.status = "ready"
                            video.duration = duration
                            await db.commit()

                    playback_url = get_presigned_url(s3_key)
                    await websocket.send_json(
                        {
                            "event": "complete",
                            "status": "ready",
                            "playback_url": playback_url,
                        }
                    )
                    await websocket.close()
                    return

                elif action == "ping":
                    await websocket.send_json({"event": "pong"})

    except WebSocketDisconnect:
        # Client disconnected — parts remain in S3 for potential resume
        pass
