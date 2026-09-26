import assert from "node:assert/strict";
import test from "node:test";
import catalog from "@/data/origin/runes.json";
import { filterOriginRunes, resolveOriginRuneSelection,
  type OriginRuneCatalog, type OriginRuneFilters } from "./origin-runes";

const data = catalog as OriginRuneCatalog;
const empty: OriginRuneFilters = { query: "", categories: new Set(), qualities: new Set(), tagIds: new Set() };

test("origin rune filters combine groups with AND and choices within groups with OR", () => {
  assert.equal(filterOriginRunes(data.runes, empty).length, 174);
  const special = filterOriginRunes(data.runes, { ...empty, categories: new Set(["special"]) });
  assert.equal(special.length, 46);
  assert.ok(special.every((rune) => rune.quality === 5));
  const gold = filterOriginRunes(data.runes, { ...empty, qualities: new Set([4]) });
  const purple = filterOriginRunes(data.runes, { ...empty, qualities: new Set([3]) });
  assert.equal(gold.length, 68);
  assert.equal(purple.length, 29);
  assert.equal(filterOriginRunes(data.runes, { ...empty, qualities: new Set([5]) }).length, 77);
  assert.equal(filterOriginRunes(data.runes, { ...empty, qualities: new Set([3, 4]) }).length, 97);
  const tagMatches = filterOriginRunes(data.runes, { ...empty, tagIds: new Set([1, 2]) });
  assert.ok(tagMatches.every((rune) => rune.tagIds.includes(1) || rune.tagIds.includes(2)));
  const combined = filterOriginRunes(data.runes, { ...empty, categories: new Set(["special"]),
    qualities: new Set([5]), tagIds: new Set([1, 2]) });
  assert.ok(combined.length > 0 && combined.length < special.length);
  assert.ok(combined.every((rune) => tagMatches.includes(rune)));
  assert.deepEqual(filterOriginRunes(data.runes, { ...empty, query: "1378042010" }).map((rune) => rune.name), ["迅射叠伤"]);
  assert.deepEqual(filterOriginRunes(data.runes, { ...empty, query: " 迅射叠伤 " }).map((rune) => rune.id), ["1378042010"]);
  assert.deepEqual(filterOriginRunes(data.runes, { ...empty, query: "no such rune" }), []);
});

test("selection stays visible or falls back to the first result", () => {
  const first = data.runes[0].id;
  assert.equal(resolveOriginRuneSelection(data.runes, first), first);
  assert.equal(resolveOriginRuneSelection(data.runes, "missing"), first);
  assert.equal(resolveOriginRuneSelection([], first), null);
  const filtered = filterOriginRunes(data.runes, { ...empty, query: "高耗迅射" });
  assert.equal(resolveOriginRuneSelection(filtered, first), filtered[0].id);
  assert.equal(filterOriginRunes(data.runes, empty).length, 174);
});

test("normal runes sort by quality then numeric ID without reordering special runes or mutating input", () => {
  const base = data.runes[0];
  const input = [
    { ...base, id: "10", category: "normal" as const, quality: 4 as const },
    { ...base, id: "30", category: "special" as const },
    { ...base, id: "2", category: "normal" as const, quality: 4 as const },
    { ...base, id: "1", category: "normal" as const, quality: 3 as const },
    { ...base, id: "20", category: "special" as const },
    { ...base, id: "40", category: "normal" as const, quality: 5 as const },
  ];
  const original = structuredClone(input);
  assert.deepEqual(filterOriginRunes(input, empty).map((rune) => rune.id), ["30", "20", "40", "2", "10", "1"]);
  assert.deepEqual(filterOriginRunes(input, { ...empty, categories: new Set(["normal"]) }).map((rune) => rune.id),
    ["40", "2", "10", "1"]);
  assert.deepEqual(input, original);
});
