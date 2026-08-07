import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDamageProfile,
  getApplicableModifierTypes,
  getProviderRelationsForSource,
  getRelationsByFactor,
  resolveMultiplierFactorHref,
  resolveMultiplierSourceHref,
} from "./multiplier-data";

test("shared effects keep perk and overlimit placements separate", () => {
  const perk = getProviderRelationsForSource({
    type: "perk",
    slot: 3,
    slug: "哑枪",
  });
  const card = getProviderRelationsForSource({
    type: "overlimit-card",
    id: "20703040436",
  });

  assert.equal(perk.length, 1);
  assert.equal(card.length, 1);
  assert.equal(perk[0].effectId, "silent-gun");
  assert.equal(card[0].effectId, "silent-gun");
  assert.notEqual(perk[0].sourceHref, card[0].sourceHref);
});

test("icepoint passive links to element and dilution factors", () => {
  const relations = getProviderRelationsForSource({
    type: "weapon",
    slug: "冰点双峰",
  });
  assert.equal(relations.length, 2);
  assert.deepEqual(
    getRelationsByFactor(relations).map((group) => group.factorId).sort(),
    ["dilution", "element"],
  );
});

test("weapon settlement profile resolves applicable modifier channels", () => {
  const profile = buildDamageProfile({
    section: "fire_mode",
    settlements: ["Numerical.SettlementType.Health.WeaponDamage"],
    element: { state: "resolved", value: "火焰" },
    enableCritical: { state: "resolved", value: true },
    enableWeakness: { state: "resolved", value: true },
  });
  const modifierIds = getApplicableModifierTypes(profile).map(
    (relation) => relation.modifierTypeId,
  );

  assert.ok(modifierIds.includes("game-mode"));
  assert.ok(modifierIds.includes("all-damage"));
  assert.ok(modifierIds.includes("weapon-damage"));
  assert.ok(modifierIds.includes("weapon-hit-damage"));
  assert.ok(modifierIds.includes("element"));
  assert.ok(modifierIds.includes("critical"));
  assert.ok(modifierIds.includes("weakness"));
  assert.ok(!modifierIds.includes("weapon-explode-damage"));
  assert.ok(!modifierIds.includes("correction"));
});

test("source and factor links preserve stable anchors and query state", () => {
  assert.equal(
    resolveMultiplierSourceHref({
      type: "perk",
      slot: 3,
      slug: "重峦叠势",
      anchor: "multiplier-provider",
    }),
    "/perks/slot-3/%E9%87%8D%E5%B3%A6%E5%8F%A0%E5%8A%BF#multiplier-provider",
  );
  assert.equal(
    resolveMultiplierFactorHref("dilution", {
      view: "providers",
      modifierTypeId: "all-damage",
    }),
    "/guides?factor=dilution&view=providers&modifier=all-damage#multiplier",
  );
});
