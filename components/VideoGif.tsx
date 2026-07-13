"use client";

import { getAssetPath } from "@/lib/path";

interface VideoGifProps {
  src: string;
  alt?: string;
  width?: number;
}

export function VideoGif({ src, alt, width }: VideoGifProps) {
  if (!src || typeof src !== "string") return null;

  const videoSrc = src.startsWith("/") ? getAssetPath(src) : src;

  return (
    <video
      suppressHydrationWarning
      src={videoSrc}
      autoPlay
      loop
      muted
      playsInline
      aria-label={alt}
      width={width}
      className="rounded-lg border border-zinc-700/50"
    />
  );
}
