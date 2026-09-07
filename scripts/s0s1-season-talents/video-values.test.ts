import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getLegacyTalentCatalog, type LegacyTalentLevel } from "../../lib/s0s1-season-talents";
import { reviewS0Values } from "./s0-reviewed-values";
import { reviewS1Values } from "./s1-reviewed-values";
import type { LegacyValueEvidence } from "./reviewed";
import { applyVideoValueEntry, applyVideoValues, VIDEO_VALUE_EVIDENCE, videoTimestamp } from "./video-values";
import { buildLegacyProviders } from "./providers";

const evidence = (season: string): LegacyValueEvidence => JSON.parse(readFileSync(`data/season-talents/${season}/audit.json`, "utf8")).valueEvidence;

test("all recording observations target only exact missing slots, preserving configuration and index evidence", () => {
  let total = 0;
  for (const season of ["s0", "s1"] as const) {
    const source = evidence(season);
    for (const tree of getLegacyTalentCatalog(season)) for (const node of tree.nodes) for (const level of node.levels) {
      const entry = VIDEO_VALUE_EVIDENCE.entries.find(entry => entry.season === season && entry.nodeId === node.id && entry.level === level.level);
      if (!entry) { assert.equal(level.videoReview, undefined); continue; }
      assert.equal(tree.id, entry.treeId);
      assert.equal(node.name, entry.nodeName);
      const input = { nodeId: node.id, level: level.level, skillIds: node.skillIds };
      const reviewed = season === "s0" ? reviewS0Values(input, source.s0!) : reviewS1Values(input, source.s1!);
      assert.equal(createHash("sha256").update(reviewed.descriptionTemplate).digest("hex"), entry.templateSha256);
      const values = new Map(entry.values.map(value => [value.slot, value.value]));
      let slot = 0;
      assert.equal(level.descriptionTemplate, reviewed.descriptionTemplate.replace(/〔数值待核实〕/g, original => values.get(slot++) ?? original));
      assert.deepEqual(level.valueReview?.applications, reviewed.valueReview.applications);
      assert.deepEqual(level.descriptionBindings, reviewed.descriptionBindings);
      assert.equal(level.valueReview?.remaining, reviewed.remaining);
      assert.equal(level.valueReview?.resolvedCount, reviewed.resolvedCount);
      assert.equal(level.videoReview?.status, "video-display-unverified");
      total += entry.values.length;
    }
  }
  assert.equal(total, 132);
});

function fixture(): LegacyTalentLevel {
  const entry = VIDEO_VALUE_EVIDENCE.entries[0];
  const review = reviewS0Values({ nodeId: entry.nodeId, level: entry.level, skillIds: [6001401] }, evidence("s0").s0!);
  return { level: entry.level, description: "", descriptionTemplate: review.descriptionTemplate,
    descriptionBindings: review.descriptionBindings, valueReview: review.valueReview, facts: [], warnings: [], modifierRows: [] };
}

test("video observations cannot survive changed templates, levels, branches or duplicate application", () => {
  const entry = VIDEO_VALUE_EVIDENCE.entries[0];
  const changed = fixture();
  changed.descriptionTemplate += "changed";
  assert.throws(() => applyVideoValueEntry(changed, entry), /VIDEO_TEMPLATE_DRIFT/);
  const wrongLevel = fixture();
  wrongLevel.level = 2;
  assert.throws(() => applyVideoValueEntry(wrongLevel, entry), /VIDEO_TEMPLATE_DRIFT/);
  assert.throws(() => applyVideoValues("s0", "frost-barrage", entry.nodeId, fixture()), /VIDEO_BRANCH_DRIFT/);
  const repeated = fixture();
  applyVideoValueEntry(repeated, entry);
  assert.throws(() => applyVideoValueEntry(repeated, entry), /VIDEO_TEMPLATE_DRIFT/);
  const wrongSlot = { ...entry, values: [{ ...entry.values[0], slot: 999 }] };
  assert.throws(() => applyVideoValueEntry(fixture(), wrongSlot), /VIDEO_SLOT_MISSING/);
});

test("recording does not cover another season or extrapolate unobserved levels", () => {
  const level = fixture();
  const before = structuredClone(level);
  applyVideoValues("s1", "mechanical-dance", "1003106", level);
  assert.deepEqual(level, before);
  const node = getLegacyTalentCatalog("s0").find(tree => tree.id === "mechanical-dance")!.nodes.find(node => node.id === "1003408")!;
  assert.equal(node.levels[0].videoReview, undefined);
  assert.ok(node.levels[0].description.includes("〔数值待核实〕"));
  assert.ok(node.levels[1].videoReview);
});

test("known recording conflicts retain structured values and timestamped explanations", () => {
  const tree = getLegacyTalentCatalog("s0").find(tree => tree.id === "mechanical-dance")!;
  const root = tree.nodes.find(node => node.id === "1003106")!.levels[0];
  assert.match(root.description, /每命中20次/);
  assert.ok(root.videoReview?.notes.some(note => note.includes("10 次")));
  const death = tree.nodes.find(node => node.id === "1003406")!.levels[0];
  assert.match(death.description, /每命中24次/);
  assert.ok(death.videoReview?.notes.some(note => note.includes("8 次")));
  assert.equal(videoTimestamp(208), "03:28");
});

test("filling recording prose never promotes unverified exclusions into verified non-damage effects", () => {
  const trees = [...getLegacyTalentCatalog("s0"), ...getLegacyTalentCatalog("s1")];
  const recorded = buildLegacyProviders(trees);
  for (const tree of trees) for (const node of tree.nodes) for (const level of node.levels) {
    if (level.videoReview) level.description = "〔数值待核实〕";
    delete level.videoReview;
  }
  assert.deepEqual(recorded, buildLegacyProviders(trees));
});
