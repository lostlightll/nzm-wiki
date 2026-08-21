const MECHANISM_POST_ORDER = new Map([
  ["element", 0],
  ["trigger-damage", 1],
  ["fire-rate", 2],
  ["enemy-buffs", 3],
  ["player-buffs", 4],
  ["summons", 5],
  ["hunting-tactical-skills", 6],
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
