"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowLeftRight,
  Check,
  ChevronRight,
  Minus,
  Plus,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  getSpentTalentPoints,
  isTalentNodeUnlocked,
  restoreSeasonTalentBuild,
  setTalentNodeLevel,
  type SavedSeasonTalentBuild,
  type SeasonTalentNodeData,
  type SeasonTalentPassiveData,
  type SeasonTalentTreeData,
} from "@/lib/season-talent-builder";
import { getAssetPath } from "@/lib/path";

export type S4TalentId = "dual-star" | "matrix-symbiosis" | "black-hole";

type EnergyType = "light" | "dark";

const THEMES: Record<
  S4TalentId,
  { accent: string; accentSoft: string; glow: string }
> = {
  "dual-star": {
    accent: "#c06cff",
    accentSoft: "rgba(192,108,255,0.24)",
    glow: "rgba(192,108,255,0.58)",
  },
  "matrix-symbiosis": {
    accent: "#ff6557",
    accentSoft: "rgba(255,101,87,0.24)",
    glow: "rgba(255,101,87,0.52)",
  },
  "black-hole": {
    accent: "#52c8ff",
    accentSoft: "rgba(82,200,255,0.22)",
    glow: "rgba(82,200,255,0.54)",
  },
};

const TREE_LINKS: Array<{ id: S4TalentId; name: string }> = [
  { id: "dual-star", name: "双星" },
  { id: "matrix-symbiosis", name: "矩阵共生" },
  { id: "black-hole", name: "黑洞" },
];

function getDesktopColumn(column: number) {
  return column >= 5 ? column - 1 : column;
}

type MutualPair = {
  id: string;
  members: [SeasonTalentNodeData, SeasonTalentNodeData];
  column: number;
  phase: number;
};

function getMutualPairs(nodes: readonly SeasonTalentNodeData[]) {
  const groups = new Map<string, SeasonTalentNodeData[]>();
  for (const node of nodes) {
    if (!node.mutualGroup) continue;
    const group = groups.get(node.mutualGroup) ?? [];
    group.push(node);
    groups.set(node.mutualGroup, group);
  }

  return Array.from(groups.entries()).flatMap(([id, members]) => {
    if (members.length !== 2 || members[0].phase !== members[1].phase) return [];
    const pair = [...members].sort((a, b) => a.column - b.column) as [
      SeasonTalentNodeData,
      SeasonTalentNodeData,
    ];
    return [
      {
        id,
        members: pair,
        column: (getDesktopColumn(pair[0].column) + getDesktopColumn(pair[1].column)) / 2,
        phase: pair[0].phase,
      } satisfies MutualPair,
    ];
  });
}

function isMutuallyExcluded(
  node: SeasonTalentNodeData,
  nodes: readonly SeasonTalentNodeData[],
  levels: Record<string, number>,
) {
  if (!node.mutualGroup || (levels[node.id] ?? 0) > 0) return false;
  return nodes.some(
    (candidate) =>
      candidate.id !== node.id &&
      candidate.mutualGroup === node.mutualGroup &&
      (levels[candidate.id] ?? 0) > 0,
  );
}

function getThemeStyle(id: S4TalentId): CSSProperties {
  const theme = THEMES[id];
  return {
    "--s4-accent": theme.accent,
    "--s4-accent-soft": theme.accentSoft,
    "--s4-glow": theme.glow,
  } as CSSProperties;
}

function RichText({ children }: { children: string }) {
  const parts = children.split(/(<qiangdiao>|<\/qiangdiao>|<\/>)/g);
  let highlighted = false;
  const rendered: ReactNode[] = [];

  parts.forEach((part, index) => {
    if (part === "<qiangdiao>") {
      highlighted = true;
      return;
    }
    if (part === "</qiangdiao>" || part === "</>") {
      highlighted = false;
      return;
    }
    if (!part) return;
    rendered.push(
      highlighted ? (
        <strong key={index} className="font-semibold text-[#f1c85d]">
          {part}
        </strong>
      ) : (
        <span key={index}>{part}</span>
      ),
    );
  });

  return <>{rendered}</>;
}

function updateDeepLink(selection: { nodeId?: string; passiveId?: string }) {
  const url = new URL(window.location.href);
  url.searchParams.delete("node");
  url.searchParams.delete("passive");
  if (selection.nodeId) url.searchParams.set("node", selection.nodeId);
  if (selection.passiveId) url.searchParams.set("passive", selection.passiveId);
  url.hash = selection.nodeId
    ? `season-talent-node-${selection.nodeId}`
    : selection.passiveId
      ? `season-talent-passive-${selection.passiveId}`
      : "";
  window.history.replaceState(null, "", url);
}

