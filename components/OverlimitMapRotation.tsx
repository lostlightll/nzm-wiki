"use client";

import { CalendarDays, Clock3, MapPinned } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import {
  OVERLIMIT_TAG_ICONS,
  OVERLIMIT_TAG_STYLES,
} from "@/components/OverlimitCardMeta";
import {
  formatRotationPeriod,
  getRotationPeriodState,
  getShanghaiDateKey,
  OVERLIMIT_BOND_NAMES,
  resolveRotationTiming,
  type RotationPeriodState,
} from "@/lib/overlimit-map-rotation";
import type {
  OverlimitBondName,
  OverlimitMapRotationMap,
  OverlimitMapRotationPeriod,
  OverlimitMapRotationSchedule,
} from "@/types";

interface OverlimitMapRotationProps {
  schedule: OverlimitMapRotationSchedule;
}

const PERIOD_STATE_LABELS: Record<RotationPeriodState, string> = {
  past: "已结束",
  current: "当前",
  upcoming: "未开始",
};

function subscribeToShanghaiDate(onStoreChange: () => void) {
  const interval = window.setInterval(onStoreChange, 60_000);
  return () => window.clearInterval(interval);
}

function getShanghaiDateSnapshot() {
  return getShanghaiDateKey();
}

function getServerDateSnapshot() {
  return "";
}

