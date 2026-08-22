"use client";

import {
  Bomb,
  Box,
  Calculator,
  Crosshair,
  Info,
  LocateFixed,
  Sparkles,
  Swords,
  Tag,
  Target,
  Telescope,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { SpriteIcon } from "@/components/SpriteIcon";
import { WEAPON_TYPE_SPRITES } from "@/constants/sprites";
import {
  DEFAULT_MULTIPLIER_FACTOR,
  DILUTION_CATEGORIES,
  MULTIPLIER_FACTOR_DETAILS,
  MULTIPLIER_FACTORS,
  WEAKPOINT_MULTIPLIER_DATA,
  type DilutionIconKey,
  type FactorDetailData,
  type MultiplierFactorId,
  type WeakpointMultiplierData,
} from "@/lib/multiplier-data";
import type { WeaponType } from "@/types";
import type { WeaponBaseDamageEntry } from "@/lib/weapon-base-damage";
import { BaseDamageDetail } from "./BaseDamageDetail";
import { DamageSourcesOverview } from "./DamageSourcesOverview";
import {
  MultiplierBidirectionalIndex,
  type MultiplierTargetIndexEntry,
} from "./MultiplierBidirectionalIndex";

const DEFAULT_FACTOR_ID: MultiplierFactorId = DEFAULT_MULTIPLIER_FACTOR.id;
const DETAIL_PANEL_ID = "multiplier-detail-panel";
const SELECTED_FACTOR_STORAGE_KEY = "nzm-wiki:guides:multiplier:selected-factor";
const SELECTED_FACTOR_CHANGE_EVENT = "nzm-wiki:multiplier-factor-change";
const FORMULA_MULTIPLIER_FACTORS = MULTIPLIER_FACTORS.filter(
  (factor) =>
    factor.id !== "element-vulnerability" &&
    factor.id !== "independent-amplification",
);

type MultiplierPart = "formula" | "damage-sources" | "index";

const MULTIPLIER_PARTS: readonly {
  id: MultiplierPart;
  part: string;
  label: string;
}[] = [
  { id: "formula", part: "Part 1", label: "乘区公式" },
  { id: "damage-sources", part: "Part 2", label: "伤害来源" },
  { id: "index", part: "Part 3", label: "增伤索引" },
];

let inMemorySelectedFactorId = DEFAULT_FACTOR_ID;
let hasInitializedFormulaFactor = false;

function isFormulaFactorId(value: string | null): value is MultiplierFactorId {
  return FORMULA_MULTIPLIER_FACTORS.some((factor) => factor.id === value);
}

function getSelectedFactorSnapshot(): MultiplierFactorId {
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view");
  const rawFactorId = view === "providers" || view === "targets"
    ? null
    : params.get("factor");
  const queryFactorId = rawFactorId === "damage-reduction" ? "vulnerability" : rawFactorId;
  if (isFormulaFactorId(queryFactorId)) {
    inMemorySelectedFactorId = queryFactorId;
    hasInitializedFormulaFactor = true;
    return queryFactorId;
  }
  if (hasInitializedFormulaFactor) return inMemorySelectedFactorId;

  try {
    const storedFactorId = window.localStorage.getItem(SELECTED_FACTOR_STORAGE_KEY);

    if (isFormulaFactorId(storedFactorId)) {
      inMemorySelectedFactorId = storedFactorId;
    } else if (storedFactorId !== null) {
      inMemorySelectedFactorId = DEFAULT_FACTOR_ID;
    }
  } catch {
    // localStorage 不可用时，当前标签页内仍保留选择。
  }

  hasInitializedFormulaFactor = true;
  return inMemorySelectedFactorId;
}

function getServerSelectedFactorSnapshot(): MultiplierFactorId {
  return DEFAULT_FACTOR_ID;
}

function subscribeToSelectedFactor(onStoreChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== SELECTED_FACTOR_STORAGE_KEY) {
      return;
    }

    inMemorySelectedFactorId = isFormulaFactorId(event.newValue)
      ? event.newValue
      : DEFAULT_FACTOR_ID;
    hasInitializedFormulaFactor = true;
    onStoreChange();
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener("popstate", onStoreChange);
  window.addEventListener("nzm-wiki:multiplier-query-change", onStoreChange);
  window.addEventListener(SELECTED_FACTOR_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener("nzm-wiki:multiplier-query-change", onStoreChange);
    window.removeEventListener(SELECTED_FACTOR_CHANGE_EVENT, onStoreChange);
  };
}

