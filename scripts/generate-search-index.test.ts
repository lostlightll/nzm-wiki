import assert from "node:assert/strict";
import test from "node:test";
import {
  createSeasonTalentSearchItem,
  createStatusEffectSearchItem,
  createSummonSearchItem,
  getBuildGuideSearchKeywords,
} from "./generate-search-index";

test("collects structured S3 build guide keywords", () => {
  const keywords = getBuildGuideSearchKeywords({
    summary: "稳定输出示例",
    source: "小小米河",
    weapons: {
      primary: "精绝兽神",
      secondary: "暗夜之殇",
      melee: "冰点双峰",
    },
    perks: {
      primary: {
        1: "slot-1/万钧过载",
        2: "slot-2/出其不意",
      },
      secondary: {
        3: "slot-3/危险膛压",
        4: "slot-4/冲刺得速",
      },
    },
    talent: { tree: "zero", passive: "2030101", route: "43211" },
  });

  for (const keyword of [
    "精绝兽神",
    "小小米河",
    "暗夜之殇",
    "冰点双峰",
    "万钧过载",
    "危险膛压",
    "零点",
    "爆射扭蛋机",
    "43211",
  ]) {
    assert.ok(keywords.includes(keyword), `missing search keyword: ${keyword}`);
  }
});

test("creates an enemy status-effect search item with a stable deep link", () => {
  const item = createStatusEffectSearchItem({
    buffId: 100300001,
    title: "感电",
    target: "enemy",
    keywords: ["电弧", "易伤", "感电"],
  });

  assert.deepEqual(
    {
      title: item.title,
      slug: item.slug,
      path: item.path,
      category: item.category,
      keywords: item.keywords,
    },
    {
      title: "感电",
      slug: "status-effects/enemy/100300001",
      path: "/posts/enemy-buffs?buff=100300001#status-effect-100300001",
      category: "状态效果",
      keywords: ["100300001", "电弧", "易伤", "感电"],
    },
  );
  assert.ok(item.pinyin.includes("gandian"));
  assert.ok(item.pinyin.includes("gd"));
});

test("creates a player status-effect search item and removes duplicate keywords", () => {
  const item = createStatusEffectSearchItem({
    buffId: 110100085,
    title: "渐入佳境",
    target: "player",
    keywords: ["武器伤害", "110100085", "武器伤害"],
  });

  assert.equal(
    item.path,
    "/posts/player-buffs?buff=110100085#status-effect-110100085",
  );
  assert.equal(item.slug, "status-effects/player/110100085");
  assert.deepEqual(item.keywords, ["110100085", "武器伤害"]);
});

test("creates an S3 talent deep link", () => {
  const item = createSeasonTalentSearchItem({
    season: "s3",
    tree: "zero",
    treeName: "零点",
    id: "2030105",
    title: "轰炸扭蛋机",
    kind: "passive",
    keywords: ["爆炸伤害", "扭蛋"],
  });

  assert.equal(item.title, "轰炸扭蛋机");
  assert.equal(item.slug, "season-talents/s3/zero/passive/2030105");
  assert.equal(
    item.path,
    "/guides/season-talents/s3/zero?passive=2030105#multiplier-provider-passive-2030105",
  );
  assert.equal(item.category, "赛季天赋");
  assert.ok(item.keywords.includes("S3"));
  assert.ok(item.keywords.every((keyword) => !/^S[012]$/i.test(keyword)));
});

test("creates an S4 talent deep link with the interactive builder anchor", () => {
  const item = createSeasonTalentSearchItem({
    season: "s4",
    tree: "dual-star",
    treeName: "双星",
    id: "4010202",
    title: "双星齐射",
    kind: "node",
    keywords: ["伴星", "武器伤害"],
  });

  assert.equal(item.slug, "season-talents/s4/dual-star/node/4010202");
  assert.equal(
    item.path,
    "/guides/season-talents/s4/dual-star?node=4010202#season-talent-node-4010202",
  );
  assert.ok(item.keywords.includes("S4"));
});

test("creates a summon mechanic deep link with Buff and multiplier keywords", () => {
  const item = createSummonSearchItem({
    id: "s3-iron-fist:iron-fist-shockwave",
    title: "S3 铁拳狂徒 · 地裂波与冲击",
    summonId: "s3-iron-fist",
    section: "iron-fist-shockwave",
    kind: "mechanic",
    keywords: ["160403101", "冲击", "易伤乘区"],
  });

  assert.equal(item.category, "召唤物");
  assert.equal(
    item.path,
    "/posts/summons?summon=s3-iron-fist&section=iron-fist-shockwave#summon-s3-iron-fist-iron-fist-shockwave",
  );
  assert.equal(
    item.slug,
    "summons/s3-iron-fist/mechanics/iron-fist-shockwave",
  );
  assert.ok(item.keywords.includes("160403101"));
  assert.ok(item.keywords.includes("易伤乘区"));
});
