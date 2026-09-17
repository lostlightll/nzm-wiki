import contentVersion from "@/config/content-version.json";

export interface PreviewRelease {
  season: string;
  version: string;
  label: string;
}

/** Publication channel, not a claim that preload switches are live. */
export function isPreviewSeason(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9][a-z0-9.-]*-preview$/.test(value);
}

export function getPreviewSeasonKey(preview: PreviewRelease): string {
  return `${preview.season}-preview`;
}

export function getActivePreview(): PreviewRelease | undefined {
  const config: { season: string; preview?: PreviewRelease } = contentVersion;
  return config.preview;
}
