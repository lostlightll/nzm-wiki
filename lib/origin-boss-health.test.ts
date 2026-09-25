import assert from "node:assert/strict";
import test from "node:test";
import { getOriginBossHealth, getOriginRooms } from "./origin-boss-health";

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
