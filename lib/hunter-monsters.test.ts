import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { getHunterMonsters } from "./hunter-monsters";
import { summarizeMonsterHealth, type MonsterAppearance } from "./hunter-monster-health";
import evidence from "../data/enemies/lc/monsters/evidence.json";
import type { BossDifficulty } from "../types";

test("血量摘要保留区域差异，不把缺失值当零或不出现", () => {
  const rows: MonsterAppearance[] = [
    { map: "大都会", area: "下水道", health: { overlimit: 1548 }, source_plans: { overlimit: 40171 } },
    { map: "大都会", area: "工厂", health: { overlimit: 2064 }, source_plans: { overlimit: 40173 } },
    { map: "大都会", area: "未知区域", health: {}, source_plans: {} },
  ];
  assert.deepEqual(summarizeMonsterHealth(rows, "overlimit"), { label: "1,548–2,064", partial: true });
  assert.deepEqual(summarizeMonsterHealth(rows, "heroic"), { label: "待核实", partial: false });
  assert.deepEqual(summarizeMonsterHealth(rows.slice(0, 1), "overlimit"), { label: "1,548", partial: false });
});

test("发布血量匹配已审核证据，怪物身份和区域不能重复", () => {
  const monsters = getHunterMonsters();
  assert.equal(new Set(monsters.map(m => m.monster_id)).size, monsters.length);
  let checked = 0;
  for (const monster of monsters) {
    assert.equal(new Set(monster.appearances.map(r => `${r.map}/${r.area}`)).size, monster.appearances.length);
    if (monster.image) assert.ok(fs.existsSync(path.join(process.cwd(), "public", monster.image)));
    const source = evidence.monsters.find(m => m.monster_id === monster.monster_id);
    assert.ok(source);
    for (const row of monster.appearances) {
      for (const [key, health] of Object.entries(row.health)) {
        const difficulty = key as BossDifficulty;
        const record = source.records.find(r => r.difficulty === difficulty && r.area === row.area);
        assert.ok(record, `${monster.title}/${row.area}/${difficulty} 缺证据`);
        assert.equal(row.source_plans[difficulty], record.plan_id);
        assert.equal(health, Math.round(source.base_health * record.plan_health * record.max_health));
        checked++;
      }
    }
  }
  assert.equal(checked, evidence.monsters.reduce((count, m) => count + m.records.length, 0));
});

test("地图提示与脚本确认的怪物不会因缺少血量计划而漏收", () => {
  const monsters = getHunterMonsters();
  const bomber = monsters.find(m => m.monster_id === 18102031);
  const special = monsters.find(m => m.monster_id === 18104032);
  assert.ok(bomber);
  assert.ok(special);
  assert.deepEqual(bomber.appearances, [{ map: "大都会", area: "区域待核实", health: {}, source_plans: {} }]);
  assert.deepEqual(special.appearances, [{ map: "大都会", area: "下水道", health: {}, source_plans: {} }]);
  assert.equal(summarizeMonsterHealth(bomber.appearances, "overlimit").label, "待核实");
});
