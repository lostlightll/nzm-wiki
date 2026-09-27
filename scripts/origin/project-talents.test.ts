import assert from "node:assert/strict";
import test from "node:test";
import catalog from "../../data/origin/talents.json";
import { projectOriginTalents, type RawTalent } from "./project-talents";

// Build a synthetic source from the public catalog so ordinary tests need no private exports.
const iconSource = "UI/UI_Textures/HuntingRou/SP/TestTalent.png";
const rows: Record<string, RawTalent> = Object.fromEntries(catalog.talents.flatMap((talent) =>
  talent.levels.map((level) => [level.sourceRow, {
    RoguelikeTech_Key: Number(level.sourceRow),
    TechSkill_Id: Number(talent.id),
    SeasonId: 0,
    BranchId: talent.branchId,
    LineId: talent.row,
    TechSkillLevel: level.level,
    TechSkillName: talent.name,
    TechSkillDesc: { LocalizedString: level.description },
    IconPath: { AssetPathName: "/Game/UI/UI_Textures/HuntingRou/SP/TestTalent.TestTalent" },
    AffixID: level.affixId,
    TotalTechSkillNum: talent.requiredTotalLevels,
    PreTechSkill: talent.prerequisites.map((entry) => `${entry.id}:${entry.level}`).join("&"),
    UnlockCostId: `45210010004:${level.cost}`,
  }]),
));

test("talents preserve configured topology, levels, costs and terminal requirement", () => {
  const projected = projectOriginTalents(rows);
  assert.deepEqual(projected, { ...catalog, talents: catalog.talents.map((talent) => ({ ...talent, icon: "" })) });
  assert.deepEqual(projected.talents.find((talent) => talent.id === "10051")?.prerequisites,
    [{ id: "10041", level: 1 }, { id: "10042", level: 1 }]);
  assert.deepEqual(projected.talents.find((talent) => talent.id === "30042")?.levels.map((level) => level.cost), [13, 15, 17]);
  assert.equal(projected.talents.find((talent) => talent.id === "40091")?.requiredTotalLevels, 66);
  assert.equal(projected.talents.find((talent) => talent.id === "20061")?.row, 6);
  assert.ok(projected.talents.every((talent) => talent.levels.every((level) => level.description.length > 0)));
});

test("only available source icons receive a public resource path", () => {
  assert.equal(projectOriginTalents(rows).talents[0].icon, "");
  const withIcons = projectOriginTalents(rows, new Set([iconSource]));
  assert.equal(withIcons.talents[0].icon, "/icons/origin/talents/TestTalent.webp");
});

test("projection refuses dangling edges, skipped levels and unsupported currencies", () => {
  const dangling = structuredClone(rows);
  dangling["4"].PreTechSkill = "99999:1";
  assert.throws(() => projectOriginTalents(dangling), /Invalid prerequisite/);
  const levels = structuredClone(rows);
  levels["2"].TechSkillLevel = 4;
  assert.throws(() => projectOriginTalents(levels), /Inconsistent talent levels/);
  const currency = structuredClone(rows);
  currency["1"].UnlockCostId = "999:1";
  assert.throws(() => projectOriginTalents(currency), /Invalid talent cost/);
});