function EnergySlot({
  energy,
  passive,
  onOpen,
  buttonRef,
}: {
  energy: EnergyType;
  passive: SeasonTalentPassiveData | null;
  onOpen: () => void;
  buttonRef: RefObject<HTMLButtonElement | null>;
}) {
  const isLight = energy === "light";
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={`选择${isLight ? "光能" : "暗能"}被动天赋`}
      onClick={onOpen}
      className={`group flex min-h-14 min-w-0 flex-1 cursor-pointer touch-manipulation items-center gap-2 rounded-lg border px-2.5 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:[&_strong]:underline focus-visible:[&_strong]:underline-offset-4 motion-reduce:transition-none sm:min-w-48 sm:px-3 ${
        isLight
          ? "border-[#aa914c]/70 bg-[#2b281d]/85 hover:bg-[#37311e]"
          : "border-[#4a82ad]/70 bg-[#142b3d]/85 hover:bg-[#17364c]"
      }`}
    >
      <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-black/30">
        {passive ? (
          <Image
            src={getAssetPath(passive.icon)}
            alt=""
            fill
            sizes="40px"
            className={`object-contain ${isLight ? "sepia-[.25]" : "hue-rotate-[8deg]"}`}
          />
        ) : (
          <Sparkles aria-hidden="true" className="m-2 h-6 w-6 text-slate-400" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-xs ${isLight ? "text-[#d8c276]" : "text-[#83c9f2]"}`}>
          {isLight ? "光能量" : "暗能量"}
        </span>
        <strong className="block truncate text-sm font-semibold text-white">
          {passive?.name ?? "选择被动"}
        </strong>
      </span>
      <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" />
    </button>
  );
}

function TalentNodeButton({
  node,
  selected,
  level,
  unlocked,
  onSelect,
  onIncrease,
  layout = "desktop",
  mutualPairPosition,
  mutuallyExcluded = false,
}: {
  node: SeasonTalentNodeData;
  selected: boolean;
  level: number;
  unlocked: boolean;
  onSelect: () => void;
  onIncrease: () => void;
  layout?: "desktop" | "mobile-exclusive" | "mobile-general";
  mutualPairPosition?: "left" | "right";
  mutuallyExcluded?: boolean;
}) {
  const active = node.isRoot || level > 0;
  const rapidIncreaseUntilRef = useRef(0);

  const handleClick = () => {
    if (Date.now() <= rapidIncreaseUntilRef.current) {
      onIncrease();
      return;
    }
    onSelect();
  };

  const handleDoubleClick = () => {
    if (node.isRoot) {
      onSelect();
      return;
    }
    if (Date.now() <= rapidIncreaseUntilRef.current) return;
    rapidIncreaseUntilRef.current = Date.now() + 1000;
    onIncrease();
  };

  return (
    <button
      id={`season-talent-node-${node.id}`}
      type="button"
      aria-pressed={selected}
      aria-label={`${node.name}，${node.isRoot ? "根技能" : `${level}/${node.maxLevel} 级`}${mutuallyExcluded ? "，与已选天赋互斥" : unlocked ? "" : "，前置未满足"}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={`group relative z-10 mx-auto flex h-[clamp(3.75rem,8.3vh,5.4rem)] w-[clamp(3.5rem,6vw,5rem)] cursor-pointer touch-manipulation flex-col items-center justify-center self-center rounded-lg border bg-[#07131d]/94 px-1 pb-2 pt-1 transition-[background-color,border-color,filter] duration-200 focus-visible:outline-none focus-visible:[&_.node-name]:underline focus-visible:[&_.node-name]:underline-offset-4 motion-reduce:transition-none ${
        selected
          ? mutuallyExcluded
            ? "border-[color:var(--s4-accent)] bg-[#050d14]/95"
            : "border-[color:var(--s4-accent)] bg-[color:var(--s4-accent-soft)]"
          : active
            ? "border-[color:var(--s4-accent)] shadow-[0_0_16px_var(--s4-glow)]"
            : mutuallyExcluded
              ? "border-slate-800/70 bg-[#050d14]/95"
            : unlocked
              ? "border-slate-400/65 hover:border-slate-200"
              : "border-slate-700/65 opacity-50"
      }`}
      style={
        layout === "desktop"
          ? {
              gridColumn: mutualPairPosition ? 2 : getDesktopColumn(node.column),
              gridRow: node.phase - 1,
              transform:
                mutualPairPosition === "left"
                  ? "translateX(-70%)"
                  : mutualPairPosition === "right"
                    ? "translateX(70%)"
                    : undefined,
            }
          : {
              gridColumn: layout === "mobile-general" ? node.column - 4 : node.column,
              gridRow: 1,
            }
      }
    >
      <span className="relative min-h-0 w-full flex-1">
        <Image
          src={getAssetPath(node.icon)}
          alt=""
          fill
          sizes="80px"
          className={`object-contain transition-[filter] duration-200 motion-reduce:transition-none ${
            active
              ? "brightness-125"
              : mutuallyExcluded
                ? "grayscale opacity-40"
                : "grayscale-[.65]"
          }`}
        />
      </span>
      {!node.isRoot && (
        <span aria-hidden="true" className="absolute inset-x-1 bottom-1 flex h-1 gap-0.5">
          {Array.from({ length: node.maxLevel }, (_, index) => (
            <span
              key={index}
              className={`h-full flex-1 rounded-[1px] ${
                index < level ? "bg-[color:var(--s4-accent)]" : "bg-slate-700"
              }`}
            />
          ))}
        </span>
      )}
      <span className="node-name sr-only">{node.name}</span>
    </button>
  );
}

function TalentConnectors({
  nodes,
  levels,
}: {
  nodes: SeasonTalentNodeData[];
  levels: Record<string, number>;
}) {
  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const mutualPairs = getMutualPairs(nodes);
  const pairByNodeId = new Map(
    mutualPairs.flatMap((pair) => pair.members.map((node) => [node.id, pair] as const)),
  );
  const renderedEdges = new Set<string>();
  const paths = nodes.flatMap((target) =>
    target.prerequisites.flatMap((sourceId) => {
      const source = nodeMap.get(sourceId);
      if (!source || source.isRoot || target.isRoot) return [];
      const sourcePair = pairByNodeId.get(source.id);
      const targetPair = pairByNodeId.get(target.id);
      const edgeKey = `${sourcePair?.id ?? source.id}-${targetPair?.id ?? target.id}`;
      if (renderedEdges.has(edgeKey)) return [];
      renderedEdges.add(edgeKey);

      const sourceColumn = sourcePair?.column ?? getDesktopColumn(source.column);
      const targetColumn = targetPair?.column ?? getDesktopColumn(target.column);
      const sourceX = ((sourceColumn - 0.5) / 7) * 100;
      const sourceY = (((sourcePair?.phase ?? source.phase) - 1.5) / 5) * 100;
      const targetX = ((targetColumn - 0.5) / 7) * 100;
      const targetY = (((targetPair?.phase ?? target.phase) - 1.5) / 5) * 100;
      const midpoint = (sourceY + targetY) / 2;
      const sourceActive = sourcePair
        ? sourcePair.members.some((node) => (levels[node.id] ?? 0) >= node.maxLevel)
        : (levels[source.id] ?? 0) >= (target.column >= 5 ? 1 : source.maxLevel);
      const targetActive = targetPair
        ? targetPair.members.some((node) => (levels[node.id] ?? 0) > 0)
        : (levels[target.id] ?? 0) > 0;
      return [
        <path
          key={edgeKey}
          d={`M ${sourceX} ${sourceY} V ${midpoint} H ${targetX} V ${targetY}`}
          fill="none"
          stroke={sourceActive && targetActive ? "var(--s4-accent)" : "rgba(118,145,164,.28)"}
          strokeWidth={sourceActive && targetActive ? 0.5 : 0.32}
          vectorEffect="non-scaling-stroke"
        />,
      ];
    }),
  );

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      {paths}
    </svg>
  );
}

