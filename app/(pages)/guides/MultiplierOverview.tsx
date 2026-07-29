import {
  Bomb,
  Box,
  Calculator,
  Crosshair,
  Info,
  LocateFixed,
  Swords,
  Tag,
  Target,
  TriangleAlert,
  Users,
  type LucideIcon,
} from "lucide-react";

type MultiplierFactor = {
  id: string;
  label: string;
  active?: boolean;
};

type DamageSource = {
  label: string;
  icon: LucideIcon;
};

type AttributeField = {
  name: string;
  description: string;
};

const FACTORS: readonly MultiplierFactor[] = [
  { id: "base", label: "基础伤害" },
  { id: "game-mode", label: "游戏模式乘区" },
  { id: "element", label: "元素乘区" },
  { id: "critical", label: "暴伤乘区" },
  { id: "weakness", label: "弱点增伤" },
  { id: "dilution", label: "大稀释乘区", active: true },
  { id: "correction", label: "特殊修正" },
];

const SOURCES: readonly DamageSource[] = [
  { label: "全伤害加成", icon: Target },
  { label: "武器伤害增加", icon: Swords },
  { label: "近距离武器伤害", icon: LocateFixed },
  { label: "射击伤害", icon: Crosshair },
  { label: "爆炸伤害", icon: Bomb },
];

const TARGETS = ["全伤害", "武器伤害", "近距离", "射击", "爆炸"] as const;

const ATTRIBUTE_FIELDS: readonly AttributeField[] = [
  {
    name: "GPAttributeSetGiveDamageRatio.AllDamageRatio",
    description: "全伤害加成的属性字段",
  },
  {
    name: "GPAttributeSetGiveDamageRatio.WeaponDamageRatio",
    description: "武器伤害增加的属性字段",
  },
  {
    name: "GPAttributeSetGiveDamageRatio.CloseRangeDamageRatio",
    description: "近距离武器伤害的属性字段",
  },
  {
    name: "Numerical.ExecutionCtx.ExecutionRatio",
    description: "射击伤害执行比例类增伤的属性字段",
  },
];

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

function DesktopFormula() {
  return (
    <div className="relative hidden h-[82px] xl:block" aria-hidden="true">
      <div className="absolute inset-x-0 top-0 flex items-start gap-3">
        {FACTORS.map((factor, index) => (
          <div key={factor.id} className="contents">
            <div className="relative h-[82px] min-w-0 flex-1">
              <div
                className={`flex h-12 items-center justify-center rounded-[10px] border px-3 text-center text-sm font-semibold tracking-wide shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] ${
                  factor.active
                    ? "border-[color:var(--guide-accent)] bg-[linear-gradient(135deg,rgba(217,164,62,0.24),rgba(85,66,29,0.18))] text-[color:var(--guide-accent)]"
                    : "border-zinc-600 bg-[linear-gradient(145deg,rgba(31,33,35,0.92),rgba(20,22,24,0.92))] text-zinc-200"
                }`}
              >
                {factor.label}
              </div>

              <span
                className={`absolute left-1/2 top-[56px] z-10 h-3.5 w-3.5 -translate-x-1/2 rounded-full border ${
                  factor.active
                    ? "border-[color:var(--guide-accent)] bg-[#111416]"
                    : "border-zinc-400 bg-[#111416]"
                }`}
              >
                <span
                  className={`absolute inset-[3px] rounded-full ${
                    factor.active ? "bg-[color:var(--guide-accent)]" : "bg-zinc-400"
                  }`}
                />
              </span>

              <span
                className={`absolute left-1/2 top-[69px] z-0 w-px -translate-x-1/2 ${
                  factor.active
                    ? "bottom-[-12px] bg-[color:var(--guide-accent)]"
                    : "bottom-0 bg-zinc-500"
                }`}
              />
            </div>

            {index < FACTORS.length - 1 && (
              <span className="mt-2.5 shrink-0 text-2xl font-light text-zinc-200">×</span>
            )}
          </div>
        ))}
      </div>
      <div className="absolute right-[4.5%] bottom-0 left-[4.5%] h-px bg-zinc-500" />
    </div>
  );
}

