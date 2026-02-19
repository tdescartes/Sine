# Project Specification: Sine v2 — Intelligent Video Capture

## 1. Vision & Goals

Sine shifts from a Loom clone to a **differentiated product** built on four innovations:  
_Intelligent Capture_ and _Network Resilience_ make recordings smarter, faster, and easier to navigate.

### Four Pillars

| #   | Innovation                                      | Why it matters                                                 |
| --- | ----------------------------------------------- | -------------------------------------------------------------- |
| A   | **WebTransport over QUIC** (WebSocket fallback) | Multiplexed streams, 0-RTT reconnect, no head-of-line blocking |
| B   | **AV1 codec negotiation** (→VP9→VP8 fallback)   | ~30% better compression at equal quality                       |
| C   | **Metadata-based Instant Trimming**             | Zero re-encoding — trim boundaries stored as metadata          |
| D   | **Context-Aware Scene Markers**                 | Auto-detect window focus switches → navigable chapters         |

## 2. Tech Stack

- **Frontend:** Next.js 14 (App Router), TypeScript strict, Tailwind CSS, MediaRecorder API, WebTransport API
- **Backend:** FastAPI (Python 3.10+), SQLAlchemy 2.0 async, Pydantic v2
- **Storage:** AWS S3 (Multipart Uploads), CloudFront CDN (production)
- **Database:** PostgreSQL 16 (via asyncpg)
- **Real-time:** WebSocket chunk ingestion (WebTransport-ready transport abstraction)

## 3. Architecture & Data Flow

### A. Transport Layer (QUIC-Ready)

```
Browser  ──  WebTransport (QUIC)  ──▶  Server
         └─  WebSocket (fallback) ──▶  Server
```

`SineTransport` abstraction (frontend/src/lib/transport.ts):

- Tries `new WebTransport(url)` first
- Falls back to `new WebSocket(url)` automatically
- Unified `send(data)`, `sendJSON(obj)`, `close()`, `onMessage` API

### B. Codec Negotiation

`negotiateCodec()` (frontend/src/lib/codec.ts):

1. `video/webm;codecs=av01.0.08M.08` (AV1)
2. `video/webm;codecs=vp9` (VP9)
3. `video/webm` (VP8 fallback)

Selected codec reported to server at `/video/start` for correct MIME storage.

### C. Stream-to-Upload (The "Magic")

1. **Client:** Captures video chunks every 3s via `MediaRecorder.ondataavailable`
2. **Transport:** Sends binary chunks via `SineTransport` (QUIC or WebSocket)
3. **Server:** Receives chunk → pushes to S3 `upload_part()`
4. **Finalization:** Client sends `{action: "complete"}` → server calls `complete_multipart_upload`

### D. Smart Stop & Metadata Trimming

- **Smart Stop:** When user clicks stop, `trim_end = duration - 1.5s` auto-trims dead air
- **Player:** Reads `trim_start` / `trim_end` from video metadata, constrains playback bounds
- **PATCH /video/{id}/trim:** Updates trim boundaries — instant, reversible, zero compute

### E. Context-Aware Scene Markers

During recording, the client listens for:

- `window.onfocus` / `window.onblur` → "Switched to [app]"
- `document.visibilitychange` → "Tab hidden/visible"
- Manual hotkey press → custom label

Each event sends `{action: "marker", timestamp, label, source}` to the server.  
The player renders them as **diamond-shaped markers** on the timeline.

## 4. Database Schema (PostgreSQL)

```sql
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  s3_key TEXT UNIQUE,
  status TEXT DEFAULT 'recording',
  duration FLOAT,
  upload_id TEXT,
  codec VARCHAR(32),           -- v2: negotiated codec
  trim_start FLOAT,            -- v2: metadata trim
  trim_end FLOAT,              -- v2: metadata trim / smart stop
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE annotations (
  id SERIAL PRIMARY KEY,
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  timestamp FLOAT NOT NULL,
  content TEXT,
  type VARCHAR(32) DEFAULT 'comment',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE scene_markers (   -- v2: new table
  id SERIAL PRIMARY KEY,
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  timestamp FLOAT NOT NULL,
  label VARCHAR(128) NOT NULL,
  source VARCHAR(32) DEFAULT 'focus_switch',
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 5. Implementation Phases

### Phase 1: Infrastructure & API ✅

### Phase 2: Frontend Recorder ✅

### Phase 3: Interactive Player ✅

### Phase 4: v2 Innovations ✅

- WebTransport/QUIC transport abstraction with WebSocket fallback
- AV1 codec negotiation
- Metadata-based instant trimming + Smart Stop
- Context-aware scene markers with auto-detection

## 6. Constraints

- **No Buffering:** Do not load entire files into memory on the server
- **No Re-encoding:** Trim is metadata-only, never re-encode on the server
- **TypeScript:** Strict mode enabled
- **Security:** Use S3 Pre-signed URLs for playback
- **Graceful Degradation:** Every innovation has a fallback (QUIC→WS, AV1→VP9→VP8)
- **Layout Stability:** Visual design and color palette remain consistent across versions
