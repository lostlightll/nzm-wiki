import { getResolvedWeaponBySlugSync } from "@/lib/weapons";
import { getResolvedFieldValue } from "@/lib/weapon-consumers";
import type { PerkIndependentDamageSourceReference } from "@/types";

const registeredSources = new Map([
  ["20703040537", "cold-field"],
  ["20703040538", "cryo-touch"],
  ["20703040539", "ice-orb"],
]);

/** Preview tokens follow the same MDX source reference as their damage panel. */
export function resolvePreviewDamageDescription(
  description: string | undefined,
  itemId: string,
  season?: string,
  references: readonly PerkIndependentDamageSourceReference[] = [],
): string | undefined {
  if (!description?.includes("{GPNumericalID:")) return description;
  const sourceId = season === "s4-preview" ? registeredSources.get(itemId) : undefined;
  const reference = sourceId && references.find(
    entry => entry.weaponSlug === "极寒冰神" && entry.damageSourceId === sourceId,
  );
  if (!reference) throw new Error(`Unregistered damage token or missing weapon reference for perk ${itemId}`);
  const weapon = getResolvedWeaponBySlugSync(reference.weaponSlug, "lc");
  const source = weapon?.damageSources.find(entry => entry.id === reference.damageSourceId);
  const sourceKey = source?.provenance.find(entry => entry.kind === "lock-numerical")?.sourceKey;
  const numericalId = /^lc:(\d+)_\d+$/.exec(sourceKey ?? "")?.[1];
  if (!source || !numericalId) throw new Error(`Missing Numerical reference for perk ${itemId}: ${reference.damageSourceId}`);
  const scale = getResolvedFieldValue(source.damage.base);
  if (typeof scale !== "number" || !Number.isFinite(scale) || scale < 0) {
    throw new Error(`Invalid damage coefficient for perk ${itemId}: ${sourceKey}`);
  }
  return description.replace(/\{GPNumericalID:([^}]+)\}/g, (token, fields: string) => {
    if (fields !== `${numericalId}:HpCalScale:13`) {
      throw new Error(`Unregistered damage token for perk ${itemId}: ${token}`);
    }
    return `${Math.round(scale * 100 * 10000) / 10000}%`;
  });
}