function CompactFormula() {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 xl:hidden" aria-label="伤害乘区公式">
      {FACTORS.map((factor, index) => (
        <li key={factor.id} className="flex min-w-0 items-center gap-2">
          {index > 0 && (
            <span aria-hidden="true" className="text-lg text-zinc-400">
              ×
            </span>
          )}
          <span
            aria-current={factor.active ? "true" : undefined}
            className={`inline-flex min-h-11 items-center rounded-lg border px-3 py-2 text-sm font-semibold ${
              factor.active
                ? "border-[color:var(--guide-accent)] bg-[color:var(--guide-accent-soft)] text-[color:var(--guide-accent)]"
                : "border-zinc-700 bg-zinc-900/70 text-zinc-200"
            }`}
          >
            {factor.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function MultiplierOverview() {
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

        <CompactFormula />
        <DesktopFormula />

        <article className="mt-5 overflow-hidden rounded-xl border border-zinc-600 bg-[linear-gradient(145deg,rgba(18,21,23,0.97),rgba(12,15,17,0.98))] shadow-[0_24px_60px_rgba(0,0,0,0.2)] xl:mt-3">
          <header className="border-b border-zinc-700 px-5 py-4 sm:px-6 xl:py-2.5">
            <h2 className="text-2xl font-bold tracking-wide text-[color:var(--guide-accent)] xl:text-xl">
              大稀释乘区
            </h2>
          </header>

          <div className="grid md:grid-cols-2 xl:grid-cols-[1.15fr_0.75fr_0.9fr_1.45fr]">
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
              <SectionHeading icon={Box}>典型来源</SectionHeading>
              <ul className="space-y-2.5 xl:space-y-1.5">
                {SOURCES.map(({ label, icon: Icon }) => (
                  <li
                    key={label}
                    className="flex min-h-12 items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-800/45 px-3 py-2.5 text-sm text-zinc-200 xl:min-h-10 xl:py-1.5"
                  >
                    <Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-zinc-100" strokeWidth={2} />
                    {label}
                  </li>
                ))}
              </ul>
            </section>

            <section className="border-b border-zinc-700 p-5 sm:p-6 md:border-r md:border-b-0 xl:p-4">
              <SectionHeading icon={Users}>增伤对象</SectionHeading>
              <p className="mb-4 text-sm leading-7 text-[color:var(--guide-muted)] sm:text-base xl:mb-3 xl:text-sm xl:leading-6">
                作用于伤害结算的特定部分，可按类型选择性生效。
              </p>
              <ul className="flex flex-wrap gap-2">
                {TARGETS.map((target) => (
                  <li
                    key={target}
                    className="rounded-md border border-zinc-600 bg-zinc-800/55 px-3 py-2 text-sm text-zinc-100 xl:py-1.5"
                  >
                    {target}
                  </li>
                ))}
              </ul>
            </section>

            <section className="p-5 sm:p-6 xl:p-4">
              <SectionHeading icon={Tag}>属性字段（精确字段名）</SectionHeading>
              <dl className="space-y-2.5 xl:space-y-1.5">
                {ATTRIBUTE_FIELDS.map((field) => (
                  <div key={field.name} className="rounded-lg border border-zinc-700 bg-zinc-800/45 p-2.5 xl:p-1.5">
                    <dt>
                      <code className="block [overflow-wrap:anywhere] rounded bg-[#0b0d0f] px-3 py-2 font-mono text-xs leading-5 text-zinc-100 sm:text-sm xl:py-1.5 xl:text-xs xl:leading-4">
                        <AttributeName name={field.name} />
                      </code>
                    </dt>
                    <dd className="px-3 pt-1.5 text-xs leading-5 text-[color:var(--guide-muted)] sm:text-sm xl:pt-1 xl:text-xs xl:leading-4">
                      {field.description}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>

          <footer className="flex items-start justify-center gap-2 border-t border-zinc-700 px-5 py-4 text-center text-xs leading-5 text-zinc-400 sm:text-sm xl:py-2">
            <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <p>提示：实际生效以战斗结算为准，部分来源受触发条件限制。</p>
          </footer>
        </article>
      </section>
    </div>
  );
}
