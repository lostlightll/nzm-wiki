"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Pause, Play } from "lucide-react";
import { getAssetPath } from "@/lib/path";

interface VideoGifProps {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void): () => void {
  const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
  mediaQuery.addEventListener("change", onChange);
  return () => mediaQuery.removeEventListener("change", onChange);
}

function getReducedMotionSnapshot(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function VideoGif({ src, alt, width, height }: VideoGifProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isInView, setIsInView] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [manuallyPaused, setManuallyPaused] = useState(false);
  const [manualPlayRequested, setManualPlayRequested] = useState(false);
  const prefersReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  );

  const hasValidSrc = typeof src === "string" && src.length > 0;
  const videoSrc = hasValidSrc
    ? src.startsWith("/")
      ? getAssetPath(src)
      : src
    : "";
  const videoWidth = width ?? 1280;
  const videoHeight = height ?? Math.round(videoWidth * (9 / 16));

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (typeof IntersectionObserver === "undefined") {
      const timer = globalThis.setTimeout(() => setIsInView(true), 0);
      return () => globalThis.clearTimeout(timer);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
        if (!entry.isIntersecting) setManualPlayRequested(false);
      },
      { threshold: 0.25 },
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!isInView) {
      video.pause();
      return;
    }

    const shouldPlay = prefersReducedMotion
      ? manualPlayRequested
      : !manuallyPaused;

    if (shouldPlay) {
      void video.play().catch(() => setIsPlaying(false));
    } else {
      video.pause();
    }
  }, [
    isInView,
    manualPlayRequested,
    manuallyPaused,
    prefersReducedMotion,
  ]);

  const togglePlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      setManuallyPaused(false);
      setManualPlayRequested(true);
      void video.play().catch(() => setIsPlaying(false));
    } else {
      setManuallyPaused(true);
      setManualPlayRequested(false);
      video.pause();
    }
  }, []);

  if (!hasValidSrc) return null;

  return (
    <div
      className="not-prose relative my-4 overflow-hidden rounded-lg border border-zinc-700/50 bg-black"
      style={{
        width: width ? `${width}px` : "100%",
        maxWidth: "100%",
        aspectRatio: `${videoWidth} / ${videoHeight}`,
      }}
    >
      <video
        ref={videoRef}
        suppressHydrationWarning
        src={videoSrc}
        loop
        muted
        playsInline
        preload="metadata"
        aria-label={alt || "循环视频"}
        width={videoWidth}
        height={videoHeight}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        className="h-full w-full object-contain"
      />
      <button
        type="button"
        onClick={togglePlayback}
        aria-label={isPlaying ? "暂停视频" : "播放视频"}
        aria-pressed={isPlaying}
        className="absolute bottom-2 right-2 flex h-11 w-11 items-center justify-center rounded-md bg-black/75 text-white ring-1 ring-white/20 transition-colors hover:bg-black/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        {isPlaying ? (
          <Pause className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Play className="h-5 w-5" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
