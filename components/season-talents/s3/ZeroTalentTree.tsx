"use client";

import Image from "next/image";
import {
  Crosshair,
  Layers3,
  Plus,
  Sparkles,
  Star,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
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

const DATA = zeroData as TalentData;
const ROOT_NODE_ID = "3002102";
const EXCLUSIVE_HEIGHT = 690;
const GENERAL_HEIGHT = 690;

const exclusivePositions: Record<string, { x: number; y: number }> = {
  "3002202": { x: 50, y: 60 },
  "3002301": { x: 23, y: 190 },
  "3002303": { x: 77, y: 190 },
  "3002402": { x: 50, y: 320 },
  "3002501": { x: 23, y: 450 },
  "3002503": { x: 77, y: 450 },
  "3002602": { x: 50, y: 580 },
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
              aria-label={`查看${node.name}${rank}级效果`}
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

  return (
    <section
      aria-live="polite"
      aria-label={`${node.name}详情`}
      className={`relative overflow-hidden border border-cyan-300/30 bg-[#071923]/95 shadow-[0_22px_70px_rgba(0,0,0,0.35)] ${
        compact ? "rounded-lg p-4" : "rounded-xl p-5 sm:p-6"
      }`}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300 to-transparent"
      />
      <div className="flex items-start gap-4">
        <div
          className={`relative shrink-0 overflow-hidden border border-cyan-200/25 bg-[#0a2330] [clip-path:polygon(18%_0,82%_0,100%_18%,100%_82%,82%_100%,18%_100%,0_82%,0_18%)] ${
            compact ? "h-16 w-16" : "h-24 w-24"
          }`}
        >
          <Image
            src={getAssetPath(node.icon)}
            alt=""
            fill
            sizes={compact ? "64px" : "96px"}
            className="object-cover"
          />
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
        <TalentDescription value={node.descriptions[level - 1]} />
      </div>

      <RankSelector node={node} level={level} onChange={onLevelChange} />
    </section>
  );
}

function TalentNodeButton({
  node,
  selected,
  x,
  y,
  onSelect,
}: {
  node: TalentNode;
  selected: boolean;
  x: number;
  y: number;
  onSelect: (node: TalentNode) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`查看${node.name}天赋效果，最高${node.maxLevel}级`}
      onClick={() => onSelect(node)}
      className="group/node absolute z-10 flex w-[5.75rem] -translate-x-1/2 -translate-y-1/2 touch-manipulation cursor-pointer flex-col items-center focus-visible:outline-none"
      style={{ left: `${x}%`, top: y }}
    >
      <span
        className={`relative block h-[4.5rem] w-[4.5rem] overflow-hidden border bg-[#0b1d28] transition-[border-color,filter,background-color] duration-200 [clip-path:polygon(18%_0,82%_0,100%_18%,100%_82%,82%_100%,18%_100%,0_82%,0_18%)] ${
          selected
            ? "border-cyan-200 bg-cyan-300/15 brightness-110"
            : node.powerful
              ? "border-amber-300/60 hover:border-amber-200 hover:brightness-110"
              : "border-cyan-800/80 hover:border-cyan-400 hover:brightness-110"
        }`}
      >
        <Image
          src={getAssetPath(node.icon)}
          alt=""
          fill
          sizes="72px"
          className="object-cover"
        />
      </span>
      <span
        className={`mt-2 max-w-full truncate text-center text-xs font-semibold leading-4 transition-colors group-focus-visible/node:underline group-focus-visible/node:decoration-2 group-focus-visible/node:underline-offset-4 ${
          selected ? "text-cyan-100" : "text-slate-300 group-hover/node:text-white"
        }`}
      >
        {node.name}
      </span>
      <span className="mt-1 flex h-2 items-center justify-center gap-1" aria-hidden="true">
        {Array.from({ length: node.maxLevel }, (_, index) => (
          <span
            key={index}
            className={`h-1.5 w-1.5 rotate-45 border ${
              selected ? "border-cyan-200 bg-cyan-300/50" : "border-slate-600"
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
        <path d="M50 92 V125 H23 V158 M50 125 H77 V158" />
        <path d="M23 222 V255 H50 V288 M77 222 V255 H50" />
        <path d="M50 352 V385 H23 V418 M50 385 H77 V418" />
        <path d="M23 482 V515 H50 V548 M77 482 V515 H50" />
      </g>
    </svg>
  );
}

function GeneralConnectors() {
  const xs = [12.5, 37.5, 62.5, 87.5];
  const centers = [60, 190, 320, 450, 580];

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
                <path key={x} d={`M${x} ${center + 32} V${nextCenter - 32}`} />
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
  onSelect,
  onLevelChange,
}: {
  node: TalentNode;
  selected: boolean;
  level: number;
  onSelect: (node: TalentNode) => void;
  onLevelChange: (level: number) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-cyan-950 bg-[#081720]/85">
      <button
        type="button"
        aria-expanded={selected}
        onClick={() => onSelect(node)}
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
          <span className="mt-1 block text-xs text-slate-400">
            最高 {node.maxLevel} 级 · 点击查看效果
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

export function ZeroTalentTree() {
  const [selectedNodeId, setSelectedNodeId] = useState(ROOT_NODE_ID);
  const [selectedLevel, setSelectedLevel] = useState(1);

  const nodeMap = useMemo(
    () => new Map(DATA.nodes.map((node) => [node.id, node])),
    [],
  );
  const selectedNode = nodeMap.get(selectedNodeId) ?? DATA.nodes[0];
  const exclusiveNodes = DATA.nodes.filter(
    (node) => node.id !== ROOT_NODE_ID && node.column <= 3,
  );
  const generalNodes = DATA.nodes.filter((node) => node.column >= 5);

  const selectNode = (node: TalentNode) => {
    setSelectedNodeId(node.id);
    setSelectedLevel(1);
  };

  return (
    <article className="relative isolate overflow-hidden rounded-xl border border-cyan-900/70 bg-[#06121a] shadow-[0_30px_100px_rgba(0,0,0,0.35)]">
      <Image
        src={getAssetPath("/webp/images/season-talents/s3/zero/background.webp")}
        alt=""
        fill
        priority
        sizes="100vw"
        className="-z-20 object-cover opacity-[0.13]"
      />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_12%,rgba(18,142,205,0.2),transparent_30%),linear-gradient(180deg,rgba(2,11,17,0.76),rgba(5,23,33,0.94))]" />

      <header className="border-b border-cyan-900/70 px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">
          <span className="rounded border border-cyan-400/40 bg-cyan-400/10 px-2.5 py-1">
            S3
          </span>
          <span>赛季天赋详情</span>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-center">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <button
              type="button"
              aria-pressed={selectedNode.id === ROOT_NODE_ID}
              aria-label="查看零点赛季技能效果"
              onClick={() => selectNode(nodeMap.get(ROOT_NODE_ID) ?? DATA.nodes[0])}
              className={`group/root relative h-28 w-28 shrink-0 touch-manipulation cursor-pointer overflow-hidden border bg-[#0a2330] transition-colors focus-visible:outline-none [clip-path:polygon(18%_0,82%_0,100%_18%,100%_82%,82%_100%,18%_100%,0_82%,0_18%)] sm:h-32 sm:w-32 ${
                selectedNode.id === ROOT_NODE_ID
                  ? "border-cyan-200 bg-cyan-300/15"
                  : "border-cyan-700 hover:border-cyan-300"
              }`}
            >
              <Image
                src={getAssetPath(DATA.nodes[0].icon)}
                alt=""
                fill
                sizes="128px"
                className="object-cover transition-[filter] duration-200 group-hover/root:brightness-110"
              />
            </button>
            <div>
              <h1 className="text-3xl font-black tracking-[0.08em] text-white sm:text-4xl">
                {DATA.name}
              </h1>
              <p className="mt-2 text-base text-slate-300 sm:text-lg">{DATA.subtitle}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {DATA.applicableWeapons.map((weapon) => (
                  <span
                    key={weapon}
                    className="inline-flex items-center gap-1.5 rounded border border-cyan-700/60 bg-cyan-950/50 px-2.5 py-1.5 text-xs font-medium text-cyan-100"
                  >
                    <Crosshair aria-hidden="true" className="h-3.5 w-3.5" />
                    {weapon}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <section
            aria-label="被动天赋槽位"
            className="flex min-h-28 items-center gap-4 rounded-lg border border-dashed border-slate-600 bg-slate-950/35 p-4"
          >
            <span className="flex h-14 w-14 shrink-0 items-center justify-center border border-slate-600 bg-slate-900/60 [clip-path:polygon(18%_0,82%_0,100%_18%,100%_82%,82%_100%,18%_100%,0_82%,0_18%)]">
              <Plus aria-hidden="true" className="h-6 w-6 text-slate-400" />
            </span>
            <div>
              <p className="text-xs font-semibold tracking-[0.15em] text-slate-500">被动天赋</p>
              <p className="mt-1 font-semibold text-slate-200">选择被动天赋</p>
              <p className="mt-1 text-xs text-slate-500">槽位已预留，内容待补充</p>
            </div>
          </section>
        </div>

        {selectedNode.id === ROOT_NODE_ID && (
          <div className="mt-5 xl:hidden">
            <DetailCard
              node={selectedNode}
              level={selectedLevel}
              onLevelChange={setSelectedLevel}
              compact
            />
          </div>
        )}
      </header>

      <div className="grid gap-6 p-4 sm:p-6 xl:grid-cols-[minmax(0,1fr)_23rem] xl:items-start xl:p-8">
        <div>
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">Talent Matrix</p>
              <h2 className="mt-1 text-xl font-bold text-white">天赋节点</h2>
            </div>
            <p className="text-right text-xs leading-5 text-slate-500">
              选择节点查看效果
              <br />
              不展示解锁状态
            </p>
          </div>

          <div className="hidden overflow-hidden rounded-xl border border-cyan-950/80 bg-[#06151e]/80 xl:block">
            <div className="grid grid-cols-[36%_64%] border-b border-cyan-950/80">
              <div className="flex items-center gap-2 border-r border-cyan-950/80 px-5 py-3 text-sm font-semibold text-cyan-100">
                <Sparkles aria-hidden="true" className="h-4 w-4 text-cyan-300" />
                专属天赋
              </div>
              <div className="flex items-center gap-2 px-5 py-3 text-sm font-semibold text-slate-200">
                <Layers3 aria-hidden="true" className="h-4 w-4 text-slate-400" />
                通用天赋
              </div>
            </div>

            <div className="grid grid-cols-[36%_64%]">
              <div
                className="relative border-r border-cyan-950/80"
                style={{ height: EXCLUSIVE_HEIGHT }}
              >
                <ExclusiveConnectors />
                {exclusiveNodes.map((node) => {
                  const position = exclusivePositions[node.id];
                  return (
                    <TalentNodeButton
                      key={node.id}
                      node={node}
                      selected={node.id === selectedNode.id}
                      x={position.x}
                      y={position.y}
                      onSelect={selectNode}
                    />
                  );
                })}
              </div>

              <div className="relative" style={{ height: GENERAL_HEIGHT }}>
                <GeneralConnectors />
                {generalNodes.map((node) => (
                  <TalentNodeButton
                    key={node.id}
                    node={node}
                    selected={node.id === selectedNode.id}
                    x={(node.column - 4.5) * 25}
                    y={60 + (node.phase - 2) * 130}
                    onSelect={selectNode}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-8 xl:hidden">
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
                    level={selectedLevel}
                    onSelect={selectNode}
                    onLevelChange={setSelectedLevel}
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
                            level={selectedLevel}
                            onSelect={selectNode}
                            onLevelChange={setSelectedLevel}
                          />
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        <aside className="hidden xl:sticky xl:top-20 xl:block">
          <DetailCard
            node={selectedNode}
            level={selectedLevel}
            onLevelChange={setSelectedLevel}
          />
        </aside>
      </div>
    </article>
  );
}
