/**
 * Sine API client — typed fetch wrappers for the FastAPI backend.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface VideoStartResponse {
  video_id: string;
  upload_id: string;
  s3_key: string;
}

export interface VideoResponse {
  id: string;
  title: string | null;
  status: string;
  duration: number | null;
  created_at: string;
  playback_url: string | null;
}

export interface VideoListResponse {
  videos: VideoResponse[];
  total: number;
}

export interface AnnotationResponse {
  id: number;
  video_id: string;
  timestamp: number;
  content: string | null;
  type: string;
  created_at: string;
}

export interface ChunkUploadResponse {
  part_number: number;
  etag: string;
}

// ─── Video API ──────────────────────────────────────────────────────────────

export async function startRecording(
  title?: string
): Promise<VideoStartResponse> {
  const res = await fetch(`${API_BASE}/video/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`Start recording failed: ${res.status}`);
  return res.json();
}

export async function uploadChunk(
  videoId: string,
  partNumber: number,
  chunk: Blob
): Promise<ChunkUploadResponse> {
  const form = new FormData();
  form.append("chunk", chunk);

  const res = await fetch(
    `${API_BASE}/video/chunk/${videoId}?part_number=${partNumber}`,
    { method: "POST", body: form }
  );
  if (!res.ok) throw new Error(`Chunk upload failed: ${res.status}`);
  return res.json();
}

export async function completeRecording(
  videoId: string,
  duration?: number
): Promise<VideoResponse> {
  const res = await fetch(`${API_BASE}/video/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ video_id: videoId, duration }),
  });
  if (!res.ok) throw new Error(`Complete recording failed: ${res.status}`);
  return res.json();
}

export async function abortRecording(videoId: string): Promise<void> {
  await fetch(`${API_BASE}/video/abort/${videoId}`, { method: "POST" });
}

export async function getVideo(videoId: string): Promise<VideoResponse> {
  const res = await fetch(`${API_BASE}/video/${videoId}`);
  if (!res.ok) throw new Error(`Get video failed: ${res.status}`);
  return res.json();
}

export async function listVideos(
  limit = 20,
  offset = 0
): Promise<VideoListResponse> {
  const res = await fetch(
    `${API_BASE}/video/?limit=${limit}&offset=${offset}`
  );
  if (!res.ok) throw new Error(`List videos failed: ${res.status}`);
  return res.json();
}

// ─── Annotations API ────────────────────────────────────────────────────────

export async function createAnnotation(data: {
  video_id: string;
  timestamp: number;
  content: string;
  type?: string;
}): Promise<AnnotationResponse> {
  const res = await fetch(`${API_BASE}/annotations/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Create annotation failed: ${res.status}`);
  return res.json();
}

export async function listAnnotations(
  videoId: string
): Promise<AnnotationResponse[]> {
  const res = await fetch(`${API_BASE}/annotations/video/${videoId}`);
  if (!res.ok) throw new Error(`List annotations failed: ${res.status}`);
  return res.json();
}

export async function deleteAnnotation(annotationId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/annotations/${annotationId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Delete annotation failed: ${res.status}`);
}

// ─── OCR ────────────────────────────────────────────────────────────────────

export async function triggerOcr(videoId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/ocr/process/${videoId}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`OCR trigger failed: ${res.status}`);
}

// ─── WebSocket ──────────────────────────────────────────────────────────────

export function createUploadSocket(videoId: string): WebSocket {
  return new WebSocket(`${WS_BASE}/ws/upload/${videoId}`);
}
