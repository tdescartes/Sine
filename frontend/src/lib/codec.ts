/**
 * Codec negotiation — AV1 → VP9 → VP8 graceful degradation.
 *
 * AV1 delivers ~30% better compression than VP9 at the same quality.
 * Not all browsers support AV1 encoding in MediaRecorder yet, so we
 * probe support and fall through to the best available codec.
 *
 * The negotiated codec name is sent to the server at recording start
 * so the backend can store the correct content-type metadata.
 */

export interface CodecResult {
    /** The MIME type string for MediaRecorder (e.g., "video/webm;codecs=av01") */
    mimeType: string;
    /** Short codec name for display/storage (e.g., "av1", "vp9", "vp8") */
    codec: string;
    /** Whether this is the best available (AV1) or a fallback */
    isBestAvailable: boolean;
}

/**
 * Ordered codec preference chain.
 * Each entry: [mimeType for MediaRecorder, short name, whether it's top-tier]
 */
const CODEC_CHAIN: [string, string, boolean][] = [
    // AV1 — best compression, hardware-accelerated on modern chips
    ["video/webm;codecs=av01.0.08M.08", "av1", true],
    ["video/webm;codecs=av01", "av1", true],
    ["video/mp4;codecs=av01", "av1", true],

    // VP9 — excellent quality, widely supported
    ["video/webm;codecs=vp9,opus", "vp9", false],
    ["video/webm;codecs=vp9", "vp9", false],

    // VP8 — universal fallback
    ["video/webm;codecs=vp8,opus", "vp8", false],
    ["video/webm;codecs=vp8", "vp8", false],

    // Bare webm — absolute last resort
    ["video/webm", "webm", false],
];

/**
 * Negotiate the best codec the current browser supports for MediaRecorder.
 *
 * Returns the codec info including MIME type and short name.
 * The short name should be sent to the backend at recording start.
 */
export function negotiateCodec(): CodecResult {
    if (typeof MediaRecorder === "undefined") {
        return { mimeType: "video/webm", codec: "webm", isBestAvailable: false };
    }

    for (const [mimeType, codec, isBest] of CODEC_CHAIN) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
            console.log(`[Sine] Codec negotiated: ${codec} (${mimeType})`);
            return { mimeType, codec, isBestAvailable: isBest };
        }
    }

    // Shouldn't reach here, but safety net
    console.warn("[Sine] No preferred codec supported, using default webm");
    return { mimeType: "video/webm", codec: "webm", isBestAvailable: false };
}

/**
 * Get a human-readable codec label for the UI.
 */
export function getCodecLabel(codec: string): string {
    switch (codec) {
        case "av1":
            return "AV1";
        case "vp9":
            return "VP9";
        case "vp8":
            return "VP8";
        default:
            return codec.toUpperCase();
    }
}

/**
 * Get the recommended video constraints based on the negotiated codec.
 * AV1 allows higher resolution at the same bitrate.
 */
export function getVideoConstraints(codec: string): MediaTrackConstraints {
    switch (codec) {
        case "av1":
            return {
                width: { ideal: 1920, max: 2560 },
                height: { ideal: 1080, max: 1440 },
                frameRate: { ideal: 30, max: 60 },
            };
        case "vp9":
            return {
                width: { ideal: 1920, max: 1920 },
                height: { ideal: 1080, max: 1080 },
                frameRate: { ideal: 30 },
            };
        default:
            return {
                width: { ideal: 1280, max: 1920 },
                height: { ideal: 720, max: 1080 },
                frameRate: { ideal: 30 },
            };
    }
}
