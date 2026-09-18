import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  BASE_DAMAGE_DATA,
  DILUTION_CATEGORIES,
  MULTIPLIER_FACTOR_DETAILS,
  MULTIPLIER_PROVIDERS,
  PROVIDER_RELATIONS,
  WEAKPOINT_MULTIPLIER_DATA,
  buildDamageProfile,
  getApplicableModifierTypes,
  getProviderRelationsForSource,
  getSourcesForModifierType,
  getRelationsByFactor,
  resolveMultiplierFactorHref,
  resolveMultiplierExampleImage,
  resolveMultiplierSourceHref,
} from "./multiplier-data";
import { getOverlimitCatalog, getOverlimitPreviewCatalog } from "./overlimit";
import { getOverlimitLinksForPerk, hasOverlimitBondStage } from "./overlimit-links";

test("perk links and relations isolate preview while ordinary season labels retain current identity", () => {
  const current = MULTIPLIER_PROVIDERS.find(provider => provider.source.type === "perk" && !provider.source.season)!;
  assert.equal(current.source.type, "perk");
  if (current.source.type !== "perk") return;
  const source = current.source;
  const currentRelations = getProviderRelationsForSource(source);
  assert.ok(currentRelations.length > 0);
  assert.deepEqual(getProviderRelationsForSource({ ...source, season: "s3" }), currentRelations);
  assert.equal(resolveMultiplierSourceHref({ ...source, season: "s3" }), resolveMultiplierSourceHref(source));
  const previewSource = { ...source, season: "s4-preview" };
  assert.ok(resolveMultiplierSourceHref(previewSource).startsWith("/perks/preview/slot-"));
  assert.ok(getProviderRelationsForSource(previewSource).every(relation => relation.effectId !== current.id));

  const preview = MULTIPLIER_PROVIDERS.find(provider => provider.source.type === "perk" && provider.source.season === "s4-preview")!;
  assert.ok(getProviderRelationsForSource(preview.source).every(relation => relation.sourceHref?.startsWith("/perks/preview/")));
});

test("preview audit publishes coefficient units and scoped source links instead of zero bases", () => {
  const preview = getOverlimitPreviewCatalog()!;
  const cases = [
    ["20703040085", "weapon-damage", "+0.4%", "每层"],
    ["20703040201", "weapon-damage", "+9%", "每层"],
    ["20703040036", "weapon-skill-damage", "+1%", "每层"],
    ["20703040072", "weapon-damage", "+5%", "13米"],
    ["20703040472", "all-damage", "+2%", "冲击波"],
    ["20703040478", "weapon-hit-damage", "+4.5%", "每层"],
    ["20703040432", "weapon-damage", "+14%", "第7"],
  ];
  for (const [id, facetId, value, condition] of cases) {
    const card = preview.cards.find(card => card.id === id)!;
    const effect = card.effectValues?.find(effect => effect.kind === "damage" && effect.modifierTypeId === facetId);
    assert.ok(effect, `${id}: ${facetId}`);
    assert.ok(effect.stages.some(stage => stage.value === value && stage.condition?.includes(condition)), id);
    assert.ok(getProviderRelationsForSource({ type: "overlimit-card", id, season: "s4-preview" })
      .some(relation => relation.modifierTypeId === facetId && relation.sourceHref?.startsWith("/overlimit/preview/")), id);
  }
});

test("unresolved B2 cards expose parameters and correction links without inventing damage percentages", () => {
  const preview = getOverlimitPreviewCatalog()!;
  for (const [id, value] of [["1317100001", "1"]]) {
    const card = preview.cards.find(card => card.id === id)!;
    const effect = card.effectValues?.find(effect => effect.kind === "stat" && effect.statId === "correction-parameter");
    assert.equal(effect?.stages[0].value, value);
    assert.doesNotMatch(card.description, /600%|100%|7倍/);
    assert.ok(card.verification);
    assert.ok(getProviderRelationsForSource({ type: "overlimit-card", id, season: "s4-preview" })
      .some(relation => relation.modifierTypeId === "correction-parameter" && relation.factorId === "correction"));
  }
});

