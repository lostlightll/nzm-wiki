"use client";

import Image from "next/image";
import { CircleDashed, Search, X } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { getAssetPath } from "@/lib/path";
import type {
  StatusEffectCatalogEntry,
  StatusEffectModifierReference,
  StatusEffectNumericalReference,
  StatusEffectPolarity,
  StatusEffectTarget,
  StatusEffectVariant,
} from "@/types";

const PAGE_SIZE = 60;

const CATEGORY_LABELS: Record<string, string> = {
  PositiveModifier: "属性增益",
  NegativeModifier: "属性减益",
  Independence: "独立状态",
  SpeedDown: "减速",
  DotDamage: "持续伤害",
  Recovery: "恢复",
  TemporaryShield: "临时护盾",
  Frozen: "冰冻",
  Invincible: "无敌",
  NoInjured: "免伤",
  Unknown: "未分类",
};

const POLARITY_LABELS: Record<StatusEffectPolarity, string> = {
  positive: "增益",
  negative: "减益",
};

type PolarityFilter = "all" | StatusEffectPolarity;

function categoryLabel(category: string) {
  return CATEGORY_LABELS[category] ?? category;
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}

function formatDuration(value: number) {
  if (value < 0) return "永久";
  if (value <= 0.1) return "瞬时";
  return `${formatNumber(value)} 秒`;
}

function formatDurationSet(variants: StatusEffectVariant[]) {
  const values = [...new Set(variants.map((variant) => formatDuration(variant.duration)))];
  return values.length > 3 ? `${values.slice(0, 3).join(" / ")} 等` : values.join(" / ");
}

function formatStackSet(variants: StatusEffectVariant[]) {
  const values = [...new Set(variants.map((variant) => variant.stackLimit))];
  return values.length === 1 ? `${values[0]} 层` : `${values.slice(0, 3).join(" / ")} 层`;
}

function isVariantVisibleForTarget(
  variant: StatusEffectVariant,
  target: StatusEffectTarget,
) {
  if (target === "enemy") {
    return (
      variant.polarity === "negative" &&
      (variant.displayMask === 2 || variant.displayMask === 3)
    );
  }
  return (
    variant.displayMask === 1 ||
    variant.displayMask === 3 ||
    variant.displayMask === 4
  );
}

function entrySearchText(entry: StatusEffectCatalogEntry) {
  return [
    entry.buffId,
    ...entry.names,
    ...entry.descriptions,
    ...entry.categories,
    ...entry.variants.flatMap((variant) => [
      variant.rowName,
      variant.name,
      variant.description,
    ]),
  ]
    .join(" ")
    .toLocaleLowerCase();
}

function ModifierReference({
  id,
  references,
}: {
  id: number;
  references: Record<string, StatusEffectModifierReference[]>;
}) {
  const rows = references[String(id)];
  if (!rows) {
    return <span className="text-amber-300">{id}（未解析，已保留原始 ID）</span>;
  }

  return (
    <span>
      {id}：{rows.map((row) => {
        const description = row.description || row.attributeName || "未命名属性";
        return `${description} [Lv.${row.level} ${row.operation} ${formatNumber(row.baseValue)} + ${formatNumber(row.coefficient)}×系数]`;
      }).join("；")}
    </span>
  );
}

function NumericalReference({
  id,
  references,
}: {
  id: number;
  references: Record<string, StatusEffectNumericalReference[]>;
}) {
  const rows = references[String(id)];
  if (!rows) {
    return <span className="text-amber-300">{id}（未解析，已保留原始 ID）</span>;
  }

  return (
    <span>
      {id}：{rows.map((row) => {
        const parts = [
          `Lv.${row.level}`,
          row.elementType || null,
          row.description || null,
          row.fleshDamageBase ? `基础伤害 ${formatNumber(row.fleshDamageBase)}` : null,
          row.hpScale ? `生命系数 ${formatNumber(row.hpScale)}` : null,
          row.hpBase ? `生命基数 ${formatNumber(row.hpBase)}` : null,
          row.settlements.length ? `结算 ${row.settlements.join("、")}` : null,
        ].filter(Boolean);
        return parts.join(" · ");
      }).join("；")}
    </span>
  );
}

