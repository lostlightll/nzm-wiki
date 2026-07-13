"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, ChevronLeft, ChevronRight, Minus, Plus, Download, Maximize2 } from "lucide-react";
import { getAssetPath, getImageAssetPaths } from "@/lib/path";
import { useDialogFocus } from "@/components/useDialogFocus";

interface TooltipButtonProps {
  onClick: () => void;
  tooltip: string;
  children: React.ReactNode;
  className?: string;
  tooltipPosition?: "top" | "bottom";
}

function TooltipButton({ onClick, tooltip, children, className = "", tooltipPosition = "top" }: TooltipButtonProps) {
  const tooltipClass = tooltipPosition === "top"
    ? "bottom-full mb-2"
    : "top-full mt-2";

  return (
    <div className="relative group">
      <button type="button" onClick={onClick} aria-label={tooltip} className={className}>
        {children}
      </button>
      <div className={`absolute left-1/2 -translate-x-1/2 px-2 py-1 text-xs text-zinc-200 bg-zinc-900 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${tooltipClass}`}>
        {tooltip}
      </div>
    </div>
  );
}

interface ImageViewerProps {
  images: { src: string; pngSrc?: string; alt?: string }[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
}

export function ImageViewer({ images, initialIndex = 0, isOpen, onClose }: ImageViewerProps) {
  if (!isOpen || images.length === 0) return null;

  const safeInitialIndex = Math.min(Math.max(initialIndex, 0), images.length - 1);

  return (
    <OpenImageViewer
      images={images}
      initialIndex={safeInitialIndex}
      isOpen={isOpen}
      onClose={onClose}
    />
  );
}

function OpenImageViewer({ images, initialIndex = 0, isOpen, onClose }: ImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(100);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const currentImage = images[currentIndex];
  const imagePaths = getImageAssetPaths(currentImage.src);

  const closeViewer = useCallback(() => onClose(), [onClose]);

  useDialogFocus({
    isOpen,
    containerRef,
    initialFocusRef: closeButtonRef,
    onClose: closeViewer,
  });

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
        case "a":
        case "A":
          setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
          break;
        case "ArrowRight":
        case "d":
        case "D":
          setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
          break;
        case "-":
          setScale((prev) => Math.max(25, prev - 25));
          break;
        case "=":
        case "+":
          setScale((prev) => Math.min(400, prev + 25));
          break;
        case "1":
          setScale(100);
          break;
        case "2":
          setScale(200);
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, images.length]);

  // Mouse wheel zoom
  useEffect(() => {
    if (!isOpen) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -25 : 25;
      setScale((prev) => Math.max(25, Math.min(400, prev + delta)));
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener("wheel", handleWheel, { passive: false });
    }

    // Also prevent wheel on the whole viewer
    const handleGlobalWheel = (e: WheelEvent) => {
      e.preventDefault();
    };

    document.addEventListener("wheel", handleGlobalWheel, { passive: false });

    return () => {
      if (container) {
        container.removeEventListener("wheel", handleWheel);
      }
      document.removeEventListener("wheel", handleGlobalWheel);
    };
  }, [isOpen]);

  // Handle fullscreen
  const handleFullscreen = useCallback(() => {
    const elem = document.documentElement;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      elem.requestFullscreen?.();
    }
  }, []);

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  }, [images.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  }, [images.length]);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => Math.max(25, prev - 25));
  }, []);

  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(400, prev + 25));
  }, []);

  const handleReset = useCallback(() => {
    setScale(100);
  }, []);

  const handleDownload = useCallback(() => {
    const downloadSrc = currentImage.pngSrc || currentImage.src;
    const link = document.createElement("a");
    link.href = getAssetPath(downloadSrc);
    link.download = downloadSrc.split("/").pop() || "image";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [currentImage]);

  const btnClass = "flex min-h-11 min-w-11 items-center justify-center rounded text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors";

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="image-viewer-title"
      tabIndex={-1}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 overflow-hidden"
    >
      <h2 id="image-viewer-title" className="sr-only">图片查看器</h2>
      {/* Close button */}
      <div className="absolute top-4 right-4">
        <button
          ref={closeButtonRef}
          type="button"
          onClick={closeViewer}
          aria-label="关闭图片查看器"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {/* Main image */}
      <div
        className="flex h-[calc(100dvh_-_9rem)] w-[calc(100%_-_1rem)] items-center justify-center overflow-hidden sm:w-[calc(100%_-_5rem)]"
        onClick={(e) => {
          if (e.target === e.currentTarget) closeViewer();
        }}
      >
        {/* Native img keeps full-resolution zoom and original fallback behavior. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imagePaths.src}
          alt={currentImage.alt || ""}
          className="max-h-full max-w-full object-contain transition-transform duration-200"
          style={{ transform: `scale(${scale / 100})` }}
          draggable={false}
          onError={(event) => {
            if (
              imagePaths.fallbackSrc &&
              event.currentTarget.dataset.fallbackApplied !== "true"
            ) {
              event.currentTarget.dataset.fallbackApplied = "true";
              event.currentTarget.src = imagePaths.fallbackSrc;
            }
          }}
        />
      </div>

      {/* Side navigation (for larger screens) */}
      {images.length > 1 && (
        <>
          <div className="absolute left-4 top-1/2 hidden -translate-y-1/2 sm:block">
            <TooltipButton
              onClick={handlePrev}
              tooltip="上一张 (A / ←)"
              className="rounded-lg bg-zinc-800/80 p-3 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors"
            >
              <ChevronLeft className="h-6 w-6" />
            </TooltipButton>
          </div>
          <div className="absolute right-4 top-1/2 hidden -translate-y-1/2 sm:block">
            <TooltipButton
              onClick={handleNext}
              tooltip="下一张 (D / →)"
              className="rounded-lg bg-zinc-800/80 p-3 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors"
            >
              <ChevronRight className="h-6 w-6" />
            </TooltipButton>
          </div>
        </>
      )}

      {/* Bottom toolbar */}
      <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 flex max-w-[calc(100vw-1rem)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-lg bg-zinc-800 px-2 py-1.5 shadow-lg">
        {/* Navigation arrows */}
        <TooltipButton onClick={handlePrev} tooltip="上一张 (A / ←)" className={`${btnClass} sm:hidden`}>
          <ChevronLeft className="h-5 w-5" />
        </TooltipButton>
        <TooltipButton onClick={handleNext} tooltip="下一张 (D / →)" className={`${btnClass} sm:hidden`}>
          <ChevronRight className="h-5 w-5" />
        </TooltipButton>

        <div className="mx-1 h-6 w-px shrink-0 bg-zinc-600 sm:hidden" />

        {/* Zoom controls */}
        <TooltipButton onClick={handleZoomOut} tooltip="缩小 (-)" className={btnClass}>
          <Minus className="h-5 w-5" />
        </TooltipButton>
        <TooltipButton
          onClick={handleReset}
          tooltip="1=100%, 2=200%"
          className="flex min-h-11 min-w-[68px] items-center justify-center rounded px-2 text-sm text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors"
        >
          {scale}%
        </TooltipButton>
        <TooltipButton onClick={handleZoomIn} tooltip="放大 (+)" className={btnClass}>
          <Plus className="h-5 w-5" />
        </TooltipButton>

        <div className="mx-1 hidden h-6 w-px shrink-0 bg-zinc-600 sm:block" />

        {/* Download */}
        <TooltipButton onClick={handleDownload} tooltip="下载原图" className={`${btnClass} hidden sm:flex`}>
          <Download className="h-5 w-5" />
        </TooltipButton>

        {/* Fullscreen */}
        <TooltipButton onClick={handleFullscreen} tooltip="全屏" className={`${btnClass} hidden sm:flex`}>
          <Maximize2 className="h-5 w-5" />
        </TooltipButton>

        <div className="mx-1 hidden h-6 w-px shrink-0 bg-zinc-600 sm:block" />

        {/* Image counter */}
        <span aria-live="polite" className="shrink-0 px-2 text-sm text-zinc-300">
          {currentIndex + 1} / {images.length}
        </span>
      </div>
    </div>
  );
}
