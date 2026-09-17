import links from "@/data/overlimit/links.json";
import previewLinks from "@/data/overlimit/preview-links.json";
import multiplierData from "@/data/guides/multiplier.json";
import { getActivePreview, getPreviewSeasonKey, type PreviewRelease } from "@/lib/content-preview";
import type { OverlimitCatalog } from "@/lib/overlimit-catalog";

const multiplierFacets = new Set(multiplierData.damageChannelMatrix.channels.map(channel => channel.facetId));

/** Include explicitly indexed trigger stats without presenting their probability as damage. */
export function getOverlimitMultiplierFacets(card: OverlimitCatalog["cards"][number]): string[] {
  return (card.effectValues ?? []).flatMap(effect => effect.kind === "damage"
    ? [effect.modifierTypeId]
    : multiplierFacets.has(effect.statId) ? [effect.statId] : []);
}

/** Small generated cross-page projection; the full catalog stays out of shared client bundles. */
export function projectOverlimitLinks(catalog: OverlimitCatalog) {
  return {
    cards: catalog.cards.map(card => ({
      id: card.id, perkItemId: card.perkItemId ?? null,
      damageFacets: getOverlimitMultiplierFacets(card),
    })),
    bonds: (catalog.bonds ?? []).flatMap(bond => bond.effects.map(effect => ({ name: bond.name, count: effect.count }))),
  };
}

const published = links as ReturnType<typeof projectOverlimitLinks>;
const publishedPreview = previewLinks as { season: string | null } & ReturnType<typeof projectOverlimitLinks>;
type LinkProjection = ReturnType<typeof projectOverlimitLinks>;

export function selectOverlimitLinkProjection(
  season: string | undefined,
  current: LinkProjection,
  preview: LinkProjection & { season: string | null },
  active: PreviewRelease | undefined,
): LinkProjection {
  if (season === undefined) return current;
  if (active && season === getPreviewSeasonKey(active) && season === preview.season) return preview;
  return { cards: [], bonds: [] };
}

const forSeason = (season?: string) => selectOverlimitLinkProjection(season, published, publishedPreview, getActivePreview());
export const getOverlimitLink = (id: string, season?: string) => forSeason(season).cards.find(card => card.id === id);
export const getOverlimitLinksForPerk = (itemId: string, season?: string) => forSeason(season).cards.filter(card => card.perkItemId === itemId);
export const hasOverlimitBondStage = (name: string, count: number, season?: string) => forSeason(season).bonds.some(bond => bond.name === name && bond.count === count);
