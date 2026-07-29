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
  TriangleAlert,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import {
  DEFAULT_MULTIPLIER_FACTOR,
  DILUTION_CATEGORIES,
  MULTIPLIER_FACTORS,
  SPECIAL_CORRECTION,
  type DilutionIconKey,
  type MultiplierFactorId,
} from "@/lib/multiplier-data";

const DEFAULT_FACTOR_ID: MultiplierFactorId = DEFAULT_MULTIPLIER_FACTOR.id;
const DETAIL_PANEL_ID = "multiplier-detail-panel";
const SELECTED_FACTOR_STORAGE_KEY = "nzm-wiki:guides:multiplier:selected-factor";
const SELECTED_FACTOR_CHANGE_EVENT = "nzm-wiki:multiplier-factor-change";

let inMemorySelectedFactorId = DEFAULT_FACTOR_ID;

function isMultiplierFactorId(value: string | null): value is MultiplierFactorId {
  return MULTIPLIER_FACTORS.some((factor) => factor.id === value);
}

function getSelectedFactorSnapshot(): MultiplierFactorId {
  try {
    const storedFactorId = window.localStorage.getItem(SELECTED_FACTOR_STORAGE_KEY);

    if (isMultiplierFactorId(storedFactorId)) {
      inMemorySelectedFactorId = storedFactorId;
    } else if (storedFactorId !== null) {
      inMemorySelectedFactorId = DEFAULT_FACTOR_ID;
    }
  } catch {
    // localStorage 不可用时，当前标签页内仍保留选择。
  }

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

    inMemorySelectedFactorId = isMultiplierFactorId(event.newValue)
      ? event.newValue
      : DEFAULT_FACTOR_ID;
    onStoreChange();
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(SELECTED_FACTOR_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(SELECTED_FACTOR_CHANGE_EVENT, onStoreChange);
  };
}

