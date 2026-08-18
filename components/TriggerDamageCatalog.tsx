import Image from "next/image";
import Link from "next/link";
import { getAssetPath } from "@/lib/path";
import {
  TRIGGER_DAMAGE_GROUPS,
  type TriggerDamageEntry,
  type TriggerDamageGroup,
  type TriggerDamagePermission,
} from "@/lib/trigger-damage";

const ELEMENT_ICONS: Record<string, string> = {
  物理: "/icons/elements/kinetic.png",
  火焰: "/icons/elements/fire.png",
  寒冷: "/icons/elements/cryo.png",
  电弧: "/icons/elements/shock.png",
  腐蚀: "/icons/elements/corossive.png",
};

function formatPermission(
  value: TriggerDamagePermission | null,
  enabledLabel: string,
  disabledLabel: string,
) {
  if (value === null) return "未确认";
  if (typeof value === "string") return value;
  return value ? enabledLabel : disabledLabel;
}

function formatWeakpointMultiplier(entry: TriggerDamageEntry) {
  if (entry.weakpoint === null || entry.weakpointMultiplier === null) {
    return "未确认";
  }
  if (entry.weakpoint === false || entry.weakpoint === "不适用") return "-";
  if (entry.weakpointMultiplier === undefined) return "-";
  return typeof entry.weakpointMultiplier === "number"
    ? `${entry.weakpointMultiplier}×`
    : entry.weakpointMultiplier;
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs leading-5 text-zinc-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm leading-5 text-zinc-100 tabular-nums">
        {value}
      </dd>
    </div>
  );
}

function ElementValue({ element }: { element: string }) {
  const icon = ELEMENT_ICONS[element];
  return (
    <span className="inline-flex items-center gap-1.5">
      {icon && (
        <Image
          src={getAssetPath(icon)}
          alt=""
          width={18}
          height={18}
          className="h-[18px] w-[18px] shrink-0"
        />
      )}
      <span>{element}</span>
    </span>
  );
}

function TriggerDamageEntryContent({
  entry,
  detail = false,
}: {
  entry: TriggerDamageEntry;
  detail?: boolean;
}) {
  return (
    <>
      <header
        className={`grid min-w-0 gap-2 lg:items-baseline lg:gap-4 ${
          detail
            ? "lg:grid-cols-[8rem_minmax(0,1fr)_20rem] xl:grid-cols-7 xl:gap-x-5"
            : "lg:grid-cols-[10rem_minmax(0,1fr)_20rem]"
        }`}
      >
        {detail ? (
          <h2 className="min-w-0 text-base font-semibold leading-6 text-zinc-100 xl:col-span-1 xl:text-sm">
            独立伤害数值
          </h2>
        ) : (
          <h3 className="min-w-0 text-base font-semibold leading-6 text-zinc-100">
            {entry.href ? (
              <Link
                href={entry.href}
                className="break-words text-zinc-100 transition-colors hover:text-amber-300 focus-visible:outline-none focus-visible:text-amber-300 focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4"
              >
                {entry.name}
              </Link>
            ) : (
              entry.name
            )}
          </h3>
        )}
        <p
          className={`min-w-0 text-sm leading-6 text-zinc-300 ${detail ? "xl:col-span-3" : ""}`}
        >
          {entry.trigger}
        </p>
        <dl
          className={`flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-xs leading-5 text-zinc-500 lg:justify-end ${detail ? "xl:col-span-3" : ""}`}
        >
          <div className="flex gap-1.5">
            <dt>NumericalID</dt>
            <dd className="font-mono text-zinc-300">{entry.numericalId}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>冷却/间隔</dt>
            <dd className="text-zinc-300">{entry.interval}</dd>
          </div>
        </dl>
      </header>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-zinc-800 pt-3 sm:grid-cols-4 xl:grid-cols-7 xl:gap-x-5">
        <Stat label="伤害类型" value={entry.damageType} />
        <Stat label="伤害数值" value={entry.damageValue} />
        <Stat label="破韧值" value={String(entry.toughness)} />
        <Stat label="元素" value={<ElementValue element={entry.element} />} />
        <Stat
          label="暴击"
          value={formatPermission(entry.critical, "可暴击", "不可暴击")}
        />
        <Stat
          label="弱点"
          value={formatPermission(entry.weakpoint, "可弱点", "不可弱点")}
        />
        <Stat label="弱点倍率" value={formatWeakpointMultiplier(entry)} />
      </dl>

      {entry.note && (
        <p className="mt-3 border-l-2 border-zinc-600 pl-3 text-xs leading-5 text-zinc-400">
          {entry.note}
        </p>
      )}
    </>
  );
}

export function TriggerDamageCatalog({ group }: { group: TriggerDamageGroup }) {
  const entries = TRIGGER_DAMAGE_GROUPS[group];

  return (
    <div className="not-prose my-5 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900/35">
      {entries.map((entry) => (
        <article
          key={`${entry.name}-${entry.numericalId}`}
          className="border-t border-zinc-700/70 px-4 py-4 first:border-t-0 sm:px-5"
        >
          <TriggerDamageEntryContent entry={entry} />
        </article>
      ))}
    </div>
  );
}

export function IndependentDamagePanel({ entry }: { entry: TriggerDamageEntry }) {
  return (
    <section className="mt-4 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-4 sm:px-5">
      <TriggerDamageEntryContent entry={entry} detail />
    </section>
  );
}

export const TriggerDamagePanel = IndependentDamagePanel;
