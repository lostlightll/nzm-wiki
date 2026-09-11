"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronDown, Search, ScanFace, ArrowLeft, ArrowUpRight, X } from "lucide-react";
import { BossDifficultyControl } from "@/components/BossDifficultyControl";
import { useBossDifficulty } from "@/components/BossDifficultyProvider";
import { EnemyCatalogNav } from "@/components/EnemyCatalogNav";
import { CatalogLink } from "@/components/CatalogLink";
import { BOSS_DIFFICULTIES } from "@/lib/boss-health";
import { MONSTER_KINDS, summarizeMonsterHealth } from "@/lib/hunter-monster-health";
import type { HunterMonster, MonsterAppearance } from "@/lib/hunter-monster-health";
import { getAssetPath } from "@/lib/path";
import { getLcMapMeta } from "@/lib/lc-maps";
import type { BossDifficulty } from "@/types";

const focus = "focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-4";
const kindColor = { normal: "text-zinc-300 border-zinc-600", captain: "text-amber-200 border-amber-300/30", elite: "text-purple-200 border-purple-300/30" };

function MonsterPortrait({ monster, large = false }: { monster: HunterMonster; large?: boolean }) {
  return <div className={`relative shrink-0 overflow-hidden rounded-lg border border-zinc-800 bg-[radial-gradient(ellipse_at_center,rgba(209,172,105,0.12),transparent_75%)] ${large ? "h-32 w-32 sm:h-44 sm:w-44" : "h-24 w-24 sm:h-28 sm:w-28"}`}>
    {monster.image ? <Image src={getAssetPath(monster.image)} alt={monster.title} fill sizes={large ? "176px" : "112px"} className="object-contain p-1" /> : <ScanFace className="m-auto h-full w-10 text-zinc-600" aria-hidden="true" />}
  </div>;
}

function RegionHealth({ rows, difficulty, ready }: { rows: MonsterAppearance[]; difficulty: BossDifficulty; ready: boolean }) {
  const maps = [...new Set(rows.map(row => row.map))];
  return <div className="space-y-4">
    {maps.map(map => <table key={map} className="w-full text-sm">
      <caption className="pb-2 text-left font-medium text-zinc-300">{map} · {BOSS_DIFFICULTIES.find(d => d.value === difficulty)?.label}</caption>
      <thead><tr className="border-b border-zinc-700 text-xs text-zinc-500"><th className="py-2 text-left font-normal">区域</th><th className="py-2 text-right font-normal">配置血量</th></tr></thead>
      <tbody>{rows.filter(row => row.map === map).map(row => <tr key={row.area} className="border-b border-zinc-800/70 last:border-0">
        <th scope="row" className="py-3 pr-3 text-left font-normal text-zinc-300">{row.area === "Z博士" ? "Z 博士区域" : row.area}</th>
        <td className={`py-3 text-right tabular-nums ${row.health[difficulty] === undefined ? "text-zinc-500" : "text-[#efd59f]"}`}>{!ready ? "加载中" : row.health[difficulty]?.toLocaleString("zh-CN") ?? "待核实"}</td>
      </tr>)}</tbody>
    </table>)}
  </div>;
}

function FilterButton({ selected, children, onClick }: { selected: boolean; children: React.ReactNode; onClick: () => void }) {
  return <button type="button" aria-pressed={selected} onClick={onClick} className={`min-h-11 cursor-pointer touch-manipulation rounded border px-3 py-2 text-sm font-medium transition-colors ${focus} ${selected ? "border-[#d1ac69]/70 bg-[#d1ac69]/15 text-[#e1c58f]" : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-700 hover:text-white"}`}>{children}</button>;
}

function useMonsterFilters(monsters: HunterMonster[]) {
  const params = useSearchParams();
  const maps = [...new Set(monsters.flatMap(monster => monster.appearances.map(row => row.map)))];
  const mapValue = params.get("map") ?? "";
  const map = maps.includes(mapValue) ? mapValue : "";
  const kindValue = params.get("kind") ?? "";
  const kind = Object.hasOwn(MONSTER_KINDS, kindValue) ? kindValue : "";
  const query = params.get("q") ?? "";
  const areas = [...new Set(monsters.flatMap(monster => monster.appearances.filter(row => row.map === map).map(row => row.area)))];
  const areaValue = params.get("area") ?? "";
  const area = areas.includes(areaValue) ? areaValue : "";
  function update(key: string, value: string) {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
    if (key === "map") url.searchParams.delete("area");
    // Let Next.js synchronize useSearchParams with the native history update.
    window.history.replaceState(null, "", url);
  }
  return { maps, map, kind, query, areas, area, update };
}

