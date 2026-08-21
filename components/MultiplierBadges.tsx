import Link from "next/link";
import { ArrowUpRight, Layers3 } from "lucide-react";
import { getMultiplierFactorStyle } from "@/components/multiplier-badge-styles";
import {
  getApplicableModifierTypes,
  getProviderRelationsForSource,
  getRelationsByFactor,
  resolveMultiplierFactorHref,
  type DamageProfile,
  type MultiplierRelation,
  type MultiplierSource,
} from "@/lib/multiplier-data";

type MultiplierBadgeVariant =
  | "default"
  | "catalog-overlay"
  | "catalog-compact"
  | "catalog-inline";

export function MultiplierBadges({
  relations,
  className = "",
  id,
  variant = "default",
}: {
  relations: readonly MultiplierRelation[];
  className?: string;
  id?: string;
  variant?: MultiplierBadgeVariant;
}) {
  const groups = getRelationsByFactor(relations);
  if (groups.length === 0) return null;
  const isCatalogOverlay = variant === "catalog-overlay";
  const isCatalogCompact = variant === "catalog-compact";
  const isCatalogInline = variant === "catalog-inline";
  const isCompact = isCatalogOverlay || isCatalogCompact || isCatalogInline;
  const Root = isCatalogInline ? "span" : "div";

  return (
    <Root
      id={id}
      className={`flex flex-wrap items-center gap-1.5 ${isCatalogInline ? "float-right mt-1 mr-0.5 ml-2" : ""} ${className}`}
    >
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
            className={`relative inline-flex touch-manipulation items-center border transition-colors duration-200 hover:brightness-125 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 motion-reduce:transition-none ${isCatalogOverlay ? "min-h-7 rounded-bl-md rounded-br-none rounded-tl-none rounded-tr-md px-2 py-0.5 text-[11px] font-medium leading-4 after:absolute after:-inset-x-1 after:-inset-y-2 after:content-['']" : isCatalogInline ? "min-h-5 rounded px-2 text-[11px] font-medium leading-4 after:absolute after:-inset-x-1 after:-inset-y-3 after:content-['']" : isCatalogCompact ? "min-h-6 rounded px-2 py-0.5 text-[11px] font-medium leading-4 after:absolute after:-inset-x-1 after:-inset-y-2.5 after:content-['']" : "min-h-11 gap-1 rounded px-2 py-1 text-xs font-semibold leading-5 sm:min-h-7"} ${getMultiplierFactorStyle(factorId)}`}
          >
            {!isCompact && (
              <Layers3 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            )}
            <span>{factorLabel}</span>
            {!isCompact && (
              <ArrowUpRight aria-hidden="true" className="h-3 w-3 shrink-0 opacity-70" />
            )}
          </Link>
        );
      })}
    </Root>
  );
}

export function MultiplierSourceBadges({
  source,
  className,
  id,
  variant,
}: {
  source: MultiplierSource;
  className?: string;
  id?: string;
  variant?: MultiplierBadgeVariant;
}) {
  return (
    <MultiplierBadges
      id={id}
      relations={getProviderRelationsForSource(source)}
      className={className}
      variant={variant}
    />
  );
}

export function MultiplierProviderRows({
  relations,
  framed = false,
}: {
  relations: readonly MultiplierRelation[];
  framed?: boolean;
}) {
  const groups = new Map<string, MultiplierRelation[]>();
  for (const relation of relations) {
    const key = relation.effectId ?? relation.modifierTypeId;
    const group = groups.get(key) ?? [];
    group.push(relation);
    groups.set(key, group);
  }

  return (
    <div className="space-y-2">
      {[...groups.values()].map((effectRelations) => {
        const placementSource = effectRelations[0].source;
        return (
          <div
            key={effectRelations[0].effectId ?? effectRelations[0].modifierTypeId}
            id={placementSource?.anchor}
            className={
              framed
                ? "grid gap-3 rounded border border-white/10 bg-black/10 px-3 py-3 sm:grid-cols-[minmax(9rem,1fr)_auto] sm:items-center"
                : "flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between"
            }
          >
            <span className="text-sm text-zinc-200">
              {effectRelations[0].effectLabel ??
                effectRelations[0].modifierTypeLabel}
            </span>
            <MultiplierBadges relations={effectRelations} />
          </div>
        );
      })}
    </div>
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

  return (
    <section
      aria-label="提供的增伤类型"
      className={`border-t border-white/10 px-4 py-4 sm:px-6 ${className}`}
    >
      <h2 className="mb-3 text-sm font-medium text-zinc-400">
        提供的增伤类型
      </h2>
      <MultiplierProviderRows relations={relations} />
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
