import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { parseOverlimitCatalog } from "../../lib/overlimit-catalog";
import { NUM_MODIFIER_RESOLVER } from "../../lib/num-modifier-data";
import { parseModifierProviderRegistry } from "../../lib/modifier-provider-registry";
import { auditReviewedEffects } from "./audit-effects";

const read = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));
const catalog = parseOverlimitCatalog(read("data/overlimit/current.json"));
const evidence = read("data/overlimit/current-evidence.json");
const registry = parseModifierProviderRegistry(read("data/modifier-providers.json"));
const runtime = new Set(catalog.cards.map(card => card.id));
const overrides = read("scripts/overlimit/current-announcement.json").cardDescriptions;

test("reviewed effect audit respects coefficients, scales, counts and formatted ratios", () => {
  assert.equal(auditReviewedEffects(catalog, evidence, NUM_MODIFIER_RESOLVER, registry, runtime, overrides).cards, catalog.cards.length);
  for (const id of ["1317110001", "1317120001", "20703040440", "20703040522"]) {
    const altered = structuredClone(catalog);
    const card = altered.cards.find(card => card.id === id)!;
    assert.ok(card.effectValues?.length, id);
    card.effectValues[0].stages[0].value = "+99999%";
    assert.throws(() => auditReviewedEffects(altered, evidence, NUM_MODIFIER_RESOLVER, registry, runtime, overrides), /published effects differ/);
  }
});

test("reviewed effect audit rejects stale raw evidence, missing cards and changed mechanics", () => {
  const stale = structuredClone(evidence);
  stale.cards.find((card: { selected: unknown[] }) => card.selected.length).selected[0].raw.BaseValue = 999;
  assert.throws(() => auditReviewedEffects(catalog, stale, NUM_MODIFIER_RESOLVER, registry, runtime, overrides), /stale Numerical evidence/);
  assert.throws(() => auditReviewedEffects(catalog, { ...evidence, cards: evidence.cards.slice(1) }, NUM_MODIFIER_RESOLVER, registry, runtime, overrides), /exact current card pool/);
  const altered = structuredClone(catalog);
  altered.cards[0].description = "未审定的新机制";
  assert.throws(() => auditReviewedEffects(altered, evidence, NUM_MODIFIER_RESOLVER, registry, runtime, overrides), /description differs/);
});
