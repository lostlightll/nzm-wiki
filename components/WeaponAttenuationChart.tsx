"use client";

import { useId, useMemo } from "react";
import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useWeaponDetail } from "@/components/WeaponDetailContext";
import {
  getResolvedFieldValue,
  type ConsumerDamageSource,
  type WeaponDetailData,
} from "@/lib/weapon-consumers";

interface ChartPoint {
  distance: number;
  damage: number;
  percent: number;
}

export interface WeaponAttenuationChartInput {
  baseDamage: number;
  beginMeters: number;
  endMeters: number;
  minScale: number;
  pellets?: number;
}

export function getWeaponAttenuationChartInput(
  weapon: Pick<WeaponDetailData, "table">,
  source: ConsumerDamageSource | undefined,
): WeaponAttenuationChartInput | null {
  if (!source || source.attenuation.status !== "applicable") return null;
  const base = getResolvedFieldValue(source.damage.base);
  if (base === undefined || base <= 0) return null;
  const { beginMeters, endMeters, minScale } = source.attenuation;
  if (endMeters <= beginMeters) return null;
  return {
    baseDamage: base * (weapon.table === "td" ? 400 : 500),
    beginMeters,
    endMeters,
    minScale,
    pellets: getResolvedFieldValue(source.fire.pellets),
  };
}

function formatNumber(value: number, fractionDigits = 1): string {
  return Number(value.toFixed(fractionDigits)).toLocaleString("zh-CN", {
    maximumFractionDigits: fractionDigits,
  });
}

function getScaleAtDistance(
  distance: number,
  begin: number,
  end: number,
  minScale: number,
): number {
  if (distance <= begin) return 1;
  if (distance >= end) return minScale;
  const progress = (distance - begin) / (end - begin);
  return 1 - (1 - minScale) * progress;
}

function getChartMax(end: number): number {
  return Math.max(5, Math.ceil((end + 5) / 5) * 5);
}

function getTicks(max: number): number[] {
  const ticks: number[] = [];
  for (let value = 0; value <= max; value += 5) ticks.push(value);
  return ticks;
}

export function buildWeaponAttenuationChartData(
  input: WeaponAttenuationChartInput,
): ChartPoint[] {
  const maxDistance = getChartMax(input.endMeters);
  const distances = new Set<number>(getTicks(maxDistance));
  distances.add(Number(input.beginMeters.toFixed(3)));
  distances.add(Number(input.endMeters.toFixed(3)));
  return [...distances]
    .sort((left, right) => left - right)
    .map((distance) => {
      const scale = getScaleAtDistance(
        distance,
        input.beginMeters,
        input.endMeters,
        input.minScale,
      );
      return {
        distance,
        damage: input.baseDamage * scale,
        percent: scale * 100,
      };
    });
}

function CustomTooltip({
  active,
  payload,
  pellets,
}: {
  active?: boolean;
  payload?: readonly { payload?: ChartPoint }[];
  pellets?: number;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded border border-zinc-700 bg-zinc-900/95 px-3 py-2 text-xs shadow-lg">
      <p className="text-zinc-400">{formatNumber(point.distance)}m</p>
      <p className="mt-1 text-zinc-100">
        {formatNumber(point.damage)}
        {pellets !== undefined && pellets > 1 ? ` × ${pellets}` : ""}
      </p>
      <p className="text-zinc-500">{formatNumber(point.percent)}%</p>
    </div>
  );
}

export function WeaponAttenuationChart() {
  const gradientId = useId().replace(/:/g, "");
  const { weapon, selectedSource } = useWeaponDetail();
  const input = getWeaponAttenuationChartInput(weapon, selectedSource);
  const chartData = useMemo(
    () => (input ? buildWeaponAttenuationChartData(input) : null),
    [input],
  );
  if (!input || !chartData) return null;

  const xMax = getChartMax(input.endMeters);
  const minDamage = chartData.reduce(
    (minimum, point) => Math.min(minimum, point.damage),
    Infinity,
  );
  const maxDamage = chartData.reduce(
    (maximum, point) => Math.max(maximum, point.damage),
    0,
  );

  return (
    <div className="not-prose my-6 h-72 w-full rounded-lg border border-zinc-700/50 bg-zinc-900/30 p-3 sm:h-80 sm:p-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 8, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="distance"
            type="number"
            domain={[0, xMax]}
            ticks={getTicks(xMax)}
            interval="preserveStartEnd"
            tickFormatter={(value) => `${value}m`}
            stroke="#71717a"
            tick={{ fill: "#a1a1aa", fontSize: 12 }}
            axisLine={{ stroke: "#3f3f46" }}
            tickLine={{ stroke: "#3f3f46" }}
          />
          <YAxis
            dataKey="damage"
            type="number"
            domain={[
              Math.max(0, Math.floor(minDamage * 0.9)),
              Math.ceil(maxDamage * 1.05),
            ]}
            tickFormatter={(value) => formatNumber(Number(value), 0)}
            stroke="#71717a"
            tick={{ fill: "#a1a1aa", fontSize: 12 }}
            axisLine={{ stroke: "#3f3f46" }}
            tickLine={{ stroke: "#3f3f46" }}
            width={42}
          />
          <ReferenceLine
            x={input.beginMeters}
            stroke="#52525b"
            strokeDasharray="4 4"
          />
          <ReferenceLine
            x={input.endMeters}
            stroke="#52525b"
            strokeDasharray="4 4"
          />
          <Tooltip
            content={({ active, payload }) => (
              <CustomTooltip
                active={active}
                payload={payload as readonly { payload?: ChartPoint }[]}
                pellets={input.pellets}
              />
            )}
          />
          <Area
            type="linear"
            dataKey="damage"
            stroke="#38bdf8"
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{
              r: 4,
              fill: "#38bdf8",
              stroke: "#0369a1",
              strokeWidth: 2,
            }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export const AttenuationChart = WeaponAttenuationChart;
