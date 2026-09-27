"use client";

import Image from "next/image";
import { useState } from "react";
import type { OriginTalent, OriginTalentCatalog, OriginTalentBranchId } from "@/lib/origin-talents";
import { getAssetPath } from "@/lib/path";

const branchStyles = {
  1: { color: "#ef8c8c", text: "text-red-300", background: "bg-red-400/10", border: "border-red-400/50" },
  2: { color: "#dcc46e", text: "text-amber-200", background: "bg-amber-300/10", border: "border-amber-300/50" },
  3: { color: "#7dc6e4", text: "text-sky-300", background: "bg-sky-400/10", border: "border-sky-400/50" },
  4: { color: "#e3ac68", text: "text-orange-300", background: "bg-orange-400/10", border: "border-orange-400/50" },
} as const;
const focusStyle = "outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4";
const rowHeight = 138;

function TalentIcon({ talent, selected = false }: { talent: OriginTalent; selected?: boolean }) {
  const style = branchStyles[talent.branchId];
  return <span className="relative block h-20 w-[92px] shrink-0">
    <svg viewBox="0 0 92 80" aria-hidden="true" className="absolute inset-0 h-full w-full">
      <polygon points="23.5,1.0289 68.5,1.0289 91,40 68.5,78.9711 23.5,78.9711 1,40"
        fill={style.color} fillOpacity={selected ? 0.2 : 0.055}
        stroke={style.color} strokeOpacity={selected ? 1 : 0.45} strokeWidth={selected ? 2 : 1} />
    </svg>
    <Image src={getAssetPath(talent.icon)} alt="" width={52} height={52}
      className="absolute left-5 top-[14px] h-[52px] w-[52px] object-contain" />
  </span>;
}

function TalentTree({ talents, selectedId, onSelect }: {
  talents: OriginTalent[];
  selectedId: string;
  onSelect: (talent: OriginTalent) => void;
}) {
  const positions = new Map(talents.map((talent) => {
    const row = talents.filter((other) => other.row === talent.row);
    return [talent.id, { x: row.length === 1 ? 50 : row.indexOf(talent) === 0 ? 25 : 75, y: (talent.row - 1) * rowHeight + 16 }];
  }));
  const height = Math.max(...talents.map((talent) => talent.row), 1) * rowHeight + 20;
  return <div className="relative mx-auto w-full max-w-[420px]" style={{ height }}>
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
      {talents.flatMap((talent) => talent.prerequisites.map((prerequisite) => {
        const from = positions.get(prerequisite.id);
        const to = positions.get(talent.id);
        if (!from || !to) return null;
        const highlighted = talent.id === selectedId || prerequisite.id === selectedId;
        return <line key={`${prerequisite.id}-${talent.id}`}
          x1={from.x} y1={from.y + 40} x2={to.x} y2={to.y + 40}
          stroke={branchStyles[talent.branchId].color} strokeOpacity={highlighted ? 0.85 : 0.25}
          strokeWidth={highlighted ? 1.5 : 1} vectorEffect="non-scaling-stroke" />;
      }))}
    </svg>
    {talents.map((talent) => {
      const position = positions.get(talent.id)!;
      const selected = selectedId === talent.id;
      return <button key={talent.id} type="button" aria-pressed={selected}
        aria-label={`${talent.name}，最高 ${talent.maxLevel} 级，查看详情`}
        onClick={() => onSelect(talent)}
        style={{ left: `${position.x}%`, top: position.y }}
        className={`group absolute flex w-[46%] -translate-x-1/2 touch-manipulation flex-col items-center text-center ${focusStyle}`}>
        <span className="rounded-full bg-zinc-900 transition-colors group-hover:bg-zinc-800">
          <TalentIcon talent={talent} selected={selected} />
        </span>
        <span className={`mt-1 max-w-full rounded bg-zinc-900 px-1 text-sm font-medium leading-5 ${selected ? branchStyles[talent.branchId].text : "text-zinc-200 group-hover:text-white"}`}>
          {talent.name}
        </span>
        <span className="mt-1 rounded bg-zinc-900 px-1 text-xs leading-4 text-zinc-400">{talent.maxLevel} 级</span>
      </button>;
    })}
  </div>;
}