function rememberSelectedFactor(factorId: MultiplierFactorId) {
  inMemorySelectedFactorId = factorId;
  hasInitializedFormulaFactor = true;

  try {
    window.localStorage.setItem(SELECTED_FACTOR_STORAGE_KEY, factorId);
  } catch {
    // localStorage 不可用时，当前标签页内仍可正常切换。
  }

  const url = new URL(window.location.href);
  url.searchParams.set("factor", factorId);
  url.searchParams.delete("modifier");
  window.history.pushState(null, "", url);

  window.dispatchEvent(new Event(SELECTED_FACTOR_CHANGE_EVENT));
  window.dispatchEvent(new Event("nzm-wiki:multiplier-query-change"));
}

const DILUTION_ICONS: Record<DilutionIconKey, LucideIcon> = {
  target: Target,
  swords: Swords,
  sparkles: Sparkles,
  "locate-fixed": LocateFixed,
  telescope: Telescope,
  crosshair: Crosshair,
  bomb: Bomb,
};

const DILUTION_EXAMPLE_COUNT = DILUTION_CATEGORIES.reduce(
  (count, category) => count + category.examples.length,
  0,
);

function SectionHeading({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <h3 className="mb-4 flex items-center gap-3 text-base font-semibold tracking-wide text-zinc-100 xl:mb-2">
      <Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-zinc-200" strokeWidth={2} />
      {children}
    </h3>
  );
}

function AttributeName({ name }: { name: string }) {
  const segments = name.split(".");

  return (
    <>
      {segments.map((segment, index) => (
        <span key={`${segment}-${index}`}>
          {segment}
          {index < segments.length - 1 && (
            <>
              .<wbr />
            </>
          )}
        </span>
      ))}
    </>
  );
}

