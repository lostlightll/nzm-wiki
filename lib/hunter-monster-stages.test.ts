import assert from "node:assert/strict";
import test from "node:test";
import { groupMonstersByStage } from "./hunter-monster-stages";
import { getHunterMonsters } from "./hunter-monsters";

test("大都会按关卡顺序呈现，同一怪物显示该关血量", () => {
  const [map] = groupMonstersByStage(getHunterMonsters(), "overlimit", { map: "大都会" });
  assert.deepEqual(map.sections.map(s => s.area), ["下水道", "博物馆", "工厂", "Z博士", "区域待核实"]);
  const health = map.sections.slice(0, 4).map(s => s.entries.find(e => e.monster.monster_id === 18164031)?.row.health.overlimit);
  assert.deepEqual(health, [2975, 2975, 4165, 5950]);
  assert.ok(map.sections.at(-1)?.entries.some(e => e.monster.monster_id === 18102031));
});

test("保留原关卡编号，没有该难度入口时不展示误导性待核实列表", () => {
  const monsters = getHunterMonsters();
  const [heroic] = groupMonstersByStage(monsters, "heroic", { map: "冰点源起" });
  const [torment] = groupMonstersByStage(monsters, "torment", { map: "冰点源起" });
  assert.ok(heroic.sections.some(s => s.area === "地下实验室A"));
  assert.ok(torment.sections.some(s => s.area === "地下实验室"));
  assert.equal(torment.sections.find(s => s.area === "地下实验室")?.number, 9);
  const [unsupported] = groupMonstersByStage(monsters, "overlimit", { map: "冰点源起" });
  assert.equal(unsupported.supported, false);
  assert.deepEqual(unsupported.sections, []);
});

test("搜索与类型筛选保留地图和关卡上下文", () => {
  const [map] = groupMonstersByStage(getHunterMonsters(), "overlimit", { map: "大都会", query: "工厂", kind: "elite" });
  assert.deepEqual(map.sections.map(s => s.area), ["工厂"]);
  assert.equal(map.sections[0].number, 3);
  assert.ok(map.sections[0].entries.every(e => e.monster.kind === "elite" && e.row.map === "大都会"));
});
