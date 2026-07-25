"use client";

import { BossDifficultyControl } from "@/components/BossDifficultyControl";
import { useBossDifficulty } from "@/components/BossDifficultyProvider";
import {
  formatBossHealthSummary,
  formatBossHealthValue,
  getBossHealth,
  getBossPhaseCount,
} from "@/lib/boss-health";
import type { Boss } from "@/types";

export function BossCardHealth({ boss }: { boss: Boss }) {
  const { difficulty, ready } = useBossDifficulty();
  const compact = getBossPhaseCount(boss) === 2;

  return (
    <span
      aria-busy={!ready}
      className={`block max-w-full whitespace-nowrap text-left leading-5 tabular-nums ${
        compact ? "text-xs" : "text-sm"
      } ${
        ready
          ? "font-mono text-[#e1c58f]"
          : "h-5 w-20 animate-pulse rounded bg-zinc-700"
      }`}
    >
      {ready ? formatBossHealthSummary(boss, difficulty) : null}
    </span>
  );
}

export function BossDetailHealth({ boss }: { boss: Boss }) {
  const { difficulty, ready } = useBossDifficulty();
  const health = getBossHealth(boss, difficulty);
  const phaseCount = getBossPhaseCount(boss);

  return (
    <div className="mt-6 max-w-lg">
      <BossDifficultyControl />
      <dl
        aria-busy={!ready}
        className={`mt-3 grid min-h-20 grid-cols-1 gap-3 ${
          phaseCount === 2 ? "sm:grid-cols-2" : ""
        }`}
      >
        {!ready ? (
          <div className="min-h-20 animate-pulse rounded border border-zinc-600/80 bg-zinc-950/65 px-4 py-3" />
        ) : health === "unsupported" ? (
          <div className="min-h-20 rounded border border-zinc-600/80 bg-zinc-950/65 px-4 py-3 backdrop-blur-sm">
            <dt className="text-sm text-zinc-400">血量</dt>
            <dd className="mt-1 text-base font-medium text-zinc-300">
              超限不适用
            </dd>
          </div>
        ) : (
          Array.from({ length: phaseCount }, (_, index) => (
            <div
              key={index}
              className="min-h-20 rounded border border-zinc-600/80 bg-zinc-950/65 px-4 py-3 backdrop-blur-sm"
            >
              <dt className="text-sm text-zinc-400">
                {phaseCount === 2
                  ? `${index === 0 ? "第一" : "第二"}阶段${
                      boss.phaseNames?.[index]
                        ? ` · ${boss.phaseNames[index]}`
                        : ""
                    }血量`
                  : "血量"}
              </dt>
              <dd className="mt-1 break-words font-mono text-lg font-semibold tabular-nums text-[#e1c58f]">
                {formatBossHealthValue(health?.[index])}
              </dd>
            </div>
          ))
        )}
      </dl>
    </div>
  );
}
