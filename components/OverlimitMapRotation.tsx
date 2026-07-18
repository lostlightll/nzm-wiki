"use client";

import Image from "next/image";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock3,
  Filter,
  Lightbulb,
  MapPinned,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import {
  useMemo,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  OVERLIMIT_TAG_ICONS,
  OVERLIMIT_TAG_STYLES,
} from "@/components/OverlimitCardMeta";
import {
  formatRotationCountdown,
  formatRotationPeriod,
  getRotationPeriodEndTimestamp,
  getRotationPeriodStartTimestamp,
  getRotationPeriodState,
  getRotationWindowStart,
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

type RotationViewMode = "compact" | "detailed";

const DEFAULT_PERIOD_COUNT = 6;
const DESKTOP_FILTER_QUERY = "(min-width: 1024px)";

const PERIOD_STATE_LABELS: Record<RotationPeriodState, string> = {
  past: "已结束",
  current: "当前",
  upcoming: "即将开始",
};

function subscribeToCurrentMinute(onStoreChange: () => void) {
  const interval = window.setInterval(onStoreChange, 60_000);
  return () => window.clearInterval(interval);
}

function getCurrentMinuteSnapshot() {
  return Math.floor(Date.now() / 60_000);
}

function getServerMinuteSnapshot() {
  return 0;
}

function subscribeToDesktopFilter(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia(DESKTOP_FILTER_QUERY);
  mediaQuery.addEventListener("change", onStoreChange);
  return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function getDesktopFilterSnapshot() {
  return window.matchMedia(DESKTOP_FILTER_QUERY).matches;
}

function getServerDesktopFilterSnapshot() {
  return false;
}

function formatDateKey(dateKey: string): string {
  const [, month, day] = dateKey.split("-").map(Number);
  return `${month}月${day}日`;
}

function toggleSetValue<T>(
  setter: Dispatch<SetStateAction<Set<T>>>,
  value: T,
) {
  setter((current) => {
    const next = new Set(current);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  });
}

function CurrentMapBackdrop({ mapName }: { mapName: string }) {
  const imagePath = getOverlimitMapImagePath(mapName);
  if (!imagePath) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <Image
        src={getAssetPath(imagePath)}
        alt=""
        fill
        sizes="(max-width: 767px) 100vw, 50vw"
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-zinc-950/25" />
      <div className="absolute inset-0 bg-linear-to-r from-zinc-950/20 via-zinc-950/55 to-zinc-950/95" />
      <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-zinc-950/75" />
    </div>
  );
}

function MapThumbnail({ mapName }: { mapName: string }) {
  const imagePath = getOverlimitMapImagePath(mapName);

  return (
    <div className="relative min-h-20 overflow-hidden bg-zinc-950 sm:min-h-24">
      {imagePath ? (
        <Image
          src={getAssetPath(imagePath)}
          alt=""
          fill
          sizes="84px"
          className="object-cover object-center"
        />
      ) : (
        <MapPinned
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-zinc-600"
        />
      )}
      <div className="absolute inset-0 bg-linear-to-r from-transparent to-zinc-950/45" />
    </div>
  );
}

function BondDisplay({
  activeBonds,
  mode,
}: {
  activeBonds: OverlimitBondName[];
  mode: RotationViewMode;
}) {
  const activeBondSet = new Set(activeBonds);
  const bonds = mode === "compact" ? activeBonds : OVERLIMIT_BOND_NAMES;

  return (
    <div className="flex min-w-0 flex-wrap gap-1.5">
      {bonds.map((bond) => {
        const active = activeBondSet.has(bond);
        const Icon = OVERLIMIT_TAG_ICONS[bond];

        return (
          <span
            key={bond}
            className={`inline-flex min-h-6 items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium ${
              active
                ? OVERLIMIT_TAG_STYLES[bond]
                : "border-zinc-800 bg-zinc-950/80 text-zinc-500"
            }`}
          >
            <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            <span>{bond}</span>
            {mode === "detailed" && (
              <span className="text-[10px] opacity-75">
                {active ? "上架" : "下架"}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

function BondSearchButton({
  map,
  onSearchBonds,
  className = "",
}: {
  map: OverlimitMapRotationMap;
  onSearchBonds: (activeBonds: OverlimitBondName[]) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onSearchBonds(map.activeBonds)}
      aria-label={`检索${map.name}的上架词条`}
      title={`检索${map.name}的上架词条`}
      className={`flex h-9 w-9 shrink-0 cursor-pointer touch-manipulation items-center justify-center rounded border border-zinc-700 bg-zinc-950/75 text-zinc-400 backdrop-blur-sm transition-colors hover:border-zinc-500 hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${className}`}
    >
      <Search aria-hidden="true" className="h-4 w-4" />
    </button>
  );
}

function CurrentMapCard({
  map,
  mode,
  onSearchBonds,
  className = "",
}: {
  map: OverlimitMapRotationMap;
  mode: RotationViewMode;
  onSearchBonds: (activeBonds: OverlimitBondName[]) => void;
  className?: string;
}) {
  return (
    <article
      className={`relative isolate min-h-28 overflow-hidden rounded border border-zinc-700/80 bg-zinc-900 px-4 py-4 ${className}`}
    >
      <CurrentMapBackdrop mapName={map.name} />
      <BondSearchButton
        map={map}
        onSearchBonds={onSearchBonds}
        className="absolute right-2 top-2 z-20"
      />
      <h3 className="relative z-10 mb-3 pr-10 text-lg font-semibold text-white drop-shadow-md">
        {map.name}
      </h3>
      <div className="relative z-10">
        <BondDisplay activeBonds={map.activeBonds} mode={mode} />
      </div>
    </article>
  );
}

function PeriodStatus({ state }: { state: RotationPeriodState }) {
  const Icon =
    state === "past" ? CheckCircle2 : state === "current" ? Check : Circle;

  return (
    <span
      className={`inline-flex min-h-6 items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium ${
        state === "current"
          ? "border-blue-500/60 bg-blue-500/10 text-blue-300"
          : state === "past"
            ? "border-zinc-700 bg-zinc-800/80 text-zinc-400"
            : "border-zinc-700 bg-zinc-950/40 text-zinc-400"
      }`}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      {PERIOD_STATE_LABELS[state]}
    </span>
  );
}

function ScheduleMapCard({
  map,
  mode,
  onSearchBonds,
}: {
  map: OverlimitMapRotationMap;
  mode: RotationViewMode;
  onSearchBonds: (activeBonds: OverlimitBondName[]) => void;
}) {
  return (
    <article className="grid min-w-0 grid-cols-[76px_minmax(0,1fr)] overflow-hidden rounded border border-zinc-800 bg-zinc-900/90 sm:grid-cols-[84px_minmax(0,1fr)]">
      <MapThumbnail mapName={map.name} />
      <div className="min-w-0 px-3 py-2.5">
        <div className="mb-2 flex min-w-0 items-start justify-between gap-2">
          <h4 className="min-w-0 truncate pt-1.5 text-sm font-semibold text-zinc-100">
            {map.name}
          </h4>
          <BondSearchButton map={map} onSearchBonds={onSearchBonds} />
        </div>
        <BondDisplay activeBonds={map.activeBonds} mode={mode} />
      </div>
    </article>
  );
}

function SchedulePeriod({
  period,
  maps,
  state,
  mode,
  index,
  onSearchBonds,
}: {
  period: OverlimitMapRotationPeriod;
  maps: OverlimitMapRotationMap[];
  state: RotationPeriodState;
  mode: RotationViewMode;
  index: number;
  onSearchBonds: (activeBonds: OverlimitBondName[]) => void;
}) {
  const titleId = `rotation-period-${index}`;

  return (
    <section
      aria-labelledby={titleId}
      className={`grid overflow-hidden rounded border md:grid-cols-[180px_minmax(0,1fr)] ${
        state === "current"
          ? "border-blue-500/55 bg-blue-500/5"
          : "border-zinc-800 bg-zinc-900/20"
      }`}
    >
      <header className="relative flex min-h-16 items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-900/65 px-4 py-3 md:block md:border-b-0 md:border-r md:pl-12">
        <div
          aria-hidden="true"
          className="absolute bottom-0 left-6 top-0 hidden w-px bg-zinc-700 md:block"
        />
        <span
          aria-hidden="true"
          className={`absolute left-[18px] top-1/2 hidden h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 md:block ${
            state === "current"
              ? "border-blue-400 bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.65)]"
              : state === "past"
                ? "border-zinc-500 bg-zinc-700"
                : "border-zinc-600 bg-zinc-950"
          }`}
        />
        <h3
          id={titleId}
          className={`text-sm font-semibold tabular-nums md:mb-2 ${
            state === "current" ? "text-blue-300" : "text-zinc-300"
          }`}
        >
          {formatRotationPeriod(period)}
        </h3>
        <PeriodStatus state={state} />
      </header>

      <div className="grid min-w-0 gap-2 bg-zinc-950/25 p-2 sm:grid-cols-2">
        {maps.map((map) => (
          <ScheduleMapCard
            key={map.name}
            map={map}
            mode={mode}
            onSearchBonds={onSearchBonds}
          />
        ))}
      </div>
    </section>
  );
}

function ModeControl({
  mode,
  onChange,
}: {
  mode: RotationViewMode;
  onChange: (mode: RotationViewMode) => void;
}) {
  return (
    <div
      role="group"
      aria-label="地图轮换显示模式"
      className="inline-flex rounded border border-zinc-700 bg-zinc-950/60 p-1"
    >
      {([
        ["compact", "简略模式"],
        ["detailed", "详细模式"],
      ] as const).map(([value, label]) => {
        const active = mode === value;

        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(value)}
            className={`min-h-9 cursor-pointer touch-manipulation rounded px-3 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 motion-reduce:transition-none ${
              active
                ? "bg-blue-600 text-white"
                : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function FilterPanel({
  mapOptions,
  selectedMaps,
  selectedBonds,
  onToggleMap,
  onToggleBond,
  onToggleAllMaps,
  onToggleAllBonds,
  onReset,
}: {
  mapOptions: string[];
  selectedMaps: Set<string>;
  selectedBonds: Set<OverlimitBondName>;
  onToggleMap: (mapName: string) => void;
  onToggleBond: (bond: OverlimitBondName) => void;
  onToggleAllMaps: () => void;
  onToggleAllBonds: () => void;
  onReset: () => void;
}) {
  const allMapsSelected = selectedMaps.size === mapOptions.length;
  const allBondsSelected = selectedBonds.size === OVERLIMIT_BOND_NAMES.length;
  const isDefault = allMapsSelected && allBondsSelected;

  return (
    <aside className="hidden self-start rounded border border-zinc-800 bg-zinc-900/35 p-4 lg:sticky lg:top-20 lg:block">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base font-semibold text-zinc-100">
          <Filter aria-hidden="true" className="h-4 w-4 text-zinc-500" />
          筛选
        </h3>
        <button
          type="button"
          disabled={isDefault}
          onClick={onReset}
          className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded px-2 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white disabled:cursor-default disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
          重置
        </button>
      </div>

      <fieldset className="mb-5">
        <legend className="mb-2 text-xs font-semibold text-zinc-400">
          地图筛选
        </legend>
        <label className="flex min-h-8 cursor-pointer items-center gap-2 text-sm text-blue-300">
          <input
            type="checkbox"
            checked={allMapsSelected}
            onChange={onToggleAllMaps}
            className="h-4 w-4 accent-blue-500"
          />
          全选
        </label>
        {mapOptions.map((mapName) => (
          <label
            key={mapName}
            className="flex min-h-8 cursor-pointer items-center gap-2 text-sm text-zinc-300"
          >
            <input
              type="checkbox"
              checked={selectedMaps.has(mapName)}
              onChange={() => onToggleMap(mapName)}
              className="h-4 w-4 accent-blue-500"
            />
            {mapName}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-xs font-semibold text-zinc-400">
          词条筛选
        </legend>
        <label className="flex min-h-8 cursor-pointer items-center gap-2 text-sm text-blue-300">
          <input
            type="checkbox"
            checked={allBondsSelected}
            onChange={onToggleAllBonds}
            className="h-4 w-4 accent-blue-500"
          />
          全选
        </label>
        {OVERLIMIT_BOND_NAMES.map((bond) => {
          const Icon = OVERLIMIT_TAG_ICONS[bond];

          return (
            <label
              key={bond}
              className="flex min-h-8 cursor-pointer items-center gap-2 text-sm text-zinc-300"
            >
              <input
                type="checkbox"
                checked={selectedBonds.has(bond)}
                onChange={() => onToggleBond(bond)}
                className="h-4 w-4 accent-blue-500"
              />
              <Icon aria-hidden="true" className="h-3.5 w-3.5 text-zinc-500" />
              {bond}
            </label>
          );
        })}
      </fieldset>

      <div className="mt-5 rounded border border-zinc-800 bg-zinc-950/55 p-3">
        <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-amber-300">
          <Lightbulb aria-hidden="true" className="h-3.5 w-3.5" />
          提示
        </p>
        <p className="text-xs leading-5 text-zinc-500">
          可按地图和词条快速查找对应的轮换周期。
        </p>
      </div>
    </aside>
  );
}

function BondLegend() {
  return (
    <section
      aria-labelledby="rotation-bond-legend-title"
      className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded border border-zinc-800 bg-zinc-900/30 px-4 py-3"
    >
      <h3
        id="rotation-bond-legend-title"
        className="mr-1 text-sm font-semibold text-zinc-300"
      >
        词条说明
      </h3>
      {OVERLIMIT_BOND_NAMES.map((bond) => {
        const Icon = OVERLIMIT_TAG_ICONS[bond];

        return (
          <span
            key={bond}
            className={`inline-flex min-h-6 items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium ${OVERLIMIT_TAG_STYLES[bond]}`}
          >
            <Icon aria-hidden="true" className="h-3.5 w-3.5" />
            {bond}
          </span>
        );
      })}
    </section>
  );
}

export function OverlimitMapRotation({
  schedule,
  onSearchBonds,
}: OverlimitMapRotationProps) {
  const mapOptions = useMemo(
    () => [
      ...new Set(
        schedule.periods.flatMap((period) =>
          period.maps.map((map) => map.name),
        ),
      ),
    ],
    [schedule.periods],
  );
  const [mode, setMode] = useState<RotationViewMode>("compact");
  const [expanded, setExpanded] = useState(false);
  const [selectedMaps, setSelectedMaps] = useState<Set<string>>(
    () => new Set(mapOptions),
  );
  const [selectedBonds, setSelectedBonds] = useState<
    Set<OverlimitBondName>
  >(() => new Set(OVERLIMIT_BOND_NAMES));
  const currentMinute = useSyncExternalStore(
    subscribeToCurrentMinute,
    getCurrentMinuteSnapshot,
    getServerMinuteSnapshot,
  );
  const isDesktopFilter = useSyncExternalStore(
    subscribeToDesktopFilter,
    getDesktopFilterSnapshot,
    getServerDesktopFilterSnapshot,
  );
  const nowTimestamp = currentMinute * 60_000;
  const today = currentMinute
    ? getShanghaiDateKey(new Date(nowTimestamp))
    : "";
  const timing = resolveRotationTiming(schedule, today);
  const featuredIndex = timing.featuredPeriod
    ? schedule.periods.indexOf(timing.featuredPeriod)
    : -1;
  const windowStart = getRotationWindowStart(
    schedule.periods.length,
    featuredIndex,
    DEFAULT_PERIOD_COUNT,
  );
  const allMapsSelected = selectedMaps.size === mapOptions.length;
  const allBondsSelected = selectedBonds.size === OVERLIMIT_BOND_NAMES.length;
  const hasActiveFilters =
    isDesktopFilter && (!allMapsSelected || !allBondsSelected);

  const filteredPeriods = useMemo(() => {
    return schedule.periods
      .map((period, index) => {
        const maps = hasActiveFilters
          ? period.maps.filter(
              (map) =>
                selectedMaps.has(map.name) &&
                map.activeBonds.some((bond) => selectedBonds.has(bond)),
            )
          : period.maps;

        return { period, maps, index };
      })
      .filter(({ maps }) => maps.length > 0);
  }, [hasActiveFilters, schedule.periods, selectedBonds, selectedMaps]);

  const visiblePeriods =
    expanded || hasActiveFilters
      ? filteredPeriods
      : filteredPeriods.filter(
          ({ index }) =>
            index >= windowStart &&
            index < windowStart + DEFAULT_PERIOD_COUNT,
        );

  const featuredPeriod = timing.featuredPeriod;
  const countdownTarget = featuredPeriod
    ? timing.phase === "current"
      ? getRotationPeriodEndTimestamp(featuredPeriod)
      : timing.phase === "upcoming"
        ? getRotationPeriodStartTimestamp(featuredPeriod)
        : null
    : null;
  const countdown =
    countdownTarget && currentMinute
      ? formatRotationCountdown(countdownTarget, nowTimestamp)
      : null;

  const resetFilters = () => {
    setSelectedMaps(new Set(mapOptions));
    setSelectedBonds(new Set(OVERLIMIT_BOND_NAMES));
  };

  return (
    <section aria-labelledby="map-rotation-title">
      <h2 id="map-rotation-title" className="sr-only">
        地图轮换
      </h2>

      <section
        aria-labelledby="featured-rotation-title"
        className="mb-6 rounded border border-zinc-700/80 bg-zinc-900/25 p-4 sm:p-5"
      >
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mb-1 text-sm text-zinc-500">{schedule.season} 赛季</p>
            <h2
              id="featured-rotation-title"
              className="text-xl font-semibold text-zinc-100"
            >
              {timing.phase === "ended" ? "赛季已结束" : "当前赛季"}
            </h2>
            {featuredPeriod && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-lg font-semibold tabular-nums text-zinc-100 sm:text-2xl">
                  {formatRotationPeriod(featuredPeriod)}
                </span>
                <span className="rounded border border-blue-500/35 bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-300">
                  {timing.phase === "upcoming" ? "下一轮换" : "当前轮换"}
                </span>
              </div>
            )}
          </div>

          {featuredPeriod && (
            <div className="sm:text-right">
              {countdown && (
                <>
                  <p className="text-xs text-zinc-500">
                    {timing.phase === "upcoming" ? "距离开始" : "距离结束"}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xl font-semibold tabular-nums text-blue-400 sm:justify-end">
                    {countdown}
                    <Clock3 aria-hidden="true" className="h-4 w-4" />
                  </p>
                </>
              )}
              <p className="mt-1 text-xs tabular-nums text-zinc-500">
                {timing.phase === "upcoming"
                  ? `${formatDateKey(featuredPeriod.startDate)} 00:00 开始`
                  : featuredPeriod.endDate
                    ? `${formatDateKey(featuredPeriod.endDate)} 23:59 结束`
                    : (featuredPeriod.endLabel ?? "至赛季结束")}
              </p>
            </div>
          )}
        </div>

        {timing.phase === "loading" ? (
          <div
            aria-busy="true"
            className="flex min-h-28 items-center justify-center rounded border border-zinc-800 bg-zinc-950/30 text-sm text-zinc-500"
          >
            正在识别当前档期
          </div>
        ) : featuredPeriod ? (
          <div className="grid gap-3 md:grid-cols-2">
            {featuredPeriod.maps.map((map, index) => (
              <CurrentMapCard
                key={map.name}
                map={map}
                mode={mode}
                onSearchBonds={onSearchBonds}
                className={
                  featuredPeriod.maps.length === 3 && index === 2
                    ? "md:col-span-2"
                    : ""
                }
              />
            ))}
          </div>
        ) : (
          <div className="flex min-h-28 items-center justify-center rounded border border-zinc-800 bg-zinc-950/30 text-sm text-zinc-500">
            本赛季排期已全部结束
          </div>
        )}
      </section>

      <section aria-labelledby="full-rotation-title">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2
            id="full-rotation-title"
            className="flex items-center gap-2 text-xl font-semibold text-zinc-100"
          >
            <CalendarDays aria-hidden="true" className="h-5 w-5 text-blue-400" />
            完整排期
          </h2>
          <ModeControl mode={mode} onChange={setMode} />
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="min-w-0">
            {hasActiveFilters && (
              <p aria-live="polite" className="mb-2 text-xs text-zinc-500">
                找到 {filteredPeriods.length} 个符合条件的轮换档期
              </p>
            )}

            {visiblePeriods.length > 0 ? (
              <div className="space-y-2">
                {visiblePeriods.map(({ period, maps, index }) => (
                  <SchedulePeriod
                    key={period.startDate}
                    period={period}
                    maps={maps}
                    state={getRotationPeriodState(period, schedule, today)}
                    mode={mode}
                    index={index}
                    onSearchBonds={onSearchBonds}
                  />
                ))}
              </div>
            ) : (
              <div className="flex min-h-40 flex-col items-center justify-center rounded border border-zinc-800 bg-zinc-900/25 px-4 text-center">
                <SlidersHorizontal
                  aria-hidden="true"
                  className="mb-3 h-6 w-6 text-zinc-600"
                />
                <p className="text-sm text-zinc-400">
                  没有符合当前筛选的轮换档期
                </p>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-3 min-h-9 cursor-pointer rounded px-3 text-sm text-blue-400 transition-colors hover:bg-zinc-800 hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  重置筛选
                </button>
              </div>
            )}

            {!hasActiveFilters &&
              schedule.periods.length > DEFAULT_PERIOD_COUNT && (
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setExpanded((current) => !current)}
                  className="mt-3 flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded text-sm text-blue-400 transition-colors hover:bg-zinc-900/60 hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  {expanded ? "收起排期" : "展开更多"}
                  {expanded ? (
                    <ChevronUp aria-hidden="true" className="h-4 w-4" />
                  ) : (
                    <ChevronDown aria-hidden="true" className="h-4 w-4" />
                  )}
                </button>
              )}
          </div>

          <FilterPanel
            mapOptions={mapOptions}
            selectedMaps={selectedMaps}
            selectedBonds={selectedBonds}
            onToggleMap={(mapName) =>
              toggleSetValue(setSelectedMaps, mapName)
            }
            onToggleBond={(bond) =>
              toggleSetValue(setSelectedBonds, bond)
            }
            onToggleAllMaps={() =>
              setSelectedMaps(
                allMapsSelected ? new Set() : new Set(mapOptions),
              )
            }
            onToggleAllBonds={() =>
              setSelectedBonds(
                allBondsSelected
                  ? new Set()
                  : new Set(OVERLIMIT_BOND_NAMES),
              )
            }
            onReset={resetFilters}
          />
        </div>

        <BondLegend />
      </section>
    </section>
  );
}