function StatusEffectDetails({
  entry,
  modifiers,
  numericals,
}: {
  entry: StatusEffectCatalogEntry;
  modifiers: Record<string, StatusEffectModifierReference[]>;
  numericals: Record<string, StatusEffectNumericalReference[]>;
}) {
  return (
    <details className="group/details border-t border-zinc-800 bg-black/10 px-3 py-2 sm:px-4">
      <summary className="w-fit cursor-pointer select-none text-xs font-medium text-zinc-400 hover:text-zinc-200 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4">
        技术详情 · {entry.variants.length} 个配置变体
      </summary>
      <div className="mt-3 space-y-3 text-xs leading-5 text-zinc-400">
        <p className="m-0 break-all">
          <span className="text-zinc-500">BuffID：</span>{entry.buffId}
        </p>
        {entry.variants.map((variant, index) => (
          <section
            key={`${variant.rowName}-${index}`}
            className="min-w-0 rounded border border-zinc-800 bg-zinc-950/60 p-3"
          >
            <div className="grid min-w-0 gap-x-6 gap-y-1 md:grid-cols-[minmax(12rem,1fr)_minmax(0,2fr)]">
              <p className="m-0 min-w-0 break-all text-zinc-200">
                {variant.rowName}
              </p>
              <p className="m-0 break-words">
                {POLARITY_LABELS[variant.polarity]} · {categoryLabel(variant.category)} · 显示位 {variant.displayMask}
              </p>
              <p className="m-0">
                持续 {formatDuration(variant.duration)} · 周期 {formatNumber(variant.period)} 秒 · 上限 {variant.stackLimit} 层
              </p>
              <p className="m-0 break-words">
                等级持续：{variant.levelDuration || "未配置"}
              </p>
            </div>
            {variant.modifierIds.length > 0 && (
              <div className="mt-2 space-y-1 border-t border-zinc-800 pt-2">
                <p className="m-0 text-zinc-500">属性修正</p>
                {variant.modifierIds.map((id) => (
                  <p key={id} className="m-0 break-words">
                    <ModifierReference id={id} references={modifiers} />
                  </p>
                ))}
              </div>
            )}
            {variant.numericalId !== null && (
              <p className="m-0 mt-2 break-words border-t border-zinc-800 pt-2">
                <span className="text-zinc-500">伤害配置：</span>{" "}
                <NumericalReference id={variant.numericalId} references={numericals} />
              </p>
            )}
          </section>
        ))}
      </div>
    </details>
  );
}

