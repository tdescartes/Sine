# Sine — VideoFlow

High-performance video recording and sharing with **stream-to-upload** architecture.  
Record → chunks stream to S3 in real-time → zero upload wait → instant playback.

---

## Architecture

```
┌─────────────────┐       WebSocket / REST        ┌──────────────┐       S3 Multipart
│  Next.js Client │  ──────────────────────────▶  │  FastAPI API  │  ─────────────────▶  AWS S3
│  (MediaRecorder) │  3s video chunks              │  (Python)     │  upload_part()
└─────────────────┘                                └──────┬───────┘
                                                          │
                                                          ▼
                                                   ┌──────────────┐
                                                   │  PostgreSQL   │
                                                   │  (videos +    │
                                                   │   annotations)│
                                                   └──────────────┘
```

## Tech Stack

| Layer     | Technology                                            |
|-----------|-------------------------------------------------------|
| Frontend  | Next.js 14 (App Router), TypeScript, Tailwind CSS     |
| Backend   | FastAPI, Python 3.10+, SQLAlchemy 2.0                 |
| Storage   | AWS S3 (Multipart Uploads)                            |
| Database  | PostgreSQL 16                                         |
| Real-time | WebSocket (chunk streaming)                           |
| OCR       | OpenCV + Tesseract (auto-documentation)               |

## Features

- **Stream-to-Upload** — video chunks upload to S3 while you record, no upload wait
- **WebSocket transport** — real-time binary chunk streaming with REST fallback
- **Interactive Player** — custom controls, timeline annotation bubbles, seek-to-comment
- **Auto-Documentation (OCR)** — extract text from screen recordings automatically
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

| Method | Path                        | Description                        |
|--------|-----------------------------|------------------------------------|
| POST   | `/video/start`              | Start a new recording              |
| POST   | `/video/chunk/{video_id}`   | Upload a chunk (REST fallback)     |
| POST   | `/video/complete`           | Finalize upload                    |
| POST   | `/video/abort/{video_id}`   | Cancel recording                   |
| GET    | `/video/{video_id}`         | Get video details + playback URL   |
| GET    | `/video/`                   | List all videos                    |

### Annotations

| Method | Path                              | Description              |
|--------|-----------------------------------|--------------------------|
| POST   | `/annotations/`                   | Create annotation        |
| GET    | `/annotations/video/{video_id}`   | List video annotations   |
| DELETE | `/annotations/{id}`               | Delete annotation        |

### OCR

| Method | Path                        | Description                    |
|--------|-----------------------------|--------------------------------|
| POST   | `/ocr/process/{video_id}`   | Trigger OCR auto-documentation |

### WebSocket

| Path                          | Description                        |
|-------------------------------|------------------------------------|
| `ws://…/ws/upload/{video_id}` | Real-time binary chunk streaming   |

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
│   │   │   ├── ocr.py        # OCR trigger endpoint
│   │   │   └── ws.py         # WebSocket chunk ingestion
│   │   └── workers/
│   │       └── ocr.py        # OCR processing pipeline
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