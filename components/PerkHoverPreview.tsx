"use client";

import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Crosshair, Sparkles } from "lucide-react";
import { CatalogLink } from "@/components/CatalogLink";
import { SpriteIcon } from "@/components/SpriteIcon";
import { WEAPON_TYPE_SPRITES } from "@/constants/sprites";
import { getPerkWeaponApplicability } from "@/lib/perk-applicability";
import type { Perk } from "@/types";

interface PerkHoverPreviewProps {
  perk: Perk;
  href: string;
  children: ReactNode;
}

interface PreviewPosition {
  left: number;
  top: number;
  placement: "above" | "below";
}

function renderDescription(description: string): ReactNode {
  const parts = description.split(
    /(\*\*[^*\n]+?\*\*|<strong>[\s\S]*?<\/strong>)/gi,
  );

  return parts.map((part, index) => {
    const htmlStrong = part.match(/^<strong>([\s\S]*)<\/strong>$/i);
    if (htmlStrong) {
      return <strong key={index}>{htmlStrong[1]}</strong>;
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export function PerkHoverPreview({
  perk,
  href,
  children,
}: PerkHoverPreviewProps) {
  const anchorRef = useRef<HTMLAnchorElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<PreviewPosition | null>(null);
  const {
    applicableWeaponTypes,
    exclusiveWeaponNames,
    hasUnknownWeaponTypes,
    appliesToAllWeapons,
  } = getPerkWeaponApplicability(perk.weaponType, perk.weaponNames);

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
      const spaceBelow =
        window.innerHeight - anchorRect.bottom - viewportPadding;
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

  const showHoverPreview = () => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      return;
    }
    showPreview();
  };

  const hidePreview = () => setIsOpen(false);

  return (
    <>
      <CatalogLink
        ref={anchorRef}
        href={href}
        className="group block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d1ac69]"
        aria-describedby={isOpen ? tooltipId : undefined}
        onMouseEnter={showHoverPreview}
        onMouseLeave={hidePreview}
        onFocus={showPreview}
        onBlur={hidePreview}
        onKeyDown={(event) => {
          if (event.key === "Escape") hidePreview();
        }}
      >
        {children}
      </CatalogLink>

      {isOpen &&
        createPortal(
          <div
            ref={previewRef}
            id={tooltipId}
            role="tooltip"
            data-placement={position?.placement}
            className="perk-hover-preview pointer-events-none fixed z-[100] max-h-[calc(100vh-2rem)] w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-[#d1ac69]/40 bg-[#15171b]/98 shadow-[0_18px_48px_rgba(0,0,0,0.55)] backdrop-blur-sm"
            style={{
              left: position?.left ?? 0,
              top: position?.top ?? 0,
              visibility: position ? "visible" : "hidden",
            }}
          >
            <div className="border-b border-white/10 px-4 py-3">
              <p className="truncate text-sm font-semibold text-white">
                {perk.name}
              </p>
            </div>

            <div className="px-4 py-3.5">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-zinc-400">
                <Sparkles
                  aria-hidden="true"
                  className="h-4 w-4 text-[#d1ac69]"
                />
                插件效果
              </div>
              <p className="whitespace-pre-line text-sm leading-6 text-zinc-200 [&_strong]:font-semibold [&_strong]:text-[#e2bd75]">
                {perk.description
                  ? renderDescription(perk.description)
                  : "暂无插件效果说明"}
              </p>
            </div>

            <div className="border-t border-white/10 px-4 py-3.5">
              <div className="mb-2.5 flex items-center gap-2 text-xs font-medium text-zinc-400">
                <Crosshair
                  aria-hidden="true"
                  className="h-4 w-4 text-[#d1ac69]"
                />
                适用武器
              </div>

              {appliesToAllWeapons ? (
                <span className="inline-flex items-center gap-1.5 rounded border border-[#d1ac69]/30 bg-[#d1ac69]/10 px-2.5 py-1.5 text-xs font-medium text-[#e2c38b]">
                  <Crosshair aria-hidden="true" className="h-3.5 w-3.5" />
                  全部武器类型
                </span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {applicableWeaponTypes.map((type) => (
                    <span
                      key={type}
                      className="inline-flex items-center gap-1.5 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-200"
                    >
                      <SpriteIcon
                        sprite={WEAPON_TYPE_SPRITES[type]}
                        size={28}
                        className="shrink-0"
                      />
                      {type}
                    </span>
                  ))}
                  {hasUnknownWeaponTypes && (
                    <span className="inline-flex items-center rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-400">
                      其他武器类型
                    </span>
                  )}
                  {exclusiveWeaponNames.map((weaponName) => (
                    <span
                      key={weaponName}
                      className="inline-flex items-center gap-1.5 rounded border border-[#d1ac69]/25 bg-[#d1ac69]/10 px-2 py-1 text-xs font-medium text-[#e2c38b]"
                    >
                      <Crosshair
                        aria-hidden="true"
                        className="h-3.5 w-3.5"
                      />
                      {weaponName}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
