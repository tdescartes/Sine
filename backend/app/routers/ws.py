"""
WebSocket endpoint for real-time chunk ingestion — Sine v2.

Protocol (binary frames with JSON control messages):
  1. Client connects to  ws://.../ws/upload/{video_id}
  2. Client sends binary frames (video chunks)
  3. Server streams each frame directly to S3 (upload_part)
  4. Client sends JSON  {"action": "complete", "duration": 42.5}  to finalise
  5. Client sends JSON  {"action": "marker", ...}  to record a scene marker
  6. Server responds with  {"status": "ready", "playback_url": "..."}

v2 additions:
  - "marker" action → stores SceneMarker during recording
  - "complete" accepts optional trim_end for Smart Stop
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.database import get_database
from app.models import SCENE_MARKERS_COLLECTION, VIDEOS_COLLECTION
from app.s3 import complete_upload, get_presigned_url, upload_chunk

router = APIRouter()


@router.websocket("/ws/upload/{video_id}")
async def ws_upload(websocket: WebSocket, video_id: uuid.UUID):
    """Accept streaming binary chunks over WebSocket and push to S3."""
    await websocket.accept()

    db = get_database()

    doc = await db[VIDEOS_COLLECTION].find_one({"_id": str(video_id)})
    if doc is None or doc["status"] != "recording":
        await websocket.close(code=4000, reason="Invalid video or state")
        return

    s3_key = doc["s3_key"]
    upload_id = doc["upload_id"]

    part_number = 1
    parts: list[dict[str, Any]] = []
    marker_order = 0

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

                # ── Scene Marker (v2) ───────────────────────────
                if action == "marker":
                    timestamp = payload.get("timestamp", 0)
                    label = payload.get("label", "Scene change")
                    source = payload.get("source", "focus_switch")

                    await db[SCENE_MARKERS_COLLECTION].insert_one({
                        "video_id": str(video_id),
                        "timestamp": timestamp,
                        "label": label,
                        "source": source,
                        "order": marker_order,
                        "created_at": datetime.now(timezone.utc),
                    })
                    marker_order += 1

                    await websocket.send_json(
                        {"event": "marker_ack", "timestamp": timestamp, "label": label}
                    )

                # ── Complete Recording ──────────────────────────
                elif action == "complete":
                    if not parts:
                        await websocket.send_json({"error": "No chunks uploaded"})
                        continue

                    complete_upload(s3_key, upload_id, parts)

                    duration = payload.get("duration")
                    trim_end = payload.get("trim_end")  # v2: Smart Stop

                    update: dict = {"status": "ready", "duration": duration}
                    if trim_end is not None:
                        update["trim_end"] = trim_end

                    await db[VIDEOS_COLLECTION].update_one(
                        {"_id": str(video_id)}, {"$set": update}
                    )

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
    marker_order = 0

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

                # ── Scene Marker (v2) ──────────────────────────────────
                if action == "marker":
                    timestamp = payload.get("timestamp", 0)
                    label = payload.get("label", "Scene change")
                    source = payload.get("source", "focus_switch")

                    async with async_session() as db:
                        marker = SceneMarker(
                            video_id=video_id,
                            timestamp=timestamp,
                            label=label,
                            source=source,
                            order=marker_order,
                        )
                        db.add(marker)
                        await db.commit()
                        marker_order += 1

                    await websocket.send_json(
                        {"event": "marker_ack", "timestamp": timestamp, "label": label}
                    )

                # ── Complete Recording ─────────────────────────────────
                elif action == "complete":
                    if not parts:
                        await websocket.send_json({"error": "No chunks uploaded"})
                        continue

                    complete_upload(s3_key, upload_id, parts)

                    duration = payload.get("duration")
                    trim_end = payload.get("trim_end")  # v2: Smart Stop

                    async with async_session() as db:
                        result = await db.execute(
                            select(Video).where(Video.id == video_id)
                        )
                        video = result.scalar_one_or_none()
                        if video:
                            video.status = "ready"
                            video.duration = duration
                            if trim_end is not None:
                                video.trim_end = trim_end
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
