/**
 * VideoRecorder — v2 recording UI with intelligent capture.
 *
 * Uses useSineRecorder for:
 *  - QUIC-ready transport (WebTransport → WebSocket fallback)
 *  - AV1 → VP9 → VP8 codec negotiation
 *  - Smart Stop auto-trim
 *  - Context-aware scene markers
 *  - Optional FaceBubble PIP overlay
 */
"use client";

import { useEffect, useRef } from "react";
import {
    useSineRecorder,
    type RecorderState,
} from "@/hooks/useSineRecorder";
import { getCodecLabel } from "@/lib/codec";
import { formatTime, cn } from "@/lib/utils";
import FaceBubble from "@/components/FaceBubble";

interface VideoRecorderProps {
    onComplete?: (videoId: string) => void;
}

export default function VideoRecorder({ onComplete }: VideoRecorderProps) {
    const {
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
    } = useSineRecorder({
        title: `Recording ${new Date().toLocaleDateString()}`,
        smartStop: true,
        sceneMarkers: true,
    });

    const videoRef = useRef<HTMLVideoElement>(null);

    // Attach the preview stream to the video element
    useEffect(() => {
        if (videoRef.current && previewStream) {
            videoRef.current.srcObject = previewStream;
        }
    }, [previewStream]);

    // Notify parent when complete
    useEffect(() => {
        if (state === "complete" && completedVideo && onComplete) {
            onComplete(completedVideo.id);
        }
    }, [state, completedVideo, onComplete]);

    return (
        <div className="w-full max-w-3xl mx-auto">
            {/* Preview / Placeholder */}
            <div className="relative rounded-2xl overflow-hidden bg-gray-900 aspect-video shadow-2xl">
                {state === "recording" || state === "stopping" ? (
                    <>
                        <video
                            ref={videoRef}
                            autoPlay
                            muted
                            playsInline
                            className="w-full h-full object-cover"
                        />
                        {/* Face Bubble PIP */}
                        <FaceBubble stream={faceStream} size={120} />
                    </>
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center text-gray-400">
                            <svg
                                className="w-16 h-16 mx-auto mb-4 opacity-50"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1.5}
                                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                                />
                            </svg>
                            <p className="text-lg font-medium">Ready to record</p>
                            <p className="text-sm mt-1 opacity-60">
                                Camera and microphone access required
                            </p>
                        </div>
                    </div>
                )}

                {/* Recording indicator + badges */}
                {state === "recording" && (
                    <div className="absolute top-4 left-4 flex items-center gap-2">
                        <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5">
                            <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse-recording" />
                            <span className="text-white text-sm font-mono font-medium">
                                {formatTime(duration)}
                            </span>
                        </div>
                        {/* Codec badge */}
                        {codec && (
                            <span className="bg-black/60 backdrop-blur-sm text-xs text-sine-300 font-medium px-2 py-1 rounded-full">
                                {getCodecLabel(codec.codec)}
                            </span>
                        )}
                        {/* Transport badge */}
                        {transportKind && (
                            <span className="bg-black/60 backdrop-blur-sm text-xs text-green-300 font-medium px-2 py-1 rounded-full">
                                {transportKind === "webtransport" ? "QUIC" : "WS"}
                            </span>
                        )}
                    </div>
                )}

                {/* Scene markers count badge */}
                {state === "recording" && markers.length > 0 && (
                    <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z" />
                        </svg>
                        <span className="text-white text-xs font-medium">
                            {markers.length} marker{markers.length !== 1 ? "s" : ""}
                        </span>
                    </div>
                )}

                {/* Stopping overlay */}
                {state === "stopping" && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <div className="text-white text-center">
                            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                            <p className="text-sm">Finalizing upload...</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="mt-6 flex items-center justify-center gap-4">
                {state === "idle" || state === "complete" || state === "error" ? (
                    <button
                        onClick={start}
                        className={cn(
                            "px-8 py-3 rounded-full font-semibold text-white transition-all",
                            "bg-red-500 hover:bg-red-600 active:scale-95",
                            "shadow-lg shadow-red-500/25 hover:shadow-red-500/40"
                        )}
                    >
                        {state === "complete" ? "Record Again" : "Start Recording"}
                    </button>
                ) : state === "recording" ? (
                    <>
                        <button
                            onClick={stop}
                            className={cn(
                                "px-8 py-3 rounded-full font-semibold text-white transition-all",
                                "bg-red-500 hover:bg-red-600 active:scale-95",
                                "shadow-lg shadow-red-500/25"
                            )}
                        >
                            <span className="flex items-center gap-2">
                                <span className="w-4 h-4 bg-white rounded-sm" />
                                Stop Recording
                            </span>
                        </button>

                        {/* Add manual marker button */}
                        <button
                            onClick={() => addManualMarker()}
                            className="px-4 py-3 rounded-full font-medium text-amber-600 hover:bg-amber-50 transition-all border border-amber-200"
                            title="Add scene marker (M)"
                        >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z" />
                            </svg>
                        </button>

                        {/* Face bubble toggle */}
                        <button
                            onClick={toggleFaceBubble}
                            className={cn(
                                "px-4 py-3 rounded-full font-medium transition-all border",
                                faceStream
                                    ? "text-sine-600 bg-sine-50 border-sine-200"
                                    : "text-gray-600 hover:bg-gray-50 border-gray-200"
                            )}
                            title="Toggle face camera"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </button>

                        <button
                            onClick={cancel}
                            className="px-6 py-3 rounded-full font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all"
                        >
                            Cancel
                        </button>
                    </>
                ) : state === "requesting" ? (
                    <div className="flex items-center gap-2 text-gray-500">
                        <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                        <span>Requesting camera access...</span>
                    </div>
                ) : null}
            </div>

            {/* Error message */}
            {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm text-center">
                    {error}
                </div>
            )}

            {/* Success message */}
            {state === "complete" && completedVideo && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                    <p className="text-green-800 font-medium">
                        Recording saved successfully!
                    </p>
                    <div className="flex items-center justify-center gap-3 mt-1">
                        <span className="text-green-600 text-sm">
                            Duration: {formatTime(completedVideo.duration ?? 0)}
                        </span>
                        {codec && (
                            <span className="text-green-600 text-sm">
                                Codec: {getCodecLabel(codec.codec)}
                            </span>
                        )}
                        {markers.length > 0 && (
                            <span className="text-green-600 text-sm">
                                {markers.length} scene marker{markers.length !== 1 ? "s" : ""}
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
