"use client";

import Link from "next/link";
import { ArrowRight, ListFilter, Search, Swords, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_MULTIPLIER_FACTOR,
  MODIFIER_TYPES,
  MULTIPLIER_FACTORS,
  PROVIDER_RELATIONS,
  type MultiplierFactorId,
  type MultiplierRelation,
} from "@/lib/multiplier-data";

export type MultiplierTargetIndexEntry = {
  id: string;
  label: string;
  sourceLabel: string;
  href: string;
  relations: readonly MultiplierRelation[];
};

type IndexView = "providers" | "targets";

const INDEX_FACTOR_STORAGE_KEY = "nzm-wiki:guides:multiplier:index-factor";
const INDEX_MULTIPLIER_FACTORS = MULTIPLIER_FACTORS.filter((factor) =>
  MODIFIER_TYPES.some((modifier) => modifier.factorId === factor.id),
);
const DEFAULT_INDEX_FACTOR_ID = DEFAULT_MULTIPLIER_FACTOR.id;

function isIndexFactorId(value: string | null): value is MultiplierFactorId {
  return INDEX_MULTIPLIER_FACTORS.some((factor) => factor.id === value);
}

function readIndexFactor(): MultiplierFactorId {
  const queryFactorId = new URLSearchParams(window.location.search).get("factor");
  if (isIndexFactorId(queryFactorId)) return queryFactorId;

  try {
    const storedFactorId = window.localStorage.getItem(INDEX_FACTOR_STORAGE_KEY);
    if (isIndexFactorId(storedFactorId)) return storedFactorId;
  } catch {
    // localStorage 不可用时回退到默认乘区。
  }

  return DEFAULT_INDEX_FACTOR_ID;
}

function readView(): IndexView {
  return new URLSearchParams(window.location.search).get("view") === "targets"
    ? "targets"
    : "providers";
}

function readModifier(): string {
  return new URLSearchParams(window.location.search).get("modifier") ?? "";
}

function updateQuery(values: {
  view?: IndexView;
  factor?: MultiplierFactorId;
  modifier?: string;
}) {
  const url = new URL(window.location.href);
  if (values.view) url.searchParams.set("view", values.view);
  if (values.factor) url.searchParams.set("factor", values.factor);
  if (values.modifier !== undefined) {
    if (values.modifier) url.searchParams.set("modifier", values.modifier);
    else url.searchParams.delete("modifier");
  }
  url.hash = "multiplier";
  window.history.pushState(null, "", url);
  window.dispatchEvent(new Event("nzm-wiki:multiplier-query-change"));
}

function sourceTypeLabel(relation: MultiplierRelation): string {
  switch (relation.source?.type) {
    case "weapon":
      return "武器技能";
    case "perk":
      return "插件";
    case "overlimit-card":
      return "超限卡片";
    case "overlimit-bond":
      return "超限羁绊";
    case "post":
      return "机制说明";
    case "season-talent":
      return "赛季天赋";
    default:
      return "增伤来源";
  }
}