export function HunterMonsterCatalog({ monsters }: { monsters: HunterMonster[] }) {
  const { maps, map, kind, query, areas, area, update } = useMonsterFilters(monsters);
  const { difficulty, ready, withDifficulty } = useBossDifficulty();
  const mapMeta = getLcMapMeta(map);
  const scoped = monsters.map(monster => ({ monster, rows: monster.appearances.filter(row => (!map || row.map === map) && (!area || row.area === area)) }));
  const visible = scoped.filter(({ monster, rows }) => rows.length && (!kind || monster.kind === kind) && `${monster.title} ${monster.description} ${rows.map(row => `${row.map} ${row.area}`).join(" ")}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const detailHref = (slug: string) => {
    const params = new URLSearchParams();
    if (map) params.set("map", map);
    if (area) params.set("area", area);
    if (kind) params.set("kind", kind);
    if (query) params.set("q", query);
    return withDifficulty(`/enemies/lc/monsters/${encodeURIComponent(slug)}?${params}`);
  };
  return <div>
    <h1 className="mb-6 text-3xl font-bold text-white">敌人图鉴</h1>
    <EnemyCatalogNav active="monsters" />
    <section aria-label="猎场怪物筛选" className="mb-8 rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
      <div role="search" className="relative max-w-xl">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <label htmlFor="monster-search" className="sr-only">搜索猎场怪物</label>
        <input id="monster-search" type="search" placeholder="搜索怪物、地图或区域" value={query} onChange={event => update("q", event.target.value)} className="min-h-11 w-full rounded border border-zinc-700 bg-zinc-900/80 py-2 pl-10 pr-11 text-base text-zinc-100 outline-none transition-colors placeholder:text-zinc-500 focus-visible:border-zinc-500" />
        {query && (
          <button type="button" onClick={() => update("q", "")} aria-label="清空搜索" title="清空搜索" className={`absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white ${focus}`}>
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="mt-5 border-t border-zinc-700/80 pt-5">
        <div className="mb-3 flex min-h-8 flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-zinc-300">地图筛选</h2>
          <p aria-live="polite" className="text-sm text-zinc-500">共 {visible.length} 种怪物</p>
        </div>
        <div aria-label="按地图筛选" className="flex flex-wrap gap-2">
          <FilterButton selected={!map} onClick={() => update("map", "")}>全部地图</FilterButton>
          {maps.map(name => <FilterButton key={name} selected={map === name} onClick={() => update("map", name)}>{name}</FilterButton>)}
        </div>
      </div>
      <BossDifficultyControl label="选择怪物血量难度" className="mt-5 border-t border-zinc-700/80 pt-5" />
      <div className="mt-5 border-t border-zinc-700/80 pt-5">
        <h2 className="mb-3 text-base font-semibold text-zinc-300">怪物类型</h2>
        <div className="flex flex-wrap gap-2" aria-label="怪物类型">
          <FilterButton selected={!kind} onClick={() => update("kind", "")}>全部类型</FilterButton>
          {Object.entries(MONSTER_KINDS).map(([value, label]) => <FilterButton key={value} selected={kind === value} onClick={() => update("kind", value)}>{label}</FilterButton>)}
        </div>
      </div>
      {map && (
        <div className="mt-5 border-t border-zinc-700/80 pt-5">
          <h2 className="mb-3 text-base font-semibold text-zinc-300">区域筛选</h2>
          <div className="flex flex-wrap gap-2" aria-label="按区域筛选">
            <FilterButton selected={!area} onClick={() => update("area", "")}>全部区域</FilterButton>
            {areas.map(name => <FilterButton key={name} selected={area === name} onClick={() => update("area", name)}>{name === "Z博士" ? "Z 博士区域" : name}</FilterButton>)}
          </div>
        </div>
      )}
    </section>
    {mapMeta && <div className="relative mb-5 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900">
      <Image src={getAssetPath(mapMeta.image)} alt="" fill sizes="1200px" className="object-cover object-center" />
      <div className="relative flex min-h-24 items-center justify-between gap-3 bg-linear-to-r from-zinc-950/95 to-zinc-950/45 px-5 py-5"><h2 className="text-2xl font-semibold text-white">{map}</h2><span className="text-sm text-zinc-300">{area || "全部区域"}</span></div>
    </div>}
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><p role="status" className="text-sm text-zinc-400">{visible.length} 种怪物<span className="mx-2 text-zinc-700">/</span>按怪物收录，区域血量分别展示</p><span className="text-xs text-zinc-500">首批收录 · 大都会</span></div>
    <div className="grid items-start gap-4 lg:grid-cols-2">
      {visible.map(({ monster, rows }) => {
        const summary = summarizeMonsterHealth(rows, difficulty);
        return <article key={monster.slug} className="min-w-0 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900/70 transition-colors hover:border-zinc-500">
          <div className="flex gap-3 p-4 sm:gap-4">
            <CatalogLink href={detailHref(monster.slug)} className={`shrink-0 rounded-lg ${focus}`} aria-label={`查看${monster.title}详情`}><MonsterPortrait monster={monster} /></CatalogLink>
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold text-white"><CatalogLink href={detailHref(monster.slug)} className={`hover:text-[#efd59f] ${focus}`}>{monster.title}</CatalogLink></h2><span className={`rounded border px-1.5 py-0.5 text-xs ${kindColor[monster.kind]}`}>{MONSTER_KINDS[monster.kind]}</span></div>
              <p className="mt-2 text-xs leading-5 text-zinc-500">{map ? `${map} · ${BOSS_DIFFICULTIES.find(d => d.value === difficulty)?.label}` : `收录地图 · ${[...new Set(rows.map(row => row.map))].join("、")}`}</p>
              <div className="mt-3"><span className="mr-2 text-xs text-zinc-400">{map ? "血量" : "区域记录"}</span><span className="text-lg font-medium tabular-nums text-[#efd59f]">{map ? ready ? summary.label : "加载中" : `${rows.length} 个区域`}</span>{map && summary.partial && <span className="ml-2 text-xs text-zinc-500">部分待核实</span>}</div>
            </div>
          </div>
          <details className="group border-t border-zinc-800">
            <summary className={`flex min-h-11 cursor-pointer list-none items-center justify-between px-4 py-3 text-sm text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 [&::-webkit-details-marker]:hidden ${focus}`}><span>区域血量<span className="ml-2 text-xs text-zinc-600">{rows.length} 个区域</span></span><ChevronDown aria-hidden="true" className="h-4 w-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" /></summary>
            <div className="border-t border-zinc-800 bg-zinc-950/25 px-4 pb-4 pt-3"><RegionHealth rows={rows} difficulty={difficulty} ready={ready} /><CatalogLink href={detailHref(monster.slug)} className={`mt-3 inline-flex min-h-11 items-center gap-1 text-sm text-zinc-400 hover:text-white ${focus}`}>查看完整档案<ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" /></CatalogLink></div>
          </details>
        </article>;
      })}
    </div>
    {!visible.length && <p className="rounded-lg border border-dashed border-zinc-700 py-14 text-center text-zinc-400">没有匹配的怪物，请调整搜索或筛选条件。</p>}
    <p className="mt-6 text-xs leading-6 text-zinc-500">血量为当前收录配置的推算值，不含额外战斗效果。「待核实」表示该难度的数值尚未确认，不代表怪物不出现。</p>
  </div>;
}

