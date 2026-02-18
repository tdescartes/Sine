/**
 * useSineRecorder — Intelligent capture hook for Sine v2.
 *
 * Core innovations over useRecorder (v1):
 *   1. Transport: QUIC-ready transport layer (WebTransport → WebSocket fallback)
 *   2. Codec: AV1 → VP9 → VP8 negotiation chain
 *   3. Smart Stop: auto-trims 1.5s of dead air at the end
 *   4. Scene Markers: detects window focus changes during recording
 *   5. Face Bubble: optional PIP camera-only stream for facecam overlay
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
    startRecording as apiStartRecording,
    uploadChunk as apiUploadChunk,
    completeRecording as apiCompleteRecording,
    abortRecording as apiAbortRecording,
    type VideoStartResponse,
    type VideoResponse,
} from "@/lib/api";
import {
    createTransport,
    type SineTransport,
    type TransportMessage,
} from "@/lib/transport";
import {
    negotiateCodec,
    getVideoConstraints,
    type CodecResult,
} from "@/lib/codec";

// ─── Constants ───────────────────────────────────────────────────────────────

/** Dead-air trim: seconds removed from the end on Smart Stop */
const SMART_STOP_TRIM_SECONDS = 1.5;

/** Scene marker debounce: ignore focus events within this window */
const MARKER_DEBOUNCE_MS = 2000;

// ─── Types ───────────────────────────────────────────────────────────────────

export type RecorderState =
    | "idle"
    | "requesting"
    | "recording"
    | "stopping"
    | "complete"
    | "error";

export interface SceneMarker {
    timestamp: number;
    label: string;
    source: "focus_switch" | "visibility" | "manual";
}

export interface UseSineRecorderOptions {
    /** Chunk interval in milliseconds (default: 3000) */
    chunkInterval?: number;
    /** Video title */
    title?: string;
    /** Enable Smart Stop auto-trim (default: true) */
    smartStop?: boolean;
    /** Enable context-aware scene markers (default: true) */
    sceneMarkers?: boolean;
    /** Enable face bubble PIP (default: false) */
    enableFaceBubble?: boolean;
}

