"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronDown, Search, ScanFace, ArrowLeft, X } from "lucide-react";
import { BossDifficultyControl } from "@/components/BossDifficultyControl";
import { useBossDifficulty } from "@/components/BossDifficultyProvider";
import { EnemyCatalogNav } from "@/components/EnemyCatalogNav";
import { CatalogLink } from "@/components/CatalogLink";
import { BOSS_DIFFICULTIES } from "@/lib/boss-health";
import { MONSTER_KINDS } from "@/lib/hunter-monster-health";
import { groupMonstersByStage } from "@/lib/hunter-monster-stages";
import type { HunterMonster, MonsterAppearance } from "@/lib/hunter-monster-health";
import { getAssetPath } from "@/lib/path";
import { LC_MAPS } from "@/lib/lc-maps";
import type { BossDifficulty } from "@/types";

const focus = "focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-4";
const kindColor = { normal: "text-zinc-300 border-zinc-600", captain: "text-amber-200 border-amber-300/30", elite: "text-purple-200 border-purple-300/30" };

function MonsterPortrait({ monster, large = false }: { monster: HunterMonster; large?: boolean }) {
  return <div className={`relative shrink-0 overflow-hidden rounded-lg border border-zinc-800 bg-[radial-gradient(ellipse_at_center,rgba(209,172,105,0.12),transparent_75%)] ${large ? "h-32 w-32 sm:h-44 sm:w-44" : "h-16 w-16"}`}>
    {monster.image ? <Image src={getAssetPath(monster.image)} alt={monster.title} fill sizes={large ? "176px" : "64px"} className="object-contain p-1" /> : <ScanFace className="m-auto h-full w-8 text-zinc-600" aria-hidden="true" />}
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
  const maps = [...new Set(monsters.flatMap(monster => monster.appearances.map(row => row.map)))].sort((a, b) => LC_MAPS.findIndex(m => m.name === a) - LC_MAPS.findIndex(m => m.name === b));
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
  const groups = groupMonstersByStage(monsters, difficulty, { map, area, kind, query });
  const scoped = monsters.map(monster => ({ monster, rows: monster.appearances.filter(row => (!map || row.map === map) && (!area || row.area === area)) }));
  const visible = scoped.filter(({ monster, rows }) => rows.length && (!kind || monster.kind === kind) && `${monster.title} ${monster.description} ${rows.map(row => `${row.map} ${row.area}`).join(" ")}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const detailHref = (slug: string, selectedMap: string, selectedArea: string) => {
    const params = new URLSearchParams();
    params.set("map", selectedMap);
    if (area) params.set("area", selectedArea);
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
    <p role="status" className="mb-4 text-sm text-zinc-400">按地图查看各关卡怪物血量<span className="mx-2 text-zinc-700">/</span>{ready ? BOSS_DIFFICULTIES.find(d => d.value === difficulty)?.label : "加载中"}</p>
    <div className="space-y-6">
      {ready && groups.map((group, index) => <details key={`${group.name}/${map}/${difficulty}/${query}/${kind}/${area}`} open={!!map || index === 0 || !!query} className="group/map overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900/60">
        <summary className={`relative flex min-h-28 cursor-pointer list-none items-center justify-between gap-4 overflow-hidden px-5 py-6 [&::-webkit-details-marker]:hidden ${focus}`}>
          <Image src={getAssetPath(group.image)} alt="" fill sizes="1200px" className="object-cover object-center" />
          <span className="absolute inset-0 bg-linear-to-r from-zinc-950/95 via-zinc-950/65 to-zinc-950/40" />
          <span className="relative"><h2 className="text-2xl font-semibold text-white">{group.name}</h2><span className="mt-2 block text-sm text-zinc-300">{BOSS_DIFFICULTIES.find(d => d.value === difficulty)?.label}{group.supported && ` · ${group.sections.filter(s => s.number !== null).length} 个关卡`}</span></span>
          <ChevronDown aria-hidden="true" className="relative h-5 w-5 shrink-0 text-zinc-300 transition-transform group-open/map:rotate-180 motion-reduce:transition-none" />
        </summary>
        <div className="divide-y divide-zinc-800 border-t border-zinc-700">
          {!group.supported && <p className="px-5 py-8 text-sm text-zinc-400">该地图暂无{BOSS_DIFFICULTIES.find(d => d.value === difficulty)?.label}难度。</p>}
          {group.sections.map(section => <section key={section.area} className="p-4 sm:p-5" aria-label={`${group.name} · ${section.area}`}>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              {section.number !== null && <span className="text-xs font-medium tracking-wider text-[#d1ac69]">关卡 {String(section.number).padStart(2, "0")}</span>}
              <h3 className="text-base font-semibold text-zinc-100">{section.number === null ? "关卡待核实" : section.area === "Z博士" ? "Z 博士" : section.area}</h3>
              <span className="text-xs text-zinc-500">{section.entries.length} 种怪物</span>
            </div>
            {section.number === null && <p className="mb-4 text-xs leading-5 text-zinc-500">已确认属于该地图，具体出现关卡尚待核实。</p>}
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {section.entries.map(({ monster, row }) => <CatalogLink key={monster.monster_id} href={detailHref(monster.slug, group.name, section.area)} className={`flex min-w-0 items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950/30 p-3 transition-colors hover:border-zinc-600 hover:bg-zinc-800/60 ${focus}`}>
                <MonsterPortrait monster={monster} />
                <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-zinc-100">{monster.title}</span><span className="mt-1 block text-xs text-zinc-500">{MONSTER_KINDS[monster.kind]}</span><span className={`mt-2 block text-base font-semibold tabular-nums ${row.health[difficulty] === undefined ? "text-zinc-500" : "text-[#efd59f]"}`}><span className="mr-2 text-xs font-normal text-zinc-500">血量</span>{row.health[difficulty]?.toLocaleString("zh-CN") ?? "待核实"}</span></span>
              </CatalogLink>)}
            </div>
            {!section.entries.length && <p className="py-3 text-sm text-zinc-500">该关卡的怪物资料待补充。</p>}
          </section>)}
        </div>
      </details>)}
    </div>
    {ready && !groups.length && <p className="rounded-lg border border-dashed border-zinc-700 py-14 text-center text-zinc-400">没有匹配的怪物，请调整搜索或筛选条件。</p>}
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
