import assert from "node:assert/strict";
import test from "node:test";
import {
  createSeasonTalentSearchItem,
  createStatusEffectSearchItem,
} from "./generate-search-index";

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

test("creates an S3 talent deep link without inventing older seasons", () => {
  const item = createSeasonTalentSearchItem({
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
