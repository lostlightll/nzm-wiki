import Link from "next/link";
import { ArrowUpRight, Layers3, Zap } from "lucide-react";
import {
  getApplicableModifierTypes,
  getProviderRelationsForSource,
  getRelationsByFactor,
  resolveMultiplierFactorHref,
  type DamageProfile,
  type MultiplierFactorId,
  type MultiplierRelation,
  type MultiplierSource,
} from "@/lib/multiplier-data";

const FACTOR_STYLES: Record<MultiplierFactorId, string> = {
  base: "border-zinc-500/60 bg-zinc-500/10 text-zinc-200",
  "weakpoint-multiplier": "border-rose-400/50 bg-rose-400/10 text-rose-200",
  "game-mode": "border-sky-400/50 bg-sky-400/10 text-sky-200",
  dilution: "border-amber-400/50 bg-amber-400/10 text-amber-200",
  element: "border-cyan-400/50 bg-cyan-400/10 text-cyan-200",
  weakness: "border-red-400/50 bg-red-400/10 text-red-200",
  critical: "border-orange-400/50 bg-orange-400/10 text-orange-200",
  correction: "border-emerald-400/50 bg-emerald-400/10 text-emerald-200",
  vulnerability: "border-teal-400/50 bg-teal-400/10 text-teal-200",
};

export function MultiplierBadges({
  relations,
  className = "",
  id,
}: {
  relations: readonly MultiplierRelation[];
  className?: string;
  id?: string;
}) {
  const groups = getRelationsByFactor(relations);
  if (groups.length === 0) return null;

  return (
    <div id={id} className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {groups.map(({ factorId, factorLabel, relations: factorRelations }) => {
        const modifierLabels = [...new Set(
          factorRelations.map((relation) => relation.modifierTypeLabel),
        )];
        const href = resolveMultiplierFactorHref(factorId, {
          view: factorRelations.some((relation) => relation.kind === "provider")
            ? "providers"
            : "targets",
          modifierTypeId:
            factorRelations.length === 1
              ? factorRelations[0].modifierTypeId
              : undefined,
        });
        const description = `${factorLabel}：${modifierLabels.join("、")}；点击查看乘区说明`;

        return (
          <Link
            key={factorId}
            href={href}
            prefetch={false}
            title={description}
            aria-label={description}
            className={`inline-flex min-h-11 touch-manipulation items-center gap-1 rounded border px-2 py-1 text-xs font-semibold leading-5 transition-colors duration-200 hover:brightness-125 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 motion-reduce:transition-none sm:min-h-7 ${FACTOR_STYLES[factorId]}`}
          >
            <Layers3 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            <span>{factorLabel}</span>
            <ArrowUpRight aria-hidden="true" className="h-3 w-3 shrink-0 opacity-70" />
          </Link>
        );
      })}
    </div>
  );
}

export function MultiplierSourceBadges({
  source,
  className,
  id,
}: {
  source: MultiplierSource;
  className?: string;
  id?: string;
}) {
  return (
    <MultiplierBadges
      id={id}
      relations={getProviderRelationsForSource(source)}
      className={className}
    />
  );
}

export function MultiplierProviderPanel({
  source,
  className = "",
}: {
  source: MultiplierSource;
  className?: string;
}) {
  const relations = getProviderRelationsForSource(source);
  if (relations.length === 0) return null;
  const groups = new Map<string, MultiplierRelation[]>();
  for (const relation of relations) {
    const key = relation.effectId ?? relation.modifierTypeId;
    const group = groups.get(key) ?? [];
    group.push(relation);
    groups.set(key, group);
  }

  return (
    <section
      aria-label="提供的增伤类型"
      className={`border-t border-white/10 px-4 py-4 sm:px-6 ${className}`}
    >
      <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-400">
        <Zap aria-hidden="true" className="h-4 w-4 text-[#d1ac69]" />
        提供的增伤类型
      </h2>
      <div className="space-y-2">
        {[...groups.values()].map((effectRelations) => {
          const placementSource = effectRelations[0].source;
          return (
            <div
              key={effectRelations[0].effectId ?? effectRelations[0].modifierTypeId}
              id={placementSource?.anchor}
              className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="text-sm text-zinc-200">
                {effectRelations[0].effectLabel ?? effectRelations[0].modifierTypeLabel}
              </span>
              <MultiplierBadges relations={effectRelations} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function DamageSourceMultiplierBadges({
  profile,
  className,
}: {
  profile: DamageProfile;
  className?: string;
}) {
  return (
    <MultiplierBadges
      relations={getApplicableModifierTypes(profile)}
      className={className}
    />
  );
}
