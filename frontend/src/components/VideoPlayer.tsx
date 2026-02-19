/**
 * VideoPlayer — custom player with interactive annotation overlay (v2).
 *
 * Features:
 *  - Custom controls (play/pause, seek, volume, fullscreen)
 *  - Metadata-based trim bounds (trim_start / trim_end) — no re-encoding
 *  - Timeline "bubbles" that mark annotation timestamps
 *  - Diamond-shaped scene markers on the timeline
 *  - Click a bubble/marker to jump to that moment
 *  - Add comments at the current timestamp
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatTime, cn } from "@/lib/utils";
import type { AnnotationResponse, SceneMarkerResponse } from "@/lib/api";

interface VideoPlayerProps {
    src: string;
    annotations: AnnotationResponse[];
    sceneMarkers?: SceneMarkerResponse[];
    trimStart?: number | null;
    trimEnd?: number | null;
    onAddAnnotation?: (timestamp: number, content: string) => void;
    onDeleteAnnotation?: (id: number) => void;
}

export default function VideoPlayer({
    src,
    annotations,
    sceneMarkers = [],
    trimStart,
    trimEnd,
    onAddAnnotation,
    onDeleteAnnotation,
}: VideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const progressRef = useRef<HTMLDivElement>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [rawDuration, setRawDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [showComment, setShowComment] = useState(false);
    const [commentText, setCommentText] = useState("");
    const [activeAnnotation, setActiveAnnotation] =
        useState<AnnotationResponse | null>(null);
    const [hoveredMarker, setHoveredMarker] = useState<SceneMarkerResponse | null>(null);

    // ─── Trim-aware derived values ────────────────────────────────────────

    const effectiveTrimStart = trimStart ?? 0;
    const effectiveTrimEnd = trimEnd ?? rawDuration;
    const effectiveDuration = Math.max(0, effectiveTrimEnd - effectiveTrimStart);
    const displayTime = Math.max(0, currentTime - effectiveTrimStart);

    // ─── Video event handlers ─────────────────────────────────────────────

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const onTimeUpdate = () => {
            const t = video.currentTime;
            setCurrentTime(t);

            // Enforce trim bounds: pause at trim_end
            if (effectiveTrimEnd > 0 && t >= effectiveTrimEnd) {
                video.pause();
                video.currentTime = effectiveTrimEnd;
            }
        };
        const onDurationChange = () => setRawDuration(video.duration);
        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        const onEnded = () => setIsPlaying(false);

        // On load, seek to trim_start
        const onLoadedData = () => {
            if (effectiveTrimStart > 0) {
                video.currentTime = effectiveTrimStart;
            }
        };

        video.addEventListener("timeupdate", onTimeUpdate);
        video.addEventListener("durationchange", onDurationChange);
        video.addEventListener("play", onPlay);
        video.addEventListener("pause", onPause);
        video.addEventListener("ended", onEnded);
        video.addEventListener("loadeddata", onLoadedData);

        return () => {
            video.removeEventListener("timeupdate", onTimeUpdate);
            video.removeEventListener("durationchange", onDurationChange);
            video.removeEventListener("play", onPlay);
            video.removeEventListener("pause", onPause);
            video.removeEventListener("ended", onEnded);
            video.removeEventListener("loadeddata", onLoadedData);
        };
    }, [effectiveTrimStart, effectiveTrimEnd]);

    // ─── Check annotation proximity ──────────────────────────────────────

    useEffect(() => {
        const nearby = annotations.find(
            (a) => Math.abs(a.timestamp - currentTime) < 1.5
        );
        setActiveAnnotation(nearby ?? null);
    }, [currentTime, annotations]);

    // ─── Controls ─────────────────────────────────────────────────────────

    const togglePlay = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) {
            // If at trim_end, restart from trim_start
            if (effectiveTrimEnd > 0 && video.currentTime >= effectiveTrimEnd) {
                video.currentTime = effectiveTrimStart;
            }
            video.play();
        } else {
            video.pause();
        }
    }, [effectiveTrimStart, effectiveTrimEnd]);

    const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const video = videoRef.current;
        const bar = progressRef.current;
        if (!video || !bar) return;

        const rect = bar.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        // Map ratio to the trimmed range
        video.currentTime = effectiveTrimStart + ratio * effectiveDuration;
    }, [effectiveTrimStart, effectiveDuration]);

    const toggleMute = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        video.muted = !video.muted;
        setIsMuted(video.muted);
    }, []);

    const changeVolume = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const video = videoRef.current;
        if (!video) return;
        const val = parseFloat(e.target.value);
        video.volume = val;
        setVolume(val);
        if (val > 0 && video.muted) {
            video.muted = false;
            setIsMuted(false);
        }
    }, []);

    const jumpTo = useCallback((timestamp: number) => {
        const video = videoRef.current;
        if (!video) return;
        video.currentTime = timestamp;
    }, []);

    const handleAddComment = useCallback(() => {
        if (!commentText.trim() || !onAddAnnotation) return;
        onAddAnnotation(currentTime, commentText.trim());
        setCommentText("");
        setShowComment(false);
    }, [commentText, currentTime, onAddAnnotation]);

    const progress = effectiveDuration > 0 ? (displayTime / effectiveDuration) * 100 : 0;

    // ─── Source icons for scene markers ───────────────────────────────────

    const markerSourceColors: Record<string, string> = {
        focus_switch: "bg-cyan-400",
        visibility: "bg-purple-400",
        manual: "bg-emerald-400",
    };

    return (
        <div className="w-full max-w-4xl mx-auto">
            {/* Video container */}
            <div className="relative rounded-2xl overflow-hidden bg-black shadow-2xl group">
                <video
                    ref={videoRef}
                    src={src}
                    className="w-full aspect-video"
                    playsInline
                    onClick={togglePlay}
                />

                {/* Active annotation overlay */}
                {activeAnnotation && (
                    <div className="absolute top-4 right-4 max-w-xs bg-black/80 backdrop-blur-sm text-white rounded-xl p-3 animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-2 mb-1">
                            <span
                                className={cn(
                                    "text-xs font-medium px-2 py-0.5 rounded-full",
                                    "bg-yellow-500/30 text-yellow-300"
                                )}
                            >
                                Comment
                            </span>
                            <span className="text-xs text-gray-400">
                                {formatTime(activeAnnotation.timestamp)}
                            </span>
                        </div>
                        <p className="text-sm">{activeAnnotation.content}</p>
                    </div>
                )}

                {/* Hovered scene marker tooltip */}
                {hoveredMarker && (
                    <div className="absolute top-4 left-4 max-w-xs bg-black/80 backdrop-blur-sm text-white rounded-xl p-3 animate-in fade-in">
                        <div className="flex items-center gap-2 mb-1">
                            <span
                                className={cn(
                                    "text-xs font-medium px-2 py-0.5 rounded-full",
                                    "bg-cyan-500/30 text-cyan-300"
                                )}
                            >
                                Scene
                            </span>
                            <span className="text-xs text-gray-400">
                                {formatTime(hoveredMarker.timestamp)}
                            </span>
                        </div>
                        <p className="text-sm">{hoveredMarker.label}</p>
                    </div>
                )}

                {/* Play/Pause overlay */}
                {!isPlaying && (
                    <div
                        className="absolute inset-0 flex items-center justify-center cursor-pointer"
                        onClick={togglePlay}
                    >
                        <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition">
                            <svg
                                className="w-8 h-8 text-white ml-1"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        </div>
                    </div>
                )}

                {/* Bottom controls — shown on hover */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Progress bar with annotation bubbles + scene markers */}
                    <div
                        ref={progressRef}
                        className="relative h-1.5 bg-white/20 rounded-full cursor-pointer mb-3 group/progress"
                        onClick={seek}
                    >
                        {/* Played progress */}
                        <div
                            className="absolute top-0 left-0 h-full bg-sine-500 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                        />

                        {/* Scene markers — diamond shape */}
                        {sceneMarkers.map((m) => {
                            const pos = effectiveDuration > 0
                                ? ((m.timestamp - effectiveTrimStart) / effectiveDuration) * 100
                                : 0;
                            if (pos < 0 || pos > 100) return null;
                            return (
                                <button
                                    key={`marker-${m.id}`}
                                    className={cn(
                                        "absolute top-1/2 -translate-y-1/2 w-3 h-3 rotate-45 border-2 border-white transition-transform hover:scale-150 z-20",
                                        markerSourceColors[m.source] || "bg-cyan-400"
                                    )}
                                    style={{ left: `${pos}%` }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        jumpTo(m.timestamp);
                                    }}
                                    onMouseEnter={() => setHoveredMarker(m)}
                                    onMouseLeave={() => setHoveredMarker(null)}
                                    title={m.label}
                                />
                            );
                        })}

                        {/* Annotation markers — circle shape */}
                        {annotations.map((a) => {
                            const pos = effectiveDuration > 0
                                ? ((a.timestamp - effectiveTrimStart) / effectiveDuration) * 100
                                : 0;
                            if (pos < 0 || pos > 100) return null;
                            return (
                                <button
                                    key={a.id}
                                    className={cn(
                                        "absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white transition-transform hover:scale-150 z-10",
                                        "bg-yellow-400"
                                    )}
                                    style={{ left: `${pos}%` }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        jumpTo(a.timestamp);
                                    }}
                                    title={`${a.type}: ${a.content?.slice(0, 40)}...`}
                                />
                            );
                        })}

                        {/* Scrubber dot */}
                        <div
                            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover/progress:opacity-100 transition-opacity"
                            style={{ left: `${progress}%`, transform: "translate(-50%, -50%)" }}
                        />
                    </div>

                    {/* Controls row */}
                    <div className="flex items-center justify-between text-white text-sm">
                        <div className="flex items-center gap-3">
                            {/* Play/Pause */}
                            <button onClick={togglePlay} className="hover:text-sine-300 transition">
                                {isPlaying ? (
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M8 5v14l11-7z" />
                                    </svg>
                                )}
                            </button>

                            {/* Volume */}
                            <button onClick={toggleMute} className="hover:text-sine-300 transition">
                                {isMuted || volume === 0 ? (
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0021 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                                    </svg>
                                )}
                            </button>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={isMuted ? 0 : volume}
                                onChange={changeVolume}
                                className="w-20 h-1 accent-sine-500"
                            />

                            {/* Time display — shows trimmed time */}
                            <span className="font-mono text-xs">
                                {formatTime(displayTime)} / {formatTime(effectiveDuration)}
                            </span>

                            {/* Trim indicator */}
                            {(trimStart != null || trimEnd != null) && (
                                <span className="text-xs bg-sine-500/30 text-sine-300 px-2 py-0.5 rounded-full">
                                    Trimmed
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Scene markers count */}
                            {sceneMarkers.length > 0 && (
                                <span className="text-xs text-cyan-300 opacity-75">
                                    {sceneMarkers.length} scene{sceneMarkers.length !== 1 ? "s" : ""}
                                </span>
                            )}

                            {/* Add comment button */}
                            {onAddAnnotation && (
                                <button
                                    onClick={() => {
                                        videoRef.current?.pause();
                                        setShowComment(true);
                                    }}
                                    className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-full text-xs font-medium transition"
                                >
                                    + Comment
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Comment input overlay */}
            {showComment && (
                <div className="mt-4 p-4 bg-white border border-gray-200 rounded-xl shadow-lg">
                    <div className="flex items-center gap-2 mb-2 text-sm text-gray-500">
                        <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">
                            {formatTime(currentTime)}
                        </span>
                        <span>Comment at this timestamp</span>
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
                            placeholder="Type your comment..."
                            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sine-500 focus:border-transparent"
                            autoFocus
                        />
                        <button
                            onClick={handleAddComment}
                            className="px-4 py-2 bg-sine-600 text-white rounded-lg hover:bg-sine-700 transition font-medium"
                        >
                            Add
                        </button>
                        <button
                            onClick={() => {
                                setShowComment(false);
                                setCommentText("");
                            }}
                            className="px-4 py-2 text-gray-500 hover:text-gray-700 transition"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Scene Markers chapter list */}
            {sceneMarkers.length > 0 && (
                <div className="mt-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">
                        Scenes ({sceneMarkers.length})
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {sceneMarkers.map((m, i) => (
                            <button
                                key={m.id}
                                onClick={() => jumpTo(m.timestamp)}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition",
                                    "bg-gray-50 border border-gray-200 hover:bg-sine-50 hover:border-sine-300"
                                )}
                            >
                                <span
                                    className={cn(
                                        "w-2.5 h-2.5 rotate-45 rounded-sm",
                                        markerSourceColors[m.source] || "bg-cyan-400"
                                    )}
                                />
                                <span className="font-mono text-xs text-gray-500">
                                    {formatTime(m.timestamp)}
                                </span>
                                <span className="text-gray-700">{m.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Annotations sidebar */}
            {annotations.length > 0 && (
                <div className="mt-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">
                        Annotations ({annotations.length})
                    </h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {annotations.map((a) => (
                            <div
                                key={a.id}
                                className={cn(
                                    "flex items-start gap-3 p-3 rounded-lg cursor-pointer transition hover:bg-gray-50",
                                    activeAnnotation?.id === a.id && "bg-sine-50 border border-sine-200"
                                )}
                                onClick={() => jumpTo(a.timestamp)}
                            >
                                <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded whitespace-nowrap mt-0.5">
                                    {formatTime(a.timestamp)}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <span
                                        className={cn(
                                            "text-xs font-medium px-1.5 py-0.5 rounded",
                                            "bg-yellow-100 text-yellow-700"
                                        )}
                                    >
                                        Comment
                                    </span>
                                    <p className="text-sm text-gray-700 mt-1 line-clamp-2">
                                        {a.content}
                                    </p>
                                </div>
                                {onDeleteAnnotation && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteAnnotation(a.id);
                                        }}
                                        className="text-gray-400 hover:text-red-500 transition p-1"
                                        title="Delete"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
