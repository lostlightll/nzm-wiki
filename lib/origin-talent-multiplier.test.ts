import assert from "node:assert/strict";
import test from "node:test";
import talents from "@/data/origin/talents.json";
import {
  getProviderRelationsForSource,
  getSourcesForModifierType,
  resolveMultiplierSourceHref,
} from "@/lib/multiplier-data";

test("indexed origin talents have stable deep links and reverse relations", () => {
  const expected = new Map([
    ["10011", "all-damage"],
    ["10032", "game-mode"],
    ["10041", "critical"],
    ["10042", "element"],
    ["10051", "weakness"],
    ["10072", "all-damage"],
  ]);
  for (const [id, facet] of expected) {
    assert.ok(talents.talents.some((talent) => talent.id === id));
    const source = { type: "origin-talent" as const, id };
    const relations = getProviderRelationsForSource(source);
    assert.deepEqual([...new Set(relations.map((relation) => relation.modifierTypeId))], [facet], id);
    assert.equal(resolveMultiplierSourceHref(source), `/origin#talent-${id}`);
    for (const relation of relations) {
      assert.ok(getSourcesForModifierType(relation.modifierTypeId).includes(relation), id);
    }
  }
});
