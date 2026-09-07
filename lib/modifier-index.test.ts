import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parseModifierProviderRegistry } from "./modifier-provider-registry";

import {
  MODIFIER_INDEX_PROVIDERS,
  getModifierAttributesForFacet,
  getModifierProvider,
  getModifierProvidersForAttributeType,
  getModifierProvidersForDirection,
  getModifierProvidersForFacet,
  getModifierProvidersForRecipient,
  getModifierProvidersForSource,
} from "@/lib/modifier-index";

test("exposes the complete generic provider projection", () => {
  const registry = parseModifierProviderRegistry(JSON.parse(readFileSync("data/modifier-providers.json", "utf8")));
  assert.deepEqual(MODIFIER_INDEX_PROVIDERS.map(provider => provider.id).sort(), registry.providers.map(provider => provider.id).sort());
  assert.equal(getModifierProvider("card:10003")?.label, "狂战士祝福");
});

test("exposes projected attributes by semantic facet", () => {
  assert.deepEqual(
    getModifierAttributesForFacet("element")
      .filter((attribute) => attribute.qualifier)
      .map((attribute) => attribute.qualifier?.id)
      .sort(),
    ["corossive", "cryo", "fire", "kinetic", "shock"],
  );
  assert.ok(
    getModifierAttributesForFacet("element").some(
      (attribute) =>
        attribute.attributeName ===
        "GPAttributeSetGiveDamageRatio.ElementDamageRatio",
    ),
  );
});

test("queries the generic projection by every semantic dimension", () => {
  assert.ok(getModifierProvidersForFacet("vulnerability").length > 0);
  assert.ok(getModifierProvidersForAttributeType("weapon-damage").length > 0);
  assert.ok(getModifierProvidersForDirection("decrease").length > 0);
  assert.ok(getModifierProvidersForRecipient("enemy").length > 0);
  const provider = getModifierProvider("card:10003");
  assert.ok(provider);
  assert.deepEqual(getModifierProvidersForSource(provider.source), [provider]);
});
