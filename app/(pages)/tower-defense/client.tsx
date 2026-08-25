"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { restoreCatalogNavigation } from "@/lib/catalog-navigation";

type TowerDefenseModule = "traps" | "enemies";

const MODULES: readonly { id: TowerDefenseModule; label: string }[] = [
  { id: "traps", label: "塔防陷阱" },
  { id: "enemies", label: "塔防敌人" },
];

function getModuleFromHash(): TowerDefenseModule {
  return window.location.hash === "#enemies" ? "enemies" : "traps";
}

export default function TowerDefensePageClient({
  trapsPanel,
  enemiesPanel,
}: {
  trapsPanel: ReactNode;
  enemiesPanel: ReactNode;
}) {
  const [activeModule, setActiveModule] = useState<TowerDefenseModule>("traps");

  useEffect(() => {
    restoreCatalogNavigation();

    const syncModuleFromHash = () => setActiveModule(getModuleFromHash());
    syncModuleFromHash();
    window.addEventListener("hashchange", syncModuleFromHash);
    window.addEventListener("popstate", syncModuleFromHash);
    return () => {
      window.removeEventListener("hashchange", syncModuleFromHash);
      window.removeEventListener("popstate", syncModuleFromHash);
    };
  }, []);

  const selectModule = useCallback((module: TowerDefenseModule) => {
    setActiveModule(module);
    const hash = module === "traps" ? "#traps" : "#enemies";
    window.history.pushState(null, "", hash);
  }, []);

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold text-white">塔防图鉴</h1>
        <p className="w-fit bg-blue-500/20 px-3 py-2 text-sm font-medium text-blue-100">
          TODO：重做陷阱详情页
        </p>
      </div>

      <nav aria-label="塔防图鉴模块" className="mb-6 flex flex-wrap items-center gap-2">
        {MODULES.map((module) => {
          const active = activeModule === module.id;

          return (
            <button
              key={module.id}
              type="button"
              aria-pressed={active}
              onClick={() => selectModule(module.id)}
              className={`min-h-11 touch-manipulation rounded border px-4 py-2 text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
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

      <section
        id="traps"
        aria-label="塔防陷阱"
        hidden={activeModule !== "traps"}
      >
        <h2 className="sr-only">塔防陷阱</h2>
        {trapsPanel}
      </section>

      <section
        id="enemies"
        aria-label="塔防敌人"
        hidden={activeModule !== "enemies"}
      >
        <h2 className="sr-only">塔防敌人</h2>
        {enemiesPanel}
      </section>
    </>
  );
}
