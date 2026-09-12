import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { appearanceKey, collect, explicitHealth } from "./import-hunter-monsters";

test("同名区域按地图隔离，避免跨图覆盖血量", () => {
  assert.notEqual(appearanceKey("大都会", "区域待核实"), appearanceKey("冰点源起", "区域待核实"));
});

test("护士沿出生链定位巴黎2区，缺失血量必须进入审计", {
  skip: !fs.existsSync("refs/Exports/NZM/Content/DataTables/HunterBaseMonsterTable.json"),
}, () => {
  const result = collect();
  const nurse = result.entries.find(entry => entry.data.monster_id === 18107041);
  assert.ok(nurse);
  assert.ok(nurse.data.appearances.some(row => row.map === "黑暗复活节" && row.area === "巴黎2区"));
  assert.ok(result.evidence.gaps.some(gap => gap.map === "黑暗复活节" && gap.monster_id === 18107041 && gap.difficulty === "torment" && gap.reason.includes("专属计划")));
  // 补充出生来源不能覆盖超限专属的区域倍率。
  assert.equal(nurse.data.appearances.find(row => row.map === "大都会" && row.area === "下水道")?.health.overlimit, 893);
  assert.equal(nurse.data.appearances.find(row => row.map === "大都会" && row.area === "工厂")?.health.overlimit, 1190);
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