test("last shot publishes reviewed 600 percent and bidirectional correction links", () => {
  const card = getOverlimitPreviewCatalog()!.cards.find(card => card.id === "1317108001")!;
  const effect = card.effectValues?.find(effect => effect.kind === "damage" && effect.modifierTypeId === "correction");
  assert.equal(effect?.stages[0].value, "+600%");
  assert.equal(effect?.label, "增伤");
  assert.equal(effect?.stages[0].condition, "弹匣最后一发");
  assert.equal(card.verification, undefined);
  assert.ok(getProviderRelationsForSource({ type: "overlimit-card", id: card.id, season: "s4-preview" })
    .some(relation => relation.modifierTypeId === "correction"));
  assert.ok(getSourcesForModifierType("correction").some(({ source }) =>
    source?.type === "overlimit-card" && source.id === card.id && source.season === "s4-preview"));
});

test("super critical indexes reviewed preview providers without treating proc chance as damage or inferring targets", () => {
  const sources = getSourcesForModifierType("super-critical-rate");
  assert.deepEqual(sources.map(source => source.effectId).sort(), [
    "overlimit-card:s4-preview:1317115001", "overlimit-card:s4-preview:1317116001",
    "overlimit-card:s4-preview:1317117001", "overlimit-bond:s4-preview:瞬暴:8",
  ].sort());
  for (const source of sources) {
    assert.equal(source.factorId, "super-critical");
    assert.equal(source.factorLabel, "会心乘区");
    assert.ok(source.sourceHref?.startsWith("/overlimit/preview"));
    assert.ok(getProviderRelationsForSource(source.source!).includes(source));
  }
  for (const id of ["1317115001", "1317116001", "1317117001"]) {
    assert.equal(getProviderRelationsForSource({ type: "overlimit-card", id }).length, 0);
    const card = getOverlimitPreviewCatalog()!.cards.find(card => card.id === id)!;
    assert.ok(card.effectValues?.some(effect => effect.kind === "stat" && effect.statId === "super-critical-rate"));
    assert.ok(!card.effectValues?.some(effect => effect.kind === "damage"));
  }
  assert.ok(!getApplicableModifierTypes({
    settlements: ["Numerical.SettlementType.Health.WeaponDamage"], enableCritical: true,
  }).some(relation => relation.factorId === "super-critical"));
});

test("typical examples use site artwork except for the hunting shop fallback", () => {
  const examples = [
    ...DILUTION_CATEGORIES.flatMap(({ examples }) => examples),
    ...Object.values(MULTIPLIER_FACTOR_DETAILS).flatMap(
      ({ examples }) => examples,
    ),
    ...WEAKPOINT_MULTIPLIER_DATA.specialSources.items,
  ];

  for (const example of examples) {
    const image = resolveMultiplierExampleImage(example);

    if (example.id === "hunting-shop-attack") {
      assert.equal(image, undefined);
      continue;
    }

    assert.ok(image, `${example.label} 缺少站内素材`);
    assert.ok(
      existsSync(join(process.cwd(), "public", ...image.split("/").filter(Boolean))),
      `${example.label} 的站内素材不存在：${image}`,
    );
  }
});

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

