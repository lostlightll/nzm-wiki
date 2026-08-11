import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  HUNTING_SPEEDRUN_CARDS,
  HUNTING_SPEEDRUN_TACTICAL_PROPS,
} from "./hunting-speedrun";

const EXPECTED_CARD_IDS = [
  10044, 10042, 10039, 10038, 10037, 10035, 10034, 10032, 10031, 10030,
  10029, 10028, 10027, 10026, 10025, 10024, 10023, 10021, 10020, 10004,
  10003, 10002, 10001, 10048, 10047, 10046, 10045, 10043, 10041, 10033,
  10022, 10015, 10014, 10013, 10008, 10007, 10006, 10005,
];

const EXPECTED_PROP_NAMES = [
  "禁用复活币",
  "单人护盾",
  "团队护盾",
  "对方减速",
  "凌空泼墨",
  "时空闪电",
  "意念干扰",
  "时空导弹",
  "闪光弹",
  "禁用武器技能",
];

test("猎场竞速保留 38 张当前卡片的既有顺序", () => {
  assert.deepEqual(
    HUNTING_SPEEDRUN_CARDS.map((card) => card.cardId),
    EXPECTED_CARD_IDS,
  );
  assert.equal(new Set(EXPECTED_CARD_IDS).size, HUNTING_SPEEDRUN_CARDS.length);

  for (const card of HUNTING_SPEEDRUN_CARDS) {
    assert.equal(
      fs.existsSync(path.join(process.cwd(), "data", "cards", `${card.slug}.mdx`)),
      true,
      `${card.title} 缺少详情页`,
    );
    assert.equal(
      fs.existsSync(path.join(process.cwd(), "public", card.icon.replace(/^\//, ""))),
      true,
      `${card.title} 缺少卡面`,
    );
  }
});

test("猎场竞速收录 IsDisplay = 1 的 10 项战术道具", () => {
  assert.deepEqual(
    HUNTING_SPEEDRUN_TACTICAL_PROPS.map((prop) => prop.id),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
  assert.deepEqual(
    HUNTING_SPEEDRUN_TACTICAL_PROPS.map((prop) => prop.name),
    EXPECTED_PROP_NAMES,
  );

  for (const prop of HUNTING_SPEEDRUN_TACTICAL_PROPS) {
    assert.equal(path.extname(prop.icon), ".webp");
    assert.equal(
      fs.existsSync(path.join(process.cwd(), "public", prop.icon.replace(/^\//, ""))),
      true,
      `${prop.name} 缺少图标`,
    );
  }
});
