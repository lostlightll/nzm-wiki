import assert from "node:assert/strict";
import test from "node:test";
import {
  BASE_DAMAGE_DATA,
  MULTIPLIER_FACTOR_DETAILS,
  buildDamageProfile,
  getApplicableModifierTypes,
  getProviderRelationsForSource,
  getRelationsByFactor,
  resolveMultiplierFactorHref,
  resolveMultiplierSourceHref,
} from "./multiplier-data";

test("factor detail fields come from the Modifier semantic projection", () => {
  assert.deepEqual(MULTIPLIER_FACTOR_DETAILS.element?.attributeFields, [
    {
      name: "GPAttributeSetGiveDamageRatio.KineticDamageRatio",
      selection: { id: "kinetic", label: "动能" },
    },
    {
      name: "GPAttributeSetGiveDamageRatio.FireDamageRatio",
      selection: { id: "fire", label: "火焰" },
    },
    {
      name: "GPAttributeSetGiveDamageRatio.CryoDamageRatio",
      selection: { id: "cryo", label: "冰霜" },
    },
    {
      name: "GPAttributeSetGiveDamageRatio.ShockDamageRatio",
      selection: { id: "shock", label: "电击" },
    },
    {
      name: "GPAttributeSetGiveDamageRatio.CorossiveDamageRatio",
      selection: { id: "corossive", label: "腐蚀" },
    },
    { name: "GPAttributeSetGiveDamageRatio.ElementDamageRatio" },
  ]);
  assert.deepEqual(
    MULTIPLIER_FACTOR_DETAILS["element-vulnerability"]?.attributeFields.map(
      ({ name, selection }) => [name, selection],
    ),
    [
      ["GPAttributeSetBearDamageRatio.KineticDamageBearRatio", undefined],
      ["GPAttributeSetBearDamageRatio.FireDamageBearRatio", undefined],
      ["GPAttributeSetBearDamageRatio.CryoDamageBearRatio", undefined],
      ["GPAttributeSetBearDamageRatio.ShockDamageBearRatio", undefined],
      ["GPAttributeSetBearDamageRatio.CorossiveDamageBearRatio", undefined],
      ["GPAttributeSetBearDamageRatio.ElementDamageBearRatio", undefined],
    ],
  );
  for (const [factorId, detail] of Object.entries(MULTIPLIER_FACTOR_DETAILS)) {
    assert.ok(detail.attributeFields.length > 0, factorId);
  }
});

test("base damage modes keep their authoritative attack values", () => {
  assert.deepEqual(BASE_DAMAGE_DATA, {
    formula: "武器白值 × 模式基础攻击力 = 单次基础伤害",
    modes: [
      { id: "lc", label: "僵尸猎场", baseAttack: 500 },
      { id: "td", label: "塔防", baseAttack: 400 },
    ],
  });
});

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

