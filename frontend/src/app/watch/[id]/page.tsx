/**
 * Watch page — video player with interactive annotations and scene markers (v2).
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import VideoPlayer from "@/components/VideoPlayer";
import {
    getVideo,
    listAnnotations,
    listMarkers,
    createAnnotation,
    deleteAnnotation,
    type VideoResponse,
    type AnnotationResponse,
    type SceneMarkerResponse,
} from "@/lib/api";
import { formatTime, formatDate } from "@/lib/utils";

export default function WatchPage() {
    const params = useParams();
    const router = useRouter();
    const videoId = params.id as string;

    const [video, setVideo] = useState<VideoResponse | null>(null);
    const [annotations, setAnnotations] = useState<AnnotationResponse[]>([]);
    const [sceneMarkers, setSceneMarkers] = useState<SceneMarkerResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // ─── Load data ────────────────────────────────────────────────────────

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const [videoData, annotationsData, markersData] = await Promise.all([
                getVideo(videoId),
                listAnnotations(videoId),
                listMarkers(videoId),
            ]);
            setVideo(videoData);
            setAnnotations(annotationsData);
            setSceneMarkers(markersData);
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
                        {/* v2: codec badge */}
                        {video.codec && (
                            <span className="text-xs bg-sine-100 text-sine-700 px-2 py-0.5 rounded-full font-medium uppercase">
                                {video.codec}
                            </span>
                        )}
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
                        {(video.trim_start != null || video.trim_end != null) && (
                            <span className="px-2 py-0.5 bg-sine-100 text-sine-700 rounded-full text-xs font-medium">
                                Trimmed
                            </span>
                        )}
                        {sceneMarkers.length > 0 && (
                            <span className="px-2 py-0.5 bg-cyan-100 text-cyan-700 rounded-full text-xs font-medium">
                                {sceneMarkers.length} scene{sceneMarkers.length !== 1 ? "s" : ""}
                            </span>
                        )}
                    </div>
                </div>

                {/* Player */}
                {video.playback_url ? (
                    <VideoPlayer
                        src={video.playback_url}
                        annotations={annotations}
                        sceneMarkers={sceneMarkers}
                        trimStart={video.trim_start}
                        trimEnd={video.trim_end}
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
