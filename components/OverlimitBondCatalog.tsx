import { ArrowRight, Layers3 } from "lucide-react";
import {
  getOverlimitBondSurfaceStyle,
  OverlimitBondIcon,
} from "@/components/OverlimitCardMeta";
import { MultiplierSourceBadges } from "@/components/MultiplierBadges";
import type { OverlimitBondCatalog as OverlimitBondCatalogData } from "@/types";

interface OverlimitBondCatalogProps {
  catalog: OverlimitBondCatalogData;
  onSearchBond: (bondName: OverlimitBondCatalogData[number]["name"]) => void;
}

export function OverlimitBondCatalog({
  catalog,
  onSearchBond,
}: OverlimitBondCatalogProps) {
  return (
    <section aria-labelledby="overlimit-bond-catalog-title">
      <header className="mb-6 border-b border-zinc-800 pb-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-400">
              <Layers3 aria-hidden="true" className="h-4 w-4" />
              9 种正式羁绊
            </p>
            <h2
              id="overlimit-bond-catalog-title"
              className="text-2xl font-bold text-white"
            >
              羁绊效果
            </h2>
          </div>
          <div className="flex items-center gap-1.5 text-sm tabular-nums text-zinc-400">
            {[2, 4, 6].map((count) => (
              <span
                key={count}
                className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-semibold text-zinc-200"
              >
                x{count}
              </span>
            ))}
          </div>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
          同一羁绊的卡片达到对应数量后，即可激活该阶段效果。
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {catalog.map((bond) => (
          <article
            key={bond.name}
            className="grid grid-rows-[4rem_auto_3.5rem] overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900/60"
          >
            <header
              className="flex min-h-16 items-center justify-between gap-3 border-b border-zinc-700 px-4 py-3"
              style={getOverlimitBondSurfaceStyle(bond.name)}
            >
              <h3 className="flex items-center gap-2 text-lg font-bold">
                <OverlimitBondIcon name={bond.name} className="h-6 w-6" />
                {bond.name}
              </h3>
              <span className="text-xs font-medium opacity-80">羁绊</span>
            </header>

            <ol className="grid min-h-0 grid-rows-[5.5rem_8rem_8.75rem] divide-y divide-zinc-800 xl:grid-rows-[5rem_7rem_8.75rem]">
              {bond.effects.map((effect) => (
                <li
                  key={effect.count}
                  id={`bond-${bond.name}-${effect.count}`}
                  className="grid min-h-0 grid-cols-[3.25rem_1fr]"
                >
                  <div className="flex items-center justify-center border-r border-zinc-800 bg-zinc-950/35 px-2 text-sm font-bold tabular-nums text-zinc-300">
                    x{effect.count}
                  </div>
                  <div className="flex min-h-0 flex-col justify-center-safe overflow-y-auto px-4 py-2 text-sm leading-5 text-zinc-200">
                    <p className="flow-root">
                      {effect.description}
                      <MultiplierSourceBadges
                        source={{
                          type: "overlimit-bond",
                          name: bond.name,
                          count: effect.count,
                        }}
                        variant="catalog-inline"
                      />
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            <footer className="border-t border-zinc-800 px-3 py-2">
              <button
                type="button"
                onClick={() => onSearchBond(bond.name)}
                aria-label={`检索${bond.name}羁绊对应卡片`}
                className="flex min-h-10 w-full items-center justify-center gap-1.5 rounded px-3 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              >
                检索对应卡片
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </button>
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}
