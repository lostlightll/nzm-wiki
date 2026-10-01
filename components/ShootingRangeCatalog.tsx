"use client";

import Image from "next/image";
import { MapPinned, Search, Skull, X } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { EnemyCatalogNav } from "@/components/EnemyCatalogNav";
import { getAssetPath } from "@/lib/path";
import { SHOOTING_RANGE_TARGETS, type ShootingRangeTarget } from "@/lib/shooting-range";

function TargetPortrait({ target, eager = false }: { target: ShootingRangeTarget; eager?: boolean }) {
  return <div className="relative aspect-square w-full overflow-hidden border-b border-zinc-700 bg-zinc-950/80">
    <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(209,172,105,0.18),_transparent_68%)]" />
    {target.image && <Image src={getAssetPath(target.image)} alt={target.title} fill loading={eager ? "eager" : "lazy"} sizes="(max-width: 639px) 45vw, (max-width: 767px) 30vw, 200px" className="object-contain transition-transform duration-200 ease-out group-hover:scale-[1.025] motion-reduce:transition-none motion-reduce:group-hover:scale-100" />}
    <span className="absolute left-2 top-2 inline-flex min-h-7 items-center gap-1 rounded border border-[#d1ac69]/40 bg-zinc-950/85 px-2 py-1 text-xs font-medium text-[#e1c58f] backdrop-blur-sm"><Skull aria-hidden="true" className="h-3.5 w-3.5" />{target.kind}</span>
  </div>;
}

function TargetCard({ target, eager = false }: { target: ShootingRangeTarget; eager?: boolean }) {
  return <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900/70 transition-[border-color,background-color,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-[#d1ac69]/70 hover:bg-zinc-800/90 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
    <TargetPortrait target={target} eager={eager} />
    <div className="flex flex-1 flex-col px-3 py-3">
      <h3 className="min-h-12 break-words text-base font-semibold leading-6 text-zinc-100">{target.title}</h3>
      <p className="mt-1 break-words text-sm leading-5 text-zinc-400">{target.kind}</p>
      <div className="mt-auto flex min-h-20 flex-col gap-1 border-t border-zinc-800 pt-3 text-sm">
        <div className="flex items-center justify-between gap-3"><span className="text-zinc-500">生命</span><span className="font-mono tabular-nums text-[#e1c58f]">{target.health.toLocaleString("zh-CN")}</span></div>
        <div className="flex items-center justify-between gap-3"><span className="text-zinc-500">护盾</span><span className="font-mono tabular-nums text-white">{target.shield.toLocaleString("zh-CN")}</span></div>
      </div>
    </div>
  </article>;
}

export function ShootingRangeCatalog() {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase("zh-CN"));
  const visibleTargets = useMemo(() => SHOOTING_RANGE_TARGETS.filter((target) => !deferredQuery || `${target.title} ${target.kind}`.toLocaleLowerCase("zh-CN").includes(deferredQuery)), [deferredQuery]);
  return <div>
    <h1 className="mb-6 text-3xl font-bold text-white">敌人图鉴</h1>
    <EnemyCatalogNav active="shooting-range" />
    <section aria-label="靶场怪物搜索" className="mb-8 rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
      <div role="search" className="relative max-w-xl">
        <label htmlFor="shooting-range-search" className="sr-only">搜索靶场怪物</label>
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input id="shooting-range-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索靶场怪物" className="min-h-11 w-full rounded border border-zinc-700 bg-zinc-900/80 py-2 pl-10 pr-11 text-base text-zinc-100 outline-none transition-colors placeholder:text-zinc-500 focus-visible:border-zinc-500" />
        {query && <button type="button" onClick={() => setQuery("")} aria-label="清空搜索" title="清空搜索" className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"><X aria-hidden="true" className="h-4 w-4" /></button>}
      </div>
      <p aria-live="polite" className="mt-5 border-t border-zinc-700/80 pt-5 text-sm text-zinc-500">共 {visibleTargets.length} 个靶场目标</p>
    </section>
    <section aria-labelledby="shooting-range-heading">
      <div className="relative isolate flex min-h-24 items-center justify-between gap-4 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-5 sm:px-6">
        <div aria-hidden="true" className="absolute inset-0 bg-linear-to-r from-zinc-950/95 via-zinc-950/65 to-zinc-950/20" />
        <div className="relative z-10 flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-zinc-600 bg-zinc-950/65 text-zinc-300 backdrop-blur-sm"><MapPinned aria-hidden="true" className="h-5 w-5" /></span><h2 id="shooting-range-heading" tabIndex={-1} className="scroll-mt-20 break-words text-xl font-semibold text-white sm:text-2xl">靶场</h2></div>
        <span className="relative z-10 shrink-0 rounded border border-zinc-600 bg-zinc-950/65 px-2.5 py-1 text-sm tabular-nums text-zinc-300 backdrop-blur-sm">{visibleTargets.length} 个</span>
      </div>
      {visibleTargets.length > 0 ? <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] sm:gap-4">{visibleTargets.map((target, index) => <TargetCard key={target.id} target={target} eager={index < 3} />)}</div> : <p className="mt-4 rounded-lg border border-dashed border-zinc-700 py-14 text-center text-zinc-400">没有匹配的靶场目标</p>}
    </section>
  </div>;
}
