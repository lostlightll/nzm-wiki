import rawCatalog from "@/data/overlimit/current.json";
import rawPreview from "@/data/overlimit/preview.json";
import { parseOverlimitCatalog } from "@/lib/overlimit-catalog";
import { getActivePreview, type PreviewRelease } from "@/lib/content-preview";

const catalog = parseOverlimitCatalog(rawCatalog);

export function getOverlimitCatalog() {
  return catalog;
}

/** Separate published channels; identical card IDs never join across seasons. */
export function parseOverlimitPreview(value: unknown, active: PreviewRelease | undefined) {
  if (value === null) return null;
  const preview = parseOverlimitCatalog(value);
  if (!active || preview.season.id !== active.version || preview.season.status !== "preload") {
    throw new Error("Overlimit preview must match the registered preview version and preload status");
  }
  return preview;
}

const preview = parseOverlimitPreview(rawPreview, getActivePreview());

export function getOverlimitPreviewCatalog() {
  return preview;
}

export function getOverlimitVersions() {
  return [
    { href: "/overlimit", label: catalog.season.label },
    ...(preview ? [{ href: "/overlimit/preview", label: preview.season.label }] : []),
  ];
}
