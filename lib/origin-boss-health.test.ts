import assert from "node:assert/strict";
import test from "node:test";
import { getOriginBossDisplayHealth, getOriginBossHealth, getOriginBossRoomIndices, getOriginRooms, ORIGIN_ROUTES } from "./origin-boss-health";

test("origin health uses its own difficulty and room factors", () => {
  assert.deepEqual(getOriginBossHealth("鬼舞樱", "heroic", null), [57600]);
  assert.deepEqual(getOriginBossHealth("鬼舞樱", "heroic", 3), [288000]);
  assert.deepEqual(getOriginBossHealth("幽魂骑士", "torment", 7),
    [Math.round(115200 * 63.02589), Math.round(172800 * 63.02589)]);
  assert.equal(getOriginRooms("torment").length, 15);
});

test("unavailable bosses and difficulties do not inherit classic health", () => {
  assert.equal(getOriginBossHealth("鬼舞樱", "inferno", 99), undefined);
  assert.equal(getOriginBossHealth("白胡子鱼王", "heroic", null), undefined);
  assert.equal(getOriginBossHealth("典狱长杰斯", "torment", null), undefined);
  assert.deepEqual(getOriginBossHealth("典狱长杰斯", "inferno", null), [144000]);
});

test("inferno routes follow reviewed boss order and room indices", () => {
  assert.deepEqual(ORIGIN_ROUTES.map((route) => route.name), ["精绝女王线", "幽魂骑士线", "引渡者线"]);
  assert.deepEqual(ORIGIN_ROUTES.map((route) => route.difficulties.inferno?.map((boss) => boss.slug)), [
    ["白胡子鱼王", "精绝奴隶主", "精绝女王"],
    ["鬼舞樱", "白毛狼王", "幽魂骑士"],
    ["鬼面将军", "典狱长杰斯", "引渡者"],
  ]);
  assert.deepEqual(ORIGIN_ROUTES[0].difficulties.inferno?.map((boss) => boss.roomIndices), [[3], [7], [10, 11]]);
  assert.deepEqual(getOriginBossRoomIndices("引渡者", "inferno"), [10]);
});

test("inferno stage health matches reviewed calculation", () => {
  assert.deepEqual(getOriginBossDisplayHealth("白胡子鱼王", "inferno", null), [874238]);
  assert.deepEqual(getOriginBossDisplayHealth("幽魂骑士", "inferno", null), [7637005, 11455508]);
  assert.deepEqual(getOriginBossDisplayHealth("精绝女王", "inferno", null), [9546257, 9546257]);
  assert.deepEqual(getOriginBossDisplayHealth("引渡者", "inferno", null), [19092514]);
  assert.deepEqual(getOriginBossDisplayHealth("幽魂骑士", "inferno", 7), [2555539, 3833309]);
});

test("unreviewed difficulties retain base health", () => {
  assert.equal(getOriginBossRoomIndices("幽魂骑士", "torment"), null);
  assert.deepEqual(getOriginBossDisplayHealth("幽魂骑士", "torment", null), [115200, 172800]);
  assert.deepEqual(getOriginBossDisplayHealth("鬼舞樱", "heroic", null), [57600]);
  assert.equal(getOriginBossDisplayHealth("精绝女王", "torment", null), undefined);
});
