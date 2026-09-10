import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { emptyS2Build, restoreS2Build, s2SpentPoints, s2UnlockReason, setS2Level, s2PrerequisiteGroups, type S2TalentTree } from "./s2-season-talent-builder";
import { getS2TalentTree, S2_TALENT_IDS } from "./s2-season-talents";

const tree = getS2TalentTree("holographic-sync")!;
const node = (id: string) => tree.nodes.find(n => n.id === id)!;
const allocate = (pairs: [string, number][]) => pairs.reduce((build, [id, level]) => setS2Level(tree, build, id, level), emptyS2Build());

test("S2 offline data has complete topology, assets and resolved numerical references", () => {
  for (const id of S2_TALENT_IDS) {
    const t = getS2TalentTree(id)!;
    assert.equal(t.nodes.length, 23); assert.equal(t.passives.length, 6);
    assert.equal(t.nodes.filter(n => n.isRoot).length, 1);
    for (const n of t.nodes) {
      assert.equal(n.costs.length, n.maxLevel); assert.equal(n.descriptions.length, n.maxLevel);
      assert.ok(fs.existsSync(path.join(process.cwd(), "public", n.icon)));
      assert.ok(n.descriptions.every(d => d.length > 0 && !/[{}]/.test(d)));
      for (const before of s2PrerequisiteGroups(n.prerequisite).flat()) assert.ok(t.nodes.some(x => x.id === before));
    }
    for (const p of t.passives) assert.ok(p.description && !/[{}]/.test(p.description));
  }
});

test("free root does not consume points and reset is empty", () => {
  const build = emptyS2Build();
  assert.equal(s2SpentPoints(tree, build.levels), 0);
  assert.equal(setS2Level(tree, build, "2003106", 0), build);
  assert.deepEqual(restoreS2Build(tree, emptyS2Build()), build);
});

test("common OR prerequisites require one level while phase point gates remain", () => {
  assert.ok(s2UnlockReason(tree, node("2003301"), {}));
  const partial = allocate([["2003201", 1]]);
  assert.match(s2UnlockReason(tree, node("2003301"), partial.levels)!, /前置阶段需投入/);
  assert.equal(s2UnlockReason(tree, { ...node("2003301"), unlockPoints: 0 }, partial.levels), null);
  const full = allocate([["2003201", 5]]);
  assert.equal(s2UnlockReason(tree, node("2003301"), full.levels), null);
  assert.equal(s2UnlockReason(tree, node("2003302"), full.levels), null);
  assert.ok(s2UnlockReason(tree, node("2003501"), full.levels));
  const partialWithPhasePoints = allocate([["2003201", 4], ["2003206", 1]]);
  assert.equal(s2UnlockReason(tree, node("2003301"), partialWithPhasePoints.levels), null);
});

test("AND junction requires both specialist predecessors", () => {
  const one = allocate([["2003201", 5], ["2003206", 1], ["2003301", 5], ["2003305", 3]]);
  assert.ok(s2UnlockReason(tree, node("2003406"), one.levels));
  const both = setS2Level(tree, one, "2003307", 3);
  assert.equal(s2UnlockReason(tree, node("2003406"), both.levels), null);
});

test("switching a mutual group inherits levels and preserves valid descendants", () => {
  const build = allocate([["2003201", 5], ["2003301", 5]]);
  const switched = setS2Level(tree, build, "2003202", 1);
  assert.equal(switched.levels["2003201"], undefined);
  assert.equal(switched.levels["2003301"], 5);
  assert.equal(switched.levels["2003202"], 5);
});

test("common descendants survive partial refunds and cascade when the prerequisite is cleared", () => {
  const build = { ...allocate([["2003201", 5], ["2003301", 5]]), passiveId: tree.passives[0].id };
  const reduced = setS2Level(tree, build, "2003201", 4);
  assert.equal(reduced.levels["2003301"], 5);
  assert.equal(reduced.passiveId, build.passiveId);
  const cleared = setS2Level(tree, reduced, "2003201", 0);
  assert.equal(cleared.levels["2003301"], undefined);
  assert.equal(cleared.passiveId, build.passiveId);
});

test("budget blocks overspending without corrupting state", () => {
  const limited: S2TalentTree = { ...tree, pointLimit: 4 };
  const build = emptyS2Build();
  assert.equal(setS2Level(limited, build, "2003201", 5), build);
  assert.equal(s2SpentPoints(limited, setS2Level(limited, build, "2003201", 4).levels), 4);
});

test("corrupt, foreign, fractional and overspent saves are sanitized", () => {
  for (const invalid of [null, [], { version: 2 }, { version: 1, levels: [] }]) assert.deepEqual(restoreS2Build(tree, invalid), emptyS2Build());
  const saved = restoreS2Build(tree, { version: 1, levels: { foreign: 5, "2003201": 3.5, "2003202": -2, "2003206": 99, "2003606": 1 }, passiveId: "foreign" });
  assert.deepEqual(saved, emptyS2Build());
  const valid = allocate([["2003201", 5], ["2003206", 1], ["2003301", 5], ["2003305", 3], ["2003307", 3]]);
  valid.passiveId = tree.passives[0].id;
  assert.deepEqual(restoreS2Build(tree, JSON.parse(JSON.stringify(valid))), valid);
});

test("historical modifier levels preserve nonstandard row suffixes without the current lock", () => {
  const t = getS2TalentTree("invisibility")!;
  const descriptions = t.nodes.find(n => n.name === "潜行")!.descriptions;
  assert.equal(new Set(descriptions).size, 3);
  assert.deepEqual(descriptions.map(d => d.match(/\d+%/)?.[0]), ["6%", "12%", "18%"]);
  assert.throws(() => s2PrerequisiteGroups("1;2"));
});

test("S2 runtime and extractor never import the current season numerical adapter", () => {
  for (const file of ["lib/s2-season-talents.ts", "scripts/s2-season-talents/extract.ts"]) {
    assert.doesNotMatch(fs.readFileSync(file, "utf8"), /num-modifier-data|NUM_MODIFIER_RESOLVER/);
  }
  const evidence = JSON.parse(fs.readFileSync("data/season-talents/s2/evidence.json", "utf8"));
  assert.equal(evidence.source, "refs/Exports/NZM/Content_S2");
  assert.ok(Object.keys(evidence.numericalRows).length > 30);
});

test("historical clone duration levels are restored with explicit evidence limitations", () => {
  const duration = tree.nodes.find(n => n.descriptions[0].startsWith("分身持续时间增加"))!;
  assert.deepEqual(duration.descriptions.map(d => d.match(/[\d.]+/)?.[0]), ["1.5", "3", "4.5"]);
  assert.match(duration.auditNote!, /尚未作为配置值证实/);
});