test("current publication controls card placements without removing ordinary perks", () => {
  const catalog = getOverlimitCatalog();
  const cardsById = new Map(catalog.cards.map(card => [card.id, card]));
  const perkProviders = MULTIPLIER_PROVIDERS.filter(provider => provider.source.type === "perk");
  assert.ok(perkProviders.length > 0);
  for (const provider of perkProviders) {
    const source = provider.source;
    if (source.type !== "perk") continue;
    const perkRelations = getProviderRelationsForSource({
      type: "perk", slot: source.slot, slug: source.slug, season: source.season,
    }).filter(relation => relation.effectId === provider.id);
    assert.deepEqual(perkRelations.map(relation => relation.modifierTypeId).sort(),
      [...new Set(provider.modifierTypeIds)].sort(), provider.id);
    assert.ok(perkRelations.every(relation => relation.sourceHref?.startsWith("/perks/")));

    const sourceCatalog = source.season ? getOverlimitPreviewCatalog() : catalog;
    const links = getOverlimitLinksForPerk(source.itemId, source.season);
    assert.deepEqual(links.map(card => card.id).sort(),
      (sourceCatalog?.cards ?? []).filter(card => card.perkItemId === source.itemId).map(card => card.id).sort(),
      `published links for ${provider.id}`);
    const expected = links.flatMap(card => card.damageFacets
      .filter(facet => provider.modifierTypeIds.includes(facet))
      .map(facet => `${card.id}:${facet}`)).sort();
    const actual = PROVIDER_RELATIONS.filter(relation =>
      relation.effectId === provider.id && relation.source?.type === "overlimit-card");
    assert.deepEqual(actual.map(relation => {
      assert.equal(relation.source?.type, "overlimit-card");
      if (relation.source?.type !== "overlimit-card") throw new Error("Unexpected placement");
      const placement = relation.source;
      assert.ok(sourceCatalog?.cards.some(card => card.id === placement.id), "removed cards must not retain links");
      assert.equal(relation.source.season, source.season);
      assert.equal(relation.sourceHref, `/overlimit/${source.season ? "preview/" : ""}${relation.source.id}#multiplier-provider`);
      return `${relation.source.id}:${relation.modifierTypeId}`;
    }).sort(), expected, provider.id);
  }
  for (const relation of PROVIDER_RELATIONS) {
    if (relation.source?.type === "overlimit-card") {
      const source = relation.source;
      const card = source.season
        ? getOverlimitPreviewCatalog()?.cards.find(card => card.id === source.id)
        : cardsById.get(source.id);
      assert.ok(card, relation.sourceHref);
      assert.ok(card.effectValues?.some(effect =>
        (effect.kind === "damage" ? effect.modifierTypeId : effect.statId) === relation.modifierTypeId), relation.sourceHref);
    }
  }
});

test("midseason super perks retain their audited multiplier channels", () => {
  const cases = [
    ["爆炸直击", ["weapon-hit-damage"]],
    ["超强技能", ["weapon-skill-damage", "skill-damage"]],
    ["暴力切换", ["weapon-damage"]],
    ["隐匿出击", ["all-damage"]],
    ["爆发", ["critical"]],
  ] as const;
  for (const [slug, expectedModifierTypes] of cases) {
    const perk = getProviderRelationsForSource({ type: "perk", slot: 4, slug });
    assert.deepEqual(perk.map(relation => relation.modifierTypeId), [...expectedModifierTypes]);
    assert.ok(perk.every(relation => relation.sourceHref?.startsWith("/perks/")));
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

test("only published bond stages retain multiplier placements", () => {
  const catalog = getOverlimitCatalog();
  for (const provider of MULTIPLIER_PROVIDERS) {
    const source = provider.source;
    if (source.type !== "overlimit-bond") continue;
    const edition = source.season ? getOverlimitPreviewCatalog() : catalog;
    const published = (edition?.bonds ?? []).some(bond =>
      bond.name === source.name && bond.effects.some(effect => effect.count === source.count));
    assert.equal(hasOverlimitBondStage(source.name, source.count, source.season), published);
    const relations = getProviderRelationsForSource(source)
      .filter(relation => relation.effectId === provider.id);
    assert.deepEqual(relations.map(relation => relation.modifierTypeId).sort(),
      published ? [...new Set(provider.modifierTypeIds)].sort() : [], provider.id);
    for (const relation of relations) {
      assert.equal(relation.sourceHref,
        `/overlimit${source.season ? "/preview" : ""}?module=bonds#bond-${encodeURIComponent(source.name)}-${source.count}`);
    }
  }
  for (const relation of PROVIDER_RELATIONS) {
    if (relation.source?.type === "overlimit-bond") {
      assert.ok(hasOverlimitBondStage(relation.source.name, relation.source.count, relation.source.season),
        relation.sourceHref);
    }
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
