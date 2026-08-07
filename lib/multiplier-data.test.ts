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
  assert.equal(perk[0].effectId, "perk:20703040436");
  assert.equal(card[0].effectId, "perk:20703040436");
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
    resolveMultiplierSourceHref({
      type: "season-talent",
      season: "s3",
      tree: "grappling-hook",
      nodeId: "3003501",
      anchor: "multiplier-provider-node-3003501",
    }),
    "/guides/season-talents/s3/grappling-hook?node=3003501#multiplier-provider-node-3003501",
  );
  assert.equal(
    resolveMultiplierSourceHref({
      type: "season-talent",
      season: "s3",
      tree: "zero",
      passiveId: "2030104",
      anchor: "multiplier-provider-passive-2030104",
    }),
    "/guides/season-talents/s3/zero?passive=2030104#multiplier-provider-passive-2030104",
  );
  assert.equal(
    resolveMultiplierFactorHref("dilution", {
      view: "providers",
      modifierTypeId: "all-damage",
    }),
    "/guides?factor=dilution&view=providers&modifier=all-damage#multiplier",
  );
});

test("named provider regressions expose their audited modifier types", () => {
  const cases = [
    [{ type: "perk", slot: 4, slug: "独弹强化" } as const, ["correction"]],
    [{ type: "perk", slot: 4, slug: "冥河送葬" } as const, ["weapon-damage"]],
    [{ type: "perk", slot: 3, slug: "致命节拍" } as const, ["weapon-damage"]],
    [{ type: "perk", slot: 4, slug: "腐蚀榴弹" } as const, ["weapon-damage"]],
    [{ type: "perk", slot: 3, slug: "射击属性-20703040445" } as const, ["weapon-hit-damage"]],
    [{ type: "weapon", slug: "Z型步枪" } as const, ["weapon-hit-damage"]],
  ] as const;

  for (const [source, expected] of cases) {
    const actual = getProviderRelationsForSource(source).map(
      (relation) => relation.modifierTypeId,
    );
    for (const modifierTypeId of expected) assert.ok(actual.includes(modifierTypeId));
  }
});

test("numerical damage-ratio providers stay in the dilution channels", () => {
  const cases = [
    [{ type: "perk", slot: 3, slug: "伏击弹药" } as const, "weapon-damage"],
    [{ type: "perk", slot: 4, slug: "肾上腺素" } as const, "weapon-damage"],
    [{ type: "perk", slot: 4, slug: "恶鬼眷顾" } as const, "weapon-hit-damage"],
  ] as const;

  for (const [source, modifierTypeId] of cases) {
    const relations = getProviderRelationsForSource(source);
    assert.ok(relations.some((relation) => relation.modifierTypeId === modifierTypeId));
    assert.ok(relations.every((relation) => relation.factorId === "dilution"));
  }
});

test("vulnerability providers use the unified factor name", () => {
  const relations = getProviderRelationsForSource({
    type: "perk",
    slot: 3,
    slug: "近战易伤",
  });
  assert.ok(relations.length > 0);
  assert.ok(relations.every((relation) => relation.factorId === "vulnerability"));
  assert.ok(relations.every((relation) => relation.factorLabel === "易伤乘区"));
});
