"use client";

import Image from "next/image";
import {
  Check,
  ChevronDown,
  Crosshair,
  Layers3,
  Plus,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import passiveData from "@/data/season-talents/s3/passives.json";
import zeroData from "@/data/season-talents/s3/zero.json";
import { getAssetPath } from "@/lib/path";

interface TalentNode {
  id: string;
  name: string;
  phase: number;
  column: number;
  prerequisites: string[];
  maxLevel: number;
  powerful: boolean;
  icon: string;
  descriptions: string[];
}

interface TalentData {
  id: string;
  season: string;
  name: string;
  subtitle: string;
  applicableWeapons: string[];
  nodes: TalentNode[];
}

interface PassiveTalent {
  id: string;
  passiveSkillId: string;
  name: string;
  unlockLevel: number;
  tags: string[];
  icon: string;
  preview: string;
  description: string;
}

interface PassiveTalentData {
  season: string;
  passives: PassiveTalent[];
}

const DATA = zeroData as TalentData;
const PASSIVE_DATA = passiveData as PassiveTalentData;
const ROOT_NODE_ID = "3002102";
const TALENT_BUILD_STORAGE_KEY = "nzm-wiki:season-talents:s3:zero:v1";
const EXCLUSIVE_HEIGHT = 500;
const GENERAL_HEIGHT = 500;
const DEFAULT_EXCLUSIVE_LEVELS = Object.fromEntries(
  DATA.nodes
    .filter((node) => node.id !== ROOT_NODE_ID && node.column <= 3)
    .map((node) => [node.id, node.maxLevel]),
) as Record<string, number>;

interface SavedTalentBuild {
  version: 1;
  levels: Record<string, number>;
  passiveId: string | null;
}

const exclusivePositions: Record<string, { x: number; y: number }> = {
  "3002202": { x: 50, y: 48 },
  "3002301": { x: 23, y: 148 },
  "3002303": { x: 77, y: 148 },
  "3002402": { x: 50, y: 248 },
  "3002501": { x: 23, y: 348 },
  "3002503": { x: 77, y: 348 },
  "3002602": { x: 50, y: 448 },
};

const phaseLabels: Record<number, string> = {
  2: "初始节点",
  3: "进阶一",
  4: "核心强化",
  5: "进阶二",
  6: "终极节点",
};

function renderRichText(value: string): ReactNode[] {
  const result: ReactNode[] = [];
  const pattern = /<(qiangdiao|T002)>(.*?)<\/>/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    if (match.index > cursor) {
      result.push(value.slice(cursor, match.index));
    }

    result.push(
      <strong
        key={`${match.index}-${match[1]}`}
        className={match[1] === "T002" ? "text-[#78d9ff]" : "text-[#ffd45e]"}
      >
        {match[2]}
      </strong>,
    );
    cursor = pattern.lastIndex;
  }

  if (cursor < value.length) {
    result.push(value.slice(cursor));
  }

  return result;
}

function TalentDescription({ value }: { value: string }) {
  return (
    <div className="space-y-2 text-[0.95rem] leading-7 text-slate-200">
      {value.split("\n").map((paragraph, index) => (
        <p key={`${index}-${paragraph.slice(0, 12)}`}>
          {renderRichText(paragraph)}
        </p>
      ))}
    </div>
  );
}