export function MultiplierBidirectionalIndex({ targets }: {
  targets: readonly MultiplierTargetIndexEntry[];
}) {
  const [view, setView] = useState<IndexView>("providers");
  const [selectedFactorId, setSelectedFactorId] = useState<MultiplierFactorId>(
    DEFAULT_INDEX_FACTOR_ID,
  );
  const [modifierTypeId, setModifierTypeId] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const sync = () => {
      setView(readView());
      const nextFactorId = readIndexFactor();
      setSelectedFactorId(nextFactorId);
      setModifierTypeId(readModifier());

      const url = new URL(window.location.href);
      if (url.searchParams.get("factor") !== nextFactorId) {
        url.searchParams.set("factor", nextFactorId);
        url.searchParams.delete("modifier");
        window.history.replaceState(null, "", url);
      }
    };
    const syncStorage = (event: StorageEvent) => {
      if (event.key === INDEX_FACTOR_STORAGE_KEY) sync();
    };
    sync();
    window.addEventListener("popstate", sync);
    window.addEventListener("nzm-wiki:multiplier-query-change", sync);
    window.addEventListener("storage", syncStorage);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("nzm-wiki:multiplier-query-change", sync);
      window.removeEventListener("storage", syncStorage);
    };
  }, []);

  const selectFactor = (factorId: MultiplierFactorId) => {
    setSelectedFactorId(factorId);
    setModifierTypeId("");
    try {
      window.localStorage.setItem(INDEX_FACTOR_STORAGE_KEY, factorId);
    } catch {
      // localStorage 不可用时，当前挂载周期内仍可正常筛选。
    }
    updateQuery({ factor: factorId, modifier: "" });
  };

  const modifierOptions = MODIFIER_TYPES.filter(
    (modifier) => modifier.factorId === selectedFactorId,
  );
  const effectiveModifier = modifierOptions.some(
    (modifier) => modifier.id === modifierTypeId,
  )
    ? modifierTypeId
    : "";
  const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");

  const providerItems = useMemo(() => {
    const groups = new Map<string, MultiplierRelation[]>();
    for (const relation of PROVIDER_RELATIONS) {
      if (relation.factorId !== selectedFactorId) continue;
      if (effectiveModifier && relation.modifierTypeId !== effectiveModifier) continue;
      const key = relation.sourceHref ?? `${relation.effectId}:${relation.modifierTypeId}`;
      const group = groups.get(key) ?? [];
      group.push(relation);
      groups.set(key, group);
    }
    return [...groups.values()].filter((relations) => {
      if (!normalizedQuery) return true;
      return `${relations[0].effectLabel ?? ""} ${sourceTypeLabel(relations[0])}`
        .toLocaleLowerCase("zh-CN")
        .includes(normalizedQuery);
    });
  }, [effectiveModifier, normalizedQuery, selectedFactorId]);

  const targetItems = useMemo(
    () =>
      targets.filter((target) => {
        const matchingRelations = target.relations.filter(
          (relation) =>
            relation.factorId === selectedFactorId &&
            (!effectiveModifier || relation.modifierTypeId === effectiveModifier),
        );
        if (matchingRelations.length === 0) return false;
        return (
          !normalizedQuery ||
          `${target.label} ${target.sourceLabel}`
            .toLocaleLowerCase("zh-CN")
            .includes(normalizedQuery)
        );
      }),
    [effectiveModifier, normalizedQuery, selectedFactorId, targets],
  );

  const resultCount = view === "providers" ? providerItems.length : targetItems.length;

  return (
    <section aria-labelledby="multiplier-index-heading">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 id="multiplier-index-heading" className="text-xl font-bold text-zinc-100">
            增伤类型双向索引
          </h2>
          <p className="mt-1 text-sm leading-6 text-zinc-400">
            选择乘区后，可继续按增伤类型或关键词精确过滤。
          </p>
        </div>
        <div className="grid grid-cols-2 rounded-md border border-zinc-700 bg-zinc-900 p-1">
          {(
            [
              { id: "providers", label: "增伤来源", icon: Zap },
              { id: "targets", label: "适用伤害来源", icon: Swords },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={view === id}
              onClick={() => updateQuery({ view: id })}
              className={`flex min-h-11 items-center justify-center gap-2 rounded border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-4 sm:min-h-9 ${
                view === id
                  ? "border-[color:var(--guide-accent)] bg-[color:var(--guide-accent-soft)] text-[color:var(--guide-accent)]"
                  : "border-transparent text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              }`}
            >
              <Icon aria-hidden="true" className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <fieldset className="mb-4 rounded-lg border border-zinc-700 bg-zinc-900/55 p-3 sm:p-4">
        <legend className="px-1 text-sm font-semibold text-zinc-100">
          <span className="inline-flex items-center gap-2">
            <ListFilter aria-hidden="true" className="h-4 w-4 text-[color:var(--guide-accent)]" />
            筛选
          </span>
        </legend>

        <div>
          <p className="mb-2 text-xs font-medium text-zinc-400">乘区</p>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {INDEX_MULTIPLIER_FACTORS.map((factor) => {
              const selected = factor.id === selectedFactorId;

              return (
                <button
                  key={factor.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => selectFactor(factor.id)}
                  className={`min-h-11 cursor-pointer touch-manipulation rounded-md border px-3 py-2 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 motion-reduce:transition-none ${
                    selected
                      ? "border-[color:var(--guide-accent)] bg-[color:var(--guide-accent-soft)] text-[color:var(--guide-accent)]"
                      : "border-zinc-700 bg-zinc-950/45 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800 hover:text-zinc-100"
                  }`}
                >
                  {factor.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 grid gap-3 border-t border-zinc-800 pt-4 sm:grid-cols-[minmax(0,1fr)_15rem]">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-zinc-400">关键词</span>
            <span className="relative block">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={
                  view === "providers"
                    ? "搜索技能、插件、卡片或羁绊"
                    : "搜索武器或伤害来源"
                }
                className="min-h-11 w-full rounded-md border border-zinc-700 bg-zinc-950/55 py-2 pl-10 pr-3 text-base text-zinc-100 outline-none transition-colors placeholder:text-zinc-500 focus:border-[color:var(--guide-accent)]"
              />
            </span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-zinc-400">增伤类型</span>
            <select
              value={effectiveModifier}
              onChange={(event) => updateQuery({ modifier: event.target.value })}
              className="min-h-11 w-full rounded-md border border-zinc-700 bg-zinc-950/55 px-3 py-2 text-base text-zinc-200 outline-none transition-colors focus:border-[color:var(--guide-accent)]"
            >
              <option value="">全部类型</option>
              {modifierOptions.map((modifier) => (
                <option key={modifier.id} value={modifier.id}>
                  {modifier.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>

      <p aria-live="polite" className="mb-2 text-xs tabular-nums text-zinc-500">
        {resultCount} 个结果
      </p>

      {resultCount > 0 ? (
        <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-700 bg-zinc-900/55">
          {view === "providers"
            ? providerItems.map((relations) => {
                const relation = relations[0];
                return (
                  <li key={relation.sourceHref}>
                    <Link
                      href={relation.sourceHref ?? "#"}
                      className="flex min-h-14 items-center justify-between gap-3 px-3 py-2 transition-colors hover:bg-zinc-800/70 focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-4"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-zinc-100">
                          {relation.effectLabel}
                        </span>
                        <span className="mt-0.5 block text-xs text-zinc-500">
                          {sourceTypeLabel(relation)} · {[...new Set(relations.map((item) => item.modifierTypeLabel))].join("、")}
                        </span>
                      </span>
                      <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-zinc-500" />
                    </Link>
                  </li>
                );
              })
            : targetItems.map((target) => (
                <li key={target.id}>
                  <Link
                    href={target.href}
                    className="flex min-h-14 items-center justify-between gap-3 px-3 py-2 transition-colors hover:bg-zinc-800/70 focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-4"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-zinc-100">
                        {target.sourceLabel}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-zinc-500">
                        武器 · {target.label}
                      </span>
                    </span>
                    <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-zinc-500" />
                  </Link>
                </li>
              ))}
        </ul>
      ) : (
        <div className="rounded-lg border border-dashed border-zinc-700 px-4 py-10 text-center text-sm text-zinc-500">
          当前筛选下没有已核验的来源
        </div>
      )}
    </section>
  );
}
