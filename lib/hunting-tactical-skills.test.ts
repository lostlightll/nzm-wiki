import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { HUNTING_TACTICAL_SKILLS } from "./hunting-tactical-skills";

const EXPECTED_SKILL_IDS = [
  30200101,
  30200201,
  30200301,
  30200401,
  30200501,
  30100301,
];

test("收录五个常驻猎场战术技能和一个限时技能", () => {
  assert.deepEqual(
    HUNTING_TACTICAL_SKILLS.map((skill) => skill.id),
    EXPECTED_SKILL_IDS,
  );
  assert.equal(new Set(EXPECTED_SKILL_IDS).size, HUNTING_TACTICAL_SKILLS.length);

  const limitedSkills = HUNTING_TACTICAL_SKILLS.filter(
    (skill) => skill.availability === "limited",
  );
  assert.deepEqual(limitedSkills.map((skill) => skill.id), [30100301]);
});

test("全部猎场战术技能图标均已发布", () => {
  for (const skill of HUNTING_TACTICAL_SKILLS) {
    const iconPath = path.join(
      process.cwd(),
      "public",
      skill.icon.replace(/^\//, ""),
    );
    assert.equal(fs.existsSync(iconPath), true, `${skill.name} 缺少图标`);
  }
});
