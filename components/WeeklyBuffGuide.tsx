"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarClock,
  ChevronRight,
  Crosshair,
  Layers3,
  MapPinned,
  Sparkles,
  TimerReset,
} from "lucide-react";
import { useSyncExternalStore } from "react";
import { getMultiplierFactorStyle } from "@/components/multiplier-badge-styles";
import { getAssetPath } from "@/lib/path";
import {
  MULTIPLIER_FACTORS,
  resolveMultiplierFactorHref,
} from "@/lib/multiplier-data";
import {
  getWeeklyBuffRotationWindow,
  getWeeklyBuffsForRotation,
  WEEKLY_BUFF_DAMAGE_INDEX,
  WEEKLY_BUFF_POOLS,
  type WeeklyBuff,
  type WeeklyBuffIndexKind,
  type WeeklyBuffPool,
  type WeeklyBuffRotationWindow,
} from "@/lib/weekly-buffs";

type PoolId = WeeklyBuffPool["id"];
type IndexFilter = "all" | Exclude<WeeklyBuffIndexKind, "utility">;

const INDEX_FILTERS: readonly { id: IndexFilter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "direct", label: "乘区增伤" },
  { id: "critical", label: "暴击收益" },
  { id: "extra", label: "额外伤害" },
];

const INDEX_KIND_STYLES: Record<"critical" | "extra", string> = {
  critical: "border-orange-400/40 bg-orange-400/10 text-orange-200",
  extra: "border-cyan-400/40 bg-cyan-400/10 text-cyan-200",
};

const FACTOR_LABELS = new Map(
  MULTIPLIER_FACTORS.map((factor) => [factor.id, factor.label]),
);

const DATE_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function readQueryState(windowInfo: WeeklyBuffRotationWindow) {
  const params = new URLSearchParams(window.location.search);
  const pool = params.get("pool");
  const rotation = Number(params.get("rotation"));
  const filter = params.get("filter");

  return {
    poolId: pool === "b" ? "b" : ("a" as PoolId),
    rotationIndex: [1, 2, 3].includes(rotation)
      ? rotation
      : windowInfo.rotationIndex,
    indexFilter: INDEX_FILTERS.some((item) => item.id === filter)
      ? (filter as IndexFilter)
      : ("all" as IndexFilter),
  };
}

function updateQuery(
  state: { poolId?: PoolId; rotationIndex?: number; indexFilter?: IndexFilter },
  hash?: string,
) {
  const url = new URL(window.location.href);
  if (state.poolId) url.searchParams.set("pool", state.poolId);
  if (state.rotationIndex) url.searchParams.set("rotation", String(state.rotationIndex));
  if (state.indexFilter) {
    if (state.indexFilter === "all") url.searchParams.delete("filter");
    else url.searchParams.set("filter", state.indexFilter);
  }
  if (hash) url.hash = hash;
  window.history.replaceState(null, "", url);
  window.dispatchEvent(new Event("nzm-wiki:weekly-buff-query-change"));
}

function subscribeToWeeklyBuffState(onStoreChange: () => void) {
  const rotationWindow = getWeeklyBuffRotationWindow();
  const timeout = window.setTimeout(
    onStoreChange,
    Math.max(0, rotationWindow.endsAt.getTime() - Date.now() + 1000),
  );
  window.addEventListener("popstate", onStoreChange);
  window.addEventListener("nzm-wiki:weekly-buff-query-change", onStoreChange);

  return () => {
    window.clearTimeout(timeout);
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener("nzm-wiki:weekly-buff-query-change", onStoreChange);
  };
}

function getWeeklyBuffStateSnapshot() {
  return `${window.location.href}|${getWeeklyBuffRotationWindow().rotationIndex}`;
}

function getServerWeeklyBuffStateSnapshot() {
  return "";
}

function formatRotationRange(windowInfo: WeeklyBuffRotationWindow) {
  return `${DATE_FORMATTER.format(windowInfo.startsAt)} - ${DATE_FORMATTER.format(windowInfo.endsAt)}`;
}