export interface UseSineRecorderReturn {
    state: RecorderState;
    error: string | null;
    duration: number;
    videoId: string | null;
    completedVideo: VideoResponse | null;
    previewStream: MediaStream | null;
    faceStream: MediaStream | null;
    codec: CodecResult | null;
    transportKind: string | null;
    markers: SceneMarker[];
    start: () => Promise<void>;
    stop: () => Promise<void>;
    cancel: () => Promise<void>;
    addManualMarker: (label?: string) => void;
    toggleFaceBubble: () => Promise<void>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useSineRecorder(
    options: UseSineRecorderOptions = {}
): UseSineRecorderReturn {
    const {
        chunkInterval = 3000,
        title,
        smartStop = true,
        sceneMarkers: enableMarkers = true,
        enableFaceBubble = false,
    } = options;

    // ── State ────────────────────────────────────────────────────────────
    const [state, setState] = useState<RecorderState>("idle");
    const [error, setError] = useState<string | null>(null);
    const [duration, setDuration] = useState(0);
    const [videoId, setVideoId] = useState<string | null>(null);
    const [completedVideo, setCompletedVideo] = useState<VideoResponse | null>(null);
    const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
    const [faceStream, setFaceStream] = useState<MediaStream | null>(null);
    const [codec, setCodec] = useState<CodecResult | null>(null);
    const [transportKind, setTransportKind] = useState<string | null>(null);
    const [markers, setMarkers] = useState<SceneMarker[]>([]);

    // ── Refs ─────────────────────────────────────────────────────────────
    const recorderRef = useRef<MediaRecorder | null>(null);
    const transportRef = useRef<SineTransport | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const faceStreamRef = useRef<MediaStream | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTimeRef = useRef<number>(0);
    const partNumberRef = useRef<number>(1);
    const uploadInfoRef = useRef<VideoStartResponse | null>(null);
    const markersRef = useRef<SceneMarker[]>([]);
    const lastMarkerTimeRef = useRef<number>(0);

    // ─── Cleanup helper ──────────────────────────────────────────────────

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
        if (faceStreamRef.current) {
            faceStreamRef.current.getTracks().forEach((t) => t.stop());
            faceStreamRef.current = null;
        }
        if (transportRef.current) {
            transportRef.current.close();
            transportRef.current = null;
        }
        setPreviewStream(null);
        setFaceStream(null);
        recorderRef.current = null;
    }, []);

    // ─── Scene Marker: send to server via transport ──────────────────────

    const sendMarker = useCallback((marker: SceneMarker) => {
        const transport = transportRef.current;
        if (transport && transport.isOpen()) {
            transport.sendJSON({
                action: "marker",
                timestamp: marker.timestamp,
                label: marker.label,
                source: marker.source,
            });
        }
    }, []);

    // ─── Scene Marker: window focus listener ─────────────────────────────

    useEffect(() => {
        if (state !== "recording" || !enableMarkers) return;

        const handleFocus = () => {
            const now = Date.now();
            if (now - lastMarkerTimeRef.current < MARKER_DEBOUNCE_MS) return;
            lastMarkerTimeRef.current = now;

            const elapsed = (now - startTimeRef.current) / 1000;
            const marker: SceneMarker = {
                timestamp: elapsed,
                label: "Switched to Sine",
                source: "focus_switch",
            };
            markersRef.current = [...markersRef.current, marker];
            setMarkers([...markersRef.current]);
            sendMarker(marker);
        };

        const handleVisibility = () => {
            if (document.visibilityState === "visible") {
                const now = Date.now();
                if (now - lastMarkerTimeRef.current < MARKER_DEBOUNCE_MS) return;
                lastMarkerTimeRef.current = now;

                const elapsed = (now - startTimeRef.current) / 1000;
                const marker: SceneMarker = {
                    timestamp: elapsed,
                    label: "Tab became visible",
                    source: "visibility",
                };
                markersRef.current = [...markersRef.current, marker];
                setMarkers([...markersRef.current]);
                sendMarker(marker);
            }
        };

        window.addEventListener("focus", handleFocus);
        document.addEventListener("visibilitychange", handleVisibility);

        return () => {
            window.removeEventListener("focus", handleFocus);
            document.removeEventListener("visibilitychange", handleVisibility);
        };
    }, [state, enableMarkers, sendMarker]);

    // ─── Manual marker ───────────────────────────────────────────────────

    const addManualMarker = useCallback(
        (label = "Manual marker") => {
            if (state !== "recording") return;
            const elapsed = (Date.now() - startTimeRef.current) / 1000;
            const marker: SceneMarker = {
                timestamp: elapsed,
                label,
                source: "manual",
            };
            markersRef.current = [...markersRef.current, marker];
            setMarkers([...markersRef.current]);
            sendMarker(marker);
        },
        [state, sendMarker]
    );

    // ─── Face Bubble toggle ──────────────────────────────────────────────

    const toggleFaceBubble = useCallback(async () => {
        if (faceStreamRef.current) {
            // Turn off
            faceStreamRef.current.getTracks().forEach((t) => t.stop());
            faceStreamRef.current = null;
            setFaceStream(null);
        } else {
            // Turn on — get camera-only stream
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 320, height: 320, facingMode: "user" },
                    audio: false,
                });
                faceStreamRef.current = stream;
                setFaceStream(stream);
            } catch {
                // Camera unavailable — not critical
            }
        }
    }, []);

    // ─── Start recording ─────────────────────────────────────────────────

    const start = useCallback(async () => {
        try {
            setState("requesting");
            setError(null);
            setDuration(0);
            setCompletedVideo(null);
            setMarkers([]);
            markersRef.current = [];
            partNumberRef.current = 1;
            lastMarkerTimeRef.current = 0;

            // 1. Negotiate codec
            const codecResult = negotiateCodec();
            setCodec(codecResult);

            // 2. Get user media with codec-aware constraints
            const videoConstraints = getVideoConstraints(codecResult.codec);
            const stream = await navigator.mediaDevices.getUserMedia({
                video: videoConstraints,
                audio: true,
            });
            streamRef.current = stream;
            setPreviewStream(stream);

            // 3. Initialize face bubble if enabled
            if (enableFaceBubble) {
                try {
                    const fStream = await navigator.mediaDevices.getUserMedia({
                        video: { width: 320, height: 320, facingMode: "user" },
                        audio: false,
                    });
                    faceStreamRef.current = fStream;
                    setFaceStream(fStream);
                } catch {
                    // Face cam not available — continue without it
                }
            }

            // 4. Initialize server-side upload (with codec info)
            const uploadInfo = await apiStartRecording(title, codecResult.codec);
            uploadInfoRef.current = uploadInfo;
            setVideoId(uploadInfo.video_id);

            // 5. Open transport (WebTransport → WebSocket fallback)
            const transport = await createTransport(uploadInfo.video_id);
            transportRef.current = transport;
            setTransportKind(transport.kind);

            // 6. Create MediaRecorder with negotiated codec
            const recorder = new MediaRecorder(stream, {
                mimeType: codecResult.mimeType,
            });
            recorderRef.current = recorder;

            // 7. Handle chunk data — stream via transport
            recorder.ondataavailable = async (event: BlobEvent) => {
                if (event.data.size === 0) return;

                const partNum = partNumberRef.current++;

                if (transport.isOpen()) {
                    // Transport layer handles binary delivery
                    const buffer = await event.data.arrayBuffer();
                    transport.sendBinary(buffer);
                } else {
                    // REST fallback (extreme edge case)
                    try {
                        await apiUploadChunk(
                            uploadInfo.video_id,
                            partNum,
                            event.data
                        );
                    } catch (err) {
                        console.error("[Sine] Chunk upload failed:", err);
                    }
                }
            };

            recorder.onerror = () => {
                setError("Recording error occurred");
                setState("error");
                cleanup();
            };

            // 8. Start recording with chunking
            recorder.start(chunkInterval);
            startTimeRef.current = Date.now();
            setState("recording");

            // 9. Duration timer (100ms resolution)
            timerRef.current = setInterval(() => {
                setDuration((Date.now() - startTimeRef.current) / 1000);
            }, 100);
        } catch (err) {
            const msg =
                err instanceof Error ? err.message : "Failed to start recording";
            setError(msg);
            setState("error");
            cleanup();
        }
    }, [title, chunkInterval, enableFaceBubble, cleanup]);

    // ─── Stop recording ──────────────────────────────────────────────────

    const stop = useCallback(async () => {
        if (state !== "recording") return;

        try {
            setState("stopping");

            const rawDuration = (Date.now() - startTimeRef.current) / 1000;
            setDuration(rawDuration);

            // Smart Stop: auto-trim the dead air at the end
            const trimEnd = smartStop
                ? Math.max(0, rawDuration - SMART_STOP_TRIM_SECONDS)
                : undefined;

            // Stop the MediaRecorder — triggers final ondataavailable
            if (recorderRef.current && recorderRef.current.state !== "inactive") {
                recorderRef.current.stop();
            }

            // Small delay to ensure the last chunk is sent
            await new Promise((r) => setTimeout(r, 500));

            const transport = transportRef.current;
            const uploadInfo = uploadInfoRef.current;

            if (transport && transport.isOpen()) {
                // Send completion signal with Smart Stop trim
                transport.sendJSON({
                    action: "complete",
                    duration: rawDuration,
                    trim_end: trimEnd,
                });

                // Wait for server confirmation
                const result = await new Promise<VideoResponse>(
                    (resolve, reject) => {
                        transport.onMessage((msg: TransportMessage) => {
                            if (msg.event === "complete") {
                                resolve({
                                    id: uploadInfo!.video_id,
                                    title: title ?? null,
                                    status: msg.status as string,
                                    duration: rawDuration,
                                    codec: codec?.codec ?? null,
                                    trim_start: null,
                                    trim_end: trimEnd ?? null,
                                    created_at: new Date().toISOString(),
                                    playback_url: msg.playback_url as string,
                                });
                            }
                        });
                        transport.onError((err) => reject(err));
                        setTimeout(
                            () => reject(new Error("Complete timeout")),
                            15000
                        );
                    }
                );

                setCompletedVideo(result);
            } else {
                // REST fallback
                const result = await apiCompleteRecording(
                    uploadInfo!.video_id,
                    rawDuration,
                    trimEnd
                );
                setCompletedVideo(result);
            }

            setState("complete");
        } catch (err) {
            const msg =
                err instanceof Error
                    ? err.message
                    : "Failed to stop recording";
            setError(msg);
            setState("error");
        } finally {
            cleanup();
        }
    }, [state, title, codec, smartStop, cleanup]);

    // ─── Cancel recording ────────────────────────────────────────────────

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
        setMarkers([]);
        markersRef.current = [];
    }, [cleanup]);

    return {
        state,
        error,
        duration,
        videoId,
        completedVideo,
        previewStream,
        faceStream,
        codec,
        transportKind,
        markers,
        start,
        stop,
        cancel,
        addManualMarker,
        toggleFaceBubble,
    };
}
