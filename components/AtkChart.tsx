"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  type TooltipContentProps,
} from "recharts";

const RAW_DATA = [
  { level: 0, atkBonus: 0, cost: 0 },
  { level: 1, atkBonus: 25, cost: 400 },
  { level: 2, atkBonus: 50, cost: 900 },
  { level: 3, atkBonus: 75, cost: 1500 },
  { level: 4, atkBonus: 100, cost: 2300 },
  { level: 5, atkBonus: 125, cost: 3300 },
  { level: 6, atkBonus: 150, cost: 4500 },
  { level: 7, atkBonus: 175, cost: 6000 },
  { level: 8, atkBonus: 200, cost: 7800 },
  { level: 9, atkBonus: 225, cost: 9900 },
  { level: 10, atkBonus: 250, cost: 12400 },
  { level: 11, atkBonus: 275, cost: 15300 },
  { level: 12, atkBonus: 300, cost: 18600 },
  { level: 13, atkBonus: 325, cost: 22400 },
  { level: 14, atkBonus: 350, cost: 26700 },
  { level: 15, atkBonus: 375, cost: 31500 },
  { level: 16, atkBonus: 400, cost: 36900 },
  { level: 17, atkBonus: 425, cost: 42900 },
  { level: 18, atkBonus: 450, cost: 49500 },
  { level: 19, atkBonus: 475, cost: 56900 },
  { level: 20, atkBonus: 500, cost: 65100 },
  { level: 21, atkBonus: 550, cost: 74300 },
  { level: 22, atkBonus: 600, cost: 84500 },
  { level: 23, atkBonus: 650, cost: 95900 },
  { level: 24, atkBonus: 700, cost: 108500 },
  { level: 25, atkBonus: 750, cost: 123500 },
  { level: 26, atkBonus: 800, cost: 143300 },
  { level: 27, atkBonus: 1000, cost: 183100 },
  { level: 28, atkBonus: 1200, cost: 242900 },
  { level: 29, atkBonus: 1500, cost: 322700 },
];

const chartData = RAW_DATA.map((d) => ({
  cost: d.cost,
  atk: 1 + d.atkBonus / 100,
  level: d.level,
}));

function formatGold(value: number): string {
  if (value === 0) return "0";
  if (value >= 10000) return `${(value / 10000).toFixed(value % 10000 === 0 ? 0 : 1)}w`;
  return value.toLocaleString();
}

function CustomTooltip({ active, payload }: TooltipContentProps<number, string>) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload as (typeof chartData)[number];
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm shadow-lg">
      <p className="text-zinc-400">
        等级 <span className="text-zinc-200">{data.level}</span>
      </p>
      <p className="text-zinc-400">
        攻击力 <span className="text-blue-400">{data.atk}x</span>
      </p>
      <p className="text-zinc-400">
        累计金币 <span className="text-amber-400">{data.cost.toLocaleString()}</span>
      </p>
    </div>
  );
}

export function AtkChart() {
  return (
    <div className="not-prose my-6 h-72 w-full rounded-xl border border-zinc-700/50 p-3 sm:h-80 sm:p-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="atkGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="atk"
            type="number"
            domain={[1, 16]}
            ticks={[2, 4, 6, 8, 10, 12, 14, 16]}
            stroke="#71717a"
            tick={{ fill: "#a1a1aa", fontSize: 12 }}
            axisLine={{ stroke: "#3f3f46" }}
            tickLine={{ stroke: "#3f3f46" }}
          />
          <YAxis
            dataKey="cost"
            type="number"
            domain={[0, 350000]}
            ticks={[0, 50000, 100000, 150000, 200000, 250000, 300000]}
            tickFormatter={formatGold}
            stroke="#71717a"
            tick={{ fill: "#a1a1aa", fontSize: 12 }}
            axisLine={{ stroke: "#3f3f46" }}
            tickLine={{ stroke: "#3f3f46" }}
            width={42}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="linear"
            dataKey="cost"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#atkGradient)"
            dot={false}
            activeDot={{ r: 4, fill: "#3b82f6", stroke: "#1d4ed8", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
