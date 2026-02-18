# Project Specification: Sine — VideoFlow (Innovative Video Messaging)

## 1. Vision & Goals

A high-performance video recording and sharing application inspired by Loom but optimized for speed and automated documentation.

* **Key Innovation:** "Stream-to-Upload" architecture using chunked uploads.
* **Unique Feature:** Auto-Documentation (OCR-based step extraction from video).

## 2. Tech Stack

* **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, MediaRecorder API.
* **Backend:** FastAPI (Python 3.10+), `python-multipart`.
* **Storage:** AWS S3 (Multipart Uploads).
* **Database:** PostgreSQL (via SQLAlchemy).
* **Real-time:** WebSockets for chunk ingestion.

## 3. Architecture & Data Flow

### A. Stream-to-Upload (The "Magic")

1. **Client:** Captures video chunks every 3 seconds using `MediaRecorder.ondataavailable`.
2. **Transport:** Sends chunks to FastAPI via WebSocket (preferred) or sequential POST requests.
3. **Server:** Receives chunk → Passes immediately to **S3 Multipart Upload** (`upload_part`).
4. **Finalization:** When recording stops, client sends a "finish" signal. Server calls S3 `complete_multipart_upload`.

### B. Interactive Metadata Layer

A React overlay sitting on top of the `<video>` element.

* **State:** Synchronized with `video.currentTime`.
* **Persistence:** JSON metadata stored in PostgreSQL linked by `timestamp` (seconds).

## 4. Database Schema (PostgreSQL)

```sql
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  s3_key TEXT UNIQUE,
  status TEXT DEFAULT 'processing',
  duration FLOAT,
  upload_id TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE annotations (
  id SERIAL PRIMARY KEY,
  video_id UUID REFERENCES videos(id),
  timestamp FLOAT NOT NULL,
  content TEXT,
  type TEXT DEFAULT 'comment',
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 5. Implementation Phases

### Phase 1: Infrastructure & API
### Phase 2: Frontend Recorder
### Phase 3: Interactive Player
### Phase 4: Auto-Doc Innovation (OCR)

## 6. Constraints

* **No Buffering:** Do not load entire files into memory on the server.
* **TypeScript:** Strict mode enabled.
* **Security:** Use S3 Pre-signed URLs for playback.
