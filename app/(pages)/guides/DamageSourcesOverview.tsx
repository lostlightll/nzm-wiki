"use client";

import {
  Bomb,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Crosshair,
  GitBranch,
  Link2,
  Minus,
  Search,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

type CoverageStatus = "applies" | "conditional" | "none" | "unknown";
type ModifierKind = "plugin" | "modifier" | "entry";

type DamageType = {
  id: string;
  label: string;
  shortLabel: string;
  family: string;
  code: string;
  summary: string;
  icon: LucideIcon;
};

type CoverageRow = {
  id: string;
  label: string;
  kind: ModifierKind;
  entry: string;
  coverage: Record<string, CoverageStatus>;
};

const DAMAGE_TYPES: readonly DamageType[] = [
  {
    id: "direct-hit",
    label: "枪械直接命中",
    shortLabel: "枪械直击",
    family: "基础射击",
    code: "DirectHit",
    summary: "开火载体接触目标后立即产生的直接伤害。",
    icon: Crosshair,
  },
  {
    id: "weapon-explosion",
    label: "枪械爆炸",
    shortLabel: "枪械爆炸",
    family: "基础射击",
    code: "WeaponExplosion",
    summary: "本次射击的弹体在命中或引爆后产生的范围伤害。",
    icon: Bomb,
  },
  {
    id: "derived-hit",
    label: "派生直接伤害",
    shortLabel: "派生直击",
    family: "派生结算",
    code: "DerivedDirect",
    summary: "由命中、插件或模式额外创建的新伤害实例。",
    icon: GitBranch,
  },
  {
    id: "derived-explosion",
    label: "派生爆炸",
    shortLabel: "派生爆炸",
    family: "派生结算",
    code: "DerivedExplosion",
    summary: "分裂弹、追加弹体等派生对象独立产生的爆炸伤害。",
    icon: Sparkles,
  },
  {
    id: "zone-tick",
    label: "区域周期伤害",
    shortLabel: "区域周期",
    family: "持续与间接",
    code: "ZoneTick",
    summary: "独立区域按固定间隔扫描目标并持续结算的伤害。",
    icon: Clock3,
  },
  {
    id: "status-tick",
    label: "状态周期伤害",
    shortLabel: "状态周期",
    family: "持续与间接",
    code: "StatusTick",
    summary: "状态附着目标后，由 Buff 或 Debuff 生命周期产生的伤害。",
    icon: CircleHelp,
  },
  {
    id: "indirect",
    label: "间接传递伤害",
    shortLabel: "间接传递",
    family: "持续与间接",
    code: "IndirectTransfer",
    summary: "通过链接、共享、复制或转移关系作用到其他目标的伤害。",
    icon: Link2,
  },
];

const COVERAGE_ROWS: readonly CoverageRow[] = [
  {
    id: "weapon-damage",
    label: "常规武器增伤",
    kind: "modifier",
    entry: "Weapon Event V3",
    coverage: {
      "direct-hit": "applies",
      "weapon-explosion": "conditional",
      "derived-hit": "unknown",
      "derived-explosion": "unknown",
      "zone-tick": "none",
      "status-tick": "none",
      indirect: "none",
    },
  },
  {
    id: "explosion-damage",
    label: "爆炸伤害增幅",
    kind: "modifier",
    entry: "Settlement filter",
    coverage: {
      "direct-hit": "none",
      "weapon-explosion": "applies",
      "derived-hit": "none",
      "derived-explosion": "conditional",
      "zone-tick": "none",
      "status-tick": "none",
      indirect: "none",
    },
  },
  {
    id: "skill-damage",
    label: "武器技能增幅",
    kind: "modifier",
    entry: "Skill slot event",
    coverage: {
      "direct-hit": "none",
      "weapon-explosion": "none",
      "derived-hit": "conditional",
      "derived-explosion": "conditional",
      "zone-tick": "unknown",
      "status-tick": "unknown",
      indirect: "unknown",
    },
  },
  {
    id: "single-shot-perk",
    label: "独弹强化",
    kind: "plugin",
    entry: "Event V3 · 0x0D",
    coverage: {
      "direct-hit": "applies",
      "weapon-explosion": "conditional",
      "derived-hit": "none",
      "derived-explosion": "none",
      "zone-tick": "none",
      "status-tick": "none",
      indirect: "none",
    },
  },
  {
    id: "lottery-perk",
    label: "抽奖增伤",
    kind: "plugin",
    entry: "FireContext V2",
    coverage: {
      "direct-hit": "applies",
      "weapon-explosion": "applies",
      "derived-hit": "conditional",
      "derived-explosion": "conditional",
      "zone-tick": "unknown",
      "status-tick": "unknown",
      indirect: "unknown",
    },
  },
  {
    id: "attribute-change",
    label: "属性变化增幅",
    kind: "entry",
    entry: "Attribute changed",
    coverage: {
      "direct-hit": "unknown",
      "weapon-explosion": "unknown",
      "derived-hit": "unknown",
      "derived-explosion": "unknown",
      "zone-tick": "conditional",
      "status-tick": "conditional",
      indirect: "unknown",
    },
  },
];

const KIND_LABELS: Record<ModifierKind, string> = {
  plugin: "插件",
  modifier: "增伤类",
  entry: "监听入口",
};

const STATUS_META: Record<
  CoverageStatus,
  { label: string; shortLabel: string; icon: LucideIcon; className: string }
> = {
  applies: {
    label: "可增幅",
    shortLabel: "可",
    icon: Check,
    className: "text-emerald-300",
  },
  conditional: {
    label: "条件覆盖",
    shortLabel: "条件",
    icon: CircleHelp,
    className: "text-amber-200",
  },
  none: {
    label: "不覆盖",
    shortLabel: "否",
    icon: Minus,
    className: "text-zinc-500",
  },
  unknown: {
    label: "待验证",
    shortLabel: "待定",
    icon: CircleHelp,
    className: "text-sky-300",
  },
};

function CoverageMark({ status, compact = false }: { status: CoverageStatus; compact?: boolean }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;

  return (
    <span
      className={`inline-flex items-center justify-center gap-1.5 font-medium ${meta.className}`}
      title={meta.label}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
      <span className={compact ? "text-[11px]" : "text-xs"}>
        {compact ? meta.shortLabel : meta.label}
      </span>
    </span>
  );
}

export function DamageSourcesOverview() {
  const [selectedTypeId, setSelectedTypeId] = useState(DAMAGE_TYPES[0].id);
  const [kindFilter, setKindFilter] = useState<"all" | ModifierKind>("all");
  const [query, setQuery] = useState("");
  const selectedType =
    DAMAGE_TYPES.find(({ id }) => id === selectedTypeId) ?? DAMAGE_TYPES[0];
  const visibleRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return COVERAGE_ROWS.filter((row) => {
      const matchesKind = kindFilter === "all" || row.kind === kindFilter;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        `${row.label} ${row.entry}`.toLocaleLowerCase().includes(normalizedQuery);
      return matchesKind && matchesQuery;
    });
  }, [kindFilter, query]);
  const families = [...new Set(DAMAGE_TYPES.map(({ family }) => family))];

  return (
    <section
      aria-labelledby="damage-source-module-heading"
      className="overflow-hidden rounded-xl border border-zinc-600 bg-[linear-gradient(145deg,rgba(18,21,23,0.97),rgba(12,15,17,0.98))] shadow-[0_24px_60px_rgba(0,0,0,0.18)]"
    >
      <header className="border-b border-zinc-700 bg-[#101315] px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="damage-source-module-heading" className="text-xl font-bold text-zinc-100">
                伤害类型与增伤覆盖
              </h2>
              <span className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                样式预览
              </span>
            </div>
            <p className="mt-1 text-sm leading-5 text-zinc-400">
              选择一种伤害，查看哪些插件或增伤效果能影响它。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-zinc-800 pt-3 text-xs lg:border-t-0 lg:pt-0">
            {(Object.keys(STATUS_META) as CoverageStatus[]).map((status) => (
              <CoverageMark key={status} status={status} />
            ))}
          </div>
        </div>
      </header>

      <div className="border-b border-zinc-700 bg-zinc-950/40 px-4 py-3 sm:px-5">
        <div className="grid gap-2 md:grid-cols-[minmax(15rem,1fr)_auto]">
          <label className="relative block min-w-0">
            <span className="sr-only">搜索插件或增伤效果</span>
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索插件或增伤效果"
              className="min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-900 py-2 pl-10 pr-3 text-base text-zinc-100 outline-none transition-colors placeholder:text-zinc-500 focus:border-[color:var(--guide-accent)] md:min-h-10"
            />
          </label>
          <div className="grid grid-cols-4 gap-1 rounded-lg border border-zinc-700 bg-zinc-900 p-1" role="group" aria-label="筛选条目类型">
            {([
              ["all", "全部"],
              ["plugin", "插件"],
              ["modifier", "增伤"],
              ["entry", "入口"],
            ] as const).map(([id, label]) => {
              const active = kindFilter === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setKindFilter(id)}
                  className={`min-h-9 cursor-pointer rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 ${
                    active
                      ? "bg-[color:var(--guide-accent-soft)] text-[color:var(--guide-accent)] shadow-[inset_0_0_0_1px_rgba(230,182,86,0.4)]"
                      : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid min-w-0 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label="伤害类型" className="border-b border-zinc-700 bg-[#0e1113] lg:border-r lg:border-b-0">
          <div className="hidden px-4 py-3 text-xs font-semibold text-zinc-500 lg:block">伤害类型</div>
          <div className="grid max-w-full grid-cols-2 gap-2 px-4 py-3 sm:grid-cols-3 lg:block lg:space-y-4 lg:px-2 lg:pb-4 lg:pt-0">
            {families.map((family) => (
              <div key={family} className="contents lg:block">
                <p className="hidden px-2 pb-1 text-[11px] font-semibold text-zinc-600 lg:block">{family}</p>
                <div className="contents lg:block">
                  {DAMAGE_TYPES.filter((type) => type.family === family).map((type) => {
                    const Icon = type.icon;
                    const active = type.id === selectedType.id;
                    return (
                      <button
                        key={type.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setSelectedTypeId(type.id)}
                        className={`flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 lg:w-full ${
                          active
                            ? "border-[color:var(--guide-accent)] bg-[color:var(--guide-accent-soft)] text-[color:var(--guide-accent)]"
                            : "border-zinc-700 bg-zinc-900/65 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800"
                        }`}
                      >
                        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                        <span>{type.shortLabel}</span>
                        <ChevronRight aria-hidden="true" className="ml-auto hidden h-3.5 w-3.5 lg:block" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        <div className="min-w-0 bg-[#111416]">
          <div className="grid gap-3 border-b border-zinc-700 px-4 py-4 sm:px-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="text-lg font-bold text-zinc-100">{selectedType.label}</h3>
                <code className="font-mono text-xs text-amber-200">{selectedType.code}</code>
              </div>
              <p className="mt-1 text-sm leading-5 text-zinc-400">{selectedType.summary}</p>
            </div>
            <dl className="grid grid-cols-2 divide-x divide-zinc-700 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950/50 text-center">
              <div className="px-4 py-2">
                <dt className="text-[10px] font-semibold text-zinc-500">当前条目</dt>
                <dd className="mt-0.5 font-mono text-sm font-bold text-zinc-100">{visibleRows.length}</dd>
              </div>
              <div className="px-4 py-2">
                <dt className="text-[10px] font-semibold text-zinc-500">分类族</dt>
                <dd className="mt-0.5 text-sm font-semibold text-zinc-200">{selectedType.family}</dd>
              </div>
            </dl>
          </div>

          <div className="hidden min-w-0 xl:block">
            <table className="w-full table-fixed border-collapse text-sm">
              <caption className="sr-only">插件和增伤类对各伤害类型的覆盖矩阵</caption>
              <colgroup>
                <col className="w-40" />
                <col className="w-24" />
                {DAMAGE_TYPES.map(({ id }) => <col key={id} />)}
              </colgroup>
              <thead>
                <tr className="bg-zinc-950/65 text-xs text-zinc-400">
                  <th scope="col" className="border-r border-b border-zinc-700 px-3 py-2 text-left">名称</th>
                  <th scope="col" className="border-r border-b border-zinc-700 px-2 py-2 text-left">类型</th>
                  {DAMAGE_TYPES.map((type) => (
                    <th
                      key={type.id}
                      scope="col"
                      className={`border-r border-b px-2 py-2 text-center font-semibold last:border-r-0 ${
                        type.id === selectedType.id
                          ? "border-[color:var(--guide-accent)] bg-[color:var(--guide-accent-soft)] text-[color:var(--guide-accent)]"
                          : "border-zinc-700 text-zinc-300"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedTypeId(type.id)}
                        className="cursor-pointer focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4"
                      >
                        {type.shortLabel}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.id} className="bg-[#111416] hover:bg-zinc-800/35">
                    <th scope="row" className="border-r border-b border-zinc-800 px-3 py-2 text-left font-semibold text-zinc-100">
                      {row.label}
                      <span className="mt-0.5 block font-mono text-[10px] font-normal text-zinc-500">{row.entry}</span>
                    </th>
                    <td className="border-r border-b border-zinc-800 px-2 py-2 text-xs text-zinc-400">{KIND_LABELS[row.kind]}</td>
                    {DAMAGE_TYPES.map((type) => (
                      <td
                        key={type.id}
                        className={`border-r border-b border-zinc-800 px-1 py-3 text-center last:border-r-0 ${
                          type.id === selectedType.id ? "bg-amber-500/[0.045]" : ""
                        }`}
                      >
                        <CoverageMark status={row.coverage[type.id]} compact />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 p-3 xl:hidden sm:p-4">
            {visibleRows.map((row) => (
              <article
                key={row.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-lg border border-zinc-700 bg-zinc-900/45 px-3 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold text-zinc-100">{row.label}</h4>
                    <span className="rounded-md border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-400">{KIND_LABELS[row.kind]}</span>
                  </div>
                  <p className="mt-1 break-words font-mono text-[11px] leading-5 text-zinc-500">{row.entry}</p>
                </div>
                <CoverageMark status={row.coverage[selectedType.id]} />
              </article>
            ))}
          </div>

          {visibleRows.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-zinc-500">没有匹配的条目</div>
          )}
        </div>
      </div>

      <footer className="border-t border-zinc-700 bg-zinc-950/55 px-4 py-3 text-xs leading-5 text-zinc-500 sm:px-5">
        这版只确认界面样式。覆盖状态暂作排版示例，正式数据会在后续接入。
      </footer>
    </section>
  );
}
