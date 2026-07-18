"use client";

import Link from "next/link";
import { Crosshair, Scale } from "lucide-react";
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { OverlimitWeaponApplicability } from "@/components/OverlimitCardMeta";
import type { OverlimitCard } from "@/types";

interface PreviewPosition {
  left: number;
  top: number;
  placement: "above" | "below";
}

export function OverlimitHoverPreview({
  card,
  href,
  children,
}: {
  card: OverlimitCard;
  href: string;
  children: ReactNode;
}) {
  const anchorRef = useRef<HTMLAnchorElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<PreviewPosition | null>(null);

  useLayoutEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      const anchor = anchorRef.current;
      const preview = previewRef.current;
      if (!anchor || !preview) return;

      const anchorRect = anchor.getBoundingClientRect();
      const previewRect = preview.getBoundingClientRect();
      const viewportPadding = 16;
      const gap = 12;
      const spaceAbove = anchorRect.top - viewportPadding;
      const spaceBelow = window.innerHeight - anchorRect.bottom - viewportPadding;
      const placement =
        spaceBelow < previewRect.height + gap && spaceAbove > spaceBelow
          ? "above"
          : "below";
      const desiredTop =
        placement === "below"
          ? anchorRect.bottom + gap
          : anchorRect.top - previewRect.height - gap;
      const desiredLeft =
        anchorRect.left + anchorRect.width / 2 - previewRect.width / 2;
      const maxTop = Math.max(
        viewportPadding,
        window.innerHeight - previewRect.height - viewportPadding,
      );

      setPosition({
        placement,
        top: Math.min(Math.max(viewportPadding, desiredTop), maxTop),
        left: Math.min(
          Math.max(viewportPadding, desiredLeft),
          window.innerWidth - previewRect.width - viewportPadding,
        ),
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  const showPreview = () => {
    setPosition(null);
    setIsOpen(true);
  };
  const hidePreview = () => setIsOpen(false);

  return (
    <>
      <Link
        ref={anchorRef}
        href={href}
        className="group block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d1ac69]"
        aria-describedby={isOpen ? tooltipId : undefined}
        onMouseEnter={() => {
          if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
            showPreview();
          }
        }}
        onMouseLeave={hidePreview}
        onFocus={showPreview}
        onBlur={hidePreview}
        onKeyDown={(event) => {
          if (event.key === "Escape") hidePreview();
        }}
      >
        {children}
      </Link>

      {isOpen &&
        createPortal(
          <div
            ref={previewRef}
            id={tooltipId}
            role="tooltip"
            data-placement={position?.placement}
            className="perk-hover-preview pointer-events-none fixed z-[100] max-h-[calc(100vh-2rem)] w-[min(13rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-[#d1ac69]/40 bg-[#15171b]/98 shadow-[0_18px_48px_rgba(0,0,0,0.55)] backdrop-blur-sm"
            style={{
              left: position?.left ?? 0,
              top: position?.top ?? 0,
              visibility: position ? "visible" : "hidden",
            }}
          >
            <div className="flex items-center justify-between gap-3 px-2 py-3">
              <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
                <Scale aria-hidden="true" className="h-4 w-4 text-[#d1ac69]" />
                抽取权重
              </div>
              <strong className="text-sm font-semibold tabular-nums text-[#e2c38b]">
                {card.weight}
              </strong>
            </div>
            <div className="border-t border-white/10 px-2 py-3">
              <div className="mb-2.5 flex items-center gap-2 text-xs font-medium text-zinc-400">
                <Crosshair aria-hidden="true" className="h-4 w-4 text-[#d1ac69]" />
                适用武器
              </div>
              <OverlimitWeaponApplicability
                weaponType={card.weaponType}
                weaponNames={card.weaponNames}
                compact
              />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
