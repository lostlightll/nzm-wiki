export type OriginRuneQuality = 3 | 4 | 5;
export type OriginRuneCategory = "special" | "normal";

export interface OriginRune {
  id: string;
  name: string;
  description: string;
  category: OriginRuneCategory;
  quality: OriginRuneQuality;
  icon: string;
  tagIds: number[];
}

export interface OriginRuneCatalog {
  schemaVersion: 2;
  tags: { id: number; name: string }[];
  runes: OriginRune[];
}

export interface OriginRuneFilters {
  query: string;
  categories: ReadonlySet<OriginRuneCategory>;
  qualities: ReadonlySet<OriginRuneQuality>;
  tagIds: ReadonlySet<number>;
}

export function filterOriginRunes(runes: readonly OriginRune[], filters: OriginRuneFilters): OriginRune[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return runes.filter((rune) =>
    (!query || rune.name.toLocaleLowerCase().includes(query) || rune.id.includes(query)) &&
    (!filters.categories.size || filters.categories.has(rune.category)) &&
    (!filters.qualities.size || filters.qualities.has(rune.quality)) &&
    (!filters.tagIds.size || rune.tagIds.some((id) => filters.tagIds.has(id))),
  );
}

export function resolveOriginRuneSelection(runes: readonly OriginRune[], selectedId: string | null): string | null {
  if (!runes.length) return null;
  return selectedId && runes.some((rune) => rune.id === selectedId) ? selectedId : runes[0].id;
}
