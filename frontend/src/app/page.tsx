/**
 * Home page — video library with recording CTA.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listVideos, type VideoResponse } from "@/lib/api";
import VideoCard from "@/components/VideoCard";

export default function HomePage() {
    const router = useRouter();
    const [videos, setVideos] = useState<VideoResponse[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);

    const loadVideos = useCallback(async () => {
        try {
            const data = await listVideos();
            setVideos(data.videos);
            setTotal(data.total);
        } catch {
            // API might not be running yet — show empty state
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadVideos();
    }, [loadVideos]);

    return (
        <div className="min-h-screen">
            {/* Header */}
            <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-sine-600 rounded-xl flex items-center justify-center">
                            <svg
                                className="w-5 h-5 text-white"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                                />
                            </svg>
                        </div>
                        <h1 className="text-xl font-bold text-gray-900">Sine</h1>
                    </div>

                    <button
                        onClick={() => router.push("/record")}
                        className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-full font-semibold text-sm transition-all shadow-lg shadow-red-500/20 hover:shadow-red-500/30 active:scale-95"
                    >
                        <span className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 bg-white rounded-full" />
                            New Recording
                        </span>
                    </button>
                </div>
            </header>

            {/* Main content */}
            <main className="max-w-7xl mx-auto px-6 py-8">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">Your Videos</h2>
                    {total > 0 && (
                        <span className="text-sm text-gray-500">
                            {total} video{total !== 1 ? "s" : ""}
                        </span>
                    )}
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-2 border-sine-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : videos.length === 0 ? (
                    /* Empty state */
                    <div className="text-center py-20">
                        <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <svg
                                className="w-10 h-10 text-gray-400"
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
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">
                            No videos yet
                        </h3>
                        <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                            Record your first video to get started. Sine streams your recording
                            directly to the cloud — no upload wait!
                        </p>
                        <button
                            onClick={() => router.push("/record")}
                            className="px-6 py-3 bg-sine-600 hover:bg-sine-700 text-white rounded-full font-semibold transition-all"
                        >
                            Record Your First Video
                        </button>
                    </div>
                ) : (
                    /* Video grid */
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {videos.map((video) => (
                            <VideoCard
                                key={video.id}
                                video={video}
                                onClick={() => router.push(`/watch/${video.id}`)}
                            />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
