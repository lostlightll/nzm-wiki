import assert from "node:assert/strict";
import test from "node:test";
import {
  getWeeklyBuffRotationWindow,
  getWeeklyBuffsForRotation,
  WEEKLY_BUFFS,
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

test("增伤索引只保存规范乘区，不保存具体增伤类型", () => {
  const expectedFactors = new Map<number, string>([
    [1398001400, "dilution"],
    [1398001420, "dilution"],
    [1398001430, "dilution"],
    [1398001440, "dilution"],
    [1398001460, "dilution"],
    [1398001470, "dilution"],
    [1398001500, "dilution"],
    [1398001520, "dilution"],
    [1398001540, "dilution"],
  ]);

  for (const [id, factorId] of expectedFactors) {
    assert.equal(WEEKLY_BUFFS[id].indexKind, "direct");
    assert.equal(WEEKLY_BUFFS[id].factorId, factorId);
    assert.equal(WEEKLY_BUFFS[id].indexLabel, undefined);
    assert.equal("modifierTypeId" in WEEKLY_BUFFS[id], false);
  }
});

test("暴击率和额外伤害不冒充乘区", () => {
  for (const buff of Object.values(WEEKLY_BUFFS)) {
    if (buff.indexKind !== "critical" && buff.indexKind !== "extra") continue;
    assert.equal(buff.factorId, undefined);
    assert.ok(buff.indexLabel);
  }
});
