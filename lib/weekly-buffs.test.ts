import assert from "node:assert/strict";
import test from "node:test";
import {
  getWeeklyBuffRotationWindow,
  getWeeklyBuffsForRotation,
  WEEKLY_BUFF_POOLS,
} from "./weekly-buffs";

test("周 Buff 每七天按三组循环", () => {
  assert.equal(
    getWeeklyBuffRotationWindow(Date.parse("2025-10-20T05:00:00+08:00")).rotationIndex,
    1,
  );
  assert.equal(
    getWeeklyBuffRotationWindow(Date.parse("2025-10-27T05:00:00+08:00")).rotationIndex,
    2,
  );
  assert.equal(
    getWeeklyBuffRotationWindow(Date.parse("2025-11-03T05:00:00+08:00")).rotationIndex,
    3,
  );
  assert.equal(
    getWeeklyBuffRotationWindow(Date.parse("2025-11-10T05:00:00+08:00")).rotationIndex,
    1,
  );
});

test("每个地图池的每周轮换都解析为三个 Buff", () => {
  for (const pool of WEEKLY_BUFF_POOLS) {
    for (const rotationIndex of [1, 2, 3]) {
      assert.equal(getWeeklyBuffsForRotation(pool, rotationIndex).length, 3);
    }
  }
});

test("当前配置日期落在第三组轮换", () => {
  assert.equal(
    getWeeklyBuffRotationWindow(Date.parse("2026-08-09T12:00:00+08:00"))
      .rotationIndex,
    3,
  );
});
