import assert from "node:assert/strict";
import test from "node:test";
import review from "../scripts/s4-perk-index-review.json";
import { validateS4Review } from "../scripts/project-s4-perk-index";
import { getAllPublishedPerks } from "./perks";
import { getPerkModifierResolver } from "./num-modifier-data";
import {
  MULTIPLIER_PROVIDERS,
  getProviderRelationsForSource,
  getSourcesForModifierType,
  getRelationsByFactor,
  resolveMultiplierSourceHref,
} from "./multiplier-data";
import registry from "../data/modifier-providers.json";
import type { ModifierProviderRegistrySource } from "./modifier-provider-registry";
import { getOverlimitCatalog } from "./overlimit";

function officialEntry<T extends { source: ModifierProviderRegistrySource }>(entry: T) {
  const result = structuredClone(entry);
  if (result.source.type === "perk") {
    delete result.source.season;
    const itemId = result.source.itemId;
    result.source.overlimitCard = getOverlimitCatalog().cards.some((card) => card.perkItemId === itemId);
  }
  return result;
}

test("S4 coverage follows local reviewed Numerical chains and explicit exclusions", () => {
  const local = validateS4Review(review);
  const perks = getAllPublishedPerks();
  const expected = [...local.providers, ...local.exclusions];
  assert.equal(expected.length, 82);
  const itemIds = new Set(expected.map(entry => entry.source.type === "perk" ? entry.source.itemId : ""));
  assert.deepEqual(perks.filter(perk => itemIds.has(perk.itemId!)).map(perk => perk.itemId).sort(), [...itemIds].sort());
  const resolver = getPerkModifierResolver("s4");
  for (const entry of local.providers) {
    const registered = registry.providers.find(provider => provider.id === entry.id);
    assert.ok(registered, entry.label);
    assert.ok(entry.evidence?.basis?.every((basis) => registered.evidence?.basis?.includes(basis)), entry.label);
    assert.deepEqual({ ...registered, evidence: { ...registered.evidence, basis: entry.evidence?.basis } }, officialEntry(entry), entry.label);
    const provider = MULTIPLIER_PROVIDERS.find(provider => provider.id === entry.id);
    assert.ok(provider, entry.label);
    assert.equal(provider.source.type, "perk");
    if (provider.source.type !== "perk") continue;
    assert.equal(provider.source.season, undefined);
    const expectedTypes = [...new Set(entry.applications!.flatMap(application =>
      resolver.resolveEffect(application.expression, application.context).facets
        .filter(facet => facet.consumer === "damage").map(facet => facet.id),
    ))].sort();
    assert.ok(expectedTypes.length, entry.label);
    assert.deepEqual([...provider.modifierTypeIds].sort(), expectedTypes, entry.label);
    const relations = getProviderRelationsForSource(provider.source);
    assert.deepEqual(relations.map(relation => relation.modifierTypeId).sort(), expectedTypes, entry.label);
    for (const relation of relations) {
      assert.ok(getSourcesForModifierType(relation.modifierTypeId).includes(relation), entry.label);
      assert.ok(resolveMultiplierSourceHref(provider.source).includes(encodeURIComponent(provider.source.slug)), entry.label);
    }
  }
  for (const entry of local.exclusions) {
    assert.ok(!MULTIPLIER_PROVIDERS.some(provider => provider.id === entry.id), entry.label);
    const registered = registry.exclusions.find(exclusion => exclusion.id === entry.id);
    assert.ok(registered, entry.label);
    if (entry.id === "perk:20703040537") {
      // Live text gained a real Numerical token, but no reviewed execution path consumes it.
      assert.equal(registered.reasonCode, "unverified-evidence");
      assert.match(JSON.stringify(registered.evidence), /120300175/);
      assert.match(JSON.stringify(registered.evidence), /[a-f0-9]{64}/);
      assert.equal(resolver.getRow("lc:120300175_1_0").baseValue, 0.5);
      continue;
    }
    assert.ok(entry.evidence?.basis?.every((basis) => registered.evidence?.basis?.includes(basis)), entry.label);
    assert.deepEqual({ ...registered, evidence: { ...registered.evidence, basis: entry.evidence?.basis } }, officialEntry(entry), entry.label);
    for (const application of entry.evidence?.applications ?? []) {
      assert.ok(!resolver.resolveEffect(application.expression, application.context).facets
        .some(facet => facet.consumer === "damage"), entry.label);
    }
  }
});