function MutualConflictMarkers({
  nodes,
  levels,
  layout = "desktop",
}: {
  nodes: readonly SeasonTalentNodeData[];
  levels: Record<string, number>;
  layout?: "desktop" | "mobile-exclusive";
}) {
  return getMutualPairs(nodes).map((pair) => {
    const [first, second] = pair.members;
    const active = (levels[first.id] ?? 0) > 0 || (levels[second.id] ?? 0) > 0;
    const className = `pointer-events-none z-20 flex h-7 w-9 items-center justify-center ${
      active
        ? "text-[color:var(--s4-accent)] drop-shadow-[0_0_7px_var(--s4-glow)]"
        : "text-cyan-100/45"
    }`;

    if (layout === "mobile-exclusive") {
      return (
        <span
          key={pair.id}
          role="img"
          aria-label={`${first.name}与${second.name}互斥`}
          className={`${className} place-self-center`}
          style={{ gridColumn: 2, gridRow: 1 }}
        >
          <ArrowLeftRight aria-hidden="true" className="h-6 w-6" />
        </span>
      );
    }

    const left = ((pair.column - 0.5) / 7) * 100;
    const top = ((pair.phase - 1.5) / 5) * 100;
    return (
      <span
        key={pair.id}
        role="img"
        aria-label={`${first.name}与${second.name}互斥`}
        className={`${className} absolute -translate-x-1/2 -translate-y-1/2`}
        style={{ left: `${left}%`, top: `${top}%` }}
      >
        <ArrowLeftRight aria-hidden="true" className="h-6 w-6" />
      </span>
    );
  });
}

function MutualPairCards({
  nodes,
  levels,
}: {
  nodes: readonly SeasonTalentNodeData[];
  levels: Record<string, number>;
}) {
  return getMutualPairs(nodes).map((pair) => {
    const active = pair.members.some((node) => (levels[node.id] ?? 0) > 0);
    const left = ((pair.column - 0.5) / 7) * 100;
    const top = ((pair.phase - 1.5) / 5) * 100;

    return (
      <span
        key={pair.id}
        aria-hidden="true"
        className={`pointer-events-none absolute z-[5] h-[clamp(5rem,10.5vh,6.75rem)] w-[clamp(10rem,14vw,13.75rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-[#06131d] shadow-[0_8px_24px_rgba(0,0,0,.4)] ${
          active
            ? "border-[color:var(--s4-accent)]"
            : "border-cyan-100/30"
        }`}
        style={{ left: `${left}%`, top: `${top}%` }}
      />
    );
  });
}

