/**
 * FaceBubble — draggable PIP face camera overlay.
 *
 * Shows a circular video feed from the user's front-facing camera,
 * positioned in the corner of the recording preview. Drag to reposition.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface FaceBubbleProps {
    stream: MediaStream | null;
    /** Size in pixels (default: 128) */
    size?: number;
}

export default function FaceBubble({ stream, size = 128 }: FaceBubbleProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState({ x: 16, y: 16 });
    const dragStart = useRef({ x: 0, y: 0 });

    // Attach stream to video element
    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    // Drag handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        dragStart.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y,
        };
        e.preventDefault();
    };

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            setPosition({
                x: e.clientX - dragStart.current.x,
                y: e.clientY - dragStart.current.y,
            });
        };

        const handleMouseUp = () => setIsDragging(false);

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isDragging]);

    if (!stream) return null;

    return (
        <div
            className={cn(
                "absolute z-30 cursor-grab active:cursor-grabbing",
                "rounded-full overflow-hidden shadow-2xl ring-3 ring-white/30",
                "transition-shadow hover:shadow-sine-500/30",
                isDragging && "ring-sine-400/50"
            )}
            style={{
                width: size,
                height: size,
                right: position.x,
                bottom: position.y,
            }}
            onMouseDown={handleMouseDown}
        >
            <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover scale-x-[-1]"
            />
        </div>
    );
}