function ExampleCard({
  icon: Icon,
  label,
  href,
}: {
  icon: LucideIcon;
  label: string;
  href?: string;
}) {
  const content = (
    <>
      <Icon aria-hidden="true" className="h-5 w-5 shrink-0" strokeWidth={2} />
      {label}
    </>
  );

  if (!href) {
    return (
      <div className="flex min-h-11 items-center gap-2.5 rounded-lg border border-zinc-700 bg-zinc-800/45 px-3 py-2 text-sm font-medium text-zinc-100 xl:min-h-9 xl:py-1.5">
        {content}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="flex min-h-11 cursor-pointer touch-manipulation items-center gap-2.5 rounded-lg border border-zinc-700 bg-zinc-800/45 px-3 py-2 text-sm font-medium text-zinc-100 transition-colors duration-200 hover:border-zinc-500 hover:bg-zinc-800 hover:text-[color:var(--guide-accent)] focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 motion-reduce:transition-none xl:min-h-9 xl:py-1.5"
    >
      {content}
    </Link>
  );
}

function WeaponTypeItem({ weaponType }: { weaponType: WeaponType }) {
  return (
    <li
      data-weapon-type={weaponType}
      className="flex min-w-0 flex-col items-center justify-center gap-1 text-center text-sm font-medium text-zinc-100 sm:w-auto sm:flex-row sm:justify-start sm:gap-2 sm:text-left"
    >
      <span
        aria-hidden="true"
        className="flex h-7 w-10 shrink-0 items-center justify-center sm:h-8"
      >
        <SpriteIcon
          sprite={WEAPON_TYPE_SPRITES[weaponType]}
          size={40}
          className="max-h-8 max-w-10"
        />
      </span>
      <span className="min-w-0 leading-5 sm:whitespace-nowrap">{weaponType}</span>
    </li>
  );
}

function WeakpointMultiplierRow({
  multiplier,
  children,
}: {
  multiplier: number;
  children: React.ReactNode;
}) {
  return (
    <li className="grid grid-cols-[4.5rem_minmax(0,1fr)] border-b border-zinc-700/80 last:border-b-0 sm:grid-cols-[6.5rem_minmax(0,1fr)]">
      <div className="flex flex-col justify-center border-r border-zinc-700/80 px-3 py-4 sm:px-4">
        <span className="font-mono text-lg font-bold leading-none tabular-nums text-[color:var(--guide-accent)]">
          {multiplier.toFixed(1)}×
        </span>
      </div>
      <div className="min-w-0 px-3 py-3 sm:px-5">
        {children}
      </div>
    </li>
  );
}

function WeakpointWeaponTable({
  detail,
}: {
  detail: WeakpointMultiplierData;
}) {
  return (
    <ol className="border-y border-zinc-700/80">
      {detail.groups.map(({ multiplier, weaponTypes }) => (
        <WeakpointMultiplierRow key={multiplier} multiplier={multiplier}>
          <ul className="grid min-h-8 grid-cols-2 items-center gap-x-4 gap-y-3 sm:flex sm:flex-wrap sm:gap-x-7 sm:gap-y-2">
            {weaponTypes.map((weaponType) => (
              <WeaponTypeItem key={weaponType} weaponType={weaponType} />
            ))}
          </ul>
        </WeakpointMultiplierRow>
      ))}

      <WeakpointMultiplierRow
        multiplier={detail.specialSources.multiplier}
      >
        <ul className="flex min-h-8 flex-col justify-center gap-x-8 gap-y-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-start sm:gap-y-2">
          {detail.specialSources.items.map(({ id, label, icon, href }) => {
            const Icon = DILUTION_ICONS[icon];

            return (
              <li key={id}>
                <Link
                  href={href}
                  className="inline-flex min-h-8 cursor-pointer touch-manipulation items-center gap-2 text-sm font-medium text-zinc-100 transition-colors duration-200 hover:text-[color:var(--guide-accent)] focus-visible:outline-none focus-visible:text-[color:var(--guide-accent)] focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 motion-reduce:transition-none"
                >
                  <Icon
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-zinc-400"
                    strokeWidth={2}
                  />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </WeakpointMultiplierRow>

      <li className="border-b border-zinc-700/80 py-2 pr-3 pl-[5.25rem] text-xs leading-5 text-zinc-400 sm:pl-[7.75rem]">
        注：{detail.specialSources.note}
      </li>
    </ol>
  );
}

function WeakpointRules({ detail }: { detail: WeakpointMultiplierData }) {
  return (
    <>
      <SectionHeading icon={Calculator}>计算规则</SectionHeading>
      <p className="mb-5 text-sm leading-7 text-[color:var(--guide-muted)] sm:text-base xl:mb-3 xl:text-sm xl:leading-6">
        弱点倍率由伤害来源的数值配置决定，命中有效弱点时按对应倍率参与伤害结算。
      </p>

      <div className="rounded-lg border border-zinc-700 bg-zinc-800/45 p-4 text-sm leading-6 text-zinc-300 xl:p-3">
        <h4 className="mb-2 font-semibold text-zinc-100 xl:mb-1">
          倍率公式
        </h4>
        <p className="font-mono text-xs leading-5 text-zinc-200">
          弱点倍率 = <AttributeName name={detail.formula} />
        </p>

        <h4 className="mt-4 mb-2 font-semibold text-zinc-100 xl:mt-3 xl:mb-1">
          数值字段
        </h4>
        <p className="font-mono text-xs leading-5 text-zinc-200">
          <AttributeName name={detail.scaleField} />
        </p>

        <h4 className="mt-4 mb-2 font-semibold text-zinc-100 xl:mt-3 xl:mb-1">
          生效条件
        </h4>
        <p className="font-mono text-xs leading-5 text-zinc-200">
          <AttributeName name={detail.enableField} /> = true
        </p>
      </div>
    </>
  );
}

function WeakpointMultiplierDetail({
  detail,
}: {
  detail: WeakpointMultiplierData;
}) {
  return (
    <>
      <div className="grid xl:grid-cols-[minmax(16rem,0.85fr)_minmax(0,2.15fr)]">
        <section className="border-b border-zinc-700 p-5 sm:p-6 xl:border-r xl:border-b-0 xl:p-4">
          <WeakpointRules detail={detail} />
        </section>

        <section className="p-5 sm:p-6 xl:p-4">
          <SectionHeading icon={Crosshair}>武器类型倍率</SectionHeading>
          <WeakpointWeaponTable detail={detail} />
        </section>
      </div>

      <footer className="flex items-start justify-center gap-2 border-t border-zinc-700 px-5 py-4 text-center text-xs leading-5 text-zinc-400 sm:text-sm xl:py-2">
        <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          以上为武器类型默认值与已确认的 1.0× 来源；武器技能、额外模式或特殊伤害事件以自身数值配置为准。
        </p>
      </footer>
    </>
  );
}

function FactorDetail({ detail }: { detail: FactorDetailData }) {
  const [selectedSelectionId, setSelectedSelectionId] = useState<string | null>(null);
  const selectionOptions = detail.attributeFields.flatMap(({ selection }) =>
    selection ? [selection] : [],
  );
  const hasSelectableExamples = detail.examples.some(
    ({ selectionId }) => selectionId !== undefined,
  );
  const visibleExamples = hasSelectableExamples
    ? selectedSelectionId
      ? detail.examples.filter(
          ({ selectionId }) => selectionId === selectedSelectionId,
        )
      : selectionOptions.flatMap(({ id }) => {
          const preview = detail.examples.find(
            ({ selectionId }) => selectionId === id,
          );
          return preview ? [preview] : [];
        })
    : detail.examples;

  const toggleSelection = (selectionId: string) => {
    setSelectedSelectionId((currentSelectionId) =>
      currentSelectionId === selectionId ? null : selectionId,
    );
  };

  return (
    <>
      <div className="grid md:grid-cols-2 xl:grid-cols-[1.15fr_0.8fr_0.9fr_1.65fr]">
        <section className="border-b border-zinc-700 p-5 sm:p-6 md:border-r xl:border-b-0 xl:p-4">
          <SectionHeading icon={Calculator}>计算规则</SectionHeading>
          <p className="mb-5 text-sm leading-7 text-[color:var(--guide-muted)] sm:text-base xl:mb-3 xl:text-sm xl:leading-6">
            {detail.summary}
          </p>

          <div className="rounded-lg border border-zinc-700 bg-zinc-800/45 p-4 text-sm leading-6 text-zinc-300 xl:p-3">
            <h4 className="mb-2 font-semibold text-zinc-100 xl:mb-1">
              {detail.rulesHeading}
            </h4>
            <ul className="list-disc space-y-1 pl-5 text-[color:var(--guide-muted)] xl:space-y-0">
              {detail.rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-b border-zinc-700 p-5 sm:p-6 xl:border-r xl:border-b-0 xl:p-4">
          <div className="flex items-start justify-between gap-4">
            <SectionHeading icon={Box}>典型案例</SectionHeading>
            <span
              aria-live="polite"
              className="shrink-0 text-xs leading-5 text-zinc-400"
            >
              {hasSelectableExamples
                ? `${visibleExamples.length} / ${detail.examples.length}`
                : detail.examples.length}
            </span>
          </div>

          {visibleExamples.length > 0 ? (
            <ul className="space-y-2 xl:space-y-1.5">
              {visibleExamples.map(({ id, label, href, icon }) => (
                <li key={id}>
                  <ExampleCard
                    icon={DILUTION_ICONS[icon]}
                    label={label}
                    href={href}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-zinc-700 bg-zinc-800/25 px-3 py-4 text-center text-sm text-[color:var(--guide-muted)]">
              暂未收录典型案例
            </p>
          )}
        </section>

        <section className="border-b border-zinc-700 p-5 sm:p-6 md:border-r md:border-b-0 xl:p-4">
          <SectionHeading icon={Users}>增伤对象</SectionHeading>
          {selectionOptions.length === 0 && (
            <div className="rounded-lg border border-zinc-700 bg-zinc-800/45 px-3 py-2 text-sm leading-6 text-zinc-100">
              {detail.target}
            </div>
          )}
          {selectionOptions.length > 0 && (
            <div
              className="flex flex-wrap gap-2 xl:gap-1.5"
              role="group"
              aria-label={`按${detail.target}筛选`}
            >
              {selectionOptions.map(({ id, label }) => {
                const active = selectedSelectionId === id;

                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleSelection(id)}
                    className={`min-h-11 cursor-pointer touch-manipulation rounded-md border px-3 py-2 text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 motion-reduce:transition-none xl:min-h-8 xl:py-1 ${
                      active
                        ? "border-[color:var(--guide-accent)] bg-[color:var(--guide-accent-soft)] text-[color:var(--guide-accent)]"
                        : "border-zinc-600 bg-zinc-800/55 text-zinc-100 hover:border-zinc-400"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
          {detail.targetNote && (
            <p className="mt-3 text-xs leading-5 text-[color:var(--guide-muted)]">
              {detail.targetNote}
            </p>
          )}
        </section>

        <section className="p-5 sm:p-6 xl:p-4">
          <SectionHeading icon={Tag}>属性字段</SectionHeading>
          <div className="space-y-2 xl:space-y-1">
            {detail.attributeFields.map(({ name, note, selection }) => {
              const content = (
                <>
                  <AttributeName name={name} />
                  {note && (
                    <span className="mt-1 block font-sans text-xs leading-5 text-[color:var(--guide-muted)]">
                      {note}
                    </span>
                  )}
                </>
              );

              if (!selection) {
                return (
                  <div
                    key={name}
                    className="min-h-11 rounded-lg border border-zinc-700 bg-zinc-800/45 px-3 py-2 text-left font-mono text-xs leading-5 text-zinc-200 xl:min-h-8 xl:px-2 xl:py-1.5"
                  >
                    {content}
                  </div>
                );
              }

              const active = selectedSelectionId === selection.id;

              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleSelection(selection.id)}
                  className={`min-h-11 w-full cursor-pointer touch-manipulation rounded-lg border px-3 py-2 text-left font-mono text-xs leading-5 transition-colors duration-200 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 motion-reduce:transition-none xl:min-h-8 xl:px-2 xl:py-1.5 ${
                    active
                      ? "border-[color:var(--guide-accent)] bg-[color:var(--guide-accent-soft)] text-[color:var(--guide-accent)]"
                      : "border-zinc-700 bg-zinc-800/45 text-zinc-200 hover:border-zinc-500"
                  }`}
                >
                  {content}
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <footer className="flex items-start justify-center gap-2 border-t border-zinc-700 px-5 py-4 text-center text-xs leading-5 text-zinc-400 sm:text-sm xl:py-2">
        <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{detail.notice}</p>
      </footer>
    </>
  );
}

type FormulaProps = {
  selectedFactorId: MultiplierFactorId;
  onSelectFactor: (factorId: MultiplierFactorId) => void;
};

function DesktopFormula({ selectedFactorId, onSelectFactor }: FormulaProps) {
  const formulaRef = useRef<HTMLDivElement>(null);
  const firstNodeRef = useRef<HTMLSpanElement>(null);
  const lastNodeRef = useRef<HTMLSpanElement>(null);
  const [rail, setRail] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const formula = formulaRef.current;
    const firstNode = firstNodeRef.current;
    const lastNode = lastNodeRef.current;
    if (!formula || !firstNode || !lastNode) return;

    const updateRail = () => {
      const formulaRect = formula.getBoundingClientRect();
      const firstNodeRect = firstNode.getBoundingClientRect();
      const lastNodeRect = lastNode.getBoundingClientRect();
      const left = firstNodeRect.left + firstNodeRect.width / 2 - formulaRect.left;
      const right = lastNodeRect.left + lastNodeRect.width / 2 - formulaRect.left;
      const nextRail = { left, width: right - left };

      setRail((currentRail) =>
        currentRail &&
        Math.abs(currentRail.left - nextRail.left) < 0.5 &&
        Math.abs(currentRail.width - nextRail.width) < 0.5
          ? currentRail
          : nextRail,
      );
    };

    updateRail();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateRail);
      return () => window.removeEventListener("resize", updateRail);
    }

    const resizeObserver = new ResizeObserver(updateRail);
    resizeObserver.observe(formula);
    resizeObserver.observe(firstNode);
    resizeObserver.observe(lastNode);
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div
      ref={formulaRef}
      className="relative hidden h-[82px] xl:block"
      role="group"
      aria-label="选择乘区查看详情"
    >
      <div className="absolute inset-x-0 top-0 flex items-start gap-3">
        {FORMULA_MULTIPLIER_FACTORS.map((factor, index) => {
          const selected = selectedFactorId === factor.id;

          return (
            <div key={factor.id} className="contents">
              <div className="relative h-[82px] min-w-0 flex-1">
                <button
                  type="button"
                  aria-expanded={selected}
                  aria-controls={DETAIL_PANEL_ID}
                  onClick={() => onSelectFactor(factor.id)}
                  className={`flex h-12 w-full cursor-pointer touch-manipulation items-center justify-center rounded-[10px] border px-3 text-center text-sm font-semibold tracking-wide shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] transition-colors duration-200 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 motion-reduce:transition-none ${
                    selected
                      ? "border-[color:var(--guide-accent)] bg-[linear-gradient(135deg,rgba(217,164,62,0.24),rgba(85,66,29,0.18))] text-[color:var(--guide-accent)]"
                      : "border-zinc-600 bg-[linear-gradient(145deg,rgba(31,33,35,0.92),rgba(20,22,24,0.92))] text-zinc-200 hover:border-zinc-400 hover:bg-zinc-800"
                  }`}
                >
                  {factor.label}
                </button>

                <span
                  ref={
                    index === 0
                      ? firstNodeRef
                      : index === FORMULA_MULTIPLIER_FACTORS.length - 1
                        ? lastNodeRef
                        : undefined
                  }
                  className={`absolute left-1/2 top-[56px] z-10 h-3.5 w-3.5 -translate-x-1/2 rounded-full border ${
                    selected
                      ? "border-[color:var(--guide-accent)] bg-[#111416]"
                      : "border-zinc-400 bg-[#111416]"
                  }`}
                >
                  <span
                    className={`absolute inset-[3px] rounded-full ${
                      selected ? "bg-[color:var(--guide-accent)]" : "bg-zinc-400"
                    }`}
                  />
                </span>

                <span
                  className={`absolute left-1/2 top-[69px] z-0 w-px -translate-x-1/2 ${
                    selected
                      ? "bottom-[-12px] bg-[color:var(--guide-accent)]"
                      : "bottom-0 bg-zinc-500"
                  }`}
                />
              </div>

              {index < FORMULA_MULTIPLIER_FACTORS.length - 1 && (
                <span aria-hidden="true" className="mt-2.5 shrink-0 text-2xl font-light text-zinc-200">
                  ×
                </span>
              )}
            </div>
          );
        })}
      </div>
      {rail && (
        <div
          className="absolute bottom-0 h-px bg-zinc-500"
          style={{ left: rail.left, width: rail.width }}
        />
      )}
    </div>
  );
}

function CompactFormula({ selectedFactorId, onSelectFactor }: FormulaProps) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 xl:hidden" aria-label="伤害乘区公式">
      {FORMULA_MULTIPLIER_FACTORS.map((factor, index) => {
        const selected = selectedFactorId === factor.id;

        return (
          <li key={factor.id} className="flex min-w-0 items-center gap-2">
            {index > 0 && (
              <span aria-hidden="true" className="text-lg text-zinc-400">
                ×
              </span>
            )}
            <button
              type="button"
              aria-expanded={selected}
              aria-controls={DETAIL_PANEL_ID}
              onClick={() => onSelectFactor(factor.id)}
              className={`inline-flex min-h-11 cursor-pointer touch-manipulation items-center rounded-lg border px-3 py-2 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 motion-reduce:transition-none ${
                selected
                  ? "border-[color:var(--guide-accent)] bg-[color:var(--guide-accent-soft)] text-[color:var(--guide-accent)]"
                  : "border-zinc-700 bg-zinc-900/70 text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800"
              }`}
            >
              {factor.label}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function MultiplierOverview({
  baseDamageEntries,
  targets,
}: {
  baseDamageEntries: readonly WeaponBaseDamageEntry[];
  targets: readonly MultiplierTargetIndexEntry[];
}) {
  const selectedFactorId = useSyncExternalStore(
    subscribeToSelectedFactor,
    getSelectedFactorSnapshot,
    getServerSelectedFactorSnapshot,
  );
  const [selectedFilterId, setSelectedFilterId] = useState<string | null>(null);
  const [activePart, setActivePart] = useState<MultiplierPart>("formula");

  useEffect(() => {
    const syncPartFromQuery = () => {
      const params = new URLSearchParams(window.location.search);
      const part = params.get("part");
      const view = params.get("view");
      setActivePart(
        part === "damage-sources"
          ? "damage-sources"
          : view === "providers" || view === "targets"
            ? "index"
            : "formula",
      );
    };
    syncPartFromQuery();
    window.addEventListener("popstate", syncPartFromQuery);
    window.addEventListener("nzm-wiki:multiplier-query-change", syncPartFromQuery);
    return () => {
      window.removeEventListener("popstate", syncPartFromQuery);
      window.removeEventListener("nzm-wiki:multiplier-query-change", syncPartFromQuery);
    };
  }, []);
  const selectedFactor =
    MULTIPLIER_FACTORS.find((factor) => factor.id === selectedFactorId) ??
    DEFAULT_MULTIPLIER_FACTOR;
  const selectedFactorDetail = MULTIPLIER_FACTOR_DETAILS[selectedFactorId];
  const filteredCategories = selectedFilterId
    ? DILUTION_CATEGORIES.filter((item) => item.id === selectedFilterId)
    : DILUTION_CATEGORIES;
  const visibleExamples = filteredCategories.flatMap(({ id, icon, examples }) =>
    (selectedFilterId ? examples : examples.slice(0, 1)).map((example) => ({
      id: `${id}-${example.id}`,
      icon: DILUTION_ICONS[icon],
      label: example.label,
      href: example.href,
    })),
  );

  const toggleFilter = (filterId: string) => {
    setSelectedFilterId((currentFilterId) =>
      currentFilterId === filterId ? null : filterId,
    );
  };

  const selectPart = (part: MultiplierPart) => {
    const url = new URL(window.location.href);
    if (part === "index") {
      url.searchParams.delete("part");
      if (!url.searchParams.has("view")) url.searchParams.set("view", "providers");
      url.searchParams.delete("factor");
      url.searchParams.delete("modifier");
    } else if (part === "damage-sources") {
      url.searchParams.set("part", "damage-sources");
      url.searchParams.delete("view");
      url.searchParams.delete("factor");
      url.searchParams.delete("modifier");
    } else {
      url.searchParams.delete("part");
      url.searchParams.delete("view");
      url.searchParams.delete("modifier");
      url.searchParams.set("factor", selectedFactorId);
    }
    window.history.pushState(null, "", url);
    setActivePart(part);
    window.dispatchEvent(new Event("nzm-wiki:multiplier-query-change"));
  };

  return (
    <div className="text-[color:var(--guide-text)]">
      <nav
        aria-label="游戏乘区分篇"
        className="mx-auto mb-5 grid max-w-2xl grid-cols-3 rounded-lg border border-zinc-700 bg-zinc-900/75 p-1 xl:mb-3"
      >
        {MULTIPLIER_PARTS.map((item) => {
          const active = activePart === item.id;

          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              onClick={() => selectPart(item.id)}
              className={`min-h-11 cursor-pointer touch-manipulation rounded-md border px-3 py-2 transition-colors duration-200 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 motion-reduce:transition-none ${
                active
                  ? "border-[color:var(--guide-accent)] bg-[color:var(--guide-accent-soft)] text-[color:var(--guide-accent)]"
                  : "border-transparent text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              }`}
            >
              <span className="block text-[10px] font-semibold uppercase leading-4 text-current">
                {item.part}
              </span>
              <span className="block text-sm font-semibold leading-5">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {activePart === "damage-sources" ? (
        <DamageSourcesOverview />
      ) : activePart === "index" ? (
        <MultiplierBidirectionalIndex targets={targets} />
      ) : (
      <section aria-labelledby="damage-formula-heading">
        <h2 id="damage-formula-heading" className="mb-4 text-2xl font-bold tracking-wide text-zinc-100 xl:mb-2 xl:text-xl">
          伤害公式总览
        </h2>

        <CompactFormula
          selectedFactorId={selectedFactorId}
          onSelectFactor={rememberSelectedFactor}
        />
        <DesktopFormula
          selectedFactorId={selectedFactorId}
          onSelectFactor={rememberSelectedFactor}
        />

        <article
          id={DETAIL_PANEL_ID}
          className="mt-5 overflow-hidden rounded-xl border border-zinc-600 bg-[linear-gradient(145deg,rgba(18,21,23,0.97),rgba(12,15,17,0.98))] shadow-[0_24px_60px_rgba(0,0,0,0.2)] xl:mt-3"
        >
          <header className="border-b border-zinc-700 px-5 py-4 sm:px-6 xl:py-2.5">
            <h2
              id={`${selectedFactor.id}-detail-heading`}
              className="text-2xl font-bold tracking-wide text-[color:var(--guide-accent)] xl:text-xl"
            >
              {selectedFactor.label}
            </h2>
          </header>

          {selectedFactorId === "base" ? (
            <BaseDamageDetail entries={baseDamageEntries} />
          ) : selectedFactorId === "weakpoint-multiplier" ? (
            <WeakpointMultiplierDetail detail={WEAKPOINT_MULTIPLIER_DATA} />
          ) : selectedFactorId === "dilution" ? (
            <>
              <div className="grid md:grid-cols-2 xl:grid-cols-[1.15fr_0.8fr_0.9fr_1.65fr]">
                <section className="border-b border-zinc-700 p-5 sm:p-6 md:border-r xl:border-b-0 xl:p-4">
                  <SectionHeading icon={Calculator}>计算规则</SectionHeading>
                  <p className="mb-5 text-sm leading-7 text-[color:var(--guide-muted)] sm:text-base xl:mb-3 xl:text-sm xl:leading-6">
                    该乘区为多个可叠加的稀释类增伤来源，与其他乘区相乘，最终影响结算伤害。
                  </p>

                  <div className="rounded-lg border border-zinc-700 bg-zinc-800/45 p-4 text-sm leading-6 text-zinc-300 xl:p-3">
                    <h4 className="mb-2 font-semibold text-zinc-100 xl:mb-1">乘区关系</h4>
                    <p className="font-mono text-xs leading-6 text-zinc-200 sm:text-sm xl:text-xs xl:leading-5">
                      最终伤害 = 基础伤害 × 其他乘区 × 大稀释乘区
                    </p>

                    <h4 className="mt-4 mb-2 font-semibold text-zinc-100 xl:mt-2 xl:mb-1">叠加规则</h4>
                    <ul className="list-disc space-y-1 pl-5 text-[color:var(--guide-muted)] xl:space-y-0">
                      <li>同类效果按加法计算后再乘入该乘区</li>
                      <li>与其他乘区独立相乘</li>
                    </ul>
                  </div>
                </section>

                <section className="border-b border-zinc-700 p-5 sm:p-6 xl:border-r xl:border-b-0 xl:p-4">
                  <div className="flex items-start justify-between gap-4">
                    <SectionHeading icon={Box}>典型案例</SectionHeading>
                    <span
                      aria-live="polite"
                      className="shrink-0 text-xs leading-5 text-zinc-400"
                    >
                      {visibleExamples.length} / {DILUTION_EXAMPLE_COUNT}
                    </span>
                  </div>

                  <ul className="space-y-2 xl:space-y-1.5">
                    {visibleExamples.map(({ id, label, href, icon }) => (
                      <li key={id}>
                        <ExampleCard icon={icon} label={label} href={href} />
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="border-b border-zinc-700 p-5 sm:p-6 md:border-r md:border-b-0 xl:p-4">
                  <SectionHeading icon={Users}>增伤对象</SectionHeading>
                  <div className="flex flex-wrap gap-2 xl:gap-1.5" role="group" aria-label="按增伤对象筛选典型案例">
                    {DILUTION_CATEGORIES.map(({ id, target }) => {
                      const active = selectedFilterId === id;

                      return (
                        <button
                          key={id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => toggleFilter(id)}
                          className={`min-h-11 cursor-pointer touch-manipulation rounded-md border px-3 py-2 text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 motion-reduce:transition-none xl:min-h-8 xl:py-1 ${
                            active
                              ? "border-[color:var(--guide-accent)] bg-[color:var(--guide-accent-soft)] text-[color:var(--guide-accent)]"
                              : "border-zinc-600 bg-zinc-800/55 text-zinc-100 hover:border-zinc-400"
                          }`}
                        >
                          {target}
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="p-5 sm:p-6 xl:p-4">
                  <SectionHeading icon={Tag}>属性字段</SectionHeading>
                  <div className="space-y-2 xl:space-y-1" role="group" aria-label="按属性字段筛选典型案例">
                    {DILUTION_CATEGORIES.map(({ id, attributeField }) => {
                      const active = selectedFilterId === id;

                      return (
                        <button
                          key={id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => toggleFilter(id)}
                          className={`min-h-11 w-full cursor-pointer touch-manipulation rounded-lg border px-3 py-2 text-left font-mono text-xs leading-4 transition-colors duration-200 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 motion-reduce:transition-none xl:min-h-8 xl:px-2 xl:py-1 ${
                            active
                              ? "border-[color:var(--guide-accent)] bg-[color:var(--guide-accent-soft)] text-[color:var(--guide-accent)]"
                              : "border-zinc-700 bg-zinc-800/45 text-zinc-200 hover:border-zinc-500"
                          }`}
                        >
                          <AttributeName name={attributeField} />
                        </button>
                      );
                    })}
                  </div>
                </section>
              </div>

              <footer className="flex items-start justify-center gap-2 border-t border-zinc-700 px-5 py-4 text-center text-xs leading-5 text-zinc-400 sm:text-sm xl:py-2">
                <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                <p>提示：实际生效以战斗结算为准，部分来源受触发条件限制。</p>
              </footer>
            </>
          ) : selectedFactorDetail ? (
            <FactorDetail key={selectedFactorId} detail={selectedFactorDetail} />
          ) : (
            <div className="flex min-h-52 items-center justify-center px-5 py-10 text-center xl:min-h-[338px]">
              <div className="max-w-md">
                <Info
                  aria-hidden="true"
                  className="mx-auto mb-4 h-7 w-7 text-[color:var(--guide-accent)]"
                  strokeWidth={1.75}
                />
                <h3 className="text-lg font-semibold text-zinc-100">详情整理中</h3>
                <p className="mt-2 text-sm leading-6 text-[color:var(--guide-muted)]">
                  该乘区的计算规则、筛选条件与典型案例将在实测核验后补充。
                </p>
              </div>
            </div>
          )}
        </article>
      </section>
      )}
    </div>
  );
}
