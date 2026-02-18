/**
 * Record page — full-screen recording experience.
 */
"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import VideoRecorder from "@/components/VideoRecorder";

export default function RecordPage() {
    const router = useRouter();

    const handleComplete = useCallback(
        (videoId: string) => {
            // Navigate to the watch page after a short delay
            setTimeout(() => {
                router.push(`/watch/${videoId}`);
            }, 2000);
        },
        [router]
    );

    return (
        <div className="min-h-screen flex flex-col">
            {/* Minimal header */}
            <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <button
                        onClick={() => router.push("/")}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
                    >
                        <svg
                            className="w-5 h-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 19l-7-7 7-7"
                            />
                        </svg>
                        <span className="font-medium">Back</span>
                    </button>

                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-sine-600 rounded-lg flex items-center justify-center">
                            <svg
                                className="w-4 h-4 text-white"
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
                        <span className="font-bold text-gray-900">Sine</span>
                    </div>

                    <div className="w-20" /> {/* Spacer for centering */}
                </div>
            </header>

            {/* Main recording area */}
            <main className="flex-1 flex items-center justify-center p-8">
                <VideoRecorder onComplete={handleComplete} />
            </main>
        </div>
    );
}
