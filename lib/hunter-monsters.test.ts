import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { getHunterMonsters } from "./hunter-monsters";
import { summarizeMonsterHealth, type MonsterAppearance } from "./hunter-monster-health";
import evidence from "../data/enemies/lc/monsters/evidence.json";
import type { BossDifficulty } from "../types";
import { LC_MAPS } from "./lc-maps";
import layout from "../data/enemies/lc/monsters/map-layout.json";

type HealthRecord = (typeof evidence.monsters)[number]["records"][number];

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
        const record: HealthRecord | undefined = source.records.find(r => r.map === row.map && r.difficulty === difficulty && r.area === row.area);
        assert.ok(record, `${monster.title}/${row.area}/${difficulty} 缺证据`);
        assert.equal(row.source_plans[difficulty], record.plan_id);
        assert.ok(source.base_health !== null);
        assert.equal(health, Math.round(source.base_health * record.plan_health * record.max_health));
        checked++;
      }
    }
  }
  assert.equal(checked, evidence.monsters.reduce((count, m) => count + m.records.length, 0));
});

test("可用难度的缺失血量均有明确断链记录，文件一致不代表数值完整", () => {
  let missing = 0;
  for (const monster of getHunterMonsters()) {
    for (const row of monster.appearances) {
      for (const scope of layout.filter(scope => scope.map === row.map)) {
        if (row.area !== "区域待核实" && !scope.areas.includes(row.area)) continue;
        const difficulty = scope.difficulty as BossDifficulty;
        if (row.health[difficulty] !== undefined) continue;
        const gap = evidence.gaps.find(gap => gap.kind === "missing-health" && gap.monster_id === monster.monster_id && gap.map === row.map && gap.area === row.area && gap.difficulty === difficulty);
        assert.ok(gap, `${monster.title}/${row.map}/${row.area}/${difficulty} 缺少断链记录`);
        assert.ok(gap.plan_ids?.length);
        assert.ok(gap.quest_id);
        missing++;
      }
    }
  }
  assert.equal(missing, evidence.gaps.filter(gap => gap.kind === "missing-health").length);
  const nurse = getHunterMonsters().find(monster => monster.monster_id === 18107041);
  assert.deepEqual(nurse?.appearances.filter(row => row.map === "黑暗复活节").map(row => row.area), ["巴黎2区"]);
});

test("地图提示与脚本确认的怪物不会因缺少血量计划而漏收", () => {
  const monsters = getHunterMonsters();
  const bomber = monsters.find(m => m.monster_id === 18102031);
  const special = monsters.find(m => m.monster_id === 18104032);
  assert.ok(bomber);
  assert.ok(special);
  const metropolis = bomber.appearances.filter(r => r.map === "大都会");
  assert.deepEqual(metropolis, [{ map: "大都会", area: "区域待核实", health: {}, source_plans: {} }]);
  assert.deepEqual(special.appearances, [{ map: "大都会", area: "下水道", health: {}, source_plans: {} }]);
  assert.equal(summarizeMonsterHealth(metropolis, "overlimit").label, "待核实");
});

test("九图审核覆盖保持完整，同一身份跨地图复用且不借用别图血量", () => {
  const monsters = getHunterMonsters();
  assert.equal(monsters.length, 144);
  assert.equal(evidence.monsters.reduce((n, m) => n + m.records.length, 0), 874);
  assert.deepEqual(new Set(monsters.flatMap(m => m.appearances.map(r => r.map))), new Set(LC_MAPS.map(m => m.name)));
  const bomber = monsters.filter(m => m.monster_id === 18102031);
  assert.equal(bomber.length, 1);
  assert.ok(bomber[0].appearances.some(r => r.map === "冰点源起" && r.health.heroic !== undefined));
  assert.ok(bomber[0].appearances.filter(r => r.map === "大都会").every(r => r.health.heroic === undefined));
  for (const m of monsters) for (const row of m.appearances) {
    assert.ok(evidence.monsters.find(s => s.monster_id === m.monster_id)?.appearances.some(a => a.map === row.map && a.area === row.area));
    for (const difficulty of Object.keys(row.health)) assert.ok(evidence.entrances.some(e => e.map === row.map && e.difficulty === difficulty));
  }
  assert.ok(evidence.exclusions.some(e => e.monster_id === 14303071 && e.reason.includes("缺行")));
});
