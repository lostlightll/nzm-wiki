import { getPerkBySlug } from "@/lib/perks";
import { getPerkPreviewEntry } from "@/lib/perk-preview";
import { getOverlimitCatalog } from "@/lib/overlimit";
import { getTriggerDamageByPerkSlug, type TriggerDamageEntry } from "@/lib/trigger-damage";
import { resolvePerkReferences } from "@/lib/perk-independent-damage";

export { resolvePerkReferences } from "@/lib/perk-independent-damage";

export async function getIndependentDamageByPerkSlug(slug: string): Promise<TriggerDamageEntry[]> {
  if (slug.startsWith("preview/")) return getPerkPreviewEntry(slug)?.independentDamage ?? [];
  const perk = getPerkBySlug(slug);
  const triggerDamage = getTriggerDamageByPerkSlug(slug);
  return [...(triggerDamage ? [triggerDamage] : []), ...(await resolvePerkReferences(perk))];
}

export async function getIndependentDamageByOverlimitId(id: string): Promise<TriggerDamageEntry[]> {
  return getOverlimitCatalog().independentDamage[id] ?? [];
}