function rememberSelectedFactor(factorId: MultiplierFactorId) {
  inMemorySelectedFactorId = factorId;

  try {
    window.localStorage.setItem(SELECTED_FACTOR_STORAGE_KEY, factorId);
  } catch {
    // localStorage 不可用时，当前标签页内仍可正常切换。
  }

  window.dispatchEvent(new Event(SELECTED_FACTOR_CHANGE_EVENT));
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

type FormulaProps = {
  selectedFactorId: MultiplierFactorId;
  onSelectFactor: (factorId: MultiplierFactorId) => void;
};

function DesktopFormula({ selectedFactorId, onSelectFactor }: FormulaProps) {
  return (
    <div
      className="relative hidden h-[82px] xl:block"
      role="group"
      aria-label="选择乘区查看详情"
    >
      <div className="absolute inset-x-0 top-0 flex items-start gap-3">
        {MULTIPLIER_FACTORS.map((factor, index) => {
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

              {index < MULTIPLIER_FACTORS.length - 1 && (
                <span aria-hidden="true" className="mt-2.5 shrink-0 text-2xl font-light text-zinc-200">
                  ×
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="absolute right-[4.5%] bottom-0 left-[4.5%] h-px bg-zinc-500" />
    </div>
  );
}

function CompactFormula({ selectedFactorId, onSelectFactor }: FormulaProps) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 xl:hidden" aria-label="伤害乘区公式">
      {MULTIPLIER_FACTORS.map((factor, index) => {
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

export function MultiplierOverview() {
  const selectedFactorId = useSyncExternalStore(
    subscribeToSelectedFactor,
    getSelectedFactorSnapshot,
    getServerSelectedFactorSnapshot,
  );
  const [selectedFilterId, setSelectedFilterId] = useState<string | null>(null);
  const selectedFactor =
    MULTIPLIER_FACTORS.find((factor) => factor.id === selectedFactorId) ??
    DEFAULT_MULTIPLIER_FACTOR;
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

  return (
    <div className="text-[color:var(--guide-text)]">
      <aside
        className="mb-7 flex min-h-14 items-center gap-3 rounded-lg border border-[color:var(--guide-warning-border)] bg-[linear-gradient(90deg,rgba(151,105,31,0.13),rgba(151,105,31,0.06))] px-4 py-3 text-[color:var(--guide-accent)] sm:px-5 xl:mb-3 xl:min-h-12 xl:py-2"
        aria-label="内容状态"
      >
        <TriangleAlert aria-hidden="true" className="h-6 w-6 shrink-0" strokeWidth={2} />
        <p className="text-sm font-semibold tracking-[0.12em] sm:text-base">
          阶段性整理 <span aria-hidden="true" className="px-1.5">·</span> 分类待实测核验
        </p>
      </aside>

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

          {selectedFactorId === "dilution" ? (
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
          ) : selectedFactorId === "correction" ? (
            <>
              <div className="grid md:grid-cols-2 xl:grid-cols-[1.15fr_0.8fr_0.9fr_1.65fr]">
                <section className="border-b border-zinc-700 p-5 sm:p-6 md:border-r xl:border-b-0 xl:p-4">
                  <SectionHeading icon={Calculator}>计算规则</SectionHeading>
                  <p className="mb-5 text-sm leading-7 text-[color:var(--guide-muted)] sm:text-base xl:mb-3 xl:text-sm xl:leading-6">
                    {SPECIAL_CORRECTION.summary}
                  </p>

                  <div className="rounded-lg border border-zinc-700 bg-zinc-800/45 p-4 text-sm leading-6 text-zinc-300 xl:p-3">
                    <h4 className="mb-2 font-semibold text-zinc-100 xl:mb-1">作用方式</h4>
                    <ul className="list-disc space-y-1 pl-5 text-[color:var(--guide-muted)] xl:space-y-0">
                      {SPECIAL_CORRECTION.rules.map((rule) => (
                        <li key={rule}>{rule}</li>
                      ))}
                    </ul>
                  </div>
                </section>

                <section className="border-b border-zinc-700 p-5 sm:p-6 xl:border-r xl:border-b-0 xl:p-4">
                  <div className="flex items-start justify-between gap-4">
                    <SectionHeading icon={Box}>典型案例</SectionHeading>
                    <span className="shrink-0 text-xs leading-5 text-zinc-400">
                      {SPECIAL_CORRECTION.examples.length}
                    </span>
                  </div>

                  <ul className="space-y-2 xl:space-y-1.5">
                    {SPECIAL_CORRECTION.examples.map(({ id, label, href, icon }) => (
                      <li key={id}>
                        <ExampleCard
                          icon={DILUTION_ICONS[icon]}
                          label={label}
                          href={href}
                        />
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="border-b border-zinc-700 p-5 sm:p-6 md:border-r md:border-b-0 xl:p-4">
                  <SectionHeading icon={Users}>增伤对象</SectionHeading>
                  <div className="rounded-lg border border-zinc-700 bg-zinc-800/45 px-3 py-2 text-sm leading-6 text-zinc-100">
                    {SPECIAL_CORRECTION.target}
                  </div>
                  <p className="mt-3 text-xs leading-5 text-[color:var(--guide-muted)]">
                    不作为固定筛选条件，需结合具体伤害事件判断。
                  </p>
                </section>

                <section className="p-5 sm:p-6 xl:p-4">
                  <SectionHeading icon={Tag}>属性字段</SectionHeading>
                  <div className="min-h-11 rounded-lg border border-zinc-700 bg-zinc-800/45 px-3 py-2 text-left font-mono text-xs leading-5 text-zinc-200 xl:min-h-8 xl:px-2 xl:py-1.5">
                    <AttributeName name={SPECIAL_CORRECTION.attributeField} />
                  </div>
                </section>
              </div>

              <footer className="flex items-start justify-center gap-2 border-t border-zinc-700 px-5 py-4 text-center text-xs leading-5 text-zinc-400 sm:text-sm xl:py-2">
                <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{SPECIAL_CORRECTION.notice}</p>
              </footer>
            </>
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
    </div>
  );
}