function getMultiplierHref(buff: WeeklyBuff) {
  if (buff.indexKind === "extra") {
    return "/guides?part=damage-sources#multiplier";
  }
  if (!buff.factorId) return undefined;
  return resolveMultiplierFactorHref(buff.factorId, { view: "providers" });
}

function IndexBadge({ buff }: { buff: WeeklyBuff }) {
  if (buff.indexKind === "utility") return null;
  const label = buff.factorId
    ? FACTOR_LABELS.get(buff.factorId)
    : buff.indexLabel;
  if (!label) return null;
  const href = getMultiplierHref(buff);
  const specialStyle =
    buff.indexKind === "critical" || buff.indexKind === "extra"
      ? INDEX_KIND_STYLES[buff.indexKind]
      : "";
  const className = `inline-flex min-h-7 items-center gap-1 rounded border px-2 py-1 text-xs font-semibold ${
    buff.factorId
      ? getMultiplierFactorStyle(buff.factorId)
      : specialStyle
  }`;

  if (!href) return <span className={className}>{label}</span>;
  return (
    <Link
      href={href}
      prefetch={false}
      className={`${className} touch-manipulation transition-[filter] hover:brightness-125 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4`}
    >
      {label}
      <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
    </Link>
  );
}

function BuffCard({ buff, position }: { buff: WeeklyBuff; position: number }) {
  return (
    <article
      id={`buff-${buff.id}`}
      className="scroll-mt-20 rounded-lg border border-zinc-700 bg-zinc-900/75 p-4 transition-colors target:border-amber-400/70 sm:p-5"
    >
      <div className="flex items-start gap-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-zinc-600 bg-zinc-950 sm:h-20 sm:w-20">
          <Image
            src={getAssetPath(buff.icon)}
            alt=""
            fill
            sizes="80px"
            className="object-cover"
          />
          <span className="absolute right-0 bottom-0 flex h-5 min-w-5 items-center justify-center rounded-tl bg-black/75 px-1 font-mono text-[10px] tabular-nums text-zinc-300">
            {position}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-zinc-100 sm:text-lg">{buff.name}</h3>
              <p className="mt-0.5 font-mono text-[11px] tabular-nums text-zinc-500">
                ID {buff.id}
              </p>
            </div>
            <IndexBadge buff={buff} />
          </div>
          <p className="mt-3 text-sm leading-6 text-zinc-300">{buff.description}</p>
        </div>
      </div>
    </article>
  );
}

function RotationButton({
  index,
  selected,
  current,
  onClick,
}: {
  index: number;
  selected: boolean;
  current: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`min-h-11 touch-manipulation rounded-md border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 ${
        selected
          ? "border-amber-400/70 bg-amber-400/12 text-amber-100"
          : "border-transparent text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
      }`}
    >
      <span className="block text-sm font-semibold">第 {index} 周</span>
      <span className="block min-h-4 text-[10px] leading-4 text-amber-300">
        {current ? "本周" : ""}
      </span>
    </button>
  );
}

