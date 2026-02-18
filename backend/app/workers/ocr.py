"""OCR auto-documentation worker.

Extracts keyframes from a completed video, runs OCR on each frame,
and saves the results as annotations with type='ocr_step'.
"""

from __future__ import annotations

import io
import tempfile
import uuid
from pathlib import Path

from app.config import get_settings
from app.s3 import _get_s3_client

# Lazy imports — these are heavy and only needed when processing
_cv2 = None
_pytesseract = None
_Image = None


def _lazy_imports():
    global _cv2, _pytesseract, _Image
    if _cv2 is None:
        import cv2
        import pytesseract
        from PIL import Image

        _cv2 = cv2
        _pytesseract = pytesseract
        _Image = Image


def download_video_to_temp(s3_key: str) -> Path:
    """Download a video from S3 to a temporary file."""
    settings = get_settings()
    client = _get_s3_client()
    tmp = tempfile.NamedTemporaryFile(suffix=".webm", delete=False)
    client.download_fileobj(settings.s3_bucket_name, s3_key, tmp)
    tmp.close()
    return Path(tmp.name)


def extract_keyframes(video_path: Path, interval_seconds: float = 5.0) -> list[bytes]:
    """Extract frames from a video at the given interval.

    Returns a list of PNG-encoded frame bytes.
    """
    _lazy_imports()
    cv2 = _cv2

    cap = cv2.VideoCapture(str(video_path))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frame_interval = int(fps * interval_seconds)

    frames: list[bytes] = []
    frame_idx = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if frame_idx % frame_interval == 0:
            _, buf = cv2.imencode(".png", frame)
            frames.append(buf.tobytes())
        frame_idx += 1

    cap.release()
    return frames


def run_ocr_on_frame(frame_bytes: bytes) -> str:
    """Run Tesseract OCR on a single PNG frame."""
    _lazy_imports()
    img = _Image.open(io.BytesIO(frame_bytes))
    text: str = _pytesseract.image_to_string(img)
    return text.strip()


def process_video_ocr(
    s3_key: str,
    video_id: uuid.UUID,
    interval_seconds: float = 5.0,
) -> list[dict]:
    """Full OCR pipeline: download → extract keyframes → OCR → return annotations.

    Returns a list of dicts ready to be inserted as Annotation rows:
        [{"video_id": ..., "timestamp": 5.0, "content": "...", "type": "ocr_step"}, ...]
    """
    video_path = download_video_to_temp(s3_key)

    try:
        frames = extract_keyframes(video_path, interval_seconds)
        annotations = []

        for idx, frame_bytes in enumerate(frames):
            timestamp = idx * interval_seconds
            text = run_ocr_on_frame(frame_bytes)
            if text:
                annotations.append(
                    {
                        "video_id": video_id,
                        "timestamp": timestamp,
                        "content": text,
                        "type": "ocr_step",
                    }
                )
        return annotations
    finally:
        video_path.unlink(missing_ok=True)
