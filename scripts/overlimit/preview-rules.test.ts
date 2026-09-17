import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { buildPreviewRules } from "./preview-rules";

function fixture(overlap = false) {
  const root = mkdtempSync(path.join(tmpdir(), "preview-rules-"));
  const files: { path: string; sha256: string }[] = [];
  function table(relative: string, rows: unknown) {
    const file = path.join(root, relative);
    mkdirSync(path.dirname(file), { recursive: true });
    const bytes = JSON.stringify([{ Rows: rows }]);
    writeFileSync(file, bytes);
    files.push({ path: relative, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
  table("DataTables/LuaDataTable/WeaponModSetTable.json", {
    1: { IsShow: true, SetName: { LocalizedString: "替代羁绊" }, Effects: [
      { RequiredCount: 8, PassiveSkillRowName: { Id: "900_1" }, MergeType: "Override", OverrideEffectLevels: [1, 2] },
    ] },
  });
  table("DataTables/MGE/MGEPassive_BD.json", { "900_1": { MGE: { Id: "900" } } });
  table("Attributes/AutoGenerate/numerical_modifier_config.json", {});
  table("DataTables/System/Dungeon/NewEntranceInfoTable.json", {
    123: { is_open: 1, is_hidden: 0, RogueAffixesId: 987, map_name: { LocalizedString: "跨年地图" } },
  });
  const period = { RogueAffixes_Id: 987, AffixesGroup_Id: "1", Begin_Time: "2026/12/1\\ 02:00:00", End_Time: "2027/1/4\\ 01:59:58" };
  table("DataTables/System/Dungeon/RogueAffixesTable.json", overlap ? { a: period, b: period } : { a: period });
  const review = path.join(root, "review.json");
  writeFileSync(review, JSON.stringify({ schemaVersion: 1, season: 2026, scheduleStart: "2026-12-28", files,
    effects: { "900_1": { description: "已核验的替代效果", evidence: ["selected execution chain"] } }, notes: [] }));
  return { root, review };
}

test("joins maps by RogueAffixesId, clips the reviewed window and preserves cross-year end and overrides", () => {
  const { root, review } = fixture();
  try {
    const result = buildPreviewRules(root, review);
    assert.deepEqual(result.mapRotation.periods, [{ startDate: "2026-12-28", endDate: "2027-01-03",
      maps: [{ name: "跨年地图", activeBonds: ["替代羁绊"] }] }]);
    assert.deepEqual(result.bonds[0].effects[0].overrides, [1, 2]);
    assert.equal(result.bonds[0].effects[0].count, 8);
    assert.equal(result.bonds[0].effects[0].mergeType, "Override");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("refuses stale execution evidence before generating a preview", () => {
  const { root, review } = fixture();
  try {
    writeFileSync(path.join(root, "DataTables/MGE/MGEPassive_BD.json"), "[]");
    assert.throws(() => buildPreviewRules(root, review), /evidence changed/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("rejects overlapping map schedule instead of silently picking a row", () => {
  const { root, review } = fixture(true);
  try { assert.throws(() => buildPreviewRules(root, review), /Overlapping rotation/); }
  finally { rmSync(root, { recursive: true, force: true }); }
});
