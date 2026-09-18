import assert from "node:assert/strict";
import test from "node:test";
import reference from "../scripts/s4-perk-index-reference.json";
import { getAllPublishedPerks } from "./perks";
import {
  MULTIPLIER_PROVIDERS,
  getProviderRelationsForSource,
  getSourcesForModifierType,
  getRelationsByFactor,
  resolveMultiplierSourceHref,
} from "./multiplier-data";
import registry from "../data/modifier-providers.json";

test("all S4 perks match the pinned reference provider/exclusion coverage", () => {
  const perks = getAllPublishedPerks().filter(perk => perk.season === "s4-preview");
  const expected = [...reference.providers, ...reference.exclusions];
  assert.equal(reference.providers.length, 35);
  assert.equal(reference.exclusions.length, 47);
  const referenceIds = new Set(expected.map(entry => entry.source.itemId));
  assert.deepEqual(perks.filter(perk => referenceIds.has(perk.itemId!)).map(perk => perk.itemId).sort(), [...referenceIds].sort());
  for (const entry of reference.providers) {
    const provider = MULTIPLIER_PROVIDERS.find(provider => provider.id === entry.id);
    assert.ok(provider, entry.label);
    assert.equal(provider.source.type, "perk");
    if (provider.source.type !== "perk") continue;
    assert.equal(provider.source.season, "s4-preview");
    const expectedTypes = [...entry.modifierTypeIds];
    // Current preload also explicitly links AllDamageRatio on this MGE.
    if (entry.source.itemId === "20703040546") expectedTypes.push("all-damage");
    assert.deepEqual([...provider.modifierTypeIds].sort(), expectedTypes.sort(), entry.label);
    const relations = getProviderRelationsForSource(provider.source);
    assert.deepEqual(relations.map(relation => relation.modifierTypeId).sort(), expectedTypes.sort(), entry.label);
    for (const relation of relations) {
      assert.ok(getSourcesForModifierType(relation.modifierTypeId).includes(relation), entry.label);
      assert.ok(resolveMultiplierSourceHref(provider.source).includes(encodeURIComponent(provider.source.slug)), entry.label);
    }
  }
  for (const entry of reference.exclusions) {
    if (entry.source.itemId === "20703040540") continue; // Maintainer correction tested below.
    assert.ok(!MULTIPLIER_PROVIDERS.some(provider => provider.id === entry.id), entry.label);
    const exclusion = registry.exclusions.find(exclusion => exclusion.id === entry.id);
    assert.equal(exclusion?.reasonCode, entry.reasonCode, entry.label);
  }
});

test("pure light uses its preview Numerical weakness damage and is no longer excluded", () => {
  const provider = MULTIPLIER_PROVIDERS.find(provider => provider.id === "perk:20703040540")!;
  assert.ok(provider);
  assert.deepEqual(provider.modifierTypeIds, ["weakness"]);
  const relations = getProviderRelationsForSource(provider.source);
  assert.deepEqual(getRelationsByFactor(relations).map(group => group.factorId), ["weakness"]);
  assert.ok(getSourcesForModifierType("weakness").includes(relations[0]));
  assert.ok(!registry.exclusions.some(entry => entry.id === provider.id));
  const registered = registry.providers.find(entry => entry.id === provider.id)!;
  assert.deepEqual(registered.applications?.[0].expression, { row: "lc:1400090107_1_0", field: "base" });
});

test("S4 badges group channels within a factor and retain both distinct factors", () => {
  const double = MULTIPLIER_PROVIDERS.find(provider => provider.id === "perk:20703040524")!;
  assert.deepEqual(getRelationsByFactor(getProviderRelationsForSource(double.source)).map(group => group.factorId).sort(), ["critical", "dilution"]);
  const multiChannel = MULTIPLIER_PROVIDERS.find(provider => provider.label === "光辉贯穿")!;
  const relations = getProviderRelationsForSource(multiChannel.source);
  assert.equal(relations.length, 2);
  assert.equal(getRelationsByFactor(relations).length, 1);
});
