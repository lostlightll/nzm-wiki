"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { SeasonTalentCatalog } from "@/components/SeasonTalentCatalog";
import { MultiplierOverview } from "./MultiplierOverview";
import type { WeaponBaseDamageEntry } from "@/lib/weapon-base-damage";
import type { MultiplierTargetIndexEntry } from "./MultiplierBidirectionalIndex";

type GuideModule = "multiplier" | "season-talents" | "archive";

const MODULES: readonly { id: GuideModule; label: string }[] = [
  { id: "multiplier", label: "游戏乘区" },
  { id: "season-talents", label: "赛季天赋" },
  { id: "archive", label: "文章归档" },
];

function getModuleFromHash(): GuideModule {
  const hash = window.location.hash.slice(1);
  return MODULES.some((module) => module.id === hash)
    ? (hash as GuideModule)
    : "multiplier";
}

export default function GuidesPageClient({
  archivePanel,
  baseDamageEntries,
  multiplierTargets,
}: {
  archivePanel: ReactNode;
  baseDamageEntries: readonly WeaponBaseDamageEntry[];
  multiplierTargets: readonly MultiplierTargetIndexEntry[];
}) {
  const [activeModule, setActiveModule] = useState<GuideModule>("multiplier");

  useEffect(() => {
    const syncModuleFromHash = () => setActiveModule(getModuleFromHash());
    syncModuleFromHash();
    window.addEventListener("hashchange", syncModuleFromHash);
    window.addEventListener("popstate", syncModuleFromHash);
    return () => {
      window.removeEventListener("hashchange", syncModuleFromHash);
      window.removeEventListener("popstate", syncModuleFromHash);
    };
  }, []);

  const selectModule = useCallback((module: GuideModule) => {
    window.history.pushState(null, "", `#${module}`);
    setActiveModule(module);
  }, []);

  return (
    <div className="[--guide-accent:#e6b656] [--guide-accent-soft:rgba(172,124,39,0.2)] [--guide-muted:#b5b5bb] [--guide-text:#e4e4e7] [--guide-warning-border:rgba(190,139,48,0.45)]">
      <h1 className="sr-only">攻略机制</h1>

      <nav
        aria-label="攻略机制模块"
        className="mx-auto mb-6 grid max-w-xl grid-cols-3 rounded-2xl border border-zinc-600 bg-zinc-900/75 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:mb-7 xl:mb-3 xl:p-0.5"
      >
        {MODULES.map((module) => {
          const active = activeModule === module.id;

          return (
            <button
              key={module.id}
              type="button"
              aria-pressed={active}
              aria-controls={`${module.id}-panel`}
              onClick={() => selectModule(module.id)}
              className={`min-h-12 cursor-pointer touch-manipulation rounded-xl border px-2 py-2 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 motion-reduce:transition-none sm:px-4 sm:text-base xl:min-h-11 xl:py-1.5 ${
                active
                  ? "border-[color:var(--guide-accent)] bg-[linear-gradient(135deg,#d8a846,#edc56f)] text-[#211909]"
                  : "border-transparent bg-transparent text-zinc-400 hover:bg-zinc-800/75 hover:text-zinc-100"
              }`}
            >
              {module.label}
            </button>
          );
        })}
      </nav>

      <section
        id="multiplier-panel"
        aria-label="游戏乘区"
        hidden={activeModule !== "multiplier"}
      >
        <MultiplierOverview
          baseDamageEntries={baseDamageEntries}
          targets={multiplierTargets}
        />
      </section>
      <section
        id="season-talents-panel"
        aria-label="赛季天赋"
        hidden={activeModule !== "season-talents"}
      >
        <SeasonTalentCatalog />
      </section>
      <section id="archive-panel" aria-label="文章归档" hidden={activeModule !== "archive"}>
        {archivePanel}
      </section>
    </div>
  );
}
