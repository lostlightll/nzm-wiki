import { getResolvedWeaponBySlugSync } from "@/lib/weapons";
import { getResolvedFieldValue } from "@/lib/weapon-consumers";
import type { PerkIndependentDamageSourceReference } from "@/types";
import { getActivePreview, getPreviewSeasonKey, isPreviewSeason } from "@/lib/content-preview";

/** Preview tokens follow the same MDX source reference as their damage panel. */
export function resolvePreviewDamageDescription(
  description: string | undefined,
  itemId: string,
  season?: string,
  references: readonly PerkIndependentDamageSourceReference[] = [],
  activePreview: ReturnType<typeof getActivePreview> | null = getActivePreview(),
): string | undefined {
  if (!description?.includes("{GPNumericalID:")) return description;
  if (!isPreviewSeason(season) || !activePreview || season !== getPreviewSeasonKey(activePreview)) {
    throw new Error(`Unconfigured preview damage token for perk ${itemId}: ${season}`);
  }
  const sources = references.map(reference => {
    const weapon = getResolvedWeaponBySlugSync(reference.weaponSlug, "lc");
    const source = weapon?.damageSources.find(entry => entry.id === reference.damageSourceId);
    const numericalKeys = source?.provenance.filter(entry => entry.kind === "lock-numerical") ?? [];
    const numericalId = numericalKeys.length === 1
      ? /^lc:(\d+)_\d+$/.exec(numericalKeys[0].sourceKey ?? "")?.[1]
      : undefined;
    if (!source || !numericalId) throw new Error(`Missing or ambiguous Numerical reference for perk ${itemId}: ${reference.damageSourceId}`);
    return { numericalId, source };
  });
  return description.replace(/\{GPNumericalID:([^}]+)\}/g, (token, fields: string) => {
    const numericalId = /^(\d+):HpCalScale:13$/.exec(fields)?.[1];
    const matches = sources.filter(source => source.numericalId === numericalId);
    if (matches.length !== 1) {
      throw new Error(`Missing, ambiguous or invalid damage token reference for perk ${itemId}: ${token}`);
    }
    const scale = getResolvedFieldValue(matches[0].source.damage.base);
    if (typeof scale !== "number" || !Number.isFinite(scale) || scale < 0) {
      throw new Error(`Invalid damage coefficient for perk ${itemId}: ${token}`);
    }
    return `${Math.round(scale * 100 * 10000) / 10000}%`;
  });
}
