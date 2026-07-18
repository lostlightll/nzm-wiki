"use client";

import Image from "next/image";
import { CalendarDays, Clock3, MapPinned, Search } from "lucide-react";
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
import { getOverlimitMapImagePath } from "@/lib/overlimit-map-images";
import { getAssetPath } from "@/lib/path";
import type {
  OverlimitBondName,
  OverlimitMapRotationMap,
  OverlimitMapRotationPeriod,
  OverlimitMapRotationSchedule,
} from "@/types";

interface OverlimitMapRotationProps {
  schedule: OverlimitMapRotationSchedule;
  onSearchBonds: (activeBonds: OverlimitBondName[]) => void;
}

const PERIOD_STATE_LABELS: Record<RotationPeriodState, string> = {
  past: "已结束",
  current: "当前",
  upcoming: "未开始",
};

const DETAILED_BOND_STYLES = {
  弹药: "border-orange-700/70 bg-orange-950 text-orange-200",
  技战: "border-teal-700/70 bg-teal-950 text-teal-200",
  异化: "border-purple-700/70 bg-purple-950 text-purple-200",
  游击: "border-blue-700/70 bg-blue-950 text-blue-200",
  壁垒: "border-zinc-600 bg-zinc-800 text-zinc-200",
  狙击: "border-lime-700/70 bg-lime-950 text-lime-200",
  爆韧: "border-amber-700/70 bg-amber-950 text-amber-200",
  共振: "border-sky-700/70 bg-sky-950 text-sky-200",
  狂战: "border-rose-700/70 bg-rose-950 text-rose-200",
} satisfies Record<OverlimitBondName, string>;

function MapBackdrop({
  mapName,
  variant,
  eager = false,
  sizes,
}: {
  mapName: string;
  variant: "current" | "schedule";
  eager?: boolean;
  sizes: string;
}) {
  const imagePath = getOverlimitMapImagePath(mapName);
  if (!imagePath) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div
        className={`absolute inset-0 md:right-auto ${
          variant === "current" ? "md:w-full" : "md:w-1/2"
        }`}
      >
        <Image
          src={getAssetPath(imagePath)}
          alt=""
          fill
          sizes={sizes}
          loading={eager ? "eager" : "lazy"}
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-zinc-950/20" />
        {variant === "schedule" && (
          <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-linear-to-r from-transparent to-zinc-900 md:block" />
        )}
      </div>
      {variant === "current" && (
        <div className="absolute inset-0 hidden bg-linear-to-r from-transparent via-zinc-900/55 to-zinc-900 md:block" />
      )}
      <div className="absolute inset-0 bg-linear-to-r from-transparent via-zinc-900/85 to-zinc-900 md:hidden" />
      <div className="absolute inset-0 bg-linear-to-b from-transparent via-zinc-950/10 to-zinc-950/70 md:hidden" />
    </div>
  );
}

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
                  ? DETAILED_BOND_STYLES[bond]
                  : "border-zinc-800 bg-zinc-950 text-zinc-500"
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

function BondSearchButton({
  map,
  onSearchBonds,
  variant = "current",
}: {
  map: OverlimitMapRotationMap;
  onSearchBonds: (activeBonds: OverlimitBondName[]) => void;
  variant?: "current" | "schedule";
}) {
  return (
    <button
      type="button"
      onClick={() => onSearchBonds(map.activeBonds)}
      aria-label={`检索${map.name}的上架羁绊`}
      title={`检索${map.name}的上架羁绊`}
      className={`z-20 flex h-7 min-w-16 shrink-0 cursor-pointer touch-manipulation items-center justify-center gap-1 rounded border border-zinc-600 bg-zinc-950/80 px-2 text-zinc-200 shadow-sm backdrop-blur-sm transition-colors before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] hover:border-zinc-400 hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 ${
        variant === "schedule"
          ? "absolute right-2 top-4 md:right-[calc(50%+0.5rem)]"
          : "absolute right-2 top-2"
      }`}
    >
      <Search aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span className="text-xs font-medium">检索</span>
    </button>
  );
}

function CurrentMapCard({
  map,
  detailed,
  onSearchBonds,
}: {
  map: OverlimitMapRotationMap;
  detailed: boolean;
  onSearchBonds: (activeBonds: OverlimitBondName[]) => void;
}) {
  return (
    <article className="relative isolate overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 p-4">
      <MapBackdrop
        mapName={map.name}
        variant="current"
        eager
        sizes="(max-width: 767px) 100vw, 50vw"
      />
      <BondSearchButton map={map} onSearchBonds={onSearchBonds} />
      <h3 className="relative z-10 mb-3 flex items-center gap-2 pr-20 text-lg font-semibold text-white drop-shadow-md">
        <MapPinned aria-hidden="true" className="h-5 w-5 text-zinc-400" />
        {map.name}
      </h3>
      <div className="relative z-10">
        <BondDisplay activeBonds={map.activeBonds} detailed={detailed} />
      </div>
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
  onSearchBonds,
}: {
  period: OverlimitMapRotationPeriod;
  state: RotationPeriodState;
  detailed: boolean;
  index: number;
  onSearchBonds: (activeBonds: OverlimitBondName[]) => void;
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
            className="relative isolate grid gap-3 overflow-hidden bg-zinc-900 px-4 py-4 md:grid-cols-[50%_minmax(0,1fr)] md:items-start"
          >
            <MapBackdrop
              mapName={map.name}
              variant="schedule"
              sizes="(max-width: 767px) 100vw, 50vw"
            />
            <BondSearchButton
              map={map}
              onSearchBonds={onSearchBonds}
              variant="schedule"
            />
            <h4 className="relative z-10 flex items-center gap-2 pr-20 font-semibold text-white drop-shadow-md">
              <MapPinned
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-zinc-500"
              />
              {map.name}
            </h4>
            <div className="relative z-10">
              <BondDisplay activeBonds={map.activeBonds} detailed={detailed} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function OverlimitMapRotation({
  schedule,
  onSearchBonds,
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
          <div className="grid gap-3 md:grid-cols-2">
            {timing.featuredPeriod.maps.map((map) => (
              <CurrentMapCard
                key={map.name}
                map={map}
                detailed={showDetails}
                onSearchBonds={onSearchBonds}
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
          <button
            type="button"
            role="switch"
            aria-checked={showDetails}
            onClick={() => setShowDetails((visible) => !visible)}
            className="group flex min-h-11 cursor-pointer touch-manipulation items-center gap-3 rounded-lg px-2.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-800/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            <span>显示详细轮换</span>
            <span
              aria-hidden="true"
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-200 motion-reduce:transition-none ${
                showDetails
                  ? "border-emerald-500 bg-emerald-600"
                  : "border-zinc-600 bg-zinc-800 group-hover:border-zinc-500"
              }`}
            >
              <span
                className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 motion-reduce:transition-none ${
                  showDetails ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </span>
          </button>
        </div>

        <div className="space-y-3">
          {schedule.periods.map((period, index) => (
            <SchedulePeriod
              key={period.startDate}
              period={period}
              state={getRotationPeriodState(period, schedule, today)}
              detailed={showDetails}
              index={index}
              onSearchBonds={onSearchBonds}
            />
          ))}
        </div>
      </section>
    </section>
  );
}
