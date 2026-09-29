import assert from "node:assert/strict";
import test from "node:test";
import affixes from "@/data/origin/affixes.json";
import {
  MULTIPLIER_PROVIDERS,
  MULTIPLIER_PROVIDER_EXCLUSIONS,
  getProviderRelationsForSource,
  getSourcesForModifierType,
  resolveMultiplierSourceHref,
} from "@/lib/multiplier-data";
import { AFFIX_PASSIVES } from "@/scripts/origin/project-affix-multipliers";

const factorsOf = (id: string) => [...new Set(getProviderRelationsForSource({ type: "origin-affix", id })
  .map((relation) => relation.factorId))].sort();

test("every origin affix has one indexed source or an explicit exclusion", () => {
  const entries = [...MULTIPLIER_PROVIDERS, ...MULTIPLIER_PROVIDER_EXCLUSIONS]
    .flatMap((entry) => entry.source.type === "origin-affix" ? [entry.source.id] : []);
  assert.equal(entries.length, affixes.affixes.length);
  assert.deepEqual(new Set(entries), new Set(affixes.affixes.map((affix) => affix.id)));
});

test("affix passive mapping keeps the reviewed sequence and gaps", () => {
  assert.equal(AFFIX_PASSIVES["10001"], "1378040010");
  assert.equal(AFFIX_PASSIVES["10022"], "1378040230");
  assert.equal(AFFIX_PASSIVES["10026"], "1378040270");
  assert.equal(AFFIX_PASSIVES["10042"], "1378040450");
  assert.equal(AFFIX_PASSIVES["10057"], "1378040620");
  assert.equal(AFFIX_PASSIVES["10090"], "1378040960");
  assert.equal(AFFIX_PASSIVES["10093"], "1378040990");
  for (const id of ["10025", "10047", "10094", "10109"]) assert.equal(AFFIX_PASSIVES[id], undefined, id);
  assert.equal(new Set(Object.values(AFFIX_PASSIVES)).size, Object.keys(AFFIX_PASSIVES).length);
});

test("origin affix factors come from the passive's Numerical rows", () => {
  const cases = [
    ["10003", ["dilution"]],
    ["10042", ["dilution"]],
    ["10039", ["dilution"]],
    ["10058", ["critical"]],
    ["10067", ["weakness"]],
    ["10090", ["game-mode"]],
  ] as const;
  for (const [id, expected] of cases) {
    assert.deepEqual(factorsOf(id), [...expected].sort(), id);
    const source = { type: "origin-affix" as const, id };
    assert.equal(resolveMultiplierSourceHref(source), `/origin#affix-${id}`);
    for (const relation of getProviderRelationsForSource(source)) {
      assert.ok(getSourcesForModifierType(relation.modifierTypeId).includes(relation), id);
    }
  }
  // Shared-segment S5 return-event rows must not leak into 毒皇·腐蚀.
  assert.deepEqual(getProviderRelationsForSource({ type: "origin-affix", id: "10003" })
    .map((relation) => relation.modifierTypeId), ["all-damage"]);
  // Crit-rate, fire-rate and element-stack affixes are not damage multipliers; weapon-specific ones stay unverified.
  for (const id of ["10023", "10006", "10047", "10096"]) assert.deepEqual(factorsOf(id), [], id);
});
