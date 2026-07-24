import assert from "node:assert/strict";
import test from "node:test";
import {
  createImportPlan,
  mapMonsterType,
  mergeFrontmatter,
  normalizeNarrative,
} from "./import-td-enemies";

test("塔防敌人类型映射保持现有图鉴约定", () => {
  assert.equal(mapMonsterType(3), "normal");
  assert.equal(mapMonsterType(4), "normal");
  assert.equal(mapMonsterType(5), "elite");
  assert.equal(mapMonsterType(7), "boss");
  assert.equal(mapMonsterType(6), null);
});

test("描述清理移除 Unreal 换行标签和无效 None", () => {
  assert.equal(normalizeNarrative("第一句。<br><br>第二句。"), "第一句。第二句。");
  assert.equal(normalizeNarrative("None"), "");
});

test("frontmatter 合并保留昵称、射程和其他人工字段", () => {
  const merged = mergeFrontmatter(
    {
      title: "测试",
      nickname: "别名",
      attack_range: 3,
      search_range: 5,
      custom: "manual",
    },
    {
      title: "测试",
      type: "normal",
      attack: 10,
      hp: 100,
      hitback_hp: -1,
      hardstraight_hp: -1,
      weight: 1,
      speed: 5,
      kill_money: 20,
      description: "描述",
    },
  );

  assert.equal(merged.nickname, "别名");
  assert.equal(merged.attack_range, 3);
  assert.equal(merged.search_range, 5);
  assert.equal(merged.custom, "manual");
});

test("当前导出生成 28 个无阻塞候选并包含 4 个新增主体", async () => {
  const plan = await createImportPlan();
  const titles = new Set(plan.candidates.map((candidate) => candidate.title));

  assert.deepEqual(plan.blockers, []);
  assert.equal(plan.candidates.length, 28);
  assert.equal(plan.excluded.length, 5);
  for (const title of ["“清”道夫", "IO渗透型", "IO污染型", "机械章鱼王"]) {
    assert.equal(titles.has(title), true);
  }
  for (const title of ["巨型异形", "巨猩赛博格", "爆破手", "脉冲", "触手"]) {
    assert.equal(titles.has(title), false);
  }

  const octopus = plan.candidates.find(
    (candidate) => candidate.title === "机械章鱼王",
  );
  assert.equal(octopus?.fields.type, "boss");
  assert.equal(octopus?.fields.hp, 400000);
  assert.equal(octopus?.fields.hardstraight_hp, 119988);

  const duke = plan.candidates.find(
    (candidate) => candidate.title === "机械公爵",
  );
  assert.equal(duke?.fields.attack, -1);
  assert.equal(duke?.fields.speed, -1);
});