export function WeeklyBuffGuide() {
  const stateSnapshot = useSyncExternalStore(
    subscribeToWeeklyBuffState,
    getWeeklyBuffStateSnapshot,
    getServerWeeklyBuffStateSnapshot,
  );
  const rotationWindow = stateSnapshot ? getWeeklyBuffRotationWindow() : null;
  const queryState = rotationWindow
    ? readQueryState(rotationWindow)
    : {
        poolId: "a" as PoolId,
        rotationIndex: 1,
        indexFilter: "all" as IndexFilter,
      };
  const { poolId, rotationIndex, indexFilter } = queryState;

  const selectedPool =
    WEEKLY_BUFF_POOLS.find((pool) => pool.id === poolId) ?? WEEKLY_BUFF_POOLS[0];
  const selectedBuffs = getWeeklyBuffsForRotation(selectedPool, rotationIndex);
  const nextBuffs = rotationWindow
    ? getWeeklyBuffsForRotation(selectedPool, rotationWindow.nextRotationIndex)
    : [];
  const indexedBuffs = WEEKLY_BUFF_DAMAGE_INDEX.filter(
    (buff) => indexFilter === "all" || buff.indexKind === indexFilter,
  );

  const selectPool = (nextPoolId: PoolId) => {
    updateQuery({ poolId: nextPoolId });
  };

  const selectRotation = (nextRotation: number) => {
    updateQuery({ rotationIndex: nextRotation }, "rotation");
  };

  const selectFilter = (filter: IndexFilter) => {
    updateQuery({ indexFilter: filter }, "damage-index");
  };

  const revealBuff = (buff: WeeklyBuff) => {
    const placement = WEEKLY_BUFF_POOLS.flatMap((pool) =>
      pool.rotations.map((ids, index) => ({ pool, index: index + 1, ids })),
    ).find((item) => item.ids.includes(buff.id));
    if (!placement) return;
    updateQuery(
      { poolId: placement.pool.id, rotationIndex: placement.index },
      `buff-${buff.id}`,
    );
    window.setTimeout(() => {
      document.getElementById(`buff-${buff.id}`)?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
    }, 0);
  };

  return (
    <div className="not-prose mx-auto max-w-6xl pb-12 [--weekly-accent:#e4b457]">
      <header className="border-b border-zinc-700 pb-7">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-300">
              <CalendarClock aria-hidden="true" className="h-4 w-4" />
              僵尸猎场机制专题
            </p>
            <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-300">
              两套地图池独立取值，但共享同一轮换周次。每 7 天切换一组，每局同时生效 3 个 Buff。
            </p>
          </div>
          <div className="grid grid-cols-3 border-y border-zinc-700 text-center lg:min-w-[21rem]">
            {[
              ["7 天", "轮换周期"],
              ["3 个", "局内生效"],
              ["2 套", "地图池"],
            ].map(([value, label]) => (
              <div key={label} className="border-r border-zinc-700 px-3 py-3 last:border-r-0">
                <strong className="block font-mono text-lg tabular-nums text-amber-200">
                  {value}
                </strong>
                <span className="mt-1 block text-xs text-zinc-500">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </header>

      <section className="grid border-b border-zinc-700 lg:grid-cols-[minmax(0,1.2fr)_minmax(19rem,0.8fr)]">
        <div className="py-5 lg:border-r lg:border-zinc-700 lg:pr-8">
          <div className="flex items-start gap-3">
            <TimerReset aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">当前轮换</h2>
              <p className="mt-1 text-sm leading-6 text-zinc-400">
                {rotationWindow
                  ? `第 ${rotationWindow.rotationIndex} 周 · ${formatRotationRange(rotationWindow)}`
                  : "正在读取本地时间…"}
              </p>
            </div>
          </div>
        </div>
        <div className="py-5 lg:pl-8">
          <div className="flex items-start gap-3">
            <ChevronRight aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-zinc-100">下周预览</h2>
              <p className="mt-1 text-sm leading-6 text-zinc-400">
                {rotationWindow ? `第 ${rotationWindow.nextRotationIndex} 周` : "下一轮"}
                {nextBuffs.length > 0 ? ` · ${nextBuffs.map((buff) => buff.name).join(" / ")}` : ""}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="rotation" className="scroll-mt-20 py-9">
        <div className="mb-6 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold text-zinc-100 sm:text-2xl">
              <Layers3 aria-hidden="true" className="h-5 w-5 text-amber-300" />
              三周轮换
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              地图池决定 Buff 组合，周次决定当前取哪一组。
            </p>
          </div>
          <div
            role="group"
            aria-label="选择地图池"
            className="grid grid-cols-2 rounded-lg border border-zinc-700 bg-zinc-900 p-1"
          >
            {WEEKLY_BUFF_POOLS.map((pool) => (
              <button
                key={pool.id}
                type="button"
                aria-pressed={pool.id === poolId}
                onClick={() => selectPool(pool.id)}
                className={`min-h-11 touch-manipulation rounded-md border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 ${
                  pool.id === poolId
                    ? "border-amber-400/70 bg-amber-400/12 text-amber-100"
                    : "border-transparent text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                }`}
              >
                {pool.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6 grid grid-cols-3 rounded-lg border border-zinc-700 bg-zinc-900/70 p-1">
          {[1, 2, 3].map((index) => (
            <RotationButton
              key={index}
              index={index}
              selected={rotationIndex === index}
              current={rotationWindow?.rotationIndex === index}
              onClick={() => selectRotation(index)}
            />
          ))}
        </div>

        <div className="mb-6 flex items-start gap-3 border-y border-zinc-700 py-4">
          <MapPinned aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">{selectedPool.label}适用地图</h3>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-400">
              {selectedPool.maps.map((map) => (
                <span key={map}>{map}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {selectedBuffs.map((buff, index) => (
            <BuffCard key={buff.id} buff={buff} position={index + 1} />
          ))}
        </div>
      </section>

      <section id="damage-index" className="scroll-mt-20 border-t border-zinc-700 pt-9">
        <div className="mb-6 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-zinc-100 sm:text-2xl">
              <Crosshair aria-hidden="true" className="h-5 w-5 text-rose-300" />
              增伤类索引
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              乘区增伤只展示规范乘区名；暴击率收益和额外伤害事件单独列出，不作为乘区处理。
            </p>
          </div>
          <div
            role="group"
            aria-label="筛选增伤索引"
            className="grid grid-cols-2 rounded-lg border border-zinc-700 bg-zinc-900 p-1 sm:grid-cols-4"
          >
            {INDEX_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                aria-pressed={indexFilter === filter.id}
                onClick={() => selectFilter(filter.id)}
                className={`min-h-11 touch-manipulation rounded-md border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 ${
                  indexFilter === filter.id
                    ? "border-rose-400/60 bg-rose-400/10 text-rose-100"
                    : "border-transparent text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900/65">
          <div className="hidden grid-cols-[minmax(12rem,0.8fr)_minmax(9rem,0.65fr)_minmax(0,1.55fr)_2rem] gap-4 border-b border-zinc-700 px-5 py-3 text-xs font-semibold text-zinc-500 md:grid">
            <span>Buff</span>
            <span>收益归类</span>
            <span>生效说明</span>
            <span className="sr-only">定位</span>
          </div>
          <div className="divide-y divide-zinc-800">
            {indexedBuffs.map((buff) => (
              <div
                key={buff.id}
                className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(12rem,0.8fr)_minmax(9rem,0.65fr)_minmax(0,1.55fr)_2rem] md:items-center md:gap-4 md:px-5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded border border-zinc-700 bg-zinc-950">
                    <Image
                      src={getAssetPath(buff.icon)}
                      alt=""
                      fill
                      sizes="40px"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => revealBuff(buff)}
                      className="touch-manipulation text-left text-sm font-semibold text-zinc-100 transition-colors hover:text-amber-200 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4"
                    >
                      {buff.name}
                    </button>
                    <p className="font-mono text-[10px] tabular-nums text-zinc-600">{buff.id}</p>
                  </div>
                </div>
                <div>
                  <IndexBadge buff={buff} />
                </div>
                <p className="text-sm leading-6 text-zinc-400">{buff.description}</p>
                <button
                  type="button"
                  onClick={() => revealBuff(buff)}
                  aria-label={`在轮换表中定位${buff.name}`}
                  title={`定位${buff.name}`}
                  className="hidden h-8 w-8 touch-manipulation items-center justify-center rounded text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:underline md:flex"
                >
                  <ChevronRight aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="mt-8 flex items-start gap-3 border-t border-zinc-700 pt-5 text-xs leading-5 text-zinc-500">
        <Sparkles aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          轮换按游戏配置的 UTC+8 时间计算。乘区徽标只表示结算乘区，不展示乘区内的具体增伤类型。
        </p>
      </footer>
    </div>
  );
}
