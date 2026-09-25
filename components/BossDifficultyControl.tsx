"use client";

import { BOSS_DIFFICULTIES } from "@/lib/boss-health";
import { useBossDifficulty } from "@/components/BossDifficultyProvider";

export function BossDifficultyControl({
  className = "",
  label = "选择首领血量难度",
  bossOnly = false,
}: {
  className?: string;
  label?: string;
  bossOnly?: boolean;
}) {
  const { difficulty, ready, setDifficulty } = useBossDifficulty();
  const options = bossOnly
    ? BOSS_DIFFICULTIES.filter((option) => option.value !== "overlimit")
    : BOSS_DIFFICULTIES;

  return (
    <div className={className}>
      <h2 className="mb-3 text-base font-semibold text-zinc-300">血量难度</h2>
      <div
        aria-label={label}
        aria-busy={!ready}
        className={`inline-grid min-h-11 max-w-full ${bossOnly ? "grid-cols-3" : "grid-cols-4"} rounded border border-zinc-700 bg-zinc-900/75 p-1`}
      >
        {options.map((option) => {
          const selected = ready && difficulty === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => setDifficulty(option.value)}
              className={`min-h-11 min-w-16 touch-manipulation rounded px-3 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-4 ${
                selected
                  ? "bg-[#d1ac69]/20 text-[#efd59f]"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
              } ${ready ? "" : "animate-pulse text-transparent"}`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
