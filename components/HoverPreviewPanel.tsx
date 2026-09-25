"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

interface PreviewPosition {
  left: number;
  top: number;
  placement: "above" | "below";
}

export function HoverPreviewPanel({
  anchorRef,
  id,
  children,
  widthClassName = "w-[min(24rem,calc(100vw-2rem))]",
}: {
  anchorRef: RefObject<HTMLElement | null>;
  id: string;
  children: ReactNode;
  widthClassName?: string;
}) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<PreviewPosition | null>(null);

  useLayoutEffect(() => {
    const updatePosition = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      const preview = previewRef.current?.getBoundingClientRect();
      if (!anchor || !preview) return;

      const padding = 16;
      const gap = 12;
      const spaceBelow = window.innerHeight - anchor.bottom - padding;
      const placement =
        spaceBelow < preview.height + gap && anchor.top - padding > spaceBelow
          ? "above"
          : "below";
      const top =
        placement === "above"
          ? anchor.top - preview.height - gap
          : anchor.bottom + gap;
      setPosition({
        placement,
        top: Math.min(
          Math.max(padding, top),
          Math.max(padding, window.innerHeight - preview.height - padding),
        ),
        left: Math.min(
          Math.max(padding, anchor.left + anchor.width / 2 - preview.width / 2),
          Math.max(padding, window.innerWidth - preview.width - padding),
        ),
      });
    };

    updatePosition();
    const frame = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRef]);

  return createPortal(
    <div
      ref={previewRef}
      id={id}
      role="tooltip"
      data-placement={position?.placement}
      className={`catalog-hover-preview pointer-events-none fixed z-[100] max-h-[calc(100dvh-2rem)] overflow-hidden rounded-lg border border-[#d1ac69]/40 bg-[#15171b]/98 shadow-[0_18px_48px_rgba(0,0,0,0.55)] backdrop-blur-sm ${widthClassName}`}
      style={{
        left: position?.left ?? 0,
        top: position?.top ?? 0,
        visibility: position ? "visible" : "hidden",
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
