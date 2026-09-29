"use client";

import { useSyncExternalStore } from "react";
import type { OriginAffixCatalog } from "@/lib/origin-affixes";
import type { OriginRuneCatalog } from "@/lib/origin-runes";
import type { OriginTalentCatalog } from "@/lib/origin-talents";
import OriginAffixesClient from "./affixes-client";
import OriginRunesClient from "./client";
import OriginTalentsClient from "./talents-client";

function activeModule(hash: string) {
  if (hash.startsWith("#talent")) return "talents";
  if (hash.startsWith("#affix")) return "affixes";
  return "runes";
}

function subscribe(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

export default function OriginCatalogClient({ runes, affixes, talents }: {
  runes: OriginRuneCatalog;
  affixes: OriginAffixCatalog;
  talents: OriginTalentCatalog;
}) {
  const active = useSyncExternalStore(subscribe, () => activeModule(window.location.hash), () => "runes");

  return <>
    <nav aria-label="原点图鉴模块" className="mb-6 flex flex-wrap items-center gap-2">
      {([
        { id: "runes", label: "强化图鉴" },
        { id: "weapons", label: "武器图鉴", disabled: true },
        { id: "affixes", label: "词条图鉴" },
        { id: "talents", label: "原点天赋" },
      ] as const).map((item) => "disabled" in item ?
        <button key={item.id} type="button" disabled title="暂未开放"
          className="min-h-11 cursor-not-allowed rounded border border-zinc-700 bg-zinc-800 px-4 py-2 text-base font-semibold text-zinc-500">
          {item.label}
        </button> :
        <a key={item.id} href={`#${item.id}`} aria-current={active === item.id ? "page" : undefined}
          className={`flex min-h-11 touch-manipulation items-center rounded border px-4 py-2 text-base font-semibold transition-colors outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 ${active === item.id
            ? "border-zinc-400 bg-zinc-600 text-white"
            : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-700/70 hover:text-white"}`}>
          {item.label}
        </a>)}
    </nav>
    {active === "talents" ? <OriginTalentsClient catalog={talents} /> :
      active === "affixes" ? <OriginAffixesClient catalog={affixes} /> : <OriginRunesClient catalog={runes} />}
  </>;
}
