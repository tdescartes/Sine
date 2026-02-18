/**
 * VideoRecorder — full recording UI with live preview, controls, and status.
 */
"use client";

import { useEffect, useRef } from "react";
import { useRecorder, type RecorderState } from "@/hooks/useRecorder";
import { formatTime, cn } from "@/lib/utils";

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
    start,
    stop,
    cancel,
  } = useRecorder({ title: `Recording ${new Date().toLocaleDateString()}` });

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
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
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

        {/* Recording indicator */}
        {state === "recording" && (
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5">
            <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse-recording" />
            <span className="text-white text-sm font-mono font-medium">
              {formatTime(duration)}
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
          <p className="text-green-600 text-sm mt-1">
            Duration: {formatTime(completedVideo.duration ?? 0)}
          </p>
        </div>
      )}
    </div>
  );
}
