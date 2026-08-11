const MECHANISM_POST_ORDER = new Map([
  ["element", 0],
  ["enemy-buffs", 1],
  ["player-buffs", 2],
  ["summons", 3],
  ["hunting-tactical-skills", 4],
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
