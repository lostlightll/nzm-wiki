"use client";

import { BossDifficultyControl } from "@/components/BossDifficultyControl";
import { BossModeControl, BossRoomControl } from "@/components/BossModeControl";
import { useBossDifficulty } from "@/components/BossDifficultyProvider";
import {
  formatBossHealthSummary,
  formatBossHealthValue,
  getBossHealth,
  getBossPhaseCount,
} from "@/lib/boss-health";
import type { Boss } from "@/types";
import { getOriginBossDisplayHealth, getOriginBossRoomIndices, type OriginDifficulty } from "@/lib/origin-boss-health";

export function BossCardHealth({ boss }: { boss: Boss }) {
  const { difficulty, ready, mode, roomIndex } = useBossDifficulty();
  const originHealth = mode === "origin" ? getOriginBossDisplayHealth(boss.slug, difficulty as OriginDifficulty, roomIndex) : undefined;
  const compact = (originHealth?.length ?? getBossPhaseCount(boss)) > 1;

  return (
    <span
      aria-busy={!ready}
      className={`block max-w-full break-words text-left leading-5 tabular-nums ${
        compact ? "text-xs" : "text-sm"
      } ${
        ready
          ? "font-mono text-[#e1c58f]"
          : "h-5 w-20 animate-pulse rounded bg-zinc-700"
      }`}
    >
      {ready ? mode === "origin"
        ? originHealth?.map(formatBossHealthValue).join(" / ") ?? "原点未收录"
        : formatBossHealthSummary(boss, mode === "overlimit" ? "overlimit" : difficulty) : null}
    </span>
  );
}

export function BossDetailHealth({ boss }: { boss: Boss }) {
  const { difficulty, ready, mode, roomIndex } = useBossDifficulty();
  const health = mode === "origin"
    ? getOriginBossDisplayHealth(boss.slug, difficulty as OriginDifficulty, roomIndex)
    : getBossHealth(boss, mode === "overlimit" ? "overlimit" : difficulty);
  const phaseCount = mode === "origin" && Array.isArray(health) ? health.length : getBossPhaseCount(boss);
  const hasOriginRoom = mode === "origin" && (roomIndex !== null || getOriginBossRoomIndices(boss.slug, difficulty as OriginDifficulty) !== null);

  return (
    <div className="mt-6 max-w-lg">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
        <BossModeControl />
        {mode !== "overlimit" && <BossDifficultyControl bossOnly />}
      </div>
      {mode === "origin" && <div className="mt-4 border-t border-zinc-700/80 pt-4">
        <BossRoomControl />
      </div>}
      <dl
        aria-busy={!ready}
        className={`mt-3 grid min-h-20 grid-cols-1 gap-3 ${
          phaseCount === 2 ? "sm:grid-cols-2" : ""
        }`}
      >
        {!ready ? (
          <div className="min-h-20 animate-pulse rounded border border-zinc-600/80 bg-zinc-950/65 px-4 py-3" />
        ) : mode === "origin" && !health ? (
          <div className="min-h-20 rounded border border-zinc-600/80 bg-zinc-950/65 px-4 py-3 text-zinc-300">该难度原点猎场未收录此首领</div>
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
                    }${mode === "origin" && !hasOriginRoom ? "配置基础血量" : "血量"}`
                  : mode === "origin" && !hasOriginRoom ? "配置基础血量" : "血量"}
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
