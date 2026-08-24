"use client";

import { Calculator, Info, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BASE_DAMAGE_DATA } from "@/lib/multiplier-data";
import type {
  WeaponBaseDamageChannel,
  WeaponBaseDamageEntry,
  WeaponBaseDamageModeData,
} from "@/lib/weapon-base-damage";
import { filterWeaponBaseDamageEntries } from "@/lib/weapon-base-damage";
import type { ElementType } from "@/types";
import type { NumericalTable } from "@/lib/weapon-source-v2";

const CHANNEL_OPTIONS: readonly {
  id: "all" | WeaponBaseDamageChannel;
  label: string;
}[] = [
  { id: "all", label: "全部类型" },
  { id: "hit", label: "命中" },
  { id: "explosion", label: "爆炸" },
  { id: "weapon-skill", label: "武器技能" },
  { id: "other", label: "其他" },
];

const ELEMENT_OPTIONS: readonly ("all" | ElementType)[] = [
  "all",
  "物理",
  "火焰",
  "寒冷",
  "电弧",
  "腐蚀",
];

function readMode(): NumericalTable {
  return new URLSearchParams(window.location.search).get("mode") === "td"
    ? "td"
    : "lc";
}

function updateMode(mode: NumericalTable) {
  const url = new URL(window.location.href);
  if (mode === "td") url.searchParams.set("mode", "td");
  else url.searchParams.delete("mode");
  window.history.pushState(null, "", url);
  window.dispatchEvent(new Event("nzm-wiki:multiplier-query-change"));
}

function formatBaseDamage(value: number): string {
  return String(Math.round(value * 10) / 10);
}

