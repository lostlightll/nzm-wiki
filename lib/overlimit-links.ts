import links from "@/data/overlimit/links.json";
import type { OverlimitCatalog } from "@/lib/overlimit-catalog";

/** Small generated cross-page projection; the full catalog stays out of shared client bundles. */
export function projectOverlimitLinks(catalog: OverlimitCatalog) {
  return {
    cards: catalog.cards.map(card => ({
      id: card.id, perkItemId: card.perkItemId ?? null,
      damageFacets: (card.effectValues ?? []).flatMap(effect => effect.kind === "damage" ? [effect.modifierTypeId] : []),
    })),
    bonds: (catalog.bonds ?? []).flatMap(bond => bond.effects.map(effect => ({ name: bond.name, count: effect.count }))),
  };
}

const published = links as ReturnType<typeof projectOverlimitLinks>;
export const getOverlimitLink = (id: string) => published.cards.find(card => card.id === id);
export const getOverlimitLinksForPerk = (itemId: string) => published.cards.filter(card => card.perkItemId === itemId);
export const hasOverlimitBondStage = (name: string, count: number) => published.bonds.some(bond => bond.name === name && bond.count === count);
