export type OriginAffixCategory = "special" | "normal";

export interface OriginAffix {
  id: string;
  name: string;
  description: string;
  category: OriginAffixCategory;
}

export interface OriginAffixCatalog {
  schemaVersion: 1;
  affixes: OriginAffix[];
}

export interface OriginAffixFilters {
  query: string;
  categories: ReadonlySet<OriginAffixCategory>;
}

export function filterOriginAffixes(affixes: readonly OriginAffix[], filters: OriginAffixFilters): OriginAffix[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return affixes.filter((affix) =>
    (!query || affix.id.includes(query) || affix.name.toLocaleLowerCase().includes(query) ||
      affix.description.toLocaleLowerCase().includes(query)) &&
    (!filters.categories.size || filters.categories.has(affix.category)),
  );
}
