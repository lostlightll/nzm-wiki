import assert from "node:assert/strict";
import test from "node:test";
import rawOverlimitCards from "@/data/overlimit-cards.json";
import { MULTIPLIER_PROVIDERS } from "./multiplier-data";
import { getAllOverlimitCards, getOverlimitCardById } from "./overlimit-cards";
import { getPerkByItemId } from "./perks";

test("all overlimit cards join their perk data by stable ItemID", () => {
  const cards = getAllOverlimitCards();
  assert.equal(cards.length, 147);
  assert.equal(new Set(cards.map((card) => card.id)).size, 147);
});

test("overlimit cards retain their concise card descriptions", () => {
  const rawDescriptions = new Map(
    rawOverlimitCards.map((card) => [card.id, card.description] as const),
  );
  for (const card of getAllOverlimitCards()) {
    assert.equal(card.description, rawDescriptions.get(card.id), card.name);
  }
  assert.equal(
    getOverlimitCardById("20703040437")?.description,
    "武器命中有 5% 概率产生爆炸伤害（CD2秒）",
  );
  assert.equal(
    getOverlimitCardById("20703040382")?.description,
    "抽扭蛋掉落能够增加移速和暴击的能量球。",
  );
  assert.equal(
    getOverlimitCardById("20703040474")?.description,
    "暴击时，向身前投射一个毒液罐，爆炸留下毒属性伤害区域并且减速敌人（CD5秒）。",
  );
});

test("reviewed perk descriptions reject stale MGE values", () => {
  assert.equal(
    getPerkByItemId("20703040437")?.description,
    "武器命中时有<strong>5%</strong>概率产生爆炸伤害，冷却时间<strong>2</strong>秒。",
  );
  assert.equal(
    getPerkByItemId("20703040471")?.description,
    "爆炸命中时发射<strong>2</strong>枚跟踪导弹；仅命中<strong>1</strong>个单位时发射<strong>5</strong>枚，冷却时间<strong>2</strong>秒。",
  );
});

test("all overlimit damage providers have exact structured values", () => {
  const cards = getAllOverlimitCards();
  const providers = MULTIPLIER_PROVIDERS.filter(
    (provider) =>
      provider.source.type === "perk" && provider.source.overlimitCard,
  );
  assert.equal(providers.length, 58);

  for (const provider of providers) {
    const source = provider.source;
    assert.equal(source.type, "perk");
    if (source.type !== "perk") continue;
    const card = cards.find((item) => item.id === source.itemId);
    assert.ok(card, source.itemId);
    const actual = (card.effectValues ?? [])
      .filter((effect) => effect.kind === "damage")
      .map((effect) => effect.modifierTypeId)
      .sort();
    const expected = [...new Set(provider.modifierTypeIds)].sort();
    assert.deepEqual(actual, expected, card.name);
  }

});

test("all reviewed overlimit stat sources have exact structured types", () => {
  const expected = [
    ["20703040136", "toughness-efficiency"],
    ["20703040448", "critical-rate"],
    ["20703040460", "critical-rate"],
    ["20703040406", "critical-rate"],
    ["20703040406", "movement-speed"],
    ["20703040115", "critical-rate"],
    ["20703040382", "critical-rate"],
    ["20703040382", "movement-speed"],
    ["20703040028", "critical-rate"],
    ["20703040116", "critical-rate"],
    ["20704040477", "critical-rate"],
    ["20703040391", "critical-rate"],
    ["20703040102", "charge-efficiency"],
    ["20703040404", "charge-efficiency"],
    ["20703040182", "charge-efficiency"],
    ["20703040385", "charge-efficiency"],
    ["20703040447", "charge-efficiency"],
    ["20703040459", "charge-efficiency"],
    ["20703040092", "fire-rate"],
    ["20703040341", "fire-rate"],
    ["20703040407", "fire-rate"],
    ["20703040410", "fire-rate"],
    ["20703040424", "fire-rate"],
    ["20703040429", "fire-rate"],
    ["20703040338", "fire-rate"],
    ["20703040450", "damage-reduction"],
    ["20703040462", "damage-reduction"],
    ["20703040405", "reload-speed"],
    ["20703040152", "reload-speed"],
    ["20703040384", "movement-speed"],
    ["20703040475", "movement-speed"],
    ["20703040344", "skill-range"],
    ["20703040409", "melee-attack-speed"],
    ["20703040043", "explosion-radius"],
    ["20703040254", "effective-range"],
  ].sort(([leftId, leftType], [rightId, rightType]) =>
    `${leftId}:${leftType}`.localeCompare(`${rightId}:${rightType}`),
  );
  const actual =
    getAllOverlimitCards().flatMap((card) =>
      (card.effectValues ?? [])
        .filter((effect) => effect.kind === "stat")
        .map((effect) => [card.id, effect.statId] as const),
    ).sort(([leftId, leftType], [rightId, rightType]) =>
      `${leftId}:${leftType}`.localeCompare(`${rightId}:${rightType}`),
    );

  assert.deepEqual(actual, expected);
});

