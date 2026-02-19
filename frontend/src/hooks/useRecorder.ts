/**
 * useRecorder — MediaRecorder hook with stream-to-upload chunking.
 *
 * Records video+audio via getUserMedia, slices into 3-second chunks,
 * and streams each chunk to the backend via WebSocket or REST fallback.
 */
"use client";

import { useCallback, useRef, useState } from "react";
import {
    startRecording as apiStartRecording,
    uploadChunk as apiUploadChunk,
    completeRecording as apiCompleteRecording,
    abortRecording as apiAbortRecording,
    createUploadSocket,
    type VideoStartResponse,
    type VideoResponse,
} from "@/lib/api";

export type RecorderState =
    | "idle"
    | "requesting"
    | "recording"
    | "stopping"
    | "complete"
    | "error";

export interface UseRecorderOptions {
    /** Chunk interval in milliseconds (default: 3000) */
    chunkInterval?: number;
    /** Use WebSocket transport (default: true, falls back to REST) */
    useWebSocket?: boolean;
    /** Video title */
    title?: string;
}

export interface UseRecorderReturn {
    state: RecorderState;
    error: string | null;
    duration: number;
    videoId: string | null;
    completedVideo: VideoResponse | null;
    previewStream: MediaStream | null;
    start: () => Promise<void>;
    stop: () => Promise<void>;
    cancel: () => Promise<void>;
}

export function useRecorder(
    options: UseRecorderOptions = {}
): UseRecorderReturn {
    const { chunkInterval = 3000, useWebSocket = true, title } = options;

    const [state, setState] = useState<RecorderState>("idle");
    const [error, setError] = useState<string | null>(null);
    const [duration, setDuration] = useState(0);
    const [videoId, setVideoId] = useState<string | null>(null);
    const [completedVideo, setCompletedVideo] = useState<VideoResponse | null>(
        null
    );
    const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);

    // Refs for mutable state inside callbacks
    const recorderRef = useRef<MediaRecorder | null>(null);
    const socketRef = useRef<WebSocket | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTimeRef = useRef<number>(0);
    const partNumberRef = useRef<number>(1);
    const uploadInfoRef = useRef<VideoStartResponse | null>(null);

    // ─── Cleanup helper ────────────────────────────────────────────────────

    const cleanup = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        if (recorderRef.current && recorderRef.current.state !== "inactive") {
            recorderRef.current.stop();
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
        }
        if (socketRef.current) {
            if (socketRef.current.readyState === WebSocket.OPEN) {
                socketRef.current.close();
            }
            socketRef.current = null;
        }
        setPreviewStream(null);
        recorderRef.current = null;
    }, []);

    // ─── Start recording ──────────────────────────────────────────────────

    const start = useCallback(async () => {
        try {
            setState("requesting");
            setError(null);
            setDuration(0);
            setCompletedVideo(null);
            partNumberRef.current = 1;

            // 1. Get user media
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 1920, height: 1080, frameRate: 30 },
                audio: true,
            });
            streamRef.current = stream;
            setPreviewStream(stream);

            // 2. Initialise server-side upload
            const uploadInfo = await apiStartRecording(title);
            uploadInfoRef.current = uploadInfo;
            setVideoId(uploadInfo.video_id);

            // 3. Open WebSocket (if enabled)
            let ws: WebSocket | null = null;
            if (useWebSocket) {
                ws = createUploadSocket(uploadInfo.video_id);
                socketRef.current = ws;

                await new Promise<void>((resolve, reject) => {
                    ws!.onopen = () => resolve();
                    ws!.onerror = () => reject(new Error("WebSocket connection failed"));
                    setTimeout(() => reject(new Error("WebSocket timeout")), 5000);
                });
            }

            // 4. Create MediaRecorder
            const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
                ? "video/webm;codecs=vp9"
                : "video/webm";

            const recorder = new MediaRecorder(stream, { mimeType });
            recorderRef.current = recorder;

            // 5. Handle chunk data
            recorder.ondataavailable = async (event: BlobEvent) => {
                if (event.data.size === 0) return;

                const partNum = partNumberRef.current++;

                if (ws && ws.readyState === WebSocket.OPEN) {
                    // WebSocket transport — send raw binary
                    const buffer = await event.data.arrayBuffer();
                    ws.send(buffer);
                } else {
                    // REST fallback
                    try {
                        await apiUploadChunk(
                            uploadInfo.video_id,
                            partNum,
                            event.data
                        );
                    } catch (err) {
                        console.error("Chunk upload failed:", err);
                    }
                }
            };

            recorder.onerror = () => {
                setError("Recording error occurred");
                setState("error");
                cleanup();
            };

            // 6. Start recording with chunking
            recorder.start(chunkInterval);
            startTimeRef.current = Date.now();
            setState("recording");

            // 7. Duration timer
            timerRef.current = setInterval(() => {
                setDuration((Date.now() - startTimeRef.current) / 1000);
            }, 100);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to start recording";
            setError(msg);
            setState("error");
            cleanup();
        }
    }, [title, useWebSocket, chunkInterval, cleanup]);

    // ─── Stop recording ───────────────────────────────────────────────────

    const stop = useCallback(async () => {
        if (state !== "recording") return;

        try {
            setState("stopping");

            const finalDuration = (Date.now() - startTimeRef.current) / 1000;
            setDuration(finalDuration);

            // Stop the MediaRecorder — triggers final ondataavailable
            if (recorderRef.current && recorderRef.current.state !== "inactive") {
                recorderRef.current.stop();
            }

            // Small delay to ensure the last chunk is sent
            await new Promise((r) => setTimeout(r, 500));

            const ws = socketRef.current;
            const uploadInfo = uploadInfoRef.current;

            if (ws && ws.readyState === WebSocket.OPEN) {
                // Send completion signal over WebSocket
                ws.send(JSON.stringify({ action: "complete", duration: finalDuration }));

                // Wait for server confirmation
                const result = await new Promise<VideoResponse>((resolve, reject) => {
                    ws.onmessage = (event) => {
                        const data = JSON.parse(event.data);
                        if (data.event === "complete") {
                            resolve({
                                id: uploadInfo!.video_id,
                                title: title ?? null,
                                status: data.status,
                                duration: finalDuration,
                                created_at: new Date().toISOString(),
                                playback_url: data.playback_url,
                            });
                        }
                    };
                    ws.onerror = () => reject(new Error("WebSocket error during complete"));
                    setTimeout(() => reject(new Error("Complete timeout")), 15000);
                });

                setCompletedVideo(result);
            } else {
                // REST fallback
                const result = await apiCompleteRecording(
                    uploadInfo!.video_id,
                    finalDuration
                );
                setCompletedVideo(result);
            }

            setState("complete");
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to stop recording";
            setError(msg);
            setState("error");
        } finally {
            cleanup();
        }
    }, [state, title, cleanup]);

    // ─── Cancel recording ─────────────────────────────────────────────────

    const cancel = useCallback(async () => {
        cleanup();
        if (uploadInfoRef.current) {
            try {
                await apiAbortRecording(uploadInfoRef.current.video_id);
            } catch {
                // best-effort
            }
        }
        setState("idle");
        setDuration(0);
        setVideoId(null);
    }, [cleanup]);

    return {
        state,
        error,
        duration,
        videoId,
        completedVideo,
        previewStream,
        start,
        stop,
        cancel,
    };
}
