import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { inspectOverlimit, OVERLIMIT_INSPECTION_FILES } from "./inspect";

function table(root: string, file: string, rows: Record<string, unknown>) {
  const target = path.join(root, file);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify([{ Type: "DataTable", Rows: rows }]));
}

test("compares schema changes by ID and proves identities without publishing raw text", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "overlimit-inspect-"));
  try {
    const current = path.join(dir, "current");
    const previous = path.join(dir, "previous");
    table(previous, OVERLIMIT_INSPECTION_FILES.cards, {
      100: { ModId: 100, Weight: 5, OverrideQuality: 3 },
      101: { ModId: 101, Weight: 7 },
    });
    table(current, OVERLIMIT_INSPECTION_FILES.cards, {
      100: { ModId: 100, Name: { LocalizedString: "同名卡" }, Quality: 4, bSlot4: true, ModSetIdList: { Values: [9] }, OverrideDesc: { LocalizedString: "未经审定+900%" } },
      200: { ModId: 200, Name: { LocalizedString: "同名卡" }, Quality: 3 },
      300: { ModId: 300, Name: { LocalizedString: "未确认卡" } },
    });
    table(current, OVERLIMIT_INSPECTION_FILES.mods, {
      unrelatedRowKey: { MODItemID: 100, PassiveSkill_ID: "800:1" },
      300: { MODItemID: 999 },
    });
    table(current, OVERLIMIT_INSPECTION_FILES.passives, {
      "200_1": { PassiveSkillID: 200, PassiveSkillLevel: "1", MGE: { Id: "201" }, MGEConfig: { Id: "202" } },
      "300_1": { PassiveSkillID: 999, PassiveSkillLevel: "1" },
    });
    const sets = { 9: { SetId: 9, Effects: [{ RequiredCount: 8, MergeType: "EWeaponModSetMergeType::Override", OverrideEffectLevels: [1, 2] }] } };
    table(current, OVERLIMIT_INSPECTION_FILES.sets, sets);
    table(current, OVERLIMIT_INSPECTION_FILES.rerollCosts, { 1: { Time: 1, Cost: 1000 } });
    const file = path.join(current, OVERLIMIT_INSPECTION_FILES.cards);
    const original = readFileSync(file);
    const report = inspectOverlimit(current, previous);
    assert.equal(report.publicationStatus, "unreviewed-candidates");
    assert.deepEqual(report.comparison?.addedIds, ["200", "300"]);
    assert.deepEqual(report.comparison?.removedIds, ["101"]);
    assert.deepEqual(report.comparison?.sharedIds, ["100"]);
    assert.deepEqual(report.comparison?.changedIds, ["100"]);
    assert.ok(report.comparison?.removedCardFields.includes("Weight"));
    assert.ok(report.comparison?.addedCardFields.includes("ModSetIdList"));
    assert.equal(report.facts.perkCardCount, 1);
    assert.equal(report.facts.skillCardCount, 1);
    assert.equal(report.facts.unresolvedCardCount, 1);
    assert.equal(report.cards[0].perkItemId, "100");
    assert.equal(report.cards[1].skillId, "200");
    assert.equal(report.cards[2].perkItemId, undefined);
    assert.equal(report.cards[2].skillId, undefined);
    assert.equal(report.cards[0].rawDescription, "未经审定+900%");
    assert.equal("description" in report.cards[0], false);
    assert.deepEqual(report.sets, sets);
    assert.deepEqual(report.rerollCosts, { 1: { Cost: 1000, Time: 1 } });
    assert.equal(report.inputs.find((input) => input.path === OVERLIMIT_INSPECTION_FILES.cards)?.sha256, createHash("sha256").update(original).digest("hex"));
    assert.deepEqual(readFileSync(file), original);
    assert.deepEqual(inspectOverlimit(current, previous), report);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("reports missing OnlyServer tables with registry evidence, not client tables or present sources", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "overlimit-inspect-"));
  try {
    table(dir, OVERLIMIT_INSPECTION_FILES.cards, {});
    const server = (name: string) => ({ LoadNetMode: "EDataTableLoadNetMode::OnlyServer", DataTablePath: { AssetPathName: `/Game/DataTables/${name}.${name}` } });
    table(dir, OVERLIMIT_INSPECTION_FILES.registry, {
      HuntingGroundRoguelikeMissing: server("Missing"),
      HuntingGroundRoguelikePresent: server("Present"),
      HuntingGroundRoguelikeClient: { ...server("Client"), LoadNetMode: "EDataTableLoadNetMode::All" },
    });
    table(dir, "DataTables/Present.json", { 1: { Weight: 20 } });
    const report = inspectOverlimit(dir);
    assert.equal(report.sourceOnlyServerGaps.length, 1);
    assert.equal(report.sourceOnlyServerGaps[0].path, "DataTables/Missing.json");
    assert.equal(report.sourceOnlyServerGaps[0].registryPath, OVERLIMIT_INSPECTION_FILES.registry);
    assert.equal(report.inputs.find((input) => input.path === "DataTables/Missing.json")?.sha256, null);
    assert.ok(report.inputs.find((input) => input.path === "DataTables/Present.json")?.sha256);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("fails instead of guessing on malformed tables and mismatched card IDs", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "overlimit-inspect-"));
  try {
    assert.throws(() => inspectOverlimit(dir), /Missing required/);
    table(dir, OVERLIMIT_INSPECTION_FILES.cards, { 1: { ModId: 2 } });
    assert.throws(() => inspectOverlimit(dir), /does not match ModId/);
    writeFileSync(path.join(dir, OVERLIMIT_INSPECTION_FILES.cards), "[]");
    assert.throws(() => inspectOverlimit(dir), /Expected exported DataTable/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