test("key cards expose their reviewed player-facing values", () => {
  const flameBlade = getOverlimitCardById("20703040334");
  assert.deepEqual(flameBlade?.effectValues, [
    {
      kind: "damage",
      modifierTypeId: "weapon-hit-damage",
      label: "射击伤害",
      stages: [
        { condition: "命中首个敌人", value: "+100%" },
        { condition: "主动技能期间", value: "+200%" },
      ],
    },
  ]);

  const perpetualRampage = getOverlimitCardById("20703040406");
  assert.deepEqual(perpetualRampage?.effectValues, [
    {
      kind: "damage",
      modifierTypeId: "critical",
      label: "暴击伤害",
      stages: [{ value: "+200%" }],
    },
    {
      kind: "stat",
      statId: "critical-rate",
      label: "暴击率",
      stages: [{ value: "+50%" }],
    },
    {
      kind: "stat",
      statId: "movement-speed",
      label: "移动速度",
      stages: [{ value: "+25%" }],
    },
  ]);
});

test("structured values cover stacks, dynamic conversion, and dual channels", () => {
  assert.deepEqual(
    getOverlimitCardById("20703040435")?.effectValues?.[0].stages,
    [
      { condition: "每层", value: "+30%" },
      { condition: "10层", value: "+300%" },
    ],
  );
  assert.deepEqual(
    getOverlimitCardById("20703040436")?.effectValues?.[0].stages,
    [
      { condition: "每层", value: "+30%" },
      { condition: "10层", value: "+300%" },
    ],
  );
  assert.deepEqual(
    getOverlimitCardById("20703040475")?.effectValues?.[0].stages,
    [
      { condition: "每1%移动速度", value: "+4%" },
      { condition: "100%移动速度", value: "+400%" },
    ],
  );
  assert.deepEqual(
    getOverlimitCardById("20704040480")?.effectValues?.map((effect) =>
      effect.kind === "damage" ? effect.modifierTypeId : effect.statId,
    ),
    ["weapon-skill-damage", "skill-damage"],
  );
  assert.deepEqual(
    getOverlimitCardById("20703040102")?.effectValues?.[0].stages,
    [
      { condition: "每发", value: "+0.8%" },
      { condition: "100层", value: "+80%" },
    ],
  );
});

test("Numerical values override stale overlimit descriptions", () => {
  assert.equal(
    getOverlimitCardById("20704040478")?.effectValues?.[0].stages[0].value,
    "+300%",
  );
  assert.equal(
    getOverlimitCardById("20703040464")?.effectValues?.[0].stages[0].value,
    "+30%",
  );
  assert.equal(
    getOverlimitCardById("20703040459")?.effectValues?.[0].stages[0].value,
    "+10%",
  );
  assert.deepEqual(
    getOverlimitCardById("20703040446")?.effectValues?.map((effect) =>
      effect.kind === "damage" ? effect.modifierTypeId : effect.statId,
    ),
    ["weapon-skill-damage", "skill-damage"],
  );
});