function NodeDetail({
  node,
  level,
  unlocked,
  spentPoints,
  pointLimit,
  onChangeLevel,
  onReset,
}: {
  node: SeasonTalentNodeData;
  level: number;
  unlocked: boolean;
  spentPoints: number;
  pointLimit: number;
  onChangeLevel: (level: number) => void;
  onReset: () => void;
}) {
  const descriptionIndex = Math.max(0, Math.min(node.descriptions.length - 1, level - 1));
  const canIncrease =
    !node.isRoot && unlocked && level < node.maxLevel && spentPoints < pointLimit;
  const canDecrease = !node.isRoot && level > 0;

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-cyan-100/20 bg-[#06111a]/25 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.32)] backdrop-blur-md lg:h-full lg:p-5">
      <div className="flex items-start justify-between gap-3 border-b border-slate-500/35 pb-3">
        <div className="min-w-0">
          <p className="text-xs text-cyan-100/60">S4 赛季天赋详情</p>
          <h2 className="mt-1 text-xl font-semibold text-white">{node.name}</h2>
        </div>
        {!node.isRoot && (
          <span className="shrink-0 rounded-md border border-slate-500/50 bg-black/25 px-2 py-1 font-mono text-sm tabular-nums text-slate-200">
            {level}/{node.maxLevel}
          </span>
        )}
      </div>

      <div className="relative mt-4 aspect-[16/8.5] shrink-0 overflow-hidden rounded-lg border border-slate-500/45 bg-[#0a1c28]">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,var(--s4-accent-soft),transparent_58%)]" />
        <Image
          src={getAssetPath(node.icon)}
          alt=""
          fill
          sizes="(min-width: 1024px) 320px, 100vw"
          className="object-contain p-7 opacity-90 drop-shadow-[0_0_20px_var(--s4-glow)]"
        />
      </div>

      <div className="min-h-0 flex-1 py-4 text-sm leading-7 text-slate-200 lg:text-[0.82rem] lg:leading-6 xl:text-sm xl:leading-7">
        {node.unlockLevel > 0 && (
          <p className="mb-2 text-xs text-[#e8ca6a]">赛季等级 {node.unlockLevel} 解锁</p>
        )}
        {!unlocked && (
          <p className="mb-2 text-xs font-medium text-rose-300">需将任一前置天赋升至满级</p>
        )}
        <p className="whitespace-pre-line">
          <RichText>{node.descriptions[descriptionIndex] ?? "暂无技能说明"}</RichText>
        </p>
      </div>

      <div className="mt-auto border-t border-slate-500/30 pt-3">
        {!node.isRoot && (
          <div className="grid grid-cols-[3rem_1fr_3rem] gap-2">
            <button
              type="button"
              aria-label={`降低${node.name}等级`}
              disabled={!canDecrease}
              onClick={() => onChangeLevel(level - 1)}
              className="flex min-h-11 cursor-pointer touch-manipulation items-center justify-center rounded-lg border border-slate-500/55 bg-slate-900/75 text-slate-100 transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:[&_svg]:text-white disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Minus aria-hidden="true" className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={!canIncrease}
              onClick={() => onChangeLevel(node.maxLevel)}
              className="min-h-11 cursor-pointer touch-manipulation rounded-lg border border-[color:var(--s4-accent)] bg-[color:var(--s4-accent-soft)] px-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700/70 focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-4 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-900/60 disabled:text-slate-500"
            >
              加满
            </button>
            <button
              type="button"
              aria-label={`提升${node.name}等级`}
              disabled={!canIncrease}
              onClick={() => onChangeLevel(level + 1)}
              className="flex min-h-11 cursor-pointer touch-manipulation items-center justify-center rounded-lg border border-[color:var(--s4-accent)] bg-[color:var(--s4-accent-soft)] text-white transition-colors hover:bg-slate-700/70 focus-visible:outline-none focus-visible:[&_svg]:text-white disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-900/60 disabled:text-slate-500"
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={onReset}
          className="mt-2 flex min-h-11 w-full cursor-pointer touch-manipulation items-center justify-center gap-2 rounded-lg px-3 text-sm text-slate-400 transition-colors hover:bg-slate-800/70 hover:text-white focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-4"
        >
          <RotateCcw aria-hidden="true" className="h-4 w-4" />
          清空方案
        </button>
      </div>
    </aside>
  );
}