function RankSelector({
  node,
  level,
  onChange,
}: {
  node: TalentNode;
  level: number;
  onChange: (level: number) => void;
}) {
  if (level === 0) {
    return (
      <div className="mt-5 border-t border-cyan-100/10 pt-4 text-sm text-slate-400">
        当前仅预览 1 级效果，双击节点后会直接加至满级。
      </div>
    );
  }

  if (node.maxLevel === 1) return null;

  return (
    <div className="mt-5 border-t border-cyan-100/10 pt-4">
      <p className="mb-2.5 text-xs font-semibold tracking-[0.16em] text-slate-400">
        等级效果
      </p>
      <div className="flex flex-wrap gap-2" aria-label={`${node.name}等级`}>
        {Array.from({ length: node.maxLevel }, (_, index) => index + 1).map(
          (rank) => (
            <button
              key={rank}
              type="button"
              aria-pressed={rank === level}
              aria-label={`将${node.name}加到${rank}级`}
              onClick={() => onChange(rank)}
              className={`flex h-11 min-w-11 touch-manipulation items-center justify-center rounded border px-3 text-sm font-bold tabular-nums transition-colors duration-200 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 ${
                rank === level
                  ? "border-cyan-300 bg-cyan-300/15 text-cyan-100"
                  : "border-slate-600 bg-slate-950/35 text-slate-400 hover:border-slate-400 hover:text-white"
              }`}
            >
              Lv.{rank}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

function DetailCard({
  node,
  level,
  onLevelChange,
  compact = false,
}: {
  node: TalentNode;
  level: number;
  onLevelChange: (level: number) => void;
  compact?: boolean;
}) {
  const isRoot = node.id === ROOT_NODE_ID;
  const category = isRoot
    ? "赛季技能"
    : node.column <= 3
      ? node.powerful
        ? "专属 · 关键天赋"
        : "专属天赋"
      : "通用天赋";
  const displayLevel = Math.max(1, level);

  return (
    <section
      aria-live="polite"
      aria-label={`${node.name}详情`}
      className={`relative overflow-hidden border border-cyan-300/35 bg-[#051721]/95 shadow-[0_22px_70px_rgba(0,0,0,0.35)] ${
        compact ? "rounded-lg p-4" : "h-full min-h-[36rem] rounded-sm p-5 sm:p-6"
      }`}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300 to-transparent"
      />
      <div className="flex items-start gap-4">
        <div
          className={`relative shrink-0 bg-cyan-700/90 [clip-path:polygon(18%_0,82%_0,100%_18%,100%_82%,82%_100%,18%_100%,0_82%,0_18%)] ${
            compact ? "h-16 w-16" : "h-20 w-20"
          }`}
        >
          <span className="absolute inset-px overflow-hidden bg-[#071923] [clip-path:polygon(18%_0,82%_0,100%_18%,100%_82%,82%_100%,18%_100%,0_82%,0_18%)]">
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(40,166,214,0.18),transparent_66%)]"
            />
            <Image
              src={getAssetPath(node.icon)}
              alt=""
              fill
              sizes={compact ? "64px" : "80px"}
              className="object-cover"
            />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">
              {category}
            </span>
            {node.powerful && (
              <span className="inline-flex items-center gap-1 rounded bg-amber-300/10 px-2 py-1 text-[0.68rem] font-semibold text-amber-200">
                <Star aria-hidden="true" className="h-3 w-3 fill-current" />
                关键
              </span>
            )}
          </div>
          <h2 className="mt-1 text-xl font-bold tracking-wide text-white sm:text-2xl">
            {node.name}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            阶段 {node.phase} · 节点 {node.id}
          </p>
        </div>
      </div>

      <div className="mt-5 border-t border-cyan-100/10 pt-4">
        <div className="mb-2.5 flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-slate-400">
          <Sparkles aria-hidden="true" className="h-4 w-4 text-[#ffd45e]" />
          天赋效果
        </div>
        <TalentDescription value={node.descriptions[displayLevel - 1]} />
      </div>

      <RankSelector node={node} level={level} onChange={onLevelChange} />
    </section>
  );
}

function TalentNodeButton({
  node,
  selected,
  level,
  dimmed,
  x,
  y,
  onSelect,
  onActivate,
}: {
  node: TalentNode;
  selected: boolean;
  level: number;
  dimmed: boolean;
  x: number;
  y: number;
  onSelect: (node: TalentNode) => void;
  onActivate: (node: TalentNode) => void;
}) {
  const allocated = level > 0;

  return (
    <button
      type="button"
      aria-pressed={allocated}
      aria-label={`${node.name}${allocated ? `已加${level}级` : "未加点"}，单击查看，双击${dimmed ? "替换同阶段天赋" : "加到满级"}`}
      title={`单击查看 · 双击${dimmed ? "切换并加满" : "加满"}`}
      onClick={() => onSelect(node)}
      onDoubleClick={() => onActivate(node)}
      className={`group/node absolute z-10 flex w-[5.5rem] -translate-x-1/2 -translate-y-1/2 touch-manipulation cursor-pointer flex-col items-center transition-[opacity,filter] duration-200 focus-visible:outline-none motion-reduce:transition-none ${
        dimmed ? "opacity-35 grayscale hover:opacity-65 hover:grayscale-0" : ""
      }`}
      style={{ left: `${x}%`, top: y }}
    >
      <span
        className={`relative block h-[3.75rem] w-[3.75rem] transition-[background-color,filter,transform] duration-200 motion-reduce:transition-none [clip-path:polygon(18%_0,82%_0,100%_18%,100%_82%,82%_100%,18%_100%,0_82%,0_18%)] group-active/node:scale-95 ${
          allocated
            ? "bg-cyan-200 brightness-110 drop-shadow-[0_0_8px_rgba(74,211,255,0.42)]"
            : selected
              ? "bg-cyan-500"
              : "bg-cyan-800/90 group-hover/node:bg-cyan-400 group-hover/node:brightness-110"
        }`}
      >
        <span className="absolute inset-px overflow-hidden bg-[#071923] [clip-path:polygon(18%_0,82%_0,100%_18%,100%_82%,82%_100%,18%_100%,0_82%,0_18%)]">
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(40,166,214,0.18),transparent_65%)]"
          />
          <Image
            src={getAssetPath(node.icon)}
            alt=""
            fill
            sizes="60px"
            className="object-cover transition-[filter,transform] duration-200 motion-reduce:transition-none group-hover/node:scale-[1.04] group-hover/node:brightness-110"
          />
        </span>
        {node.powerful && (
          <span
            aria-hidden="true"
            className="absolute right-[0.3rem] top-[0.3rem] h-1.5 w-1.5 rotate-45 bg-amber-300 shadow-[0_0_5px_rgba(252,211,77,0.75)]"
          />
        )}
      </span>
      <span
        className={`mt-1 max-w-full truncate text-center text-[0.72rem] font-semibold leading-4 transition-colors duration-200 group-focus-visible/node:underline group-focus-visible/node:decoration-2 group-focus-visible/node:underline-offset-4 ${
          allocated ? "text-cyan-100" : "text-slate-300 group-hover/node:text-white"
        }`}
      >
        {node.name}
      </span>
      <span className="sr-only">{allocated ? `当前 ${level} 级` : "未加点"}</span>
      <span className="mt-1 flex h-2 items-center justify-center gap-1.5" aria-hidden="true">
        {Array.from({ length: node.maxLevel }, (_, index) => (
          <span
            key={index}
            className={`h-[0.4rem] w-[0.4rem] rotate-45 border transition-colors duration-200 ${
              index < level
                ? "border-cyan-200 bg-cyan-300/55"
                : "border-cyan-800 bg-[#06151e] group-hover/node:border-cyan-500"
            }`}
          />
        ))}
      </span>
    </button>
  );
}

function ExclusiveConnectors() {
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 100 ${EXCLUSIVE_HEIGHT}`}
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full text-cyan-700/45"
    >
      <g fill="none" stroke="currentColor" strokeWidth="0.7" vectorEffect="non-scaling-stroke">
        <path d="M50 76 V98 H23 V120 M50 98 H77 V120" />
        <path d="M23 176 V198 H50 V220 M77 176 V198 H50" />
        <path d="M50 276 V298 H23 V320 M50 298 H77 V320" />
        <path d="M23 376 V398 H50 V420 M77 376 V398 H50" />
      </g>
    </svg>
  );
}

function GeneralConnectors() {
  const xs = [12.5, 37.5, 62.5, 87.5];
  const centers = [48, 148, 248, 348, 448];

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 100 ${GENERAL_HEIGHT}`}
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full text-cyan-800/35"
    >
      <g fill="none" stroke="currentColor" strokeWidth="0.6" vectorEffect="non-scaling-stroke">
        {centers.slice(0, -1).map((center, rowIndex) => {
          const nextCenter = centers[rowIndex + 1];
          const rail = (center + nextCenter) / 2;
          return (
            <g key={center}>
              <path d={`M${xs[0]} ${rail} H${xs[xs.length - 1]}`} />
              {xs.map((x) => (
                <path key={x} d={`M${x} ${center + 28} V${nextCenter - 28}`} />
              ))}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

function MobileNode({
  node,
  selected,
  level,
  dimmed,
  onSelect,
  onActivate,
  onLevelChange,
}: {
  node: TalentNode;
  selected: boolean;
  level: number;
  dimmed: boolean;
  onSelect: (node: TalentNode) => void;
  onActivate: (node: TalentNode) => void;
  onLevelChange: (level: number) => void;
}) {
  const allocated = level > 0;

  return (
    <div
      className={`overflow-hidden rounded-lg border bg-[#081720]/85 transition-[border-color,opacity,filter] duration-200 motion-reduce:transition-none ${
        allocated ? "border-cyan-500/60" : "border-cyan-950"
      } ${dimmed ? "opacity-45 grayscale" : ""}`}
    >
      <button
        type="button"
        aria-expanded={selected}
        aria-pressed={allocated}
        aria-label={`${node.name}${allocated ? `已加${level}级` : "未加点"}，单击查看，双击${dimmed ? "替换同阶段天赋" : "加到满级"}`}
        onClick={() => onSelect(node)}
        onDoubleClick={() => onActivate(node)}
        className={`flex min-h-20 w-full touch-manipulation items-center gap-3 px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:[&_h3]:underline focus-visible:[&_h3]:decoration-2 focus-visible:[&_h3]:underline-offset-4 ${
          selected ? "bg-cyan-300/10" : "hover:bg-cyan-300/5"
        }`}
      >
        <span className="relative h-14 w-14 shrink-0 overflow-hidden border border-cyan-700 bg-[#0a2330] [clip-path:polygon(18%_0,82%_0,100%_18%,100%_82%,82%_100%,18%_100%,0_82%,0_18%)]">
          <Image
            src={getAssetPath(node.icon)}
            alt=""
            fill
            sizes="56px"
            className="object-cover"
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-white">{node.name}</h3>
            {node.powerful && (
              <span className="text-[0.68rem] font-semibold text-amber-200">关键</span>
            )}
          </span>
          <span className="mt-1 flex items-center gap-3 text-xs text-slate-400">
            <span>{allocated ? `已加 ${level}/${node.maxLevel} 级` : `双击加满 · 最高 ${node.maxLevel} 级`}</span>
            <span className="flex items-center gap-1" aria-hidden="true">
              {Array.from({ length: node.maxLevel }, (_, index) => (
                <span
                  key={index}
                  className={`h-1.5 w-1.5 rotate-45 border ${
                    index < level
                      ? "border-cyan-200 bg-cyan-300/60"
                      : "border-cyan-800 bg-[#06151e]"
                  }`}
                />
              ))}
            </span>
          </span>
        </span>
        <span className="text-xl text-cyan-300" aria-hidden="true">
          {selected ? "−" : "+"}
        </span>
      </button>
      {selected && (
        <div className="border-t border-cyan-900/60 p-3">
          <DetailCard
            node={node}
            level={level}
            onLevelChange={onLevelChange}
            compact
          />
        </div>
      )}
    </div>
  );
}

function PassiveTalentIcon({
  talent,
  sizes,
}: {
  talent: PassiveTalent;
  sizes: string;
}) {
  return (
    <span className="relative block h-full w-full overflow-hidden bg-[#061823] [clip-path:polygon(18%_0,82%_0,100%_18%,100%_82%,82%_100%,18%_100%,0_82%,0_18%)]">
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_44%,rgba(62,197,244,0.2),transparent_66%)]"
      />
      <Image
        src={getAssetPath(talent.icon)}
        alt=""
        fill
        sizes={sizes}
        className="object-contain p-1"
      />
    </span>
  );
}

function PassiveTalentSelector({
  selectedTalent,
  onSelect,
  onClose,
}: {
  selectedTalent: PassiveTalent;
  onSelect: (talent: PassiveTalent) => void;
  onClose: () => void;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const requestClose = useCallback(() => {
    if (closeTimerRef.current) return;

    setIsVisible(false);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    closeTimerRef.current = setTimeout(onClose, reducedMotion ? 0 : 150);
  }, [onClose]);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const openFrame = window.requestAnimationFrame(() => setIsVisible(true));

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.cancelAnimationFrame(openFrame);
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [requestClose]);

  return (
    <div
      className={`fixed inset-0 z-[2147483647] flex items-center justify-center bg-[#01070c]/90 p-2 transition-[opacity,backdrop-filter] motion-reduce:transition-none sm:p-5 ${
        isVisible
          ? "opacity-100 backdrop-blur-sm duration-200 ease-out"
          : "pointer-events-none opacity-0 backdrop-blur-none duration-150 ease-in"
      }`}
      role="presentation"
    >
      <section
        id="s3-passive-talent-selector"
        role="dialog"
        aria-modal="true"
        aria-labelledby="passive-selector-heading"
        className={`relative flex max-h-[calc(100dvh-1rem)] w-full max-w-[76rem] flex-col overflow-hidden border border-cyan-300/55 bg-[#03141d] shadow-[0_30px_100px_rgba(0,0,0,0.78),0_0_45px_rgba(8,145,178,0.09)] transition-[opacity,transform] [clip-path:polygon(12px_0,calc(100%_-_12px)_0,100%_12px,100%_calc(100%_-_12px),calc(100%_-_12px)_100%,12px_100%,0_calc(100%_-_12px),0_12px)] motion-reduce:translate-y-0 motion-reduce:scale-100 motion-reduce:transition-none sm:max-h-[calc(100dvh-2.5rem)] ${
          isVisible
            ? "translate-y-0 scale-100 opacity-100 duration-200 ease-out"
            : "translate-y-3 scale-[0.985] opacity-0 duration-150 ease-in"
        }`}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 opacity-25 [background-image:linear-gradient(rgba(62,190,225,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(62,190,225,0.05)_1px,transparent_1px)] [background-size:32px_32px]"
        />
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 z-20 h-px bg-gradient-to-r from-transparent via-cyan-100 to-transparent"
        />
        <span aria-hidden="true" className="pointer-events-none absolute left-2 top-2 z-30 h-5 w-5 border-l border-t border-cyan-100/80" />
        <span aria-hidden="true" className="pointer-events-none absolute right-2 top-2 z-30 h-5 w-5 border-r border-t border-cyan-100/80" />
        <span aria-hidden="true" className="pointer-events-none absolute bottom-2 left-2 z-30 h-5 w-5 border-b border-l border-cyan-100/60" />
        <span aria-hidden="true" className="pointer-events-none absolute bottom-2 right-2 z-30 h-5 w-5 border-b border-r border-cyan-100/60" />

        <header className="relative z-10 flex min-h-[4.5rem] items-center justify-center overflow-hidden border-b border-cyan-400/35 bg-[linear-gradient(90deg,rgba(5,28,39,0.96),rgba(7,55,70,0.72),rgba(5,28,39,0.96))] px-16 py-3">
          <span
            aria-hidden="true"
            className="absolute bottom-0 left-1/2 h-px w-56 -translate-x-1/2 bg-gradient-to-r from-transparent via-cyan-200 to-transparent"
          />
          <div className="absolute left-6 hidden items-center gap-2 font-mono text-[0.62rem] tracking-[0.2em] text-cyan-500/80 md:flex">
            <span className="h-1.5 w-1.5 rotate-45 bg-cyan-300" />
            S3 // PASSIVE CONFIG
          </div>
          <h2
            id="passive-selector-heading"
            className="text-lg font-black tracking-[0.12em] text-cyan-50 drop-shadow-[0_0_12px_rgba(103,232,249,0.2)] sm:text-2xl"
          >
            切换被动天赋
          </h2>
          <button
            type="button"
            onClick={requestClose}
            aria-label="关闭被动天赋弹窗"
            className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 touch-manipulation items-center justify-center border border-cyan-700/80 bg-[#061923]/90 text-slate-300 transition-[border-color,background-color,color] hover:border-cyan-300 hover:bg-cyan-950 hover:text-white focus-visible:outline-none focus-visible:text-cyan-200 sm:right-5"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </header>

        <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1.55fr)_minmax(21rem,0.85fr)]">
          <div className="flex min-h-max flex-col border-cyan-700/20 bg-[radial-gradient(circle_at_35%_20%,rgba(17,123,158,0.1),transparent_46%)] p-3 sm:p-5 lg:min-h-0 lg:border-r">
            <div className="relative aspect-video shrink-0 overflow-hidden border border-cyan-300/45 bg-slate-950 shadow-[0_16px_45px_rgba(0,0,0,0.28)] [clip-path:polygon(8px_0,100%_0,100%_calc(100%_-_8px),calc(100%_-_8px)_100%,0_100%,0_8px)]">
              <Image
                src={getAssetPath(selectedTalent.preview)}
                alt={`${selectedTalent.name}效果预览`}
                fill
                priority
                sizes="(min-width: 1024px) 720px, 94vw"
                className="object-cover"
              />
              <span
                aria-hidden="true"
                className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,18,26,0.02),transparent_75%,rgba(2,18,26,0.4))] shadow-[inset_0_0_52px_rgba(0,12,20,0.52)]"
              />
              <span className="absolute left-3 top-3 border-l-2 border-cyan-300 bg-[#03151e]/80 px-2 py-1 font-mono text-[0.6rem] font-bold tracking-[0.18em] text-cyan-200">
                COMBAT PREVIEW
              </span>
              <span className="absolute bottom-3 right-3 bg-[#03151e]/80 px-2 py-1 font-mono text-[0.6rem] tracking-[0.12em] text-slate-300">
                ID {selectedTalent.id}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="S3 被动天赋列表">
              {PASSIVE_DATA.passives.map((talent) => {
                const selected = talent.id === selectedTalent.id;
                return (
                  <button
                    key={talent.id}
                    type="button"
                    aria-pressed={selected}
                    aria-label={`选择${talent.name}`}
                    onClick={() => onSelect(talent)}
                    className={`group relative min-w-0 touch-manipulation overflow-hidden border p-2 text-center transition-[border-color,background-color,transform,box-shadow] active:scale-[0.98] focus-visible:outline-none focus-visible:[&_span:last-child]:underline focus-visible:[&_span:last-child]:underline-offset-4 motion-reduce:transform-none ${
                      selected
                        ? "border-cyan-200 bg-[linear-gradient(180deg,rgba(29,176,214,0.2),rgba(6,28,39,0.92))] shadow-[inset_0_0_18px_rgba(34,211,238,0.08),0_0_16px_rgba(34,211,238,0.08)]"
                        : "border-cyan-950/90 bg-[#06131c]/90 hover:border-cyan-600 hover:bg-cyan-950/45"
                    }`}
                  >
                    {selected && (
                      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-cyan-200" />
                    )}
                    <span
                      className={`relative mx-auto block h-14 w-14 transition-colors [clip-path:polygon(18%_0,82%_0,100%_18%,100%_82%,82%_100%,18%_100%,0_82%,0_18%)] sm:h-16 sm:w-16 ${
                        selected ? "bg-cyan-100" : "bg-cyan-900 group-hover:bg-cyan-500"
                      }`}
                    >
                      <span className="absolute inset-px">
                        <PassiveTalentIcon talent={talent} sizes="64px" />
                      </span>
                      {selected && (
                        <span className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-200 text-[#03131c]">
                          <Check aria-hidden="true" className="h-3.5 w-3.5 stroke-[3]" />
                        </span>
                      )}
                    </span>
                    <span
                      className={`mt-1.5 block truncate text-[0.68rem] font-bold tracking-wide sm:text-xs ${
                        selected ? "text-cyan-50" : "text-slate-400 group-hover:text-slate-200"
                      }`}
                    >
                      {talent.name.replace("扭蛋机", "")}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div
            className="relative flex min-h-[24rem] shrink-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_100%_0%,rgba(13,105,132,0.16),transparent_42%),linear-gradient(180deg,rgba(4,25,35,0.94),rgba(3,18,26,0.98))] p-4 sm:p-6 lg:shrink"
            aria-live="polite"
          >
            <span aria-hidden="true" className="absolute right-0 top-0 h-24 w-24 bg-[linear-gradient(135deg,transparent_48%,rgba(34,211,238,0.08)_49%,rgba(34,211,238,0.08)_52%,transparent_53%)]" />
            <div className="flex items-start gap-3 border-b border-cyan-100/10 pb-4">
              <span className="relative h-16 w-16 shrink-0 bg-cyan-500 [clip-path:polygon(18%_0,82%_0,100%_18%,100%_82%,82%_100%,18%_100%,0_82%,0_18%)]">
                <span className="absolute inset-px">
                  <PassiveTalentIcon talent={selectedTalent} sizes="64px" />
                </span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[0.62rem] font-bold tracking-[0.18em] text-cyan-400">
                  S3 PASSIVE UNIT · {selectedTalent.passiveSkillId}
                </p>
                <h3 className="mt-1 text-xl font-black tracking-wide text-white sm:text-2xl">
                  {selectedTalent.name}
                </h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selectedTalent.tags.map((tag) => (
                    <span
                      key={tag}
                      className="border border-amber-300/20 bg-amber-300/10 px-2 py-0.5 text-[0.68rem] font-semibold text-amber-200"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 border-l-2 border-cyan-400/25 pl-4">
              <p className="mb-3 font-mono text-[0.62rem] font-bold tracking-[0.18em] text-slate-500">
                EFFECT DESCRIPTION
              </p>
              <TalentDescription value={selectedTalent.description} />
            </div>
            <div className="mt-auto flex flex-col gap-4 border-t border-cyan-100/10 pt-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="font-mono text-[0.62rem] tracking-[0.16em] text-slate-500">UNLOCK CONDITION</p>
                <p className="mt-1 text-sm text-slate-300">
                  赛季等级 <strong className="text-lg text-amber-300">{selectedTalent.unlockLevel}</strong> 解锁
                </p>
              </div>
              <button
                type="button"
                onClick={requestClose}
                className="min-h-11 min-w-40 touch-manipulation bg-cyan-300 px-7 py-2 text-sm font-black tracking-[0.12em] text-[#03202b] shadow-[0_0_22px_rgba(34,211,238,0.14)] transition-[background-color,transform,box-shadow] [clip-path:polygon(8px_0,100%_0,100%_calc(100%_-_8px),calc(100%_-_8px)_100%,0_100%,0_8px)] hover:bg-cyan-100 hover:shadow-[0_0_28px_rgba(34,211,238,0.22)] active:scale-[0.98] focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-4 motion-reduce:transform-none"
              >
                确认选择
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export function ZeroTalentTree() {
  const [selectedNodeId, setSelectedNodeId] = useState(ROOT_NODE_ID);
  const [talentLevels, setTalentLevels] = useState<Record<string, number>>(() => ({
    ...DEFAULT_EXCLUSIVE_LEVELS,
  }));
  const [selectedPassiveId, setSelectedPassiveId] = useState<string | null>(null);
  const [passiveSelectorOpen, setPassiveSelectorOpen] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const closePassiveSelector = useCallback(() => setPassiveSelectorOpen(false), []);

  const nodeMap = useMemo(
    () => new Map(DATA.nodes.map((node) => [node.id, node])),
    [],
  );
  const selectedNode = nodeMap.get(selectedNodeId) ?? DATA.nodes[0];
  const selectedLevel =
    selectedNode.id === ROOT_NODE_ID ? 1 : (talentLevels[selectedNode.id] ?? 0);
  const selectedPassive =
    PASSIVE_DATA.passives.find((talent) => talent.id === selectedPassiveId) ?? null;
  const exclusiveNodes = DATA.nodes.filter(
    (node) => node.id !== ROOT_NODE_ID && node.column <= 3,
  );
  const generalNodes = DATA.nodes.filter((node) => node.column >= 5);

  const updateNodeLevel = useCallback((node: TalentNode, requestedLevel: number) => {
    if (node.id === ROOT_NODE_ID) return;

    const level = Math.max(1, Math.min(node.maxLevel, requestedLevel));
    setTalentLevels((current) => {
      const next = { ...current };

      if (node.column >= 5) {
        DATA.nodes.forEach((candidate) => {
          if (candidate.column >= 5 && candidate.phase === node.phase) {
            delete next[candidate.id];
          }
        });
      }

      next[node.id] = level;
      return next;
    });
  }, []);

  const selectNode = (node: TalentNode) => {
    setSelectedNodeId(node.id);
  };

  const activateNode = (node: TalentNode) => {
    setSelectedNodeId(node.id);
    if (node.id !== ROOT_NODE_ID) {
      updateNodeLevel(node, node.maxLevel);
    }
  };

  const isGeneralNodeDimmed = (node: TalentNode) =>
    node.column >= 5 &&
    !talentLevels[node.id] &&
    generalNodes.some(
      (candidate) =>
        candidate.phase === node.phase && Boolean(talentLevels[candidate.id]),
    );

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(TALENT_BUILD_STORAGE_KEY);
      if (!raw) return;

      const saved = JSON.parse(raw) as Partial<SavedTalentBuild>;
      if (saved.version !== 1 || typeof saved.levels !== "object" || !saved.levels) {
        return;
      }

      const restoredLevels: Record<string, number> = {
        ...DEFAULT_EXCLUSIVE_LEVELS,
      };
      const occupiedGeneralPhases = new Set<number>();
      DATA.nodes.forEach((node) => {
        if (node.id === ROOT_NODE_ID) return;
        const storedLevel = saved.levels?.[node.id];
        if (!Number.isFinite(storedLevel) || Number(storedLevel) <= 0) return;
        if (node.column >= 5 && occupiedGeneralPhases.has(node.phase)) return;

        restoredLevels[node.id] = Math.min(node.maxLevel, Math.floor(Number(storedLevel)));
        if (node.column >= 5) occupiedGeneralPhases.add(node.phase);
      });
      setTalentLevels(restoredLevels);

      if (
        typeof saved.passiveId === "string" &&
        PASSIVE_DATA.passives.some((talent) => talent.id === saved.passiveId)
      ) {
        setSelectedPassiveId(saved.passiveId);
      }
    } catch {
      // Ignore unavailable or malformed local storage and keep a clean build.
    } finally {
      setStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!storageReady) return;

    const saved: SavedTalentBuild = {
      version: 1,
      levels: talentLevels,
      passiveId: selectedPassiveId,
    };

    try {
      window.localStorage.setItem(TALENT_BUILD_STORAGE_KEY, JSON.stringify(saved));
    } catch {
      // The builder remains usable when storage is disabled.
    }
  }, [selectedPassiveId, storageReady, talentLevels]);

  return (
    <article className="relative isolate space-y-4">
      <header className="relative overflow-hidden rounded-sm border border-cyan-300/40 bg-[#05151f] px-4 py-4 shadow-[0_20px_70px_rgba(0,0,0,0.32)] sm:px-6 xl:min-h-[11.5rem] xl:px-12">
        <Image
          src={getAssetPath("/webp/images/season-talents/s3/zero/background.webp")}
          alt=""
          fill
          priority
          sizes="100vw"
          className="-z-20 object-cover opacity-[0.12]"
        />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_35%,rgba(18,142,205,0.22),transparent_30%),linear-gradient(90deg,rgba(2,11,17,0.72),rgba(5,23,33,0.95))]" />
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-cyan-300 via-cyan-300/20 to-transparent" />

        <div className="grid gap-5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center xl:grid-cols-[11rem_minmax(0,1fr)_23.5rem] xl:gap-10">
          <button
            type="button"
            aria-pressed={selectedNode.id === ROOT_NODE_ID}
            aria-label="查看零点赛季技能效果"
            onClick={() => selectNode(nodeMap.get(ROOT_NODE_ID) ?? DATA.nodes[0])}
            className={`group/root relative h-32 w-32 shrink-0 touch-manipulation cursor-pointer transition-[background-color,filter,transform] duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:[&+div_h1]:underline focus-visible:[&+div_h1]:decoration-2 focus-visible:[&+div_h1]:underline-offset-4 [clip-path:polygon(18%_0,82%_0,100%_18%,100%_82%,82%_100%,18%_100%,0_82%,0_18%)] active:scale-[0.985] sm:h-36 sm:w-36 xl:h-40 xl:w-40 ${
              selectedNode.id === ROOT_NODE_ID
                ? "bg-cyan-200 drop-shadow-[0_0_12px_rgba(74,211,255,0.28)]"
                : "bg-cyan-700 hover:bg-cyan-300"
            }`}
          >
            <span className="absolute inset-px overflow-hidden bg-[#071923] [clip-path:polygon(18%_0,82%_0,100%_18%,100%_82%,82%_100%,18%_100%,0_82%,0_18%)]">
              <span
                aria-hidden="true"
                className="absolute inset-0 bg-[radial-gradient(circle_at_50%_46%,rgba(40,166,214,0.2),transparent_68%)]"
              />
              <Image
                src={getAssetPath(DATA.nodes[0].icon)}
                alt=""
                fill
                sizes="160px"
                className="object-cover transition-[filter,transform] duration-200 motion-reduce:transition-none group-hover/root:scale-[1.025] group-hover/root:brightness-110"
              />
            </span>
          </button>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">
              <span className="rounded border border-cyan-400/50 bg-cyan-400/10 px-2.5 py-1">S3</span>
              <span className="text-slate-300">赛季天赋详情</span>
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-[0.08em] text-white sm:text-4xl">
              {DATA.name}
            </h1>
            <p className="mt-1.5 text-base text-slate-300 sm:text-lg">{DATA.subtitle}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {DATA.applicableWeapons.map((weapon) => (
                <span
                  key={weapon}
                  className="inline-flex items-center gap-1.5 rounded border border-cyan-700/70 bg-cyan-950/45 px-2.5 py-1.5 text-xs font-medium text-cyan-100"
                >
                  <Crosshair aria-hidden="true" className="h-3.5 w-3.5" />
                  {weapon}
                </span>
              ))}
            </div>
          </div>

          <button
            type="button"
            aria-expanded={passiveSelectorOpen}
            aria-controls="s3-passive-talent-selector"
            onClick={() => {
              if (!selectedPassive) {
                setSelectedPassiveId(PASSIVE_DATA.passives[0].id);
              }
              setPassiveSelectorOpen(true);
            }}
            className={`group/passive flex min-h-32 w-full touch-manipulation items-center gap-5 rounded-lg border p-5 text-left transition-colors focus-visible:outline-none focus-visible:[&_h2]:underline focus-visible:[&_h2]:decoration-2 focus-visible:[&_h2]:underline-offset-4 sm:col-span-2 xl:col-span-1 ${
              selectedPassive
                ? "border-cyan-500/70 bg-cyan-950/35 hover:border-cyan-300"
                : "border-dashed border-slate-500/80 bg-slate-950/30 hover:border-cyan-600 hover:bg-cyan-950/20"
            }`}
          >
            <span
              className={`relative h-20 w-20 shrink-0 [clip-path:polygon(18%_0,82%_0,100%_18%,100%_82%,82%_100%,18%_100%,0_82%,0_18%)] ${
                selectedPassive ? "bg-cyan-400" : "bg-slate-500/90"
              }`}
            >
              <span className="absolute inset-px flex items-center justify-center">
                {selectedPassive ? (
                  <PassiveTalentIcon talent={selectedPassive} sizes="80px" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-[#071923] [clip-path:polygon(18%_0,82%_0,100%_18%,100%_82%,82%_100%,18%_100%,0_82%,0_18%)]">
                    <Plus aria-hidden="true" className="h-7 w-7 text-slate-300" />
                  </span>
                )}
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <p className="text-xs font-semibold tracking-[0.15em] text-slate-400">被动天赋</p>
              <h2 className="mt-2 text-base font-semibold text-slate-100">
                {selectedPassive?.name ?? "选择被动天赋"}
              </h2>
              <span className="mt-1 block text-sm text-slate-500">
                {selectedPassive
                  ? `赛季等级 ${selectedPassive.unlockLevel} 解锁 · ${selectedPassive.tags.join(" / ")}`
                  : `S3 共 ${PASSIVE_DATA.passives.length} 个被动天赋`}
              </span>
            </span>
            <ChevronDown
              aria-hidden="true"
              className={`h-5 w-5 shrink-0 text-cyan-300 transition-transform duration-200 motion-reduce:transition-none ${
                passiveSelectorOpen ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>
      </header>

      {passiveSelectorOpen && selectedPassive && (
        <PassiveTalentSelector
          selectedTalent={selectedPassive}
          onSelect={(talent) => setSelectedPassiveId(talent.id)}
          onClose={closePassiveSelector}
        />
      )}

      {selectedNode.id === ROOT_NODE_ID && (
        <div className="xl:hidden">
          <DetailCard
            node={selectedNode}
            level={selectedLevel}
            onLevelChange={(level) => updateNodeLevel(selectedNode, level)}
            compact
          />
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(22rem,1fr)] xl:items-stretch">
        <section className="relative overflow-hidden rounded-sm border border-cyan-300/35 bg-[#05151f]/95 shadow-[0_20px_70px_rgba(0,0,0,0.28)]">
          <div className="flex min-h-16 items-center justify-between gap-4 border-b border-cyan-950/90 px-4 py-3 sm:px-6">
            <div>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-cyan-400">Talent Matrix</p>
              <h2 className="mt-0.5 text-xl font-bold text-white">天赋节点</h2>
            </div>
            <div className="text-right text-xs leading-5 text-slate-500">
              <p>单击查看 · 双击加满或切换</p>
              <p className="inline-flex items-center gap-1.5 text-cyan-500">
                <Check aria-hidden="true" className="h-3.5 w-3.5" />
                {storageReady ? "加点方案已自动保存" : "正在读取加点方案"}
              </p>
            </div>
          </div>

          <div className="hidden grid-cols-[42%_58%] xl:grid">
            <div className="border-r border-cyan-950/90">
              <div className="flex h-11 items-center justify-center gap-2 border-b border-cyan-950/90 text-sm font-semibold text-cyan-100">
                <Sparkles aria-hidden="true" className="h-4 w-4 text-cyan-300" />
                专属天赋
              </div>
              <div className="relative" style={{ height: EXCLUSIVE_HEIGHT }}>
                <ExclusiveConnectors />
                {exclusiveNodes.map((node) => {
                  const position = exclusivePositions[node.id];
                  return (
                    <TalentNodeButton
                      key={node.id}
                      node={node}
                      selected={node.id === selectedNode.id}
                      level={talentLevels[node.id] ?? 0}
                      dimmed={false}
                      x={position.x}
                      y={position.y}
                      onSelect={selectNode}
                      onActivate={activateNode}
                    />
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex h-11 items-center justify-center gap-2 border-b border-cyan-950/90 text-sm font-semibold text-slate-200">
                <Layers3 aria-hidden="true" className="h-4 w-4 text-slate-400" />
                通用天赋
              </div>
              <div className="relative" style={{ height: GENERAL_HEIGHT }}>
                <GeneralConnectors />
                {generalNodes.map((node) => (
                  <TalentNodeButton
                    key={node.id}
                    node={node}
                    selected={node.id === selectedNode.id}
                    level={talentLevels[node.id] ?? 0}
                    dimmed={isGeneralNodeDimmed(node)}
                    x={(node.column - 4.5) * 25}
                    y={48 + (node.phase - 2) * 100}
                    onSelect={selectNode}
                    onActivate={activateNode}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-8 p-4 sm:p-6 xl:hidden">
            <section aria-labelledby="exclusive-mobile-heading">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles aria-hidden="true" className="h-4 w-4 text-cyan-300" />
                <h2 id="exclusive-mobile-heading" className="font-semibold text-cyan-100">
                  专属天赋
                </h2>
              </div>
              <div className="space-y-3">
                {exclusiveNodes.map((node) => (
                  <MobileNode
                    key={node.id}
                    node={node}
                    selected={node.id === selectedNode.id}
                    level={talentLevels[node.id] ?? 0}
                    dimmed={false}
                    onSelect={selectNode}
                    onActivate={activateNode}
                    onLevelChange={(level) => updateNodeLevel(node, level)}
                  />
                ))}
              </div>
            </section>

            <section aria-labelledby="general-mobile-heading">
              <div className="mb-3 flex items-center gap-2">
                <Layers3 aria-hidden="true" className="h-4 w-4 text-slate-400" />
                <h2 id="general-mobile-heading" className="font-semibold text-slate-200">
                  通用天赋
                </h2>
              </div>
              <div className="space-y-6">
                {Object.keys(phaseLabels).map(Number).map((phase) => (
                  <div key={phase}>
                    <h3 className="mb-2 text-xs font-bold tracking-[0.16em] text-slate-500">
                      阶段 {phase} · {phaseLabels[phase]}
                    </h3>
                    <div className="space-y-3">
                      {generalNodes
                        .filter((node) => node.phase === phase)
                        .map((node) => (
                          <MobileNode
                            key={node.id}
                            node={node}
                            selected={node.id === selectedNode.id}
                            level={talentLevels[node.id] ?? 0}
                            dimmed={isGeneralNodeDimmed(node)}
                            onSelect={selectNode}
                            onActivate={activateNode}
                            onLevelChange={(level) => updateNodeLevel(node, level)}
                          />
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>

        <aside className="hidden xl:block">
          <DetailCard
            node={selectedNode}
            level={selectedLevel}
            onLevelChange={(level) => updateNodeLevel(selectedNode, level)}
          />
        </aside>
      </div>
    </article>
  );
}
