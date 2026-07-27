"use client";

import Image from "next/image";
import { Crosshair, Sparkles } from "lucide-react";
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { getAssetPath } from "@/lib/path";

interface SeasonTalent {
  id: string;
  name: string;
  subtitle: string;
  icon: string;
  applicableWeapons: readonly string[];
  description: ReactNode;
}

interface PreviewPosition {
  left: number;
  top: number;
  placement: "above" | "below";
}

const TALENTS: readonly SeasonTalent[] = [
  {
    id: "iron-fist",
    name: "铁拳狂徒",
    subtitle: "自动作战",
    icon: "/webp/images/season-talents/iron-fist-card.webp",
    applicableWeapons: ["全部武器类型"],
    description: (
      <>
        点击技能召唤<strong>铁拳狂徒</strong>协助战斗。仆从存在期间，长按技能可为
        <strong>铁拳狂徒</strong>指定目标；仆从存在期间，召唤物伤害增加
        <strong>30%</strong>。
      </>
    ),
  },
  {
    id: "zero",
    name: "零点",
    subtitle: "强化单体控制能力",
    icon: "/webp/images/season-talents/zero-card.webp",
    applicableWeapons: ["射手步枪", "狙击步枪", "手枪"],
    description: (
      <>
        点击技能释放泡泡，控制一名敌人，持续<strong>10 秒</strong>
        。再次释放技能使其砸地进行一次爆炸，半径<strong>5 米</strong>，造成
        <strong>237%</strong>攻击力伤害。控制效果对 Boss 无法生效。
      </>
    ),
  },
  {
    id: "grappling-hook",
    name: "劫掠钩锁",
    subtitle: "强化单体爆发能力",
    icon: "/webp/images/season-talents/grappling-hook-card.webp",
    applicableWeapons: ["高射速武器", "高爆发武器"],
    description: (
      <>
        点击技能释放<strong>钩锁</strong>，最远<strong>150 米</strong>
        。钩中普通怪物时，怪物进入<strong>10 秒</strong>眩晕及
        <strong>150%</strong>易伤效果，并被拉到身前。钩中非 Boss
        目标或场景物品时返还<strong>30 秒</strong>冷却时间。
      </>
    ),
  },
];

function TalentInfo({ talent }: { talent: SeasonTalent }) {
  const anchorRef = useRef<HTMLButtonElement>(null);
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
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      showPreview();
    }
  };

  const hidePreview = () => setIsOpen(false);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-label={`预览${talent.name}详细信息`}
        aria-describedby={isOpen ? tooltipId : undefined}
        aria-expanded={isOpen}
        onMouseEnter={showHoverPreview}
        onMouseLeave={hidePreview}
        onClick={() => {
          if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
            showPreview();
          }
        }}
        onFocus={showPreview}
        onBlur={hidePreview}
        onKeyDown={(event) => {
          if (event.key === "Escape") hidePreview();
        }}
        className="group/info relative flex h-11 w-11 shrink-0 touch-manipulation cursor-pointer items-center justify-center text-[#9aa4ab] transition-colors duration-200 hover:text-[#e2c38b] focus-visible:outline-none focus-visible:text-[#e2c38b] focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4"
      >
        <span className="flex h-5 w-5 rotate-45 items-center justify-center border border-current bg-[#101419]/80 transition-colors duration-200 group-hover/info:bg-[#d1ac69]/10">
          <span
            aria-hidden="true"
            className="flex h-3.5 w-2 -rotate-45 flex-col items-center justify-center gap-[2px]"
          >
            <span className="h-[3px] w-[3px] shrink-0 rounded-full bg-current" />
            <span className="h-[7px] w-0.5 shrink-0 rounded-full bg-current" />
          </span>
        </span>
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={previewRef}
            id={tooltipId}
            role="tooltip"
            data-placement={position?.placement}
            className="perk-hover-preview pointer-events-none fixed z-[100] max-h-[calc(100dvh-2rem)] w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-[#d1ac69]/40 bg-[#15171b]/98 shadow-[0_18px_48px_rgba(0,0,0,0.55)] backdrop-blur-sm"
            style={{
              left: position?.left ?? 0,
              top: position?.top ?? 0,
              visibility: position ? "visible" : "hidden",
            }}
          >
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded border border-[#d1ac69]/30 bg-black/30">
                <Image
                  src={getAssetPath(talent.icon)}
                  alt=""
                  fill
                  sizes="48px"
                  className="object-contain p-1"
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-white">
                  {talent.name}
                </p>
                <p className="mt-0.5 truncate text-xs text-zinc-400">
                  {talent.subtitle}
                </p>
              </div>
            </div>

            <div className="px-4 py-3.5">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-zinc-400">
                <Sparkles aria-hidden="true" className="h-4 w-4 text-[#d1ac69]" />
                天赋效果
              </div>
              <p className="text-sm leading-6 text-zinc-200 [&_strong]:font-semibold [&_strong]:text-[#e2bd75]">
                {talent.description}
              </p>
            </div>

            <div className="border-t border-white/10 px-4 py-3.5">
              <div className="mb-2.5 flex items-center gap-2 text-xs font-medium text-zinc-400">
                <Crosshair aria-hidden="true" className="h-4 w-4 text-[#d1ac69]" />
                适用武器
              </div>
              <div className="flex flex-wrap gap-1.5">
                {talent.applicableWeapons.map((weapon) => (
                  <span
                    key={weapon}
                    className="inline-flex items-center gap-1.5 rounded border border-[#d1ac69]/25 bg-[#d1ac69]/10 px-2.5 py-1.5 text-xs font-medium text-[#e2c38b]"
                  >
                    <Crosshair aria-hidden="true" className="h-3.5 w-3.5" />
                    {weapon}
                  </span>
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

export function SeasonTalentCatalog() {
  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 justify-items-center gap-5 sm:grid-cols-3 sm:gap-6">
      {TALENTS.map((talent) => (
        <article
          key={talent.id}
          className="relative aspect-[3/4] w-full max-w-[19rem] select-none"
        >
          <Image
            src={getAssetPath("/webp/images/season-talents/card-frame.webp")}
            alt=""
            fill
            sizes="(min-width: 640px) 19rem, calc(100vw - 2rem)"
            className="pointer-events-none object-fill"
          />
          <Image
            src={getAssetPath(talent.icon)}
            alt=""
            width={220}
            height={220}
            className="pointer-events-none absolute left-1/2 top-[18%] w-[62%] -translate-x-1/2 drop-shadow-[0_10px_14px_rgba(0,0,0,0.6)]"
          />
          <div className="absolute inset-x-[9%] bottom-[18%] text-center">
            <div className="relative mx-auto flex h-11 w-fit items-center justify-center">
              <h2 className="whitespace-nowrap text-[1.55rem] font-bold leading-none tracking-[0.055em] text-[#bda66f] subpixel-antialiased [font-family:'Microsoft_YaHei_UI','Microsoft_YaHei',Arial,sans-serif]">
                {talent.name}
              </h2>
              <div className="absolute left-full top-0 -ml-1">
                <TalentInfo talent={talent} />
              </div>
            </div>
            <p className="mt-1 whitespace-nowrap text-[0.95rem] font-semibold leading-5 tracking-[0.02em] text-[#8f8d92] subpixel-antialiased [font-family:'Microsoft_YaHei_UI','Microsoft_YaHei',Arial,sans-serif]">
              {talent.subtitle}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}