function PassiveSelector({
  talentId,
  energy,
  passives,
  equippedId,
  previewId,
  onPreview,
  onApply,
  onClose,
}: {
  talentId: S4TalentId;
  energy: EnergyType;
  passives: SeasonTalentPassiveData[];
  equippedId: string | null;
  previewId: string;
  onPreview: (id: string) => void;
  onApply: (id: string) => void;
  onClose: () => void;
}) {
  const selected = passives.find((passive) => passive.id === previewId) ?? passives[0];
  const isLight = energy === "light";
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const originalOverflow = document.body.style.overflow;
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const equipped = selected.id === equippedId;

  return createPortal(
    <div
      role="presentation"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-2 backdrop-blur-sm sm:p-5"
      style={getThemeStyle(talentId)}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="passive-selector-heading"
        className="relative flex max-h-[calc(100dvh-1rem)] w-full max-w-[58rem] flex-col overflow-hidden rounded-lg border border-cyan-100/25 bg-[#04131d] shadow-[0_30px_100px_rgba(0,0,0,0.72),0_0_40px_var(--s4-accent-soft)] sm:max-h-[calc(100dvh-2.5rem)]"
      >
      <header className="relative flex min-h-[4.5rem] items-center justify-between border-b border-cyan-100/15 bg-[#071a26]/96 px-4 sm:px-6">
        <div>
          <p className={`text-xs font-medium ${isLight ? "text-[#e2c95f]" : "text-[#78c9f4]"}`}>
            S4 被动天赋
          </p>
          <h2 id="passive-selector-heading" className="mt-1 text-lg font-semibold text-white sm:text-2xl">
            {isLight ? "选择光能天赋" : "选择暗能天赋"}
          </h2>
        </div>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="关闭被动天赋弹窗"
          className="flex h-11 w-11 cursor-pointer touch-manipulation items-center justify-center rounded-lg border border-slate-600/65 bg-slate-900/70 text-slate-300 transition-colors hover:border-[color:var(--s4-accent)] hover:text-white focus-visible:outline-none focus-visible:[&_svg]:text-white"
        >
          <X aria-hidden="true" className="h-5 w-5" />
        </button>
      </header>

      <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1.45fr)_minmax(20rem,.75fr)] lg:overflow-hidden">
        <div className="flex min-h-max flex-col border-b border-slate-500/30 p-4 lg:min-h-0 lg:border-b-0 lg:border-r lg:p-6">
          <div className="relative flex min-h-64 items-center justify-center overflow-hidden rounded-lg border border-slate-500/40 bg-[#071925]">
            <Image
              src={getAssetPath("/webp/images/season-talents/s4/details/grid-blue.webp")}
              alt=""
              fill
              sizes="(min-width: 1024px) 65vw, 100vw"
              className="object-cover opacity-30"
            />
            <div
              aria-hidden="true"
              className={`absolute inset-0 ${
                isLight
                  ? "bg-[radial-gradient(circle_at_center,rgba(235,205,91,.24),transparent_52%)]"
                  : "bg-[radial-gradient(circle_at_center,rgba(57,151,219,.27),transparent_52%)]"
              }`}
            />
            <div className="relative h-40 w-40 sm:h-52 sm:w-52">
              <Image
                src={getAssetPath(selected.icon)}
                alt=""
                fill
                sizes="208px"
                className="object-contain drop-shadow-[0_0_28px_rgba(152,213,255,.45)]"
              />
            </div>
          </div>

          <div
            className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-[repeat(6,5rem)] sm:justify-center"
            aria-label="被动天赋列表"
          >
            {passives.map((passive) => (
              <button
                id={`season-talent-passive-${passive.id}`}
                key={passive.id}
                type="button"
                aria-pressed={passive.id === selected.id}
                aria-label={`预览${passive.name}`}
                onClick={() => onPreview(passive.id)}
                className={`relative flex aspect-square min-h-14 cursor-pointer touch-manipulation items-center justify-center justify-self-center overflow-hidden rounded-lg border bg-[#06121b] p-1 transition-colors focus-visible:outline-none focus-visible:[&_.passive-name]:underline focus-visible:[&_.passive-name]:underline-offset-4 sm:w-20 ${
                  passive.id === selected.id
                    ? isLight
                      ? "border-[#e2c95f] bg-[#332f1e]"
                      : "border-[#69bce9] bg-[#122f43]"
                    : "border-slate-600/60 hover:border-slate-300"
                }`}
              >
                <Image
                  src={getAssetPath(passive.icon)}
                  alt=""
                  fill
                  sizes="120px"
                  className="object-contain p-1"
                />
                <span className="passive-name sr-only">{passive.name}</span>
                {passive.id === equippedId && (
                  <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded bg-emerald-300 text-[#082015]">
                    <Check aria-hidden="true" className="h-3.5 w-3.5" />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <aside className="flex min-h-[22rem] shrink-0 flex-col bg-[#06111a]/95 p-5 sm:p-7 lg:min-h-0 lg:shrink">
          <div className="border-b border-slate-500/35 pb-4">
            <p className={`text-xs font-medium ${isLight ? "text-[#e2c95f]" : "text-[#78c9f4]"}`}>
              {isLight ? "光能量" : "暗能量"}
            </p>
            <h3 className="mt-1 text-2xl font-semibold text-white">{selected.name}</h3>
          </div>
          <p className="whitespace-pre-line py-5 text-base leading-8 text-slate-200">
            <RichText>{selected.description}</RichText>
          </p>
          <button
            type="button"
            aria-label={equipped ? `${selected.name}使用中，关闭弹窗` : `使用${selected.name}`}
            onClick={() => (equipped ? onClose() : onApply(selected.id))}
            className={`mt-auto min-h-12 cursor-pointer touch-manipulation rounded-lg border px-5 text-base font-semibold transition-colors focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-4 ${
              equipped
                ? "border-slate-500 bg-slate-200 text-slate-700 hover:bg-white"
                : isLight
                  ? "border-[#e2c95f] bg-[#d9c05b] text-[#251f0b] hover:bg-[#ead477]"
                  : "border-[#70c8f5] bg-[#7bc8ed] text-[#071c29] hover:bg-[#9fdcff]"
            }`}
          >
            {equipped ? "使用中" : "使用"}
          </button>
        </aside>
      </div>
      </section>
    </div>,
    document.body,
  );
}

export function S4SeasonTalentBuilder({
  tree,
  passives,
}: {
  tree: SeasonTalentTreeData;
  passives: SeasonTalentPassiveData[];
}) {
  const talentId = tree.id as S4TalentId;
  const rootNode = tree.nodes.find((node) => node.isRoot) ?? tree.nodes[0];
  const defaultLight = passives.find(
    (passive) => passive.energy === "light" && passive.isDefault,
  );
  const defaultDark = passives.find(
    (passive) => passive.energy === "dark" && passive.isDefault,
  );
  const storageKey = `nzm-wiki:season-talents:s4:${talentId}:v1`;
  const [selectedNodeId, setSelectedNodeId] = useState(rootNode.id);
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [lightPassiveId, setLightPassiveId] = useState<string | null>(
    defaultLight?.id ?? null,
  );
  const [darkPassiveId, setDarkPassiveId] = useState<string | null>(defaultDark?.id ?? null);
  const [selectorEnergy, setSelectorEnergy] = useState<EnergyType | null>(null);
  const [previewPassiveId, setPreviewPassiveId] = useState(defaultLight?.id ?? passives[0]?.id);
  const [storageReady, setStorageReady] = useState(false);
  const lightButtonRef = useRef<HTMLButtonElement>(null);
  const darkButtonRef = useRef<HTMLButtonElement>(null);

  const nodeMap = useMemo(() => new Map(tree.nodes.map((node) => [node.id, node])), [tree.nodes]);
  const selectedNode = nodeMap.get(selectedNodeId) ?? rootNode;
  const selectedLevel = selectedNode.isRoot ? 1 : (levels[selectedNode.id] ?? 0);
  const spentPoints = getSpentTalentPoints(levels);
  const lightPassive = passives.find((passive) => passive.id === lightPassiveId) ?? null;
  const darkPassive = passives.find((passive) => passive.id === darkPassiveId) ?? null;
  const visiblePassives = passives.filter((passive) => passive.energy === selectorEnergy);

  const closeSelector = useCallback(
    (restoreFocus = true) => {
      const closingEnergy = selectorEnergy;
      setSelectorEnergy(null);
      updateDeepLink({});
      if (restoreFocus && closingEnergy) {
        window.requestAnimationFrame(() => {
          (closingEnergy === "light" ? lightButtonRef : darkButtonRef).current?.focus();
        });
      }
    },
    [selectorEnergy],
  );

  const openSelector = useCallback(
    (energy: EnergyType, passiveId?: string) => {
      const candidates = passives.filter((passive) => passive.energy === energy);
      const equippedId = energy === "light" ? lightPassiveId : darkPassiveId;
      const selectedId = passiveId ?? equippedId ?? candidates[0]?.id;
      if (!selectedId) return;
      setPreviewPassiveId(selectedId);
      setSelectorEnergy(energy);
      updateDeepLink({ passiveId: selectedId });
    },
    [darkPassiveId, lightPassiveId, passives],
  );

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const restored = restoreSeasonTalentBuild(tree, JSON.parse(raw), passives);
        setLevels(restored.levels);
        setLightPassiveId(restored.lightPassiveId ?? defaultLight?.id ?? null);
        setDarkPassiveId(restored.darkPassiveId ?? defaultDark?.id ?? null);
      }
    } catch {
      // Keep the clean default build when storage is unavailable or malformed.
    } finally {
      const params = new URLSearchParams(window.location.search);
      const nodeId = params.get("node");
      const passiveId = params.get("passive");
      if (nodeId && nodeMap.has(nodeId)) setSelectedNodeId(nodeId);
      if (passiveId) {
        const passive = passives.find((candidate) => candidate.id === passiveId);
        if (passive) {
          setPreviewPassiveId(passive.id);
          setSelectorEnergy(passive.energy);
        }
      }
      setStorageReady(true);
    }
  }, [defaultDark?.id, defaultLight?.id, nodeMap, passives, storageKey, tree]);

  useEffect(() => {
    if (!storageReady) return;
    const saved: SavedSeasonTalentBuild = {
      version: 1,
      levels,
      lightPassiveId,
      darkPassiveId,
    };
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(saved));
    } catch {
      // The builder remains usable when storage is unavailable.
    }
  }, [darkPassiveId, levels, lightPassiveId, storageKey, storageReady]);

  const selectNode = (node: SeasonTalentNodeData) => {
    setSelectedNodeId(node.id);
    updateDeepLink({ nodeId: node.id });
  };

  const resetBuild = () => {
    setLevels({});
    setLightPassiveId(defaultLight?.id ?? null);
    setDarkPassiveId(defaultDark?.id ?? null);
  };

  const increaseNodeLevel = (node: SeasonTalentNodeData) => {
    if (node.isRoot) return;
    setLevels((current) =>
      setTalentNodeLevel(tree, current, node.id, (current[node.id] ?? 0) + 1),
    );
  };

  const applyPassive = (passiveId: string) => {
    const passive = passives.find((candidate) => candidate.id === passiveId);
    if (!selectorEnergy || passive?.energy !== selectorEnergy) return;
    if (selectorEnergy === "light") setLightPassiveId(passiveId);
    else setDarkPassiveId(passiveId);
    closeSelector();
  };

  const mutualPairPositions = new Map(
    getMutualPairs(tree.nodes).flatMap((pair) => [
      [pair.members[0].id, "left" as const],
      [pair.members[1].id, "right" as const],
    ]),
  );

  return (
    <article
      className="relative -mx-4 flex min-h-full flex-col gap-4 px-4 py-4 sm:-mx-6 sm:px-6 lg:h-full lg:min-h-0 lg:gap-3 lg:py-0 xl:-mx-12 xl:px-12"
      data-s4-talent={talentId}
      style={getThemeStyle(talentId)}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10"
      >
        <Image
          src={getAssetPath(
            talentId === "matrix-symbiosis"
              ? "/webp/images/season-talents/s4/details/grid-orange.webp"
              : "/webp/images/season-talents/s4/details/grid-blue.webp",
          )}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div
          className={`absolute inset-0 ${
            talentId === "matrix-symbiosis"
              ? "bg-[linear-gradient(135deg,rgba(165,48,31,0.08),rgba(2,10,16,0.3)_48%,rgba(2,10,16,0.7))]"
              : talentId === "black-hole"
                ? "bg-[linear-gradient(135deg,rgba(18,126,166,0.16),rgba(2,10,16,0.3)_48%,rgba(2,10,16,0.7))]"
                : "bg-[linear-gradient(135deg,rgba(116,45,158,0.2),rgba(2,10,16,0.3)_48%,rgba(2,10,16,0.7))]"
          }`}
        />
      </div>
      <header className="relative z-20 shrink-0 overflow-hidden rounded-lg border border-cyan-50/20 bg-[#04101a]/25 px-3 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.32)] backdrop-blur-md sm:px-5 lg:py-2">
        <div className="mx-auto grid max-w-[1800px] items-center gap-3 lg:grid-cols-[minmax(15rem,.8fr)_minmax(18rem,1fr)_minmax(25rem,1.2fr)]">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href="/season-talents"
              aria-label="返回赛季天赋总览"
              title="返回赛季天赋总览"
              className="hidden min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-slate-800/70 hover:text-white focus-visible:outline-none focus-visible:[&_svg]:text-white lg:flex"
            >
              <ArrowLeft aria-hidden="true" className="h-5 w-5" />
            </Link>
            <nav aria-label="S4 天赋树" className="flex min-w-0 gap-1">
              {TREE_LINKS.map((link) => (
                <Link
                  key={link.id}
                  href={`/guides/season-talents/s4/${link.id}`}
                  aria-current={link.id === talentId ? "page" : undefined}
                  className={`flex min-h-11 touch-manipulation items-center rounded-lg border px-2.5 text-xs transition-colors focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-4 sm:text-sm ${
                    link.id === talentId
                      ? "border-[color:var(--s4-accent)] bg-[color:var(--s4-accent-soft)] text-white"
                      : "border-transparent text-slate-400 hover:bg-slate-800/60 hover:text-white"
                  }`}
                >
                  {link.name}
                </Link>
              ))}
            </nav>
          </div>

          <button
            type="button"
            onClick={() => selectNode(rootNode)}
            className="group flex min-h-16 cursor-pointer touch-manipulation items-center justify-center gap-3 rounded-lg px-3 text-left focus-visible:outline-none focus-visible:[&_h1]:underline focus-visible:[&_h1]:underline-offset-4 lg:justify-start"
          >
            <span className="relative h-16 w-16 shrink-0 drop-shadow-[0_0_13px_var(--s4-glow)]">
              <Image
                src={getAssetPath(tree.icon)}
                alt=""
                fill
                priority
                sizes="64px"
                className="object-contain"
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2">
                <h1 className="text-xl font-semibold text-white lg:text-2xl">{tree.name}</h1>
                <span
                  className="font-mono text-sm tabular-nums text-slate-300"
                  aria-live="polite"
                >
                  {spentPoints}/{tree.pointLimit}
                </span>
              </span>
              <span className="mt-0.5 block text-[11px] leading-4 text-slate-400 sm:text-xs">
                <RichText>{tree.applicableWeapons}</RichText>
              </span>
            </span>
          </button>

          <div className="min-w-0">
            <h2 className="mb-2 text-sm font-semibold text-cyan-50/80 lg:sr-only">
              被动天赋
            </h2>
            <div className="flex min-w-0 gap-2">
              <EnergySlot
                energy="light"
                passive={lightPassive}
                onOpen={() => openSelector("light")}
                buttonRef={lightButtonRef}
              />
              <EnergySlot
                energy="dark"
                passive={darkPassive}
                onOpen={() => openSelector("dark")}
                buttonRef={darkButtonRef}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_clamp(18rem,26vw,25rem)] lg:items-stretch">
          <div className="lg:col-start-2 lg:row-start-1 lg:min-h-0">
            <NodeDetail
              node={selectedNode}
              level={selectedLevel}
              unlocked={isTalentNodeUnlocked(selectedNode, tree.nodes, levels)}
              spentPoints={spentPoints}
              pointLimit={tree.pointLimit}
              onChangeLevel={(level) =>
                setLevels((current) =>
                  setTalentNodeLevel(tree, current, selectedNode.id, level),
                )
              }
              onReset={resetBuild}
            />
          </div>

          <section
            aria-label={`${tree.name}天赋节点`}
            className="relative overflow-hidden rounded-lg border border-cyan-100/20 bg-[#05141e]/25 px-3 py-5 shadow-[0_20px_60px_rgba(0,0,0,0.32)] backdrop-blur-md sm:px-6 lg:col-start-1 lg:row-start-1 lg:h-full lg:min-h-0 lg:px-5 lg:py-3 xl:px-8"
          >
            <div className="relative mx-auto hidden h-full min-h-0 max-w-[1120px] grid-cols-7 grid-rows-5 gap-x-1 gap-y-1 lg:grid">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-0 w-[42.5%] overflow-hidden rounded-lg border border-white/10 bg-[linear-gradient(145deg,var(--s4-accent-soft),rgba(3,12,18,.08)_45%)]"
              >
                <span className="absolute inset-x-0 top-0 h-px bg-[color:var(--s4-accent)] opacity-70" />
              </div>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 right-0 w-[56.8%] overflow-hidden rounded-lg border border-cyan-100/10 bg-[linear-gradient(145deg,rgba(45,100,128,.18),rgba(3,12,18,.08)_45%)]"
              >
                <span className="absolute inset-x-0 top-0 h-px bg-cyan-200/45" />
              </div>
              <TalentConnectors nodes={tree.nodes} levels={levels} />
              <MutualPairCards nodes={tree.nodes} levels={levels} />
              <MutualConflictMarkers nodes={tree.nodes} levels={levels} />
              <span className="absolute left-3 top-2 z-20 flex items-center gap-2 text-xs font-semibold text-[color:var(--s4-accent)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--s4-accent)] shadow-[0_0_8px_var(--s4-glow)]" />
                专属天赋
              </span>
              <span className="absolute left-[44.5%] top-2 z-20 flex items-center gap-2 text-xs font-semibold text-cyan-100/75">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-200/70" />
                通用天赋
              </span>
              {tree.nodes
                .filter((node) => !node.isRoot)
                .map((node) => (
                  <TalentNodeButton
                    key={node.id}
                    node={node}
                    selected={selectedNode.id === node.id}
                    level={levels[node.id] ?? 0}
                    unlocked={isTalentNodeUnlocked(node, tree.nodes, levels)}
                    onSelect={() => selectNode(node)}
                    onIncrease={() => increaseNodeLevel(node)}
                    mutualPairPosition={mutualPairPositions.get(node.id)}
                    mutuallyExcluded={isMutuallyExcluded(node, tree.nodes, levels)}
                  />
                ))}
            </div>

            <div className="relative space-y-7 lg:hidden">
              {[
                { label: "专属天赋", columns: 3, kind: "exclusive" as const },
                { label: "通用天赋", columns: 4, kind: "general" as const },
              ].map((section) => {
                const sectionNodes = tree.nodes.filter((node) =>
                  section.kind === "exclusive"
                    ? !node.isRoot && node.column <= 3
                    : node.column >= 5,
                );
                return (
                  <div
                    key={section.kind}
                    className={`border-l-2 pl-3 ${
                      section.kind === "exclusive"
                        ? "border-[color:var(--s4-accent)]"
                        : "border-cyan-200/45"
                    }`}
                  >
                    <h2
                      className={`mb-3 text-sm font-semibold ${
                        section.kind === "exclusive"
                          ? "text-[color:var(--s4-accent)]"
                          : "text-cyan-100/75"
                      }`}
                    >
                      {section.label}
                    </h2>
                    <div className="space-y-3">
                      {[2, 3, 4, 5, 6].map((phase) => (
                        <div
                          key={phase}
                          className="relative grid min-h-[5rem] items-center gap-2 rounded-lg border border-slate-700/35 bg-[#06131d]/45 px-1 py-1"
                          style={{ gridTemplateColumns: `repeat(${section.columns}, minmax(0, 1fr))` }}
                        >
                          <span className="absolute left-1 top-1 text-[0.6rem] text-slate-600">
                            {phase - 1}
                          </span>
                          {sectionNodes
                            .filter((node) => node.phase === phase)
                            .map((node) => (
                              <TalentNodeButton
                                key={node.id}
                                node={node}
                                selected={selectedNode.id === node.id}
                                level={levels[node.id] ?? 0}
                                unlocked={isTalentNodeUnlocked(node, tree.nodes, levels)}
                                onSelect={() => selectNode(node)}
                                onIncrease={() => increaseNodeLevel(node)}
                                mutuallyExcluded={isMutuallyExcluded(
                                  node,
                                  tree.nodes,
                                  levels,
                                )}
                                layout={
                                  section.kind === "general"
                                    ? "mobile-general"
                                    : "mobile-exclusive"
                                }
                              />
                            ))}
                          {section.kind === "exclusive" && (
                            <MutualConflictMarkers
                              nodes={sectionNodes.filter((node) => node.phase === phase)}
                              levels={levels}
                              layout="mobile-exclusive"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

          </section>
      </div>

      {selectorEnergy && (
        <PassiveSelector
          talentId={talentId}
          energy={selectorEnergy}
          passives={visiblePassives}
          equippedId={selectorEnergy === "light" ? lightPassiveId : darkPassiveId}
          previewId={previewPassiveId}
          onPreview={(id) => {
            setPreviewPassiveId(id);
            updateDeepLink({ passiveId: id });
          }}
          onApply={applyPassive}
          onClose={closeSelector}
        />
      )}
    </article>
  );
}
