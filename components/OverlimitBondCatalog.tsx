import { ArrowRight, Layers3 } from "lucide-react";
import { MultiplierSourceBadges } from "@/components/MultiplierBadges";
import {
  getOverlimitBondSurfaceStyle,
  OverlimitBondIcon,
} from "@/components/OverlimitCardMeta";
import type { OverlimitBondCatalog as OverlimitBondCatalogData } from "@/types";

interface OverlimitBondCatalogProps {
  catalog: OverlimitBondCatalogData;
  sourceSeason?: string;
  onSearchBond: (bondName: OverlimitBondCatalogData[number]["name"]) => void;
}

export function OverlimitBondCatalog({
  catalog,
  sourceSeason,
  onSearchBond,
}: OverlimitBondCatalogProps) {
  const groupedBonds = new Map<
    string,
    { counts: number[]; bonds: OverlimitBondCatalogData }
  >();
  for (const bond of catalog) {
    const counts = [...new Set(bond.effects.map((effect) => effect.count))].sort(
      (a, b) => a - b,
    );
    const signature = counts.join("-");
    const group = groupedBonds.get(signature);
    if (group) {
      group.bonds.push(bond);
    } else {
      groupedBonds.set(signature, { counts, bonds: [bond] });
    }
  }
  const groups = [...groupedBonds.entries()].sort(([, a], [, b]) => {
    // Higher final thresholds lead, without binding the layout to a season.
    for (
      let offset = 1;
      offset <= Math.max(a.counts.length, b.counts.length);
      offset++
    ) {
      const difference = (b.counts.at(-offset) ?? 0) - (a.counts.at(-offset) ?? 0);
      if (difference) return difference;
    }
    return 0;
  });
  const hasMultipleGroups = groups.length > 1;
  const BondHeading = hasMultipleGroups ? "h4" : "h3";

  return (
    <section aria-labelledby="overlimit-bond-catalog-title">
      <header className="mb-6 border-b border-zinc-800 pb-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-400">
              <Layers3 aria-hidden="true" className="h-4 w-4" />
              {catalog.length} 种羁绊
            </p>
            <h2
              id="overlimit-bond-catalog-title"
              className="text-2xl font-bold text-white"
            >
              羁绊效果
            </h2>
          </div>
          {!hasMultipleGroups && groups[0] && (
            <BondThresholds counts={groups[0][1].counts} />
          )}
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
          同一羁绊的卡片达到对应数量后，即可激活该阶段效果。
        </p>
      </header>

      <div className="space-y-8">
        {groups.map(([signature, group]) => (
          <div key={signature}>
            {hasMultipleGroups && (
              <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-zinc-100">
                  {group.counts.join(" / ")} 件羁绊
                </h3>
                <BondThresholds counts={group.counts} />
              </header>
            )}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {group.bonds.map((bond) => (
                <article
                  key={bond.name}
                  className="flex flex-col overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900/60"
                >
                  <header
                    className="flex min-h-16 items-center justify-between gap-3 border-b border-zinc-700 px-4 py-3"
                    style={getOverlimitBondSurfaceStyle(bond.name)}
                  >
                    <BondHeading className="flex items-center gap-2 text-lg font-bold">
                      <OverlimitBondIcon name={bond.name} className="h-6 w-6" />
                      {bond.name}
                    </BondHeading>
                    <span className="text-xs font-medium opacity-80">羁绊</span>
                  </header>

                  <ol className="flex-1 divide-y divide-zinc-800">
                    {bond.effects.map((effect) => (
                      <li
                        key={effect.count}
                        id={`bond-${bond.name}-${effect.count}`}
                        className="grid min-h-24 grid-cols-[3.25rem_1fr]"
                      >
                        <div className="flex items-center justify-center border-r border-zinc-800 bg-zinc-950/35 px-2 text-sm font-bold tabular-nums text-zinc-300">
                          x{effect.count}
                        </div>
                        <div className="flex min-h-0 flex-col justify-center-safe overflow-y-auto px-4 py-2 text-sm leading-5 text-zinc-200">
                          <p className="flow-root">
                            <MultiplierSourceBadges
                              source={{ type: "overlimit-bond", name: bond.name, count: effect.count, ...(sourceSeason ? { season: sourceSeason } : {}) }}
                              variant="catalog-inline"
                            />
                            {effect.description}
                          </p>
                          {effect.overrides && effect.overrides.length > 0 && (
                            <p className="mt-2 text-xs text-zinc-400">
                              替代第 {effect.overrides.join("、")} 档效果
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>

                  <footer className="border-t border-zinc-800 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => onSearchBond(bond.name)}
                      aria-label={`检索${bond.name}羁绊对应卡片`}
                      className="flex min-h-10 w-full items-center justify-center gap-1.5 rounded px-3 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4"
                    >
                      检索对应卡片
                      <ArrowRight aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </footer>
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function BondThresholds({ counts }: { counts: number[] }) {
  return (
    <div className="flex items-center gap-1.5 text-sm tabular-nums text-zinc-400">
      {counts.map((count) => (
        <span
          key={count}
          className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-semibold text-zinc-200"
        >
          x{count}
        </span>
      ))}
    </div>
  );
}