function Permission({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  return (
    <span className={enabled ? "text-zinc-100" : "text-zinc-500"}>
      {children}
    </span>
  );
}

function DamageFormula({ mode }: { mode: WeaponBaseDamageModeData }) {
  return (
    <span className="font-mono text-sm tabular-nums text-zinc-100">
      <span className="text-[color:var(--guide-accent)]">
        {String(mode.coefficient)}
      </span>{" "}
      × {mode.baseAttack} = {formatBaseDamage(mode.baseDamage)}
    </span>
  );
}

function DamageSourceRow({
  entry,
  mode,
}: {
  entry: WeaponBaseDamageEntry;
  mode: WeaponBaseDamageModeData;
}) {
  return (
    <li className="grid min-w-0 gap-x-4 gap-y-3 border-b border-zinc-800 px-4 py-4 last:border-b-0 sm:grid-cols-2 lg:grid-cols-[minmax(14rem,1.5fr)_minmax(12rem,1.05fr)_minmax(6rem,0.55fr)_minmax(5rem,0.45fr)_minmax(5rem,0.45fr)_minmax(8rem,0.75fr)] lg:items-center lg:gap-y-0 lg:px-5 lg:py-3">
      <div className="min-w-0 sm:col-span-2 lg:col-span-1">
        <span className="mb-1 block text-xs text-zinc-500 lg:hidden">伤害来源</span>
        <Link
          href={mode.href}
          className="inline-block min-w-0 break-words text-sm font-semibold leading-5 text-zinc-100 transition-colors duration-200 hover:text-[color:var(--guide-accent)] focus-visible:outline-none focus-visible:text-[color:var(--guide-accent)] focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 motion-reduce:transition-none"
        >
          {entry.displayName}
        </Link>
      </div>

      <div className="min-w-0 sm:col-span-2 lg:col-span-1">
        <span className="mb-1 block text-xs text-zinc-500 lg:hidden">白值计算</span>
        <DamageFormula mode={mode} />
      </div>

      <div className="min-w-0">
        <span className="mb-1 block text-xs text-zinc-500 lg:hidden">类型</span>
        <span className="text-sm text-zinc-200">{mode.sourceTypeLabel}</span>
      </div>

      <div className="min-w-0">
        <span className="mb-1 block text-xs text-zinc-500 lg:hidden">元素</span>
        <span className="text-sm text-zinc-200">{mode.element}</span>
      </div>

      <div className="min-w-0">
        <span className="mb-1 block text-xs text-zinc-500 lg:hidden">暴击</span>
        <Permission enabled={mode.enableCritical}>
          {mode.enableCritical ? "可暴击" : "不可暴击"}
        </Permission>
      </div>

      <div className="min-w-0">
        <span className="mb-1 block text-xs text-zinc-500 lg:hidden">弱点</span>
        <Permission enabled={mode.enableWeakness}>
          {mode.enableWeakness
            ? `可弱点 ${String(mode.weaknessMultiplier)}×`
            : "不可弱点"}
        </Permission>
      </div>
    </li>
  );
}

export function BaseDamageDetail({
  entries,
}: {
  entries: readonly WeaponBaseDamageEntry[];
}) {
  const [mode, setMode] = useState<NumericalTable>("lc");
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState<"all" | WeaponBaseDamageChannel>("all");
  const [element, setElement] = useState<"all" | ElementType>("all");

  useEffect(() => {
    const sync = () => setMode(readMode());
    sync();
    window.addEventListener("popstate", sync);
    window.addEventListener("nzm-wiki:multiplier-query-change", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("nzm-wiki:multiplier-query-change", sync);
    };
  }, []);

  const visibleSources = useMemo(() => {
    return filterWeaponBaseDamageEntries(entries, mode, {
      query,
      channel,
      element,
    });
  }, [channel, element, entries, mode, query]);

  const selectMode = (nextMode: NumericalTable) => {
    updateMode(nextMode);
    setMode(nextMode);
  };

  return (
    <>
      <div className="grid border-b border-zinc-800 lg:grid-cols-[minmax(0,1fr)_minmax(23rem,0.42fr)]">
        <section className="border-b border-zinc-800 p-5 sm:p-6 lg:border-r lg:border-b-0 xl:px-5 xl:py-3">
          <div className="xl:flex xl:items-baseline xl:gap-4">
            <h3 className="flex shrink-0 items-center gap-3 text-base font-semibold text-zinc-100">
              <Calculator aria-hidden="true" className="h-5 w-5 text-zinc-200" />
              计算规则
            </h3>
            <p className="mt-3 text-sm leading-7 text-[color:var(--guide-muted)] sm:text-base xl:mt-0 xl:text-sm xl:leading-6">
              单颗弹丸、单段攻击或单次原子结算的武器白值，乘以当前模式的基础攻击力，得到无增伤身体伤害。
            </p>
          </div>
          <div className="mt-4 border-l-2 border-[color:var(--guide-accent)] bg-zinc-950/45 px-4 py-3 xl:mt-2 xl:flex xl:items-baseline xl:gap-4 xl:px-3 xl:py-2">
            <p className="shrink-0 font-mono text-sm leading-6 text-zinc-100">
              {BASE_DAMAGE_DATA.formula}
            </p>
            <p className="mt-1 text-xs leading-5 text-zinc-400 xl:mt-0">
              不包含弹丸数、多段次数、射速、距离衰减、暴击、弱点和其他增伤。
            </p>
          </div>
        </section>

        <section className="p-5 sm:p-6 xl:flex xl:items-center xl:gap-4 xl:px-4 xl:py-3">
          <h3 className="shrink-0 text-base font-semibold text-zinc-100">游戏模式</h3>
          <div
            className="mt-3 grid grid-cols-2 rounded-md border border-zinc-700 bg-zinc-900 p-1 xl:mt-0 xl:min-w-0 xl:flex-1"
            role="group"
            aria-label="选择基础伤害游戏模式"
          >
            {BASE_DAMAGE_DATA.modes.map((item) => {
              const active = item.id === mode;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => selectMode(item.id)}
                  className={`min-h-11 cursor-pointer touch-manipulation rounded border px-3 py-2 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 motion-reduce:transition-none ${
                    active
                      ? "border-[color:var(--guide-accent)] bg-[color:var(--guide-accent-soft)] text-[color:var(--guide-accent)]"
                      : "border-transparent text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                  }`}
                >
                  {item.label} · {item.baseAttack}
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <section aria-labelledby="base-damage-index-heading" className="p-5 sm:p-6 xl:p-5">
        <div className="mb-4">
          <h3 id="base-damage-index-heading" className="text-lg font-semibold text-zinc-100">
            武器白值索引
          </h3>
          <p className="mt-1 text-sm leading-6 text-zinc-400">
            名称采用武器 MDX 中的伤害来源命名，数值由已提交的 Weapon Data Lock 解析。
            不收录近战武器；其他武器的近战来源仍按命中展示。
          </p>
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_12rem]">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-zinc-400">搜索伤害来源</span>
            <span className="relative block">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="武器或来源名称"
                className="min-h-11 w-full rounded-md border border-zinc-700 bg-zinc-950/45 py-2 pr-3 pl-10 text-base text-zinc-100 outline-none transition-colors placeholder:text-zinc-500 focus:border-[color:var(--guide-accent)]"
              />
            </span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-zinc-400">伤害类型</span>
            <select
              value={channel}
              onChange={(event) =>
                setChannel(event.target.value as "all" | WeaponBaseDamageChannel)
              }
              className="min-h-11 w-full rounded-md border border-zinc-700 bg-zinc-950/45 px-3 py-2 text-base text-zinc-200 outline-none transition-colors focus:border-[color:var(--guide-accent)]"
            >
              {CHANNEL_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-zinc-400">元素类型</span>
            <select
              value={element}
              onChange={(event) => setElement(event.target.value as "all" | ElementType)}
              className="min-h-11 w-full rounded-md border border-zinc-700 bg-zinc-950/45 px-3 py-2 text-base text-zinc-200 outline-none transition-colors focus:border-[color:var(--guide-accent)]"
            >
              {ELEMENT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === "all" ? "全部元素" : option}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p aria-live="polite" className="mb-2 text-xs tabular-nums text-zinc-500">
          {visibleSources.length} 个结果
        </p>

        <div className="overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900/55">
          <div className="hidden grid-cols-[minmax(14rem,1.5fr)_minmax(12rem,1.05fr)_minmax(6rem,0.55fr)_minmax(5rem,0.45fr)_minmax(5rem,0.45fr)_minmax(8rem,0.75fr)] gap-4 border-b border-zinc-800 bg-zinc-950/45 px-5 py-2 text-xs font-semibold text-zinc-400 lg:grid">
            <span>伤害来源</span>
            <span>白值计算</span>
            <span>类型</span>
            <span>元素</span>
            <span>暴击</span>
            <span>弱点</span>
          </div>
          {visibleSources.length > 0 ? (
            <ul>
              {visibleSources.map(({ entry, mode: modeData }) => (
                <DamageSourceRow key={entry.id} entry={entry} mode={modeData} />
              ))}
            </ul>
          ) : (
            <p className="px-4 py-10 text-center text-sm text-zinc-400">
              没有符合当前筛选条件的伤害来源
            </p>
          )}
        </div>
      </section>

      <footer className="flex items-start justify-center gap-2 border-t border-zinc-800 px-5 py-4 text-center text-xs leading-5 text-zinc-400 sm:text-sm">
        <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        <p>开发环境会与武器页面保持一致，同时包含标记为草稿的武器来源。</p>
      </footer>
    </>
  );
}