test("local S4 review rejects overrides, missing identity evidence and duplicate ItemIDs", () => {
  const override = structuredClone(review);
  const first = override.providers[0] as unknown as Record<string, unknown>;
  first.evidence = { kind: "reviewed-override", passiveSkillId: "1", basis: ["unverified"] };
  delete first.applications;
  first.reviewedFacetIds = ["weapon-damage"];
  assert.throws(() => validateS4Review(override), /direct Numerical/);
  const missing = structuredClone(review);
  delete (missing.providers[0].evidence as { passiveSkillId?: string }).passiveSkillId;
  assert.throws(() => validateS4Review(missing), /local identity/);
  const duplicate = structuredClone(review);
  duplicate.providers.push({ ...duplicate.providers[0], id: "duplicate-local-perk" });
  assert.throws(() => validateS4Review(duplicate), /Duplicate ItemID/);
});

test("pure light uses its formal Numerical weakness damage and is no longer excluded", () => {
  const provider = MULTIPLIER_PROVIDERS.find(provider => provider.id === "perk:20703040540")!;
  assert.ok(provider);
  assert.deepEqual(provider.modifierTypeIds, ["weakness"]);
  const relations = getProviderRelationsForSource(provider.source);
  assert.deepEqual(getRelationsByFactor(relations).map(group => group.factorId), ["weakness"]);
  assert.ok(getSourcesForModifierType("weakness").includes(relations[0]));
  assert.ok(!registry.exclusions.some(entry => entry.id === provider.id));
  const registered = registry.providers.find(entry => entry.id === provider.id)!;
  assert.ok(registered.applications?.some(application => application.expression.row === "lc:1400090107_1_0"));
});

test("local execution evidence restores scoped damage and keeps missing cold-flame rows unresolved", () => {
  for (const [id, row] of [
    ["20703040503", "lc:111051018_1_0"],
    ["20703040499", "lc:111051017_1_0"],
    ["20703040528", "lc:111051037_1_0"],
  ]) {
    const entry = review.providers.find(provider => provider.source.itemId === id);
    assert.ok(entry, id);
    const application = entry.applications.find(item => item.expression.row === row);
    assert.equal(application?.context.recipient, "damage-event", id);
    assert.ok(MULTIPLIER_PROVIDERS.some(provider => provider.id === entry.id), id);
  }
  for (const id of ["20703040083", "20703040084"]) {
    const entry = review.exclusions.find(exclusion => exclusion.source.itemId === id);
    assert.equal(entry?.reasonCode, "unverified-evidence", id);
    assert.ok(!MULTIPLIER_PROVIDERS.some(provider => provider.source.type === "perk" &&
      provider.source.season === undefined && provider.source.itemId === id), id);
  }
});

test("S4 badges group channels within a factor and retain both distinct factors", () => {
  const double = MULTIPLIER_PROVIDERS.find(provider => provider.id === "perk:20703040524")!;
  assert.deepEqual(getRelationsByFactor(getProviderRelationsForSource(double.source)).map(group => group.factorId).sort(), ["critical", "dilution"]);
  const multiChannel = MULTIPLIER_PROVIDERS.find(provider => provider.label === "光辉贯穿")!;
  const relations = getProviderRelationsForSource(multiChannel.source);
  assert.equal(relations.length, 2);
  assert.equal(getRelationsByFactor(relations).length, 1);
});