export function HunterMonsterDetail({ monster, children }: { monster: HunterMonster; children: React.ReactNode }) {
  const { map, maps, update } = useMonsterFilters([monster]);
  const { difficulty, ready, withDifficulty } = useBossDifficulty();
  const params = useSearchParams();
  const rows = monster.appearances.filter(row => !map || row.map === map);
  return <div>
    <Link href={withDifficulty(`/enemies/lc/monsters?${params}`)} className={`mb-6 inline-flex min-h-11 items-center gap-2 text-sm text-zinc-400 hover:text-white ${focus}`}><ArrowLeft aria-hidden="true" className="h-4 w-4" />返回猎场怪物</Link>
    <header className="mb-8 flex flex-wrap items-center gap-5"><MonsterPortrait monster={monster} large /><div className="min-w-0 flex-1"><span className={`inline-block rounded border px-2 py-1 text-xs ${kindColor[monster.kind]}`}>{MONSTER_KINDS[monster.kind]}</span><h1 className="mt-3 text-3xl font-bold text-white">{monster.title}</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">{monster.description}</p></div></header>
    <section aria-label="血量与分布" className="max-w-3xl rounded-lg border border-zinc-700 bg-zinc-900/60 p-4 sm:p-6"><h2 className="mb-5 text-xl font-semibold text-white">血量与分布</h2><div className="mb-6 flex flex-wrap items-end justify-between gap-5"><div className="flex flex-wrap gap-2">{maps.length > 1 && <FilterButton selected={!map} onClick={() => update("map", "")}>全部地图</FilterButton>}{maps.map(name => <FilterButton key={name} selected={map === name || maps.length === 1} onClick={() => update("map", name)}>{name}</FilterButton>)}</div><BossDifficultyControl label="选择怪物血量难度" /></div><RegionHealth rows={rows} difficulty={difficulty} ready={ready} /><p className="mt-4 text-xs leading-6 text-zinc-500">配置推算值，不含额外战斗效果。待核实不代表不出现。</p></section>
    <div className="prose prose-invert mt-8 max-w-3xl text-sm text-zinc-400">{children}</div>
  </div>;
}