function BondDisplay({
  activeBonds,
  detailed,
}: {
  activeBonds: OverlimitBondName[];
  detailed: boolean;
}) {
  if (detailed) {
    const activeBondSet = new Set(activeBonds);

    return (
      <div className="grid grid-cols-3 gap-1.5 lg:grid-cols-9">
        {OVERLIMIT_BOND_NAMES.map((bond) => {
          const active = activeBondSet.has(bond);
          const Icon = OVERLIMIT_TAG_ICONS[bond];

          return (
            <div
              key={bond}
              className={`flex min-h-[68px] min-w-0 flex-col items-center justify-center gap-1 rounded border px-1.5 py-2 text-center ${
                active
                  ? OVERLIMIT_TAG_STYLES[bond]
                  : "border-zinc-800 bg-zinc-950/40 text-zinc-500"
              }`}
            >
              <span className="flex items-center gap-1 text-xs font-medium">
                <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                <span>{bond}</span>
              </span>
              <span
                className={`text-xs font-semibold ${
                  active ? "text-emerald-300" : "text-zinc-500"
                }`}
              >
                {active ? "上架" : "下架"}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {activeBonds.map((bond) => {
        const Icon = OVERLIMIT_TAG_ICONS[bond];

        return (
          <span
            key={bond}
            className={`inline-flex min-h-7 items-center gap-1 rounded border px-2 py-1 text-xs font-medium ${OVERLIMIT_TAG_STYLES[bond]}`}
          >
            <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            {bond}
          </span>
        );
      })}
    </div>
  );
}

function CurrentMapCard({
  map,
  detailed,
}: {
  map: OverlimitMapRotationMap;
  detailed: boolean;
}) {
  return (
    <article className="rounded-lg border border-zinc-700 bg-zinc-900/60 p-4">
      <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-white">
        <MapPinned aria-hidden="true" className="h-5 w-5 text-zinc-400" />
        {map.name}
      </h3>
      <BondDisplay activeBonds={map.activeBonds} detailed={detailed} />
    </article>
  );
}

function PeriodStatus({ state }: { state: RotationPeriodState }) {
  return (
    <span
      className={`inline-flex min-h-6 items-center rounded border px-2 py-0.5 text-xs font-medium ${
        state === "current"
          ? "border-emerald-700/60 bg-emerald-950/50 text-emerald-300"
          : state === "past"
            ? "border-zinc-700 bg-zinc-800 text-zinc-400"
            : "border-sky-800/70 bg-sky-950/40 text-sky-300"
      }`}
    >
      {PERIOD_STATE_LABELS[state]}
    </span>
  );
}

function SchedulePeriod({
  period,
  state,
  detailed,
  index,
}: {
  period: OverlimitMapRotationPeriod;
  state: RotationPeriodState;
  detailed: boolean;
  index: number;
}) {
  const titleId = `rotation-period-${index}`;

  return (
    <section
      aria-labelledby={titleId}
      className={`overflow-hidden rounded-lg border ${
        state === "current"
          ? "border-emerald-800/80 bg-emerald-950/10"
          : "border-zinc-800 bg-zinc-900/30"
      }`}
    >
      <header className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b border-zinc-800 px-4 py-2.5">
        <h3
          id={titleId}
          className="flex items-center gap-2 text-sm font-semibold text-zinc-200"
        >
          <CalendarDays aria-hidden="true" className="h-4 w-4 text-zinc-500" />
          <span className="tabular-nums">{formatRotationPeriod(period)}</span>
        </h3>
        <PeriodStatus state={state} />
      </header>

      <div className="divide-y divide-zinc-800">
        {period.maps.map((map) => (
          <article
            key={map.name}
            className="grid gap-3 px-4 py-4 md:grid-cols-[9rem_minmax(0,1fr)] md:items-start"
          >
            <h4 className="flex items-center gap-2 font-semibold text-zinc-200">
              <MapPinned
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-zinc-500"
              />
              {map.name}
            </h4>
            <BondDisplay activeBonds={map.activeBonds} detailed={detailed} />
          </article>
        ))}
      </div>
    </section>
  );
}

export function OverlimitMapRotation({
  schedule,
}: OverlimitMapRotationProps) {
  const [showDetails, setShowDetails] = useState(false);
  const today = useSyncExternalStore(
    subscribeToShanghaiDate,
    getShanghaiDateSnapshot,
    getServerDateSnapshot,
  );
  const timing = resolveRotationTiming(schedule, today);

  return (
    <section aria-labelledby="map-rotation-title">
      <h2 id="map-rotation-title" className="sr-only">
        地图轮换
      </h2>

      <section aria-labelledby="featured-rotation-title" className="mb-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-1 text-sm text-zinc-500">{schedule.season} 赛季</p>
            <h2
              id="featured-rotation-title"
              className="text-xl font-semibold text-zinc-100"
            >
              {timing.phase === "upcoming"
                ? "下一档期"
                : timing.phase === "ended"
                  ? `${schedule.season} 赛季已结束`
                  : "当前档期"}
            </h2>
          </div>
          {timing.featuredPeriod && (
            <p className="flex min-h-8 items-center gap-2 rounded border border-zinc-700 bg-zinc-900/60 px-3 py-1 text-sm text-zinc-300">
              <Clock3 aria-hidden="true" className="h-4 w-4 text-zinc-500" />
              <span className="tabular-nums">
                {formatRotationPeriod(timing.featuredPeriod)}
              </span>
            </p>
          )}
        </div>

        {timing.phase === "loading" ? (
          <div
            aria-busy="true"
            className="flex min-h-28 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/30 text-sm text-zinc-500"
          >
            正在识别当前档期
          </div>
        ) : timing.featuredPeriod ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {timing.featuredPeriod.maps.map((map) => (
              <CurrentMapCard
                key={map.name}
                map={map}
                detailed={showDetails}
              />
            ))}
          </div>
        ) : (
          <div className="flex min-h-28 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/30 text-sm text-zinc-500">
            本赛季排期已全部结束
          </div>
        )}
      </section>

      <section aria-labelledby="full-rotation-title">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2
            id="full-rotation-title"
            className="text-xl font-semibold text-zinc-100"
          >
            完整排期
          </h2>
          <label className="flex min-h-11 cursor-pointer touch-manipulation items-center gap-2 rounded px-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800/70 hover:text-white focus-within:ring-2 focus-within:ring-zinc-400">
            <input
              type="checkbox"
              checked={showDetails}
              onChange={(event) => setShowDetails(event.target.checked)}
              className="h-5 w-5 cursor-pointer accent-zinc-400"
            />
            <span>显示详细轮换</span>
          </label>
        </div>

        <div className="space-y-3">
          {schedule.periods.map((period, index) => (
            <SchedulePeriod
              key={period.startDate}
              period={period}
              state={getRotationPeriodState(period, schedule, today)}
              detailed={showDetails}
              index={index}
            />
          ))}
        </div>
      </section>
    </section>
  );
}