function StatusEffectRow({
  entry,
  target,
  modifiers,
  numericals,
}: {
  entry: StatusEffectCatalogEntry;
  target: StatusEffectTarget;
  modifiers: Record<string, StatusEffectModifierReference[]>;
  numericals: Record<string, StatusEffectNumericalReference[]>;
}) {
  const targetVariants = entry.variants.filter((variant) =>
    isVariantVisibleForTarget(variant, target),
  );
  const primary = targetVariants[0] ?? entry.variants[0];
  const icon = targetVariants.find((variant) => variant.icon)?.icon ?? entry.icon;
  const descriptions = [...new Set(targetVariants.map((variant) => variant.description).filter(Boolean))];
  const names = [...new Set(targetVariants.map((variant) => variant.name).filter(Boolean))];

  return (
    <article className="min-w-0 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/45">
      <div className="grid min-w-0 gap-3 p-3 lg:grid-cols-[3rem_minmax(10rem,0.9fr)_minmax(16rem,2fr)_8rem_6rem] lg:items-center lg:gap-4 lg:px-4">
        <div className="flex items-start gap-3 lg:contents">
          {icon ? (
            <Image
              src={getAssetPath(icon)}
              alt=""
              width={48}
              height={48}
              className="h-12 w-12 shrink-0 rounded border border-zinc-700 bg-zinc-950 object-contain"
            />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-zinc-800 bg-zinc-950 text-zinc-600">
              <CircleDashed aria-hidden="true" size={22} />
            </div>
          )}
          <div className="min-w-0 lg:col-start-2">
            <h3 className="m-0 break-words text-sm font-semibold leading-5 text-zinc-100">
              {primary.name}
            </h3>
            {names.length > 1 && (
              <p className="m-0 mt-1 text-xs text-zinc-500">
                另有 {names.length - 1} 个名称变体
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-1">
              {entry.polarities.map((polarity) => (
                <span
                  key={polarity}
                  className={`rounded border px-1.5 py-0.5 text-[11px] leading-4 ${
                    polarity === "positive"
                      ? "border-emerald-700/70 bg-emerald-950/40 text-emerald-300"
                      : "border-rose-700/70 bg-rose-950/40 text-rose-300"
                  }`}
                >
                  {POLARITY_LABELS[polarity]}
                </span>
              ))}
              {entry.categories.slice(0, 2).map((category) => (
                <span
                  key={category}
                  className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-[11px] leading-4 text-zinc-300"
                >
                  {categoryLabel(category)}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="min-w-0 lg:col-start-3">
          <p className="m-0 break-words text-sm leading-6 text-zinc-300">
            {descriptions[0] || "导出配置未提供公开描述。"}
          </p>
          {descriptions.length > 1 && (
            <p className="m-0 mt-1 text-xs text-zinc-500">
              另有 {descriptions.length - 1} 个描述变体
            </p>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-2 text-xs lg:contents">
          <div className="rounded bg-zinc-950/60 p-2 lg:col-start-4 lg:bg-transparent lg:p-0">
            <dt className="text-zinc-500">持续时间</dt>
            <dd className="m-0 mt-1 text-zinc-200">{formatDurationSet(targetVariants)}</dd>
          </div>
          <div className="rounded bg-zinc-950/60 p-2 lg:col-start-5 lg:bg-transparent lg:p-0">
            <dt className="text-zinc-500">叠层上限</dt>
            <dd className="m-0 mt-1 text-zinc-200">{formatStackSet(targetVariants)}</dd>
          </div>
        </dl>
      </div>
      <StatusEffectDetails entry={entry} modifiers={modifiers} numericals={numericals} />
    </article>
  );
}

export function StatusEffectCatalogClient({
  target,
  entries,
  modifiers,
  numericals,
}: {
  target: StatusEffectTarget;
  entries: StatusEffectCatalogEntry[];
  modifiers: Record<string, StatusEffectModifierReference[]>;
  numericals: Record<string, StatusEffectNumericalReference[]>;
}) {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLocaleLowerCase());
  const [polarity, setPolarity] = useState<PolarityFilter>("all");
  const [category, setCategory] = useState("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const categories = useMemo(
    () => [...new Set(entries.flatMap((entry) => entry.categories))].sort((left, right) =>
      categoryLabel(left).localeCompare(categoryLabel(right), "zh-CN"),
    ),
    [entries],
  );
  const availablePolarities = useMemo(
    () => [...new Set(entries.flatMap((entry) => entry.polarities))],
    [entries],
  );
  const searchableEntries = useMemo(
    () => entries.map((entry) => ({ entry, searchText: entrySearchText(entry) })),
    [entries],
  );
  const filteredEntries = useMemo(
    () => searchableEntries
      .filter(({ entry, searchText }) => {
        if (deferredSearch && !searchText.includes(deferredSearch)) return false;
        if (polarity !== "all" && !entry.polarities.includes(polarity)) return false;
        if (category !== "all" && !entry.categories.includes(category)) return false;
        return true;
      })
      .map(({ entry }) => entry),
    [category, deferredSearch, polarity, searchableEntries],
  );
  const visibleEntries = filteredEntries.slice(0, visibleCount);

  const resetVisible = () => setVisibleCount(PAGE_SIZE);

  return (
    <div className="not-prose my-6 min-w-0">
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/65 p-3 sm:p-4">
        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(16rem,1fr)_auto_minmax(12rem,16rem)] lg:items-end">
          <label className="min-w-0">
            <span className="mb-1.5 block text-xs font-medium text-zinc-400">搜索状态</span>
            <span className="relative block">
              <Search
                aria-hidden="true"
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  resetVisible();
                }}
                placeholder="名称、描述、内部名或 BuffID"
                className="h-11 w-full rounded border border-zinc-700 bg-zinc-950 py-2 pl-9 pr-10 text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:border-zinc-400 focus-visible:outline-none"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    resetVisible();
                  }}
                  aria-label="清空搜索"
                  title="清空搜索"
                  className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:[&_svg]:underline"
                >
                  <X aria-hidden="true" size={17} />
                </button>
              )}
            </span>
          </label>

          <fieldset className="min-w-0">
            <legend className="mb-1.5 text-xs font-medium text-zinc-400">极性</legend>
            <div className="flex min-h-11 flex-wrap gap-1 rounded border border-zinc-800 bg-zinc-950 p-1">
              {(["all", ...availablePolarities] as PolarityFilter[]).map((value) => {
                const selected = polarity === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setPolarity(value);
                      resetVisible();
                    }}
                    className={`min-h-9 rounded border px-3 text-sm focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 ${
                      selected
                        ? "border-zinc-500 bg-zinc-700 text-white"
                        : "border-transparent bg-transparent text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                    }`}
                  >
                    {value === "all" ? "全部" : POLARITY_LABELS[value]}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="min-w-0">
            <span className="mb-1.5 block text-xs font-medium text-zinc-400">配置分类</span>
            <select
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                resetVisible();
              }}
              className="h-11 w-full rounded border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-200 focus-visible:border-zinc-400 focus-visible:outline-none"
            >
              <option value="all">全部分类</option>
              {categories.map((value) => (
                <option key={value} value={value}>
                  {categoryLabel(value)}（{value}）
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="m-0 mt-3 text-xs text-zinc-500" aria-live="polite">
          找到 {filteredEntries.length} 项，当前显示 {visibleEntries.length} 项
        </p>
      </div>

      <div className="mt-3 hidden grid-cols-[3rem_minmax(10rem,0.9fr)_minmax(16rem,2fr)_8rem_6rem] gap-4 px-4 text-xs font-medium text-zinc-500 lg:grid">
        <span>图标</span>
        <span>名称</span>
        <span>效果</span>
        <span>持续时间</span>
        <span>叠层</span>
      </div>

      {visibleEntries.length > 0 ? (
        <div className="mt-2 space-y-2">
          {visibleEntries.map((entry) => (
            <StatusEffectRow
              key={entry.buffId}
              entry={entry}
              target={target}
              modifiers={modifiers}
              numericals={numericals}
            />
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-dashed border-zinc-700 px-4 py-12 text-center text-sm text-zinc-500">
          没有符合当前搜索和筛选条件的状态。
        </div>
      )}

      {visibleEntries.length < filteredEntries.length && (
        <button
          type="button"
          onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
          className="mt-4 min-h-11 w-full rounded border border-zinc-700 bg-zinc-900 px-4 text-sm font-medium text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4"
        >
          继续加载（剩余 {filteredEntries.length - visibleEntries.length} 项）
        </button>
      )}
    </div>
  );
}