test("midseason super perks mirror multiplier channels to overlimit cards", () => {
  const cases = [
    ["20704040478", "爆炸直击", ["weapon-hit-damage"]],
    ["20704040480", "超强技能", ["weapon-skill-damage", "skill-damage"]],
    ["20704040482", "暴力切换", ["weapon-damage"]],
    ["20704040483", "隐匿出击", ["all-damage"]],
    ["20704040484", "爆发", ["critical"]],
  ] as const;

  for (const [id, slug, expectedModifierTypes] of cases) {
    const perk = getProviderRelationsForSource({ type: "perk", slot: 4, slug });
    const card = getProviderRelationsForSource({ type: "overlimit-card", id });

    assert.deepEqual(
      perk.map((relation) => relation.modifierTypeId),
      [...expectedModifierTypes],
    );
    assert.deepEqual(
      card.map((relation) => relation.modifierTypeId),
      [...expectedModifierTypes],
    );
    assert.ok(perk.every((relation) => relation.sourceHref?.startsWith("/perks/")));
    assert.ok(
      card.every((relation) => relation.sourceHref === `/overlimit/${id}#multiplier-provider`),
    );
  }
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

test("dawn flame feather passive follows its audited attribute channels", () => {
  const relations = getProviderRelationsForSource({
    type: "weapon",
    slug: "拂晓炎翎",
  });
  assert.deepEqual(
    relations.map((relation) => [relation.modifierTypeId, relation.factorId]),
    [
      ["element", "element"],
      ["weapon-damage", "dilution"],
    ],
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
  assert.ok(modifierIds.includes("element-vulnerability"));
  assert.ok(modifierIds.includes("critical"));
  assert.ok(modifierIds.includes("weakness"));
  assert.ok(!modifierIds.includes("weapon-explode-damage"));
  assert.ok(!modifierIds.includes("correction"));
});

test("source and factor links preserve stable anchors and query state", () => {
  assert.equal(
    resolveMultiplierSourceHref({
      type: "card",
      slug: "blademaster",
      anchor: "multiplier-provider",
    }),
    "/cards/blademaster#multiplier-provider",
  );
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
    "/multiplier?factor=dilution&view=providers&modifier=all-damage",
  );
});

test("audited speedrun cards resolve to weapon damage in dilution", () => {
  for (const slug of ["blademaster", "critical-hit-crazy"]) {
    const relations = getProviderRelationsForSource({ type: "card", slug });
    assert.deepEqual(
      relations.map((relation) => [relation.modifierTypeId, relation.factorId]),
      [["weapon-damage", "dilution"]],
    );
    assert.equal(
      relations[0].sourceHref,
      `/cards/${slug}#multiplier-provider`,
    );
  }
});

test("glass cannon resolves its attack level override to game mode damage", () => {
  const relations = getProviderRelationsForSource({
    type: "card",
    slug: "glass-cannon",
  });
  assert.deepEqual(
    relations.map((relation) => [relation.modifierTypeId, relation.factorId]),
    [["game-mode", "game-mode"]],
  );
  assert.equal(
    relations[0].sourceHref,
    "/cards/glass-cannon#multiplier-provider",
  );
});

test("speedrun card multiplier badges use their registered factors", () => {
  const cases = [
    ["berserker", "independent-amplification", "independent-amplification"],
    ["close-range-shot", "independent-amplification", "independent-amplification"],
    ["weak-point-boost", "weapon-damage", "dilution"],
  ] as const;

  for (const [slug, modifierTypeId, factorId] of cases) {
    const relations = getProviderRelationsForSource({ type: "card", slug });
    assert.deepEqual(
      relations.map((relation) => [relation.modifierTypeId, relation.factorId]),
      [[modifierTypeId, factorId]],
    );
    assert.equal(relations[0].sourceHref, `/cards/${slug}#multiplier-provider`);
  }
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

test("overlimit bond providers follow their numerical attribute channels", () => {
  const cases = [
    ["弹药", 6, "game-mode", "game-mode"],
    ["狙击", 2, "game-mode", "game-mode"],
    ["狂战", 2, "game-mode", "game-mode"],
    ["技战", 4, "weapon-damage", "dilution"],
  ] as const;

  for (const [name, count, modifierTypeId, factorId] of cases) {
    const relations = getProviderRelationsForSource({
      type: "overlimit-bond",
      name,
      count,
    });
    assert.deepEqual(
      relations.map((relation) => [relation.modifierTypeId, relation.factorId]),
      [[modifierTypeId, factorId]],
    );
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

test("black powder uses the element vulnerability factor", () => {
  const relations = getProviderRelationsForSource({
    type: "weapon",
    slug: "暗夜之殇",
  });
  assert.ok(relations.length > 0);
  assert.ok(
    relations.every(
      (relation) =>
        relation.modifierTypeId === "element-vulnerability" &&
        relation.factorId === "element-vulnerability" &&
        relation.factorLabel === "元素易伤乘区",
    ),
  );
});
