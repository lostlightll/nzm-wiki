import assert from "node:assert/strict";
import test from "node:test";
import { appearanceKey, explicitHealth } from "./import-hunter-monsters";

test("同名区域按地图隔离，避免跨图覆盖血量", () => {
  assert.notEqual(appearanceKey("大都会", "区域待核实"), appearanceKey("冰点源起", "区域待核实"));
});

test("缺少怪物专属计划时不得猜测默认倍率", () => {
  assert.equal(explicitHealth(0.7, [], 750), undefined);
});

test("女性丧尸沿用首领的乘算顺序与 Math.round 口径", () => {
  const plan = { MonsterPlanID: 40171, UniqueMonsterID: 18162031, Health: 0.75 };
  // JS 中此乘积为 451.49999999999994，保持现有首领计算口径。
  assert.equal(explicitHealth(0.7, [plan], 860), 451);
  assert.equal(explicitHealth(0.7, [{ ...plan, Health: 1 }], 860), 602);
});

test("歧义与无效倍率阻止发布", () => {
  const plan = { MonsterPlanID: 40171, UniqueMonsterID: 18162031, Health: 0.75 };
  assert.throws(() => explicitHealth(0.7, [plan, plan], 860), /Ambiguous/);
  assert.throws(() => explicitHealth(0.7, [plan], NaN), /Invalid/);
  assert.throws(() => explicitHealth(0.7, [{ ...plan, Health: 0 }], 860), /Invalid/);
});