function TalentDetails({ talent, catalog }: {
  talent: OriginTalent;
  catalog: OriginTalentCatalog;
}) {
  const [level, setLevel] = useState(1);
  const selectedLevel = talent.levels.find((item) => item.level === level) ?? talent.levels[0];
  const style = branchStyles[talent.branchId];
  const branchName = catalog.branches.find((branch) => branch.id === talent.branchId)?.name ?? "终极";
  return <div className={`rounded-lg border bg-zinc-900 p-4 sm:p-5 ${style.border}`}>
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.65fr)]">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <TalentIcon talent={talent} selected />
          <div className="min-w-0">
            <p className={`mb-1 text-xs ${style.text}`}>{branchName}天赋</p>
            <h3 className="break-words text-lg font-semibold text-white">{talent.name}</h3>
            <p className="mt-1 text-xs text-zinc-400">最高 {talent.maxLevel} 级</p>
          </div>
        </div>
        <p className="mt-3 whitespace-pre-line break-words text-sm leading-7 text-zinc-200">{selectedLevel?.description ?? talent.description}</p>
      </div>
      <div className="min-w-0 space-y-3">
        <fieldset>
          <legend className="mb-2 text-xs text-zinc-400">等级预览</legend>
          <div className="flex flex-wrap gap-2">
            {talent.levels.map((item) => <button key={item.level} type="button" aria-pressed={level === item.level}
              onClick={() => setLevel(item.level)}
              className={`min-h-11 min-w-11 rounded border px-3 text-sm transition-colors ${focusStyle} ${level === item.level ? `${style.border} ${style.background} ${style.text}` : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}>
              {item.level} 级
            </button>)}
          </div>
        </fieldset>
        {selectedLevel && <p className="text-sm text-zinc-300">本级升级材料消耗 <span className="font-medium tabular-nums text-white">{selectedLevel.cost}</span></p>}
      </div>
    </div>
  </div>;
}

export default function OriginTalentsClient({ catalog }: { catalog: OriginTalentCatalog }) {
  const [selectedId, setSelectedId] = useState(catalog.talents[0]?.id ?? "");
  const [activeBranch, setActiveBranch] = useState<OriginTalentBranchId>(1);
  const selected = catalog.talents.find((talent) => talent.id === selectedId) ?? catalog.talents[0];
  const ultimate = catalog.talents.find((talent) => talent.branchId === 4);
  const selectTalent = (talent: OriginTalent) => {
    setSelectedId(talent.id);
    if (talent.branchId !== 4) setActiveBranch(talent.branchId);
  };

  return <section id="talents" aria-label="原点天赋图鉴" className="space-y-4">
    <div className="flex justify-end text-sm leading-6 text-zinc-400">
      <span>{catalog.talents.length} 项天赋</span>
    </div>
    <div className="overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900">
      <div className="grid grid-cols-3 border-b border-zinc-700">
        {catalog.branches.map((branch) => {
          const style = branchStyles[branch.id];
          return <div key={branch.id}>
            <button type="button" aria-pressed={activeBranch === branch.id}
              onClick={() => {
                setActiveBranch(branch.id);
                const firstTalent = catalog.talents.find((talent) => talent.branchId === branch.id);
                if (firstTalent) setSelectedId(firstTalent.id);
              }}
              className={`min-h-12 w-full px-2 py-3 text-sm font-semibold transition-colors md:hidden ${focusStyle} ${activeBranch === branch.id ? `${style.background} ${style.text}` : "text-zinc-400 hover:bg-zinc-800"}`}>
              {branch.name}
            </button>
            <h2 className={`hidden px-3 py-3 text-center text-base font-semibold md:block ${style.text} ${style.background}`}>{branch.name}</h2>
          </div>;
        })}
      </div>
      <div aria-label="天赋树，向下滚动浏览后续天赋" tabIndex={0}
        className={`max-h-[52dvh] min-h-[320px] overflow-y-auto overscroll-contain md:max-h-[510px] ${focusStyle} focus-visible:bg-zinc-800/30`}>
        <div className="grid md:grid-cols-3">
          {catalog.branches.map((branch) => <div key={branch.id} aria-label={`${branch.name}天赋树`}
            className={`min-w-0 md:border-r md:border-zinc-800 md:last:border-r-0 ${activeBranch === branch.id ? "block" : "hidden md:block"}`}>
            <TalentTree talents={catalog.talents.filter((talent) => talent.branchId === branch.id)} selectedId={selectedId} onSelect={selectTalent} />
          </div>)}
        </div>
      </div>
      {ultimate && <button type="button" onClick={() => selectTalent(ultimate)} aria-pressed={selectedId === ultimate.id}
        className={`flex min-h-24 w-full items-center gap-4 border-t border-zinc-700 px-4 py-3 text-left transition-colors sm:px-6 ${focusStyle} ${selectedId === ultimate.id ? "bg-orange-400/10" : "bg-zinc-800/40 hover:bg-zinc-800"}`}>
        <TalentIcon talent={ultimate} selected={selectedId === ultimate.id} />
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-orange-300">终极天赋</span>
          <span className="mt-1 block break-words text-base font-semibold text-white">{ultimate.name}</span>
        </span>
        <span aria-hidden="true" className="text-xl text-zinc-400">›</span>
      </button>}
    </div>
    {selected && <TalentDetails key={selected.id} talent={selected} catalog={catalog} />}
  </section>;
}
