"""S3 Multipart Upload utility — streaming, zero-buffer architecture.

This module provides the core "Stream-to-Upload" logic:
  1. initiate_upload()   → Creates an S3 multipart upload
  2. upload_chunk()      → Streams a single chunk (part) to S3
  3. complete_upload()   → Finalises the multipart upload
  4. abort_upload()      → Cleans up on failure
  5. get_presigned_url() → Generates a time-limited playback URL
"""

from __future__ import annotations

import uuid
from typing import Optional

import boto3
from botocore.config import Config as BotoConfig

from app.config import get_settings

_client = None


def _get_s3_client():
    """Lazy-initialised, reusable S3 client."""
    global _client
    if _client is None:
        settings = get_settings()
        _client = boto3.client(
            "s3",
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            region_name=settings.aws_region,
            config=BotoConfig(
                signature_version="s3v4",
                retries={"max_attempts": 3, "mode": "adaptive"},
            ),
        )
    return _client


def generate_s3_key(video_id: str, extension: str = "webm") -> str:
    """Produce a unique S3 object key for a video."""
    return f"videos/{video_id}/{uuid.uuid4().hex}.{extension}"


def initiate_upload(s3_key: str) -> str:
    """Start a multipart upload; return the UploadId."""
    settings = get_settings()
    client = _get_s3_client()
    response = client.create_multipart_upload(
        Bucket=settings.s3_bucket_name,
        Key=s3_key,
        ContentType="video/webm",
    )
    return response["UploadId"]


def upload_chunk(
    s3_key: str,
    upload_id: str,
    part_number: int,
    data: bytes,
) -> dict:
    """Upload a single part to S3. Returns {"ETag": ..., "PartNumber": ...}."""
    settings = get_settings()
    client = _get_s3_client()
    response = client.upload_part(
        Bucket=settings.s3_bucket_name,
        Key=s3_key,
        UploadId=upload_id,
        PartNumber=part_number,
        Body=data,
    )
    return {"ETag": response["ETag"], "PartNumber": part_number}


def complete_upload(s3_key: str, upload_id: str, parts: list[dict]) -> str:
    """Finalise the multipart upload. Returns the S3 object location."""
    settings = get_settings()
    client = _get_s3_client()
    # Parts must be sorted by PartNumber
    sorted_parts = sorted(parts, key=lambda p: p["PartNumber"])
    response = client.complete_multipart_upload(
        Bucket=settings.s3_bucket_name,
        Key=s3_key,
        UploadId=upload_id,
        MultipartUpload={"Parts": sorted_parts},
    )
    return response.get("Location", s3_key)


def abort_upload(s3_key: str, upload_id: str) -> None:
    """Cancel a multipart upload and remove any uploaded parts."""
    settings = get_settings()
    client = _get_s3_client()
    client.abort_multipart_upload(
        Bucket=settings.s3_bucket_name,
        Key=s3_key,
        UploadId=upload_id,
    )


def get_presigned_url(s3_key: str, expiry: Optional[int] = None) -> str:
    """Generate a pre-signed GET URL for secure playback."""
    settings = get_settings()
    client = _get_s3_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_bucket_name, "Key": s3_key},
        ExpiresIn=expiry or settings.presigned_url_expiry,
    )
