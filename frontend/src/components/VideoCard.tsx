/**
 * VideoCard — thumbnail card for the video library listing.
 */
"use client";

import { formatTime, formatDate, cn } from "@/lib/utils";
import type { VideoResponse } from "@/lib/api";

interface VideoCardProps {
    video: VideoResponse;
    onClick?: () => void;
}

export default function VideoCard({ video, onClick }: VideoCardProps) {
    const statusColors: Record<string, string> = {
        ready: "bg-green-100 text-green-700",
        recording: "bg-red-100 text-red-700",
        processing: "bg-yellow-100 text-yellow-700",
        cancelled: "bg-gray-100 text-gray-500",
    };

    return (
        <div
            onClick={onClick}
            className={cn(
                "group rounded-xl border border-gray-200 overflow-hidden bg-white",
                "hover:shadow-lg hover:border-sine-300 transition-all cursor-pointer"
            )}
        >
            {/* Thumbnail placeholder */}
            <div className="aspect-video bg-gray-900 relative flex items-center justify-center">
                <svg
                    className="w-12 h-12 text-gray-600 group-hover:text-sine-400 transition"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path d="M8 5v14l11-7z" />
                </svg>

                {/* Duration badge */}
                {video.duration && (
                    <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs font-mono px-2 py-0.5 rounded">
                        {formatTime(video.duration)}
                    </span>
                )}
            </div>

            {/* Info */}
            <div className="p-3">
                <h3 className="font-medium text-gray-900 truncate text-sm">
                    {video.title || "Untitled Recording"}
                </h3>
                <div className="flex items-center gap-2 mt-1.5">
                    <span
                        className={cn(
                            "text-xs font-medium px-2 py-0.5 rounded-full",
                            statusColors[video.status] || "bg-gray-100 text-gray-500"
                        )}
                    >
                        {video.status}
                    </span>
                    <span className="text-xs text-gray-400">
                        {formatDate(video.created_at)}
                    </span>
                </div>
            </div>
        </div>
    );
}
