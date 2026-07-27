"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { SeasonTalentCatalog } from "@/components/SeasonTalentCatalog";

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
}: {
  archivePanel: ReactNode;
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
    <>
      <h1 className="mb-6 text-3xl font-bold text-white">攻略机制</h1>

      <nav aria-label="攻略机制模块" className="mb-6 flex flex-wrap items-center gap-2">
        {MODULES.map((module) => {
          const active = activeModule === module.id;

          return (
            <button
              key={module.id}
              type="button"
              aria-pressed={active}
              onClick={() => selectModule(module.id)}
              className={`min-h-11 touch-manipulation rounded border px-4 py-2 text-base font-semibold transition-colors focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 ${
                active
                  ? "border-zinc-400 bg-zinc-600 text-white"
                  : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-700 hover:text-white"
              }`}
            >
              {module.label}
            </button>
          );
        })}
      </nav>

      <section aria-label="游戏乘区" hidden={activeModule !== "multiplier"} />
      <section aria-label="赛季天赋" hidden={activeModule !== "season-talents"}>
        <SeasonTalentCatalog />
      </section>
      <section aria-label="文章归档" hidden={activeModule !== "archive"}>
        {archivePanel}
      </section>
    </>
  );
}
