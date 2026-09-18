import rawPreview from "@/data/perk-preview/preview.json";
import { getActivePreview, getPreviewSeasonKey, type PreviewRelease } from "@/lib/content-preview";
import { parsePerkPreviewCatalog } from "@/lib/perk-preview-catalog";

export function parseRegisteredPerkPreview(value: unknown, active: PreviewRelease | undefined) {
  if (value === null) return null;
  const catalog = parsePerkPreviewCatalog(value);
  if (!active || catalog.season.id !== active.version || catalog.season.key !== getPreviewSeasonKey(active)) {
    throw new Error("Perk preview must match the registered preview version and season");
  }
  return catalog;
}

const preview = parseRegisteredPerkPreview(rawPreview, getActivePreview());

export function getPerkPreviewCatalog() { return preview; }

export function getPerkPreviewEntry(slug: string) {
  return preview?.entries.find(entry => entry.perk.slug === slug);
}
