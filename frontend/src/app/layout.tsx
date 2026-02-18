import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Sine — Video Messaging",
    description:
        "High-performance video recording and sharing with stream-to-upload architecture.",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body className="min-h-screen antialiased">{children}</body>
        </html>
    );
}
