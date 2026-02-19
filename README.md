# Sine v2 — Intelligent Video Capture

High-performance video recording and sharing with **QUIC-ready transport**, **AV1 encoding**, **instant metadata trimming**, and **context-aware scene markers**.

Record → chunks stream to S3 in real-time → zero upload wait → instant playback.

---

## What's New in v2

| Innovation              | Description                                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| **WebTransport / QUIC** | Transport abstraction: tries WebTransport first, falls back to WebSocket. Multiplexed streams, 0-RTT reconnect. |
| **AV1 Codec**           | Negotiates AV1 → VP9 → VP8 automatically. ~30% better compression at equal quality.                             |
| **Instant Trimming**    | Metadata-based trim (no re-encoding). "Smart Stop" auto-trims 1.5s of dead air.                                 |
| **Scene Markers**       | Detects window focus switches during recording. Diamond markers on the player timeline act as chapters.         |

---

## Architecture

```
┌─────────────────┐    WebTransport (QUIC)     ┌──────────────┐       S3 Multipart
│  Next.js Client │  ══════════════════════▶   │  FastAPI API  │  ─────────────────▶  AWS S3
│  (MediaRecorder) │  ─── WebSocket fallback ─▶ │  (Python)     │  upload_part()
│  AV1 / VP9 codec│                             └──────┬───────┘
└─────────────────┘                                    │
                                                       ▼
                                                ┌──────────────┐
                                                │  PostgreSQL   │
                                                │  videos       │
                                                │  annotations  │
                                                │  scene_markers│
                                                └──────────────┘
```

## Tech Stack

| Layer     | Technology                                        |
| --------- | ------------------------------------------------- |
| Frontend  | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Backend   | FastAPI, Python 3.10+, SQLAlchemy 2.0 async       |
| Storage   | AWS S3 (Multipart Uploads)                        |
| Database  | PostgreSQL 16                                     |
| Transport | WebTransport (QUIC) with WebSocket fallback       |
| Codec     | AV1 → VP9 → VP8 (auto-negotiation)                |

## Key Features

- **Stream-to-Upload** — video chunks upload to S3 while you record, no upload wait
- **QUIC-Ready Transport** — `SineTransport` abstraction with automatic WebSocket fallback
- **AV1 Encoding** — best-in-class compression with graceful degradation
- **Smart Stop** — auto-trims 1.5s of dead air when you stop recording
- **Metadata Trimming** — instant, reversible trim via PATCH endpoint (zero re-encoding)
- **Scene Markers** — auto-detected from window focus changes, displayed as timeline chapters
- **Interactive Player** — custom controls, trim bounds, annotation bubbles, scene diamonds
- **Pre-signed URLs** — secure, time-limited playback without public S3 buckets

---

## Quick Start

### Prerequisites

- **Node.js** 18+ and **npm**
- **Python** 3.10+
- **Docker** (for PostgreSQL and optional LocalStack)
- **AWS credentials** (or use LocalStack for local dev)

### 1. Start infrastructure

```bash
docker compose up -d
```

This starts PostgreSQL on port 5432 and LocalStack (S3 emulation) on port 4566.

### 2. Backend setup

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate       # Windows
# source venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
copy .env.example .env      # Windows
# cp .env.example .env      # macOS/Linux
# Edit .env with your AWS credentials (or LocalStack defaults)

# Run database migrations
alembic upgrade head

# Start the API server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Frontend setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## Using LocalStack (Local S3)

If you don't have AWS credentials, use LocalStack for local S3 emulation:

1. Set these values in `backend/.env`:

   ```
   AWS_ACCESS_KEY_ID=test
   AWS_SECRET_ACCESS_KEY=test
   AWS_REGION=us-east-1
   S3_BUCKET_NAME=sine-videos
   ```

2. Create the bucket:
   ```bash
   aws --endpoint-url=http://localhost:4566 s3 mb s3://sine-videos
   ```

---

## API Endpoints

### Video

| Method | Path                      | Description                               |
| ------ | ------------------------- | ----------------------------------------- |
| POST   | `/video/start`            | Start a new recording (accepts codec)     |
| POST   | `/video/chunk/{video_id}` | Upload a chunk (REST fallback)            |
| POST   | `/video/complete`         | Finalize upload (Smart Stop trim_end)     |
| POST   | `/video/abort/{video_id}` | Cancel recording                          |
| PATCH  | `/video/{video_id}/trim`  | **v2:** Update trim bounds (no re-encode) |
| GET    | `/video/{video_id}`       | Get video details + playback URL          |
| GET    | `/video/`                 | List all videos                           |

### Annotations

| Method | Path                            | Description            |
| ------ | ------------------------------- | ---------------------- |
| POST   | `/annotations/`                 | Create annotation      |
| GET    | `/annotations/video/{video_id}` | List video annotations |
| DELETE | `/annotations/{id}`             | Delete annotation      |

### Scene Markers (v2)

| Method | Path                        | Description              |
| ------ | --------------------------- | ------------------------ |
| POST   | `/markers/`                 | Create a scene marker    |
| POST   | `/markers/batch`            | Batch create markers     |
| GET    | `/markers/video/{video_id}` | List markers for a video |
| DELETE | `/markers/{id}`             | Delete a marker          |

### WebSocket

| Path                          | Description                                      |
| ----------------------------- | ------------------------------------------------ |
| `ws://…/ws/upload/{video_id}` | Binary chunks + JSON control (markers, complete) |

---

## Project Structure

```
Sine/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI entry point
│   │   ├── config.py         # Settings from .env
│   │   ├── database.py       # SQLAlchemy async engine
│   │   ├── models.py         # ORM models (Video, Annotation)
│   │   ├── schemas.py        # Pydantic request/response schemas
│   │   ├── s3.py             # S3 multipart upload utility
│   │   ├── routers/
│   │   │   ├── video.py      # Video REST endpoints
│   │   │   ├── annotations.py
│   │   │   └── ws.py         # WebSocket chunk ingestion
│   ├── alembic/              # Database migrations
│   ├── alembic.ini
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx      # Video library (home)
│   │   │   ├── record/page.tsx
│   │   │   └── watch/[id]/page.tsx
│   │   ├── components/
│   │   │   ├── VideoRecorder.tsx
│   │   │   ├── VideoPlayer.tsx
│   │   │   └── VideoCard.tsx
│   │   ├── hooks/
│   │   │   └── useRecorder.ts  # MediaRecorder + chunking
│   │   └── lib/
│   │       ├── api.ts          # Typed API client
│   │       └── utils.ts
│   ├── tailwind.config.js
│   └── package.json
├── docker-compose.yml
├── SPEC.md
└── README.md
```

---

## License

See [LICENSE](LICENSE).
