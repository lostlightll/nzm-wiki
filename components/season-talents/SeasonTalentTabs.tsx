"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";
import { SeasonTalentCatalog } from "@/components/SeasonTalentCatalog";

const BASE_SEASONS = ["s0", "s1", "s2", "s3"] as const;
const ALL_SEASONS = [...BASE_SEASONS, "s4"] as const;

type SeasonPage = (typeof ALL_SEASONS)[number];

export function SeasonTalentTabs({ s4Panel }: { s4Panel: ReactNode }) {
  const showS4 = s4Panel !== null;
  const seasonPages: readonly SeasonPage[] = showS4 ? ALL_SEASONS : BASE_SEASONS;
  const [activePage, setActivePage] = useState<SeasonPage>(
    showS4 ? "s4" : "s3",
  );

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    let nextPage: SeasonPage | null = null;
    const activeIndex = seasonPages.indexOf(activePage);

    if (event.key === "ArrowLeft") {
      nextPage =
        seasonPages[(activeIndex - 1 + seasonPages.length) % seasonPages.length];
    } else if (event.key === "ArrowRight") {
      nextPage = seasonPages[(activeIndex + 1) % seasonPages.length];
    } else if (event.key === "Home") {
      nextPage = seasonPages[0];
    } else if (event.key === "End") {
      nextPage = seasonPages[seasonPages.length - 1];
    }

    if (!nextPage) return;

    event.preventDefault();
    setActivePage(nextPage);
    document.getElementById(`season-talents-${nextPage}-tab`)?.focus();
  };

  return (
    <div className="relative lg:h-full">
      <div
        role="tablist"
        aria-label="赛季天赋版本"
        className="relative z-30 mx-auto mb-5 flex max-w-xl rounded-2xl border border-zinc-600 bg-zinc-900/85 p-1 shadow-[0_8px_24px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm lg:absolute lg:left-1/2 lg:top-3 lg:mb-0 lg:w-full lg:-translate-x-1/2"
      >
        {seasonPages.map((page) => (
          <button
            key={page}
            id={`season-talents-${page}-tab`}
            type="button"
            role="tab"
            aria-selected={activePage === page}
            aria-controls={`season-talents-${page}-panel`}
            tabIndex={activePage === page ? 0 : -1}
            onClick={() => setActivePage(page)}
            onKeyDown={handleTabKeyDown}
            onPointerUp={(event) => event.currentTarget.blur()}
            className={`min-h-12 flex-1 cursor-pointer touch-manipulation rounded-xl border px-3 py-2 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 motion-reduce:transition-none ${
              activePage === page
                ? "border-[color:var(--guide-accent)] bg-[linear-gradient(135deg,#d8a846,#edc56f)] text-[#211909]"
                : "border-transparent bg-transparent text-zinc-400 hover:bg-zinc-800/75 hover:text-zinc-100"
            }`}
          >
            {page.toUpperCase()}
          </button>
        ))}
      </div>

      {(["s0", "s1", "s2"] as const).map((page) => (
        <div
          key={page}
          id={`season-talents-${page}-panel`}
          role="tabpanel"
          aria-labelledby={`season-talents-${page}-tab`}
          hidden={activePage !== page}
          className="px-4 pb-6 sm:px-6 lg:flex lg:h-full lg:items-center lg:justify-center lg:pt-20"
        >
          <div className="w-full rounded-lg border border-zinc-700/80 bg-zinc-900/55 px-6 py-16 text-center lg:max-w-5xl">
            <p className="text-sm font-medium text-zinc-400">
              {page.toUpperCase()} 赛季天赋暂未收录
            </p>
          </div>
        </div>
      ))}

      {showS4 && (
        <div
          id="season-talents-s4-panel"
          role="tabpanel"
          aria-labelledby="season-talents-s4-tab"
          hidden={activePage !== "s4"}
          className="lg:h-full"
        >
          {s4Panel}
        </div>
      )}
      <div
        id="season-talents-s3-panel"
        role="tabpanel"
        aria-labelledby="season-talents-s3-tab"
        hidden={activePage !== "s3"}
        className="px-4 pb-6 sm:px-6 lg:h-full lg:overflow-y-auto lg:pt-20"
      >
        <SeasonTalentCatalog />
      </div>
    </div>
  );
}
