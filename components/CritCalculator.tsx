"use client";

import { useState, useMemo, useCallback, useId } from "react";
import { Minus, Plus } from "lucide-react";

/**
 * 基础暴击计算：给定固定暴击率和暴击伤害，计算期望
 */
function computeBase(critRate: number, critDmg: number) {
  const c = critRate / 100;
  const m = critDmg / 100;
  const expectedShots = c > 0 ? 1 / c : Infinity;
  const dmgMultiplier = 1 + c * (m - 1);
  return { expectedShots, effectiveCrit: c, dmgMultiplier };
}

/**
 * 概率坍缩机制：暴击率逐发递增，暴击后清零
 */
function computeStacking(
  baseCrit: number,
  critDmg: number,
  bonusPerStack: number,
) {
  const base = baseCrit / 100;
  const bonus = bonusPerStack / 100;
  const m = critDmg / 100;

  let expectedShots = 0;
  let survivalProb = 1;

  const maxK = Math.ceil((1 - base) / bonus) + 1;
  for (let k = 1; k <= maxK + 1 && survivalProb > 1e-12; k++) {
    const critRate = Math.min(base + (k - 1) * bonus, 1);
    const pK = survivalProb * critRate;
    expectedShots += k * pK;
    survivalProb *= 1 - critRate;
  }

  if (survivalProb > 1e-12) {
    expectedShots += (maxK + 2) * survivalProb;
  }

  const effectiveCrit = 1 / expectedShots;
  const dmgMultiplier = 1 + effectiveCrit * (m - 1);
  return { expectedShots, effectiveCrit, dmgMultiplier };
}

/**
 * 通用暴击计算器
 *
 * Props:
 * - bonusPerStack: 传入时显示"每层加成"输入，启用叠加计算
 * - 不传时为纯暴击率/暴击伤害的基础计算器
 */
export function CritCalculator({
  bonusPerStack: defaultBonus,
}: {
  bonusPerStack?: number;
} = {}) {
  const hasStacking = defaultBonus !== undefined;

  const [baseCrit, setBaseCrit] = useState(5);
  const [critDmg, setCritDmg] = useState(150);
  const [bonus, setBonus] = useState(defaultBonus ?? 0);

  const baseResult = useMemo(
    () => computeBase(baseCrit, critDmg),
    [baseCrit, critDmg],
  );

  const stackResult = useMemo(
    () =>
      hasStacking && bonus > 0
        ? computeStacking(baseCrit, critDmg, bonus)
        : null,
    [hasStacking, baseCrit, critDmg, bonus],
  );

  // 展示的结果：有叠加机制时用叠加结果，否则用基础结果
  const result = stackResult ?? baseResult;
  const netDmgIncrease =
    stackResult && baseResult.dmgMultiplier > 0
      ? stackResult.dmgMultiplier / baseResult.dmgMultiplier - 1
      : 0;

  // 等效伤害增幅：相比完全不暴击的 DPS 提升
  const dmgBoost = result.dmgMultiplier - 1;

  return (
    <div className="not-prose my-6 rounded-lg border border-zinc-700/80 bg-zinc-900/80 p-4 sm:p-5">
      {/* 输入区 */}
      <div
        className={`grid gap-3 ${hasStacking ? "grid-cols-3" : "grid-cols-2"}`}
      >
        <InputField
          label="基础暴击率"
          unit="%"
          value={baseCrit}
          onChange={setBaseCrit}
          min={0}
          max={100}
          step={5}
        />
        <InputField
          label="暴击伤害"
          unit="%"
          value={critDmg}
          onChange={setCritDmg}
          min={100}
          max={500}
          step={5}
        />
        {hasStacking && (
          <InputField
            label="每层加成"
            unit="%"
            value={bonus}
            onChange={setBonus}
            min={0}
            max={50}
            step={1}
          />
        )}
      </div>

      {/* 分割线 */}
      <div className="my-4 border-t border-zinc-700/60" />

      {/* 输出区 */}
      <div
        className={`grid gap-3 ${hasStacking ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2"}`}
      >
        <ResultCard
          label="期望射击次数"
          value={
            isFinite(result.expectedShots)
              ? result.expectedShots.toFixed(2)
              : "∞"
          }
          unit={isFinite(result.expectedShots) ? "发" : ""}
        />
        {hasStacking && (
          <ResultCard
            label="等效暴击率"
            value={(result.effectiveCrit * 100).toFixed(2)}
            unit="%"
          />
        )}
        <ResultCard
          label="伤害增幅"
          value={(dmgBoost * 100).toFixed(2)}
          unit="%"
        />
        {hasStacking && (
          <ResultCard
            label="插件净增伤"
            value={(netDmgIncrease * 100).toFixed(2)}
            unit="%"
            highlight
          />
        )}
      </div>
    </div>
  );
}

function InputField({
  label,
  unit,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  unit: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const inputId = useId();

  const commit = useCallback(() => {
    if (draft === null) return;
    const v = parseFloat(draft);
    if (!isNaN(v)) {
      onChange(Math.min(Math.max(v, min), max));
    }
    setDraft(null);
  }, [draft, onChange, min, max]);

  return (
    <div>
      <label htmlFor={inputId} className="mb-1.5 block text-xs text-zinc-400">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-md border border-zinc-600/80 bg-zinc-800 text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => onChange(Math.max(value - step, min))}
          disabled={value <= min}
          aria-label={`减少${label}`}
        >
          <Minus className="h-4 w-4" />
        </button>
        <div className="relative flex-1">
          <input
            id={inputId}
            type="number"
            className="min-h-11 w-full appearance-none rounded-md border border-zinc-600/80 bg-zinc-800 py-2 pl-3 pr-7 text-sm tabular-nums text-zinc-100 outline-none transition-colors focus:border-zinc-400 focus-visible:ring-2 focus-visible:ring-sky-400 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
            value={draft ?? value}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
            }}
            min={min}
            max={max}
            step={step}
          />
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
            {unit}
          </span>
        </div>
        <button
          type="button"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-md border border-zinc-600/80 bg-zinc-800 text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => onChange(Math.min(value + step, max))}
          disabled={value >= max}
          aria-label={`增加${label}`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function ResultCard({
  label,
  value,
  unit,
  highlight,
}: {
  label: string;
  value: string;
  unit: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-md border px-3 py-2.5 ${
        highlight
          ? "border-amber-600/40 bg-amber-950/20"
          : "border-zinc-700/60 bg-zinc-800/40"
      }`}
    >
      <div className="text-[11px] text-zinc-500">{label}</div>
      <div
        className={`mt-1 text-lg font-semibold tabular-nums ${
          highlight ? "text-amber-400" : "text-zinc-100"
        }`}
      >
        {value}
        <span className="ml-0.5 text-xs font-normal text-zinc-500">{unit}</span>
      </div>
    </div>
  );
}
