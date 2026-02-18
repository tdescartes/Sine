/**
 * SineTransport — QUIC-ready transport abstraction.
 *
 * Architecture:
 *   Tries WebTransport (HTTP/3 QUIC) first for multiplexed, 0-RTT streams.
 *   Falls back to WebSocket when WebTransport is unavailable.
 *   Both transports expose the same interface for transparent swapping.
 *
 * Why this matters:
 *   - WebTransport: no head-of-line blocking, independent streams, built-in
 *     congestion control, survives network switches (mobile → Wi-Fi)
 *   - WebSocket: universal fallback, works everywhere today
 */

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000";
const WT_BASE = process.env.NEXT_PUBLIC_WT_URL ?? "https://localhost:4433";

// ─── Transport Interface ─────────────────────────────────────────────────────

export type TransportKind = "webtransport" | "websocket";

export interface TransportMessage {
    event: string;
    [key: string]: unknown;
}

export interface SineTransport {
    readonly kind: TransportKind;
    readonly ready: Promise<void>;

    /** Send a binary chunk (video data) */
    sendBinary(data: ArrayBuffer): void;

    /** Send a JSON control message */
    sendJSON(payload: Record<string, unknown>): void;

    /** Register handler for incoming JSON messages */
    onMessage(handler: (msg: TransportMessage) => void): void;

    /** Register handler for transport errors */
    onError(handler: (err: Error) => void): void;

    /** Close the transport */
    close(): void;

    /** Whether the transport is currently open */
    isOpen(): boolean;
}

// ─── WebSocket Transport ─────────────────────────────────────────────────────

class WebSocketTransport implements SineTransport {
    readonly kind: TransportKind = "websocket";
    readonly ready: Promise<void>;

    private ws: WebSocket;
    private messageHandler: ((msg: TransportMessage) => void) | null = null;
    private errorHandler: ((err: Error) => void) | null = null;

    constructor(videoId: string) {
        this.ws = new WebSocket(`${WS_BASE}/ws/upload/${videoId}`);

        this.ready = new Promise<void>((resolve, reject) => {
            this.ws.onopen = () => resolve();
            this.ws.onerror = () => reject(new Error("WebSocket connection failed"));
            setTimeout(() => reject(new Error("WebSocket connection timeout")), 5000);
        });

        this.ws.onmessage = (event: MessageEvent) => {
            if (typeof event.data === "string" && this.messageHandler) {
                try {
                    const parsed = JSON.parse(event.data);
                    this.messageHandler(parsed);
                } catch {
                    // Ignore non-JSON messages
                }
            }
        };

        this.ws.onerror = () => {
            this.errorHandler?.(new Error("WebSocket error"));
        };
    }

    sendBinary(data: ArrayBuffer): void {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(data);
        }
    }

    sendJSON(payload: Record<string, unknown>): void {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(payload));
        }
    }

    onMessage(handler: (msg: TransportMessage) => void): void {
        this.messageHandler = handler;
    }

    onError(handler: (err: Error) => void): void {
        this.errorHandler = handler;
    }

    close(): void {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.close();
        }
    }

    isOpen(): boolean {
        return this.ws.readyState === WebSocket.OPEN;
    }
}

// ─── WebTransport Transport (QUIC) ──────────────────────────────────────────

/**
 * WebTransport implementation using the W3C WebTransport API.
 *
 * Uses a single unidirectional stream for binary data (video chunks)
 * and datagrams for lightweight control messages.
 *
 * Note: Requires an HTTP/3 server. Falls back to WebSocket if
 * WebTransport is not available in the browser or server.
 */
class WebTransportTransport implements SineTransport {
    readonly kind: TransportKind = "webtransport";
    readonly ready: Promise<void>;

    private transport: WebTransport;
    private writer: WritableStreamDefaultWriter | null = null;
    private messageHandler: ((msg: TransportMessage) => void) | null = null;
    private errorHandler: ((err: Error) => void) | null = null;
    private _open = false;

    constructor(videoId: string) {
        const url = `${WT_BASE}/upload/${videoId}`;
        this.transport = new WebTransport(url);

        this.ready = this._init();
    }

    private async _init(): Promise<void> {
        try {
            await this.transport.ready;
            this._open = true;

            // Open a unidirectional stream for binary data
            const stream = await this.transport.createUnidirectionalStream();
            this.writer = stream.getWriter();

            // Listen for incoming server streams (control messages)
            this._readIncomingStreams();
        } catch (err) {
            throw new Error(
                `WebTransport init failed: ${err instanceof Error ? err.message : "unknown"}`
            );
        }
    }

    private async _readIncomingStreams(): Promise<void> {
        try {
            const reader = this.transport.incomingUnidirectionalStreams.getReader();
            while (true) {
                const { value: stream, done } = await reader.read();
                if (done) break;
                this._readStream(stream);
            }
        } catch {
            // Transport closed
        }
    }

    private async _readStream(stream: ReadableStream): Promise<void> {
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                // Try parsing each line
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";
                for (const line of lines) {
                    if (line.trim()) {
                        try {
                            this.messageHandler?.(JSON.parse(line));
                        } catch {
                            // Not JSON
                        }
                    }
                }
            }
        } catch {
            // Stream ended
        }
    }

    sendBinary(data: ArrayBuffer): void {
        if (this.writer) {
            this.writer.write(new Uint8Array(data)).catch(() => {
                this.errorHandler?.(new Error("WebTransport write failed"));
            });
        }
    }

    sendJSON(payload: Record<string, unknown>): void {
        // Send control messages as datagrams (lightweight, no stream overhead)
        const encoder = new TextEncoder();
        const data = encoder.encode(JSON.stringify(payload));
        this.transport.datagrams.writable
            .getWriter()
            .write(data)
            .catch(() => {
                // Fallback: try sending on the main stream
                this.sendBinary(data.buffer as ArrayBuffer);
            });
    }

    onMessage(handler: (msg: TransportMessage) => void): void {
        this.messageHandler = handler;
    }

    onError(handler: (err: Error) => void): void {
        this.errorHandler = handler;
    }

    close(): void {
        this._open = false;
        try {
            this.transport.close();
        } catch {
            // Already closed
        }
    }

    isOpen(): boolean {
        return this._open;
    }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Check if WebTransport is available in the current browser.
 */
export function isWebTransportSupported(): boolean {
    return typeof globalThis.WebTransport !== "undefined";
}

/**
 * Create the best available transport for a video upload session.
 *
 * Tries WebTransport first (QUIC/HTTP/3), falls back to WebSocket.
 * The caller doesn't need to know which transport was chosen — the
 * interface is identical.
 */
export async function createTransport(videoId: string): Promise<SineTransport> {
    // Try WebTransport first
    if (isWebTransportSupported()) {
        try {
            const wt = new WebTransportTransport(videoId);
            await Promise.race([
                wt.ready,
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("WebTransport timeout")), 3000)
                ),
            ]);
            console.log("[Sine] Connected via WebTransport (QUIC)");
            return wt;
        } catch (err) {
            console.warn(
                "[Sine] WebTransport unavailable, falling back to WebSocket:",
                err instanceof Error ? err.message : err
            );
        }
    }

    // Fall back to WebSocket
    const ws = new WebSocketTransport(videoId);
    await ws.ready;
    console.log("[Sine] Connected via WebSocket");
    return ws;
}
