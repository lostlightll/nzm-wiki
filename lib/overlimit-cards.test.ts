import assert from "node:assert/strict";
import test from "node:test";
import { MULTIPLIER_PROVIDERS } from "./multiplier-data";
import { getAllOverlimitCards, getOverlimitCardById } from "./overlimit-cards";

test("all overlimit cards join their perk data by stable ItemID", () => {
  const cards = getAllOverlimitCards();
  assert.equal(cards.length, 147);
  assert.equal(new Set(cards.map((card) => card.id)).size, 147);
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

  assert.equal(
    cards.flatMap((card) => card.effectValues ?? []).some(
      (effect) => effect.kind === "stat",
    ),
    false,
  );
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
});
