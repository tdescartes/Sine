/**
 * Watch page — video player with interactive annotations.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import VideoPlayer from "@/components/VideoPlayer";
import {
    getVideo,
    listAnnotations,
    createAnnotation,
    deleteAnnotation,
    triggerOcr,
    type VideoResponse,
    type AnnotationResponse,
} from "@/lib/api";
import { formatTime, formatDate } from "@/lib/utils";

export default function WatchPage() {
    const params = useParams();
    const router = useRouter();
    const videoId = params.id as string;

    const [video, setVideo] = useState<VideoResponse | null>(null);
    const [annotations, setAnnotations] = useState<AnnotationResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [ocrProcessing, setOcrProcessing] = useState(false);

    // ─── Load data ────────────────────────────────────────────────────────

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const [videoData, annotationsData] = await Promise.all([
                getVideo(videoId),
                listAnnotations(videoId),
            ]);
            setVideo(videoData);
            setAnnotations(annotationsData);
        } catch (err) {
            setError("Failed to load video");
        } finally {
            setLoading(false);
        }
    }, [videoId]);

    useEffect(() => {
        if (videoId) loadData();
    }, [videoId, loadData]);

    // ─── Handlers ─────────────────────────────────────────────────────────

    const handleAddAnnotation = useCallback(
        async (timestamp: number, content: string) => {
            try {
                const newAnnotation = await createAnnotation({
                    video_id: videoId,
                    timestamp,
                    content,
                    type: "comment",
                });
                setAnnotations((prev) =>
                    [...prev, newAnnotation].sort((a, b) => a.timestamp - b.timestamp)
                );
            } catch {
                // silent fail
            }
        },
        [videoId]
    );

    const handleDeleteAnnotation = useCallback(async (id: number) => {
        try {
            await deleteAnnotation(id);
            setAnnotations((prev) => prev.filter((a) => a.id !== id));
        } catch {
            // silent fail
        }
    }, []);

    const handleTriggerOcr = useCallback(async () => {
        try {
            setOcrProcessing(true);
            await triggerOcr(videoId);
            // Poll for results after a delay
            setTimeout(async () => {
                const updatedAnnotations = await listAnnotations(videoId);
                setAnnotations(updatedAnnotations);
                setOcrProcessing(false);
            }, 5000);
        } catch {
            setOcrProcessing(false);
        }
    }, [videoId]);

    // ─── Render ───────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-sine-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (error || !video) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <p className="text-gray-500 mb-4">{error || "Video not found"}</p>
                    <button
                        onClick={() => router.push("/")}
                        className="px-4 py-2 bg-sine-600 text-white rounded-lg hover:bg-sine-700 transition"
                    >
                        Go Home
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen">
            {/* Header */}
            <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <button
                        onClick={() => router.push("/")}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        <span className="font-medium">Library</span>
                    </button>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleTriggerOcr}
                            disabled={ocrProcessing || video.status !== "ready"}
                            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
                        >
                            {ocrProcessing ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    Auto-Document (OCR)
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </header>

            {/* Main */}
            <main className="max-w-7xl mx-auto px-6 py-8">
                {/* Video info */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">
                        {video.title || "Untitled Recording"}
                    </h1>
                    <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                        <span>{formatDate(video.created_at)}</span>
                        {video.duration && <span>{formatTime(video.duration)}</span>}
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            {video.status}
                        </span>
                    </div>
                </div>

                {/* Player */}
                {video.playback_url ? (
                    <VideoPlayer
                        src={video.playback_url}
                        annotations={annotations}
                        onAddAnnotation={handleAddAnnotation}
                        onDeleteAnnotation={handleDeleteAnnotation}
                    />
                ) : (
                    <div className="aspect-video bg-gray-100 rounded-2xl flex items-center justify-center">
                        <p className="text-gray-500">
                            {video.status === "processing"
                                ? "Video is processing..."
                                : "Playback not available"}
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
}
