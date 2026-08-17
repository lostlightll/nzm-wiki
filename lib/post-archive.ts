const MECHANISM_POST_ORDER = new Map([
  ["element", 0],
  ["trigger-damage", 1],
  ["enemy-buffs", 2],
  ["player-buffs", 3],
  ["summons", 4],
  ["hunting-tactical-skills", 5],
]);

const POST_SLUG_COLLATOR = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});

function getArchiveSortKey(slug: string) {
  const mechanismOrder = MECHANISM_POST_ORDER.get(slug);
  return mechanismOrder === undefined
    ? slug
    : `element/${mechanismOrder}`;
}

export function sortPostArchiveItems<T extends { slug: string }>(posts: T[]): T[] {
  return [...posts].sort((left, right) =>
    POST_SLUG_COLLATOR.compare(
      getArchiveSortKey(left.slug),
      getArchiveSortKey(right.slug),
    ),
  );
}
