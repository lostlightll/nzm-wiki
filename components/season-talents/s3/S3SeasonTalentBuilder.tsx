"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Minus,
  Plus,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import grapplingHookData from "@/data/season-talents/s3/grappling-hook.json";
import ironFistData from "@/data/season-talents/s3/iron-fist.json";
import passiveData from "@/data/season-talents/s3/passives.json";
import zeroData from "@/data/season-talents/s3/zero.json";
import { MultiplierSourceBadges } from "@/components/MultiplierBadges";
import type { MultiplierSource } from "@/lib/multiplier-data";
import { getAssetPath } from "@/lib/path";
import {
  getDefaultS3TalentLevels,
  getS3SpentTalentPoints,
  isS3TalentNodeUnlocked,
  restoreS3TalentBuild,
  setS3TalentNodeLevel,
  type SavedS3TalentBuild,
} from "@/lib/s3-season-talent-builder";

interface TalentNode {
  id: string;
  canonicalId?: string;
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
  talentType: number;
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

const PASSIVE_DATA = passiveData as PassiveTalentData;

export type S3TalentId = "iron-fist" | "zero" | "grappling-hook";

interface TalentTheme {
  accent: string;
  accentText: string;
  accentStrong: string;
  accentDark: string;
  accentSoft: string;
  accentMuted: string;
  glow: string;
  frame: string;
  divider: string;
  surfaceSoft: string;
  radial: string;
  grid: string;
}

const THEMES: Record<S3TalentId, TalentTheme> = {
  zero: {
    accent: "#67e8f9",
    accentText: "#cffafe",
    accentStrong: "#0891b2",
    accentDark: "#164e63",
    accentSoft: "rgba(34,211,238,0.14)",
    accentMuted: "rgba(103,232,249,0.38)",
    glow: "rgba(34,211,238,0.34)",
    frame: "rgba(103,232,249,0.34)",
    divider: "rgba(8,145,178,0.25)",
    surfaceSoft: "rgba(8,145,178,0.13)",
    radial: "rgba(34,211,238,0.18)",
    grid: "rgba(103,232,249,0.05)",
  },
  "iron-fist": {
    accent: "#fb7185",
    accentText: "#ffe4e6",
    accentStrong: "#e11d48",
    accentDark: "#881337",
    accentSoft: "rgba(244,63,94,0.14)",
    accentMuted: "rgba(251,113,133,0.4)",
    glow: "rgba(244,63,94,0.34)",
    frame: "rgba(251,113,133,0.34)",
    divider: "rgba(225,29,72,0.25)",
    surfaceSoft: "rgba(225,29,72,0.13)",
    radial: "rgba(244,63,94,0.18)",
    grid: "rgba(251,113,133,0.05)",
  },
  "grappling-hook": {
    accent: "#4ade80",
    accentText: "#dcfce7",
    accentStrong: "#16a34a",
    accentDark: "#14532d",
    accentSoft: "rgba(34,197,94,0.14)",
    accentMuted: "rgba(74,222,128,0.4)",
    glow: "rgba(34,197,94,0.34)",
    frame: "rgba(74,222,128,0.34)",
    divider: "rgba(22,163,74,0.25)",
    surfaceSoft: "rgba(22,163,74,0.13)",
    radial: "rgba(34,197,94,0.18)",
    grid: "rgba(74,222,128,0.05)",
  },
};

function mapGeneralNodes(talentType: number): TalentNode[] {
  return (zeroData as TalentData).nodes
    .filter((node) => node.column >= 5)
    .map((node) => ({
      ...node,
      id: `shared-${talentType}-${node.id}`,
      canonicalId: node.id,
      prerequisites: node.prerequisites.map((id) =>
        `shared-${talentType}-${id}`,
      ),
    }));
}

function completeTalentData(rawData: TalentData): TalentData {
  if (rawData.nodes.some((node) => node.column >= 5)) return rawData;

  return {
    ...rawData,
    nodes: [...rawData.nodes, ...mapGeneralNodes(rawData.talentType)],
  };
}

const TALENT_DATA: Record<S3TalentId, TalentData> = {
  zero: completeTalentData(zeroData as TalentData),
  "iron-fist": completeTalentData(ironFistData as TalentData),
  "grappling-hook": completeTalentData(grapplingHookData as TalentData),
};

function getThemeStyle(theme: TalentTheme): CSSProperties {
  return {
    "--talent-accent": theme.accent,
    "--talent-accent-text": theme.accentText,
    "--talent-accent-strong": theme.accentStrong,
    "--talent-accent-dark": theme.accentDark,
    "--talent-accent-soft": theme.accentSoft,
    "--talent-accent-muted": theme.accentMuted,
    "--talent-glow": theme.glow,
    "--talent-frame": theme.frame,
    "--talent-divider": theme.divider,
    "--talent-surface-soft": theme.surfaceSoft,
    "--talent-radial": theme.radial,
    "--talent-grid": theme.grid,
  } as CSSProperties;
}

const TREE_LINKS: Array<{ id: S3TalentId; name: string }> = [
  { id: "iron-fist", name: "铁拳狂徒" },
  { id: "zero", name: "零点" },
  { id: "grappling-hook", name: "劫掠钩锁" },
];

const POINT_LIMIT = 40;

function getDesktopColumn(column: number) {
  return column >= 5 ? column - 1 : column;
}

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
        className={
          match[1] === "T002"
            ? "text-[color:var(--talent-accent)]"
            : "text-[#ffd45e]"
        }
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

function DetailCard({
  node,
  talentId,
  rootNodeId,
  level,
  unlocked,
  spentPoints,
  onLevelChange,
  onReset,
}: {
  node: TalentNode;
  talentId: S3TalentId;
  rootNodeId: string;
  level: number;
  unlocked: boolean;
  spentPoints: number;
  onLevelChange: (level: number) => void;
  onReset: () => void;
}) {
  const isRoot = node.id === rootNodeId;
  const displayLevel = Math.max(1, level);
  const canDecrease = !isRoot && level > 0;
  const canIncrease =
    !isRoot && unlocked && level < node.maxLevel && spentPoints < POINT_LIMIT;
  const providerSource: MultiplierSource = node.column >= 5
    ? {
        type: "season-talent",
        season: "s3",
        tree: "zero",
        nodeId: node.canonicalId ?? node.id,
      }
    : {
        type: "season-talent",
        season: "s3",
        tree: talentId,
        nodeId: node.id,
      };

  return (
    <section
      aria-live="polite"
      aria-label={`${node.name}详情`}
      className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-[color:var(--talent-frame)] bg-[#06111a]/30 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.32)] backdrop-blur-sm lg:h-full lg:p-5"
    >
      <div className="flex items-start justify-between gap-3 border-b border-[color:var(--talent-divider)] pb-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-[color:var(--talent-accent)]">S3 赛季天赋详情</p>
          <h2 className="mt-1 text-xl font-semibold text-white">
            {node.name}
          </h2>
        </div>
        {!isRoot && (
          <span className="shrink-0 rounded-md border border-slate-500/50 bg-black/25 px-2 py-1 font-mono text-sm tabular-nums text-slate-200">
            {level}/{node.maxLevel}
          </span>
        )}
      </div>

      <div className="relative mt-4 aspect-[16/8.5] shrink-0 overflow-hidden rounded-lg border border-[color:var(--talent-frame)] bg-[#0a1c28]">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,var(--talent-surface-soft),transparent_58%)]" />
        <Image
          src={getAssetPath(node.icon)}
          alt=""
          fill
          sizes="(min-width: 1024px) 320px, 100vw"
          className="object-contain p-7 opacity-90 drop-shadow-[0_0_20px_var(--talent-glow)]"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-4 text-sm leading-7 text-slate-200 lg:text-[0.82rem] lg:leading-6 xl:text-sm xl:leading-7">
        {!unlocked && (
          <p className="mb-2 text-xs font-medium text-rose-300">
            需将任一前置天赋升至所需等级
          </p>
        )}
        <TalentDescription value={node.descriptions[displayLevel - 1]} />
        <div
          data-multiplier-provider-target={`node-${node.id}`}
          className="mt-3"
        >
          <MultiplierSourceBadges source={providerSource} />
        </div>
      </div>

      <div className="mt-auto border-t border-[color:var(--talent-divider)] pt-3">
        {!isRoot && (
          <div className="grid grid-cols-[3rem_1fr_3rem] gap-2">
            <button
              type="button"
              aria-label={`降低${node.name}等级`}
              disabled={!canDecrease}
              onClick={() => onLevelChange(level - 1)}
              className="flex min-h-11 cursor-pointer touch-manipulation items-center justify-center rounded-lg border border-slate-500/55 bg-slate-900/75 text-slate-100 transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:[&_svg]:text-white disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Minus aria-hidden="true" className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={!canIncrease}
              onClick={() => onLevelChange(node.maxLevel)}
              className="min-h-11 cursor-pointer touch-manipulation rounded-lg border border-[color:var(--talent-accent)] bg-[color:var(--talent-accent-soft)] px-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700/70 focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-4 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-900/60 disabled:text-slate-500"
            >
              加满
            </button>
            <button
              type="button"
              aria-label={`提升${node.name}等级`}
              disabled={!canIncrease}
              onClick={() => onLevelChange(level + 1)}
              className="flex min-h-11 cursor-pointer touch-manipulation items-center justify-center rounded-lg border border-[color:var(--talent-accent)] bg-[color:var(--talent-accent-strong)] text-white transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:[&_svg]:text-white disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500"
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
          重置方案
        </button>
      </div>
    </section>
  );
}

function TalentNodeButton({
  node,
  selected,
  level,
  unlocked,
  mutuallyExcluded,
  onSelect,
  onActivate,
  layout = "desktop",
}: {
  node: TalentNode;
  selected: boolean;
  level: number;
  unlocked: boolean;
  mutuallyExcluded: boolean;
  onSelect: (node: TalentNode) => void;
  onActivate: (node: TalentNode) => void;
  layout?: "desktop" | "mobile-exclusive" | "mobile-general";
}) {
  const active = level > 0;
  const rapidIncreaseUntilRef = useRef(0);

  const handleClick = () => {
    if (Date.now() <= rapidIncreaseUntilRef.current) {
      onActivate(node);
      return;
    }
    onSelect(node);
  };

  const handleDoubleClick = () => {
    if (Date.now() <= rapidIncreaseUntilRef.current) return;
    rapidIncreaseUntilRef.current = Date.now() + 1000;
    onActivate(node);
  };

  return (
    <button
      id={`season-talent-node-${node.id}`}
      type="button"
      aria-pressed={selected}
      aria-label={`${node.name}，${level}/${node.maxLevel} 级${mutuallyExcluded ? "，与已选天赋互斥" : unlocked ? "" : "，前置未满足"}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={`group/node relative z-10 mx-auto flex h-[clamp(3.75rem,8.3vh,5.4rem)] w-[clamp(3.5rem,6vw,5rem)] cursor-pointer touch-manipulation flex-col items-center justify-center self-center rounded-lg border bg-[#07131d]/94 px-1 pb-2 pt-1 transition-[background-color,border-color,filter] duration-200 focus-visible:outline-none focus-visible:[&_.node-name]:underline focus-visible:[&_.node-name]:underline-offset-4 motion-reduce:transition-none ${
        selected
          ? "border-[color:var(--talent-accent)] bg-[color:var(--talent-surface-soft)]"
          : active
            ? "border-[color:var(--talent-accent)] shadow-[0_0_16px_var(--talent-glow)]"
            : mutuallyExcluded
              ? "border-slate-800/70 bg-[#050d14]/95"
              : unlocked
                ? "border-slate-400/65 hover:border-slate-200"
                : "border-slate-700/65 opacity-50"
      }`}
      style={
        layout === "desktop"
          ? { gridColumn: getDesktopColumn(node.column), gridRow: node.phase - 1 }
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
        {node.powerful && (
          <span
            aria-hidden="true"
            className="absolute right-0 top-0 h-1.5 w-1.5 rotate-45 bg-amber-300 shadow-[0_0_5px_rgba(252,211,77,0.75)]"
          />
        )}
      </span>
      <span className="node-name sr-only">{node.name}</span>
      <span aria-hidden="true" className="absolute inset-x-1 bottom-1 flex h-1 gap-0.5">
        {Array.from({ length: node.maxLevel }, (_, index) => (
          <span
            key={index}
            className={`h-full flex-1 rounded-[1px] ${
              index < level ? "bg-[color:var(--talent-accent)]" : "bg-slate-700"
            }`}
          />
        ))}
      </span>
    </button>
  );
}

interface PositionedTalentNode extends TalentNode {
  x: number;
  y: number;
}

interface ConnectorGroup {
  key: string;
  sources: PositionedTalentNode[];
  targets: PositionedTalentNode[];
}

function createConnectorGroups(
  nodes: TalentNode[],
  activeNodeIds?: Set<string>,
): ConnectorGroup[] {
  const positionedNodes = nodes.map((node) => ({
    ...node,
    x: ((getDesktopColumn(node.column) - 0.5) / 7) * 100,
    y: ((node.phase - 1.5) / 5) * 100,
  }));
  const nodeMap = new Map(positionedNodes.map((node) => [node.id, node]));
  const groups = new Map<
    string,
    { sources: Map<string, PositionedTalentNode>; targets: Map<string, PositionedTalentNode> }
  >();

  positionedNodes.forEach((target) => {
    if (activeNodeIds && !activeNodeIds.has(target.id)) return;

    target.prerequisites.forEach((prerequisiteId) => {
      const source = nodeMap.get(prerequisiteId);
      if (!source || (activeNodeIds && !activeNodeIds.has(source.id))) return;

      const section = target.column >= 5 ? "general" : "exclusive";
      const key = `${section}-${source.phase}-${target.phase}`;
      const group = groups.get(key) ?? {
        sources: new Map<string, PositionedTalentNode>(),
        targets: new Map<string, PositionedTalentNode>(),
      };
      group.sources.set(source.id, source);
      group.targets.set(target.id, target);
      groups.set(key, group);
    });
  });

  return [...groups.entries()].map(([key, group]) => ({
    key,
    sources: [...group.sources.values()],
    targets: [...group.targets.values()],
  }));
}

function getConnectorPath({ sources, targets }: ConnectorGroup) {
  const sourceBottom = Math.max(
    ...sources.map((node) => node.y + 5.25),
  );
  const targetTop = Math.min(
    ...targets.map((node) => node.y - 5.25),
  );
  const railY = (sourceBottom + targetTop) / 2;
  const xs = [...sources, ...targets].map((node) => node.x);
  const left = Math.min(...xs);
  const right = Math.max(...xs);

  return [
    `M${left} ${railY} H${right}`,
    ...sources.map(
      (node) => `M${node.x} ${node.y + 5.25} V${railY}`,
    ),
    ...targets.map(
      (node) => `M${node.x} ${railY} V${node.y - 5.25}`,
    ),
  ].join(" ");
}

function TalentConnectors({
  nodes,
  levels,
}: {
  nodes: TalentNode[];
  levels: Record<string, number>;
}) {
  const activeNodeIds = new Set(
    nodes
      .filter((node) => (levels[node.id] ?? 0) > 0)
      .map((node) => node.id),
  );
  const connectorGroups = createConnectorGroups(nodes);
  const activeConnectorGroups = createConnectorGroups(nodes, activeNodeIds);

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <g
        fill="none"
        stroke="var(--talent-accent-muted)"
        strokeWidth="1"
        strokeLinecap="square"
        strokeLinejoin="miter"
        opacity="0.42"
      >
        {connectorGroups.map((group) => (
          <path
            key={group.key}
            d={getConnectorPath(group)}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>

      <g
        fill="none"
        stroke="var(--talent-accent)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.18"
        style={{ filter: "drop-shadow(0 0 3px var(--talent-glow))" }}
      >
        {activeConnectorGroups.map((group) => (
          <path
            key={group.key}
            d={getConnectorPath(group)}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>

      <g
        fill="none"
        stroke="var(--talent-accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      >
        {activeConnectorGroups.map((group) => (
          <path
            key={group.key}
            d={getConnectorPath(group)}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>
    </svg>
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
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_44%,var(--talent-radial),transparent_66%)]"
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
  theme,
  previewTalent,
  equippedId,
  onPreview,
  onApply,
  onClose,
}: {
  theme: TalentTheme;
  previewTalent: PassiveTalent;
  equippedId: string | null;
  onPreview: (talent: PassiveTalent) => void;
  onApply: (talent: PassiveTalent) => void;
  onClose: () => void;
}) {
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

  const equipped = previewTalent.id === equippedId;

  return createPortal(
    <div
      role="presentation"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-2 backdrop-blur-sm sm:p-5"
      style={getThemeStyle(theme)}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        id="s3-passive-talent-selector"
        role="dialog"
        aria-modal="true"
        aria-labelledby="passive-selector-heading"
        className="relative flex max-h-[calc(100dvh-1rem)] w-full max-w-[58rem] flex-col overflow-hidden rounded-lg border border-[color:var(--talent-frame)] bg-[#04131d] shadow-[0_30px_100px_rgba(0,0,0,0.72),0_0_40px_var(--talent-surface-soft)] sm:max-h-[calc(100dvh-2.5rem)]"
      >
        <header className="relative flex min-h-[4.5rem] items-center justify-between border-b border-[color:var(--talent-divider)] bg-[#071a26]/96 px-4 sm:px-6">
          <div>
            <p className="text-xs font-medium text-[color:var(--talent-accent)]">
              S3 被动天赋
            </p>
            <h2 id="passive-selector-heading" className="mt-1 text-lg font-semibold text-white sm:text-2xl">
              选择被动天赋
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="关闭被动天赋弹窗"
            className="flex h-11 w-11 cursor-pointer touch-manipulation items-center justify-center rounded-lg border border-slate-600/65 bg-slate-900/70 text-slate-300 transition-colors hover:border-[color:var(--talent-accent)] hover:text-white focus-visible:outline-none focus-visible:[&_svg]:text-white"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(20rem,.8fr)] lg:overflow-hidden">
          <div className="flex shrink-0 flex-col border-b border-[color:var(--talent-divider)] p-4 lg:min-h-0 lg:shrink lg:border-b-0 lg:border-r lg:p-6">
            <div className="relative flex min-h-64 items-center justify-center overflow-hidden rounded-lg border border-[color:var(--talent-frame)] bg-[#071925]">
              <span aria-hidden="true" className="absolute inset-0 opacity-45 [background-image:linear-gradient(var(--talent-grid)_1px,transparent_1px),linear-gradient(90deg,var(--talent-grid)_1px,transparent_1px)] [background-size:32px_32px]" />
              <span aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--talent-radial),transparent_55%)]" />
              <span className="relative h-40 w-40 sm:h-52 sm:w-52">
                <PassiveTalentIcon talent={previewTalent} sizes="208px" />
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-[repeat(6,5rem)] sm:justify-center" aria-label="S3 被动天赋列表">
              {PASSIVE_DATA.passives.map((talent) => {
                const selected = talent.id === previewTalent.id;
                const isEquipped = talent.id === equippedId;
                return (
                  <button
                    id={`season-talent-passive-${talent.id}`}
                    key={talent.id}
                    type="button"
                    aria-pressed={selected}
                    aria-label={`预览${talent.name}`}
                    onClick={() => onPreview(talent)}
                    className={`group relative flex aspect-square min-h-14 cursor-pointer touch-manipulation items-center justify-center justify-self-center overflow-hidden rounded-lg border bg-[#06121b] p-1 transition-colors focus-visible:outline-none focus-visible:[&_.passive-name]:underline focus-visible:[&_.passive-name]:underline-offset-4 sm:w-20 ${
                      selected
                        ? "border-[color:var(--talent-accent)] bg-[color:var(--talent-surface-soft)]"
                        : "border-slate-600/60 hover:border-slate-300"
                    }`}
                  >
                    <PassiveTalentIcon talent={talent} sizes="80px" />
                    <span className="passive-name sr-only">{talent.name}</span>
                    {isEquipped && (
                      <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded bg-emerald-300 text-[#082015]">
                        <Check aria-hidden="true" className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="flex min-h-[24rem] shrink-0 flex-col bg-[#06111a]/95 p-5 sm:p-7 lg:min-h-0 lg:shrink" aria-live="polite">
            <div className="flex items-start gap-3 border-b border-[color:var(--talent-accent-soft)] pb-4">
              <span className="relative h-16 w-16 shrink-0 bg-[color:var(--talent-accent-strong)] [clip-path:polygon(18%_0,82%_0,100%_18%,100%_82%,82%_100%,18%_100%,0_82%,0_18%)]">
                <span className="absolute inset-px">
                  <PassiveTalentIcon talent={previewTalent} sizes="64px" />
                </span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[0.62rem] font-bold tracking-[0.18em] text-[color:var(--talent-accent)]">
                  S3 被动天赋 · {previewTalent.passiveSkillId}
                </p>
                <h3 className="mt-1 text-xl font-black tracking-wide text-white sm:text-2xl">
                  {previewTalent.name}
                </h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {previewTalent.tags.map((tag) => (
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
            <div className="mt-4 border-l-2 border-[color:var(--talent-accent-muted)] pl-4">
              <p className="mb-3 font-mono text-[0.62rem] font-bold tracking-[0.18em] text-slate-500">
                天赋效果
              </p>
              <TalentDescription value={previewTalent.description} />
              <div
                id={`multiplier-provider-passive-${previewTalent.id}`}
                data-multiplier-provider-target={`passive-${previewTalent.id}`}
                className="mt-3"
              >
                <MultiplierSourceBadges
                  source={{
                    type: "season-talent",
                    season: "s3",
                    tree: "zero",
                    passiveId: previewTalent.id,
                  }}
                />
              </div>
            </div>
            <div className="mt-auto flex flex-col gap-4 border-t border-[color:var(--talent-accent-soft)] pt-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="font-mono text-[0.62rem] tracking-[0.16em] text-slate-500">UNLOCK CONDITION</p>
                <p className="mt-1 text-sm text-slate-300">
                  赛季等级 <strong className="text-lg text-amber-300">{previewTalent.unlockLevel}</strong> 解锁
                </p>
              </div>
              <button
                type="button"
                aria-label={equipped ? `${previewTalent.name}使用中，关闭弹窗` : `使用${previewTalent.name}`}
                onClick={() => (equipped ? onClose() : onApply(previewTalent))}
                className="min-h-11 min-w-40 touch-manipulation bg-[color:var(--talent-accent)] px-7 py-2 text-sm font-black tracking-[0.12em] text-[#03202b] shadow-[0_0_22px_var(--talent-accent-soft)] transition-[background-color,filter,transform,box-shadow] [clip-path:polygon(8px_0,100%_0,100%_calc(100%_-_8px),calc(100%_-_8px)_100%,0_100%,0_8px)] hover:brightness-110 hover:shadow-[0_0_28px_var(--talent-glow)] active:scale-[0.98] focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-4 motion-reduce:transform-none"
              >
                {equipped ? "使用中" : "使用"}
              </button>
            </div>
          </aside>
        </div>
      </section>
    </div>,
    document.body,
  );
}

export function S3SeasonTalentBuilder({ talentId }: { talentId: S3TalentId }) {
  const DATA = TALENT_DATA[talentId];
  const ROOT_NODE_ID = DATA.nodes[0].id;
  const TALENT_BUILD_STORAGE_KEY = `nzm-wiki:season-talents:s3:${talentId}:v1`;
  const DEFAULT_EXCLUSIVE_LEVELS = useMemo(
    () => getDefaultS3TalentLevels(DATA.nodes, ROOT_NODE_ID),
    [DATA.nodes, ROOT_NODE_ID],
  );
  const [selectedNodeId, setSelectedNodeId] = useState(ROOT_NODE_ID);
  const [talentLevels, setTalentLevels] = useState<Record<string, number>>(() => ({
    ...DEFAULT_EXCLUSIVE_LEVELS,
  }));
  const [selectedPassiveId, setSelectedPassiveId] = useState<string | null>(null);
  const [previewPassiveId, setPreviewPassiveId] = useState(PASSIVE_DATA.passives[0].id);
  const [passiveSelectorOpen, setPassiveSelectorOpen] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const passiveButtonRef = useRef<HTMLButtonElement>(null);

  const nodeMap = useMemo(
    () => new Map(DATA.nodes.map((node) => [node.id, node])),
    [DATA.nodes],
  );
  const selectedNode = nodeMap.get(selectedNodeId) ?? DATA.nodes[0];
  const selectedLevel =
    selectedNode.id === ROOT_NODE_ID ? 1 : (talentLevels[selectedNode.id] ?? 0);
  const selectedPassive =
    PASSIVE_DATA.passives.find((talent) => talent.id === selectedPassiveId) ?? null;
  const previewPassive =
    PASSIVE_DATA.passives.find((talent) => talent.id === previewPassiveId) ??
    PASSIVE_DATA.passives[0];
  const exclusiveNodes = DATA.nodes.filter(
    (node) => node.id !== ROOT_NODE_ID && node.column <= 3,
  );
  const generalNodes = DATA.nodes.filter((node) => node.column >= 5);

  const updateDeepLink = useCallback((selection: { nodeId?: string; passiveId?: string }) => {
    const url = new URL(window.location.href);
    url.searchParams.delete("node");
    url.searchParams.delete("passive");
    if (selection.nodeId) url.searchParams.set("node", selection.nodeId);
    if (selection.passiveId) url.searchParams.set("passive", selection.passiveId);
    url.hash = selection.passiveId
      ? `season-talent-passive-${selection.passiveId}`
      : selection.nodeId
        ? `season-talent-node-${selection.nodeId}`
        : "";
    window.history.replaceState(null, "", url);
  }, []);

  const spentPoints = useMemo(
    () => getS3SpentTalentPoints(talentLevels),
    [talentLevels],
  );

  const closePassiveSelector = useCallback((restoreFocus = true) => {
    setPassiveSelectorOpen(false);
    updateDeepLink({});
    if (restoreFocus) {
      window.requestAnimationFrame(() => passiveButtonRef.current?.focus());
    }
  }, [updateDeepLink]);

  const openPassiveSelector = useCallback((passiveId?: string) => {
    const targetId =
      passiveId ?? selectedPassiveId ?? PASSIVE_DATA.passives[0].id;
    setPreviewPassiveId(targetId);
    setPassiveSelectorOpen(true);
    updateDeepLink({ passiveId: targetId });
  }, [selectedPassiveId, updateDeepLink]);

  const updateNodeLevel = useCallback((node: TalentNode, requestedLevel: number) => {
    if (node.id === ROOT_NODE_ID) return;

    setTalentLevels((current) =>
      setS3TalentNodeLevel(
        DATA.nodes,
        current,
        node.id,
        requestedLevel,
        POINT_LIMIT,
      ),
    );
  }, [DATA.nodes, ROOT_NODE_ID]);

  const selectNode = (node: TalentNode) => {
    setSelectedNodeId(node.id);
    updateDeepLink({ nodeId: node.id });
  };

  const activateNode = (node: TalentNode) => {
    setSelectedNodeId(node.id);
    updateDeepLink({ nodeId: node.id });
    if (node.id !== ROOT_NODE_ID) {
      updateNodeLevel(node, (talentLevels[node.id] ?? 0) + 1);
    }
  };

  const resetBuild = () => {
    setTalentLevels({ ...DEFAULT_EXCLUSIVE_LEVELS });
    setSelectedPassiveId(null);
    setSelectedNodeId(ROOT_NODE_ID);
    updateDeepLink({});
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

      const restored = restoreS3TalentBuild(
        DATA.nodes,
        ROOT_NODE_ID,
        JSON.parse(raw),
        new Set(PASSIVE_DATA.passives.map((talent) => talent.id)),
        POINT_LIMIT,
      );
      setTalentLevels(restored.levels);
      setSelectedPassiveId(restored.passiveId);
    } catch {
      // Ignore unavailable or malformed local storage and keep a clean build.
    } finally {
      setStorageReady(true);
    }
  }, [DATA.nodes, DEFAULT_EXCLUSIVE_LEVELS, ROOT_NODE_ID, TALENT_BUILD_STORAGE_KEY]);

  useEffect(() => {
    let frame = 0;
    const syncFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const nodeId = params.get("node");
      const passiveId = params.get("passive");
      if (nodeId && nodeMap.has(nodeId)) setSelectedNodeId(nodeId);
      else if (!passiveId) setSelectedNodeId(ROOT_NODE_ID);

      const passive = PASSIVE_DATA.passives.find(
        (talent) => talent.id === passiveId,
      );
      if (passive) {
        setPreviewPassiveId(passive.id);
        setPassiveSelectorOpen(true);
      } else {
        setPassiveSelectorOpen(false);
      }

      const targetId = passiveId
        ? `season-talent-passive-${passiveId}`
        : nodeId
          ? `season-talent-node-${nodeId}`
          : null;
      if (!targetId) return;
      frame = window.requestAnimationFrame(() => {
        const targets = document.querySelectorAll<HTMLElement>(
          `[id="${targetId}"]`,
        );
        const visibleTarget = [...targets].find(
          (target) => target.getClientRects().length > 0,
        );
        visibleTarget?.scrollIntoView({
          block: "center",
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
        });
      });
    };

    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("popstate", syncFromUrl);
    };
  }, [ROOT_NODE_ID, nodeMap]);

  useEffect(() => {
    if (!storageReady) return;

    const saved: SavedS3TalentBuild = {
      version: 1,
      levels: talentLevels,
      passiveId: selectedPassiveId,
    };

    try {
      window.localStorage.setItem(TALENT_BUILD_STORAGE_KEY, JSON.stringify(saved));
    } catch {
      // The builder remains usable when storage is disabled.
    }
  }, [TALENT_BUILD_STORAGE_KEY, selectedPassiveId, storageReady, talentLevels]);

  return (
    <article
      className="relative -mx-4 flex min-h-full flex-col gap-4 px-4 py-4 sm:-mx-6 sm:px-6 lg:h-full lg:min-h-0 lg:gap-3 lg:py-0 xl:-mx-12 xl:px-12"
      data-s3-talent={talentId}
      style={getThemeStyle(THEMES[talentId])}
    >
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
        <Image
          src={getAssetPath("/webp/images/season-talents/s3/T_FX_TalentS3_08.webp")}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(2,10,16,.3),rgba(2,10,16,.5)_48%,rgba(2,10,16,.76))]" />
      </div>

      <header className="relative z-20 shrink-0 overflow-hidden rounded-lg border border-[color:var(--talent-frame)] bg-[#04101a]/20 px-3 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.32)] backdrop-blur-sm sm:px-5 lg:py-2">
        <div className="mx-auto grid max-w-[1800px] items-center gap-3 lg:grid-cols-[minmax(15rem,.8fr)_minmax(18rem,1fr)_minmax(21rem,1fr)]">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href="/season-talents"
              aria-label="返回赛季天赋总览"
              title="返回赛季天赋总览"
              className="hidden min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-slate-800/70 hover:text-white focus-visible:outline-none focus-visible:[&_svg]:text-white lg:flex"
            >
              <ArrowLeft aria-hidden="true" className="h-5 w-5" />
            </Link>
            <nav aria-label="S3 天赋树" className="flex min-w-0 gap-1">
              {TREE_LINKS.map((link) => (
                <Link
                  key={link.id}
                  href={`/guides/season-talents/s3/${link.id}`}
                  aria-current={link.id === talentId ? "page" : undefined}
                  className={`flex min-h-11 touch-manipulation items-center rounded-lg border px-2.5 text-xs transition-colors focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-4 sm:text-sm ${
                    link.id === talentId
                      ? "border-[color:var(--talent-accent)] bg-[color:var(--talent-accent-soft)] text-white"
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
            aria-pressed={selectedNode.id === ROOT_NODE_ID}
            aria-label={`查看${DATA.name}赛季技能效果`}
            onClick={() => selectNode(nodeMap.get(ROOT_NODE_ID) ?? DATA.nodes[0])}
            className="group flex min-h-16 cursor-pointer touch-manipulation items-center justify-center gap-3 rounded-lg px-3 text-left focus-visible:outline-none focus-visible:[&_h1]:underline focus-visible:[&_h1]:underline-offset-4 lg:justify-start"
          >
            <span className="relative h-16 w-16 shrink-0 drop-shadow-[0_0_13px_var(--talent-glow)]">
              <Image
                src={getAssetPath(DATA.nodes[0].icon)}
                alt=""
                fill
                priority
                sizes="64px"
                className="object-contain"
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2">
                <h1 className="text-xl font-semibold text-white lg:text-2xl">{DATA.name}</h1>
                <span className="font-mono text-sm tabular-nums text-slate-300" aria-live="polite">
                  {spentPoints}/{POINT_LIMIT}
                </span>
              </span>
              <span className="mt-0.5 block text-[11px] leading-4 text-slate-400 sm:text-xs">
                适用武器：{DATA.applicableWeapons.join("、")}
              </span>
            </span>
          </button>

          <button
            ref={passiveButtonRef}
            type="button"
            aria-expanded={passiveSelectorOpen}
            aria-controls="s3-passive-talent-selector"
            aria-label="选择 S3 被动天赋"
            onClick={() => openPassiveSelector()}
            className={`group/passive flex min-h-14 w-full cursor-pointer touch-manipulation items-center gap-2 rounded-lg border px-3 text-left transition-colors focus-visible:outline-none focus-visible:[&_.passive-title]:underline focus-visible:[&_.passive-title]:underline-offset-4 ${
              selectedPassive
                ? "border-[color:var(--talent-frame)] bg-[color:var(--talent-surface-soft)] hover:border-[color:var(--talent-accent)]"
                : "border-slate-600/70 bg-[#07131d]/75 hover:border-[color:var(--talent-accent)]"
            }`}
          >
            <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-black/30">
              {selectedPassive ? (
                <Image
                  src={getAssetPath(selectedPassive.icon)}
                  alt=""
                  fill
                  sizes="40px"
                  className="object-contain p-0.5"
                />
              ) : (
                <Sparkles aria-hidden="true" className="m-2 h-6 w-6 text-slate-400" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-[color:var(--talent-accent)]">被动天赋</span>
              <span className="passive-title mt-0.5 block truncate text-sm font-semibold text-slate-100">
                {selectedPassive?.name ?? "选择被动天赋"}
              </span>
            </span>
            <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" />
          </button>
        </div>
      </header>

      {passiveSelectorOpen && (
        <PassiveTalentSelector
          theme={THEMES[talentId]}
          previewTalent={previewPassive}
          equippedId={selectedPassiveId}
          onPreview={(talent) => {
            setPreviewPassiveId(talent.id);
            updateDeepLink({ passiveId: talent.id });
          }}
          onApply={(talent) => {
            setSelectedPassiveId(talent.id);
            closePassiveSelector();
          }}
          onClose={closePassiveSelector}
        />
      )}

      <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_clamp(18rem,26vw,25rem)] lg:items-stretch">
        <div className="lg:col-start-2 lg:row-start-1 lg:min-h-0">
          <DetailCard
            node={selectedNode}
            talentId={talentId}
            rootNodeId={ROOT_NODE_ID}
            level={selectedLevel}
            unlocked={isS3TalentNodeUnlocked(selectedNode, DATA.nodes, talentLevels)}
            spentPoints={spentPoints}
            onLevelChange={(level) => updateNodeLevel(selectedNode, level)}
            onReset={resetBuild}
          />
        </div>

        <section className="relative overflow-hidden rounded-lg border border-[color:var(--talent-frame)] bg-[#05141e]/55 px-3 py-5 shadow-[0_20px_60px_rgba(0,0,0,0.32)] backdrop-blur-sm sm:px-6 lg:col-start-1 lg:row-start-1 lg:h-full lg:min-h-0 lg:px-5 lg:py-3 xl:px-8">
          <div className="relative mx-auto hidden h-full min-h-0 max-w-[1120px] grid-cols-7 grid-rows-5 gap-x-1 gap-y-1 lg:grid">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 w-[42.5%] overflow-hidden rounded-lg border border-white/10 bg-[linear-gradient(145deg,var(--talent-surface-soft),rgba(3,12,18,.08)_45%)]"
            >
              <span className="absolute inset-x-0 top-0 h-px bg-[color:var(--talent-accent)] opacity-70" />
            </div>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 w-[56.8%] overflow-hidden rounded-lg border border-cyan-100/10 bg-[linear-gradient(145deg,rgba(45,100,128,.18),rgba(3,12,18,.08)_45%)]"
            >
              <span className="absolute inset-x-0 top-0 h-px bg-cyan-200/45" />
            </div>
            <TalentConnectors nodes={[...exclusiveNodes, ...generalNodes]} levels={talentLevels} />
            <span className="absolute left-3 top-2 z-20 flex items-center gap-2 text-xs font-semibold text-[color:var(--talent-accent)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--talent-accent)] shadow-[0_0_8px_var(--talent-glow)]" />
              专属天赋
            </span>
            <span className="absolute left-[44.5%] top-2 z-20 flex items-center gap-2 text-xs font-semibold text-cyan-100/75">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-200/70" />
              通用天赋 · 同阶段四选一
            </span>
            {[...exclusiveNodes, ...generalNodes].map((node) => (
              <TalentNodeButton
                key={node.id}
                node={node}
                selected={node.id === selectedNode.id}
                level={talentLevels[node.id] ?? 0}
                unlocked={isS3TalentNodeUnlocked(node, DATA.nodes, talentLevels)}
                mutuallyExcluded={isGeneralNodeDimmed(node)}
                onSelect={selectNode}
                onActivate={activateNode}
              />
            ))}
          </div>

          <div className="relative space-y-7 lg:hidden">
            {[
              {
                label: "专属天赋",
                kind: "exclusive" as const,
                columns: 3,
                nodes: exclusiveNodes,
              },
              {
                label: "通用天赋",
                kind: "general" as const,
                columns: 4,
                nodes: generalNodes,
              },
            ].map((section) => (
              <div
                key={section.kind}
                className={`border-l-2 pl-3 ${
                  section.kind === "exclusive"
                    ? "border-[color:var(--talent-accent)]"
                    : "border-cyan-200/45"
                }`}
              >
                <div className="mb-3 flex min-h-11 items-center justify-between gap-3">
                  <h2 className={`text-sm font-semibold ${
                    section.kind === "exclusive"
                      ? "text-[color:var(--talent-accent)]"
                      : "text-cyan-100/75"
                  }`}>
                    {section.label}
                  </h2>
                  <span className="text-[0.68rem] text-slate-500">
                    {storageReady ? "方案已保存" : "正在读取方案"}
                  </span>
                </div>
                <div className="space-y-3">
                  {[2, 3, 4, 5, 6].map((phase) => (
                    <div
                      key={phase}
                      className="relative grid min-h-[6rem] items-center gap-1 rounded-lg border border-slate-700/35 bg-[#06131d]/55 px-1 py-1"
                      style={{ gridTemplateColumns: `repeat(${section.columns}, minmax(0, 1fr))` }}
                    >
                      <span className="absolute left-1 top-1 text-[0.6rem] text-slate-600">
                        {phase - 1}
                      </span>
                      {section.nodes
                        .filter((node) => node.phase === phase)
                        .map((node) => (
                          <TalentNodeButton
                            key={node.id}
                            node={node}
                            selected={node.id === selectedNode.id}
                            level={talentLevels[node.id] ?? 0}
                            unlocked={isS3TalentNodeUnlocked(
                              node,
                              DATA.nodes,
                              talentLevels,
                            )}
                            mutuallyExcluded={isGeneralNodeDimmed(node)}
                            onSelect={selectNode}
                            onActivate={activateNode}
                            layout={
                              section.kind === "general"
                                ? "mobile-general"
                                : "mobile-exclusive"
                            }
                          />
                        ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </article>
  );
}
