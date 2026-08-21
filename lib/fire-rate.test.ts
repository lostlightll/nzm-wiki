import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  FIRE_RATE_EXCLUSIONS,
  WEAPON_FIRE_RATE_SOURCES,
  getBaseFireRateEntries,
  getOverlimitFireRateSources,
  getPerkFireRateSources,
} from "./fire-rate";

const expectedWeapons = new Map([
  ["星海狂想", ["+50%"]],
  ["死亡猎手", ["+50%"]],
  ["元宵来袭", ["+40%"]],
  ["死神猎手", ["+40%"]],
  ["爆星", ["+30%"]],
  ["维和者", ["+30%"]],
  ["黄沙风暴", ["+30%"]],
  ["裁决之眼", ["+30%"]],
  ["超级复合弓", ["+30%"]],
  ["钢铁游隼", ["+20%"]],
  ["振弦", ["+3%", "+15%"]],
]);

test("weapon fire-rate registry has exact reviewed sources and valid links", () => {
  const actual = new Map(
    WEAPON_FIRE_RATE_SOURCES.map((source) => [
      source.slug,
      source.stages.map((stage) => stage.value),
    ]),
  );
  assert.deepEqual(actual, expectedWeapons);

  for (const source of WEAPON_FIRE_RATE_SOURCES) {
    assert.ok(source.stages.length > 0, source.id);
    assert.ok(
      fs.existsSync(path.join(process.cwd(), "data/weapons", `${source.slug}.mdx`)),
      source.slug,
    );
  }

});

test("all perk entities and overlimit cards expose exact fire-rate sets", () => {
  const perks = getPerkFireRateSources();
  assert.deepEqual(
    new Set(perks.map(({ perk }) => perk.name)),
    new Set([
      "不死狂热",
      "反哺",
      "哈士奇支援",
      "幸运龙炎",
      "狂热兽魂",
      "狂轰乱炸",
      "腐蚀狂热",
      "霜华",
    ]),
  );
  assert.deepEqual(
    new Set(
      perks
        .filter(({ perk }) => perk.collectModItem === 0)
        .map(({ perk }) => perk.name),
    ),
    new Set(["不死狂热", "狂轰乱炸"]),
  );

  const cards = getOverlimitFireRateSources();
  assert.deepEqual(
    new Set(cards.map(({ card }) => card.name)),
    new Set([
      "反哺",
      "哈士奇支援",
      "幸运龙炎",
      "狂热兽魂",
      "狂轰乱炸",
      "不死狂热",
      "霜华",
    ]),
  );

  for (const { effect } of [...perks, ...cards]) {
    assert.equal(effect.statId, "fire-rate");
    assert.ok(effect.stages.length > 0);
  }

  assert.deepEqual(
    cards.find(({ card }) => card.name === "不死狂热")?.effect.stages,
    [{ condition: "红扭蛋效果存在时", value: "+50%" }],
  );
  assert.deepEqual(
    cards.find(({ card }) => card.name === "幸运龙炎")?.effect.stages,
    [{ condition: "抽到红扭蛋后20秒内", value: "+50%" }],
  );
});

test("base fire-rate entries are resolved from weapon sources", async () => {
  const entries = await getBaseFireRateEntries();
  const bySlug = new Map(entries.map((entry) => [entry.slug, entry]));

  assert.equal(bySlug.get("星海狂想")?.baseRpm, 375);
  assert.ok(Math.abs((bySlug.get("星海狂想")?.maxRpm ?? 0) - 825.3095) < 0.001);
  assert.ok(
    Math.abs((bySlug.get("星海狂想")?.combinedMaxRpm ?? 0) - 1237.9642) <
      0.001,
  );
  assert.equal(bySlug.get("纯白至上")?.baseRpm, 300);
  assert.ok(Math.abs((bySlug.get("纯白至上")?.maxRpm ?? 0) - 660.066) < 0.001);
  assert.ok(Math.abs((bySlug.get("冥河之矛")?.baseRpm ?? 0) - 285.7143) < 0.001);
  assert.ok(Math.abs((bySlug.get("冥河之矛")?.maxRpm ?? 0) - 857.1429) < 0.001);
});

test("fire-rate exclusions cover non-player and unavailable sources", () => {
  assert.deepEqual(
    new Set(FIRE_RATE_EXCLUSIONS.map((entry) => entry.category)),
    new Set([
      "summon-fire-rate",
      "melee-attack-speed",
      "fixed-action-cadence",
      "obsolete",
      "no-public-entity",
      "unverified-current-link",
    ]),
  );
  assert.ok(FIRE_RATE_EXCLUSIONS.some((entry) => entry.id === "resource:121200031"));
  assert.ok(FIRE_RATE_EXCLUSIONS.some((entry) => entry.id === "resource:120600290"));
  assert.ok(FIRE_RATE_EXCLUSIONS.some((entry) => entry.id === "resource:121400010"));
  assert.ok(FIRE_RATE_EXCLUSIONS.some((entry) => entry.id === "resource:120100200"));
  assert.ok(FIRE_RATE_EXCLUSIONS.some((entry) => entry.id === "resource:120700070"));
});
