import { createHash } from "node:crypto";
import { z } from "zod";
import manifest from "../../data/season-talents/video-values.json";
import type { LegacyTalentLevel, LegacyTalentSeason } from "../../lib/s0s1-season-talents";

const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const entrySchema = z.object({
  season: z.enum(["s0", "s1"]), treeId: z.string().min(1), nodeId: z.string().regex(/^\d+$/), nodeName: z.string().min(1),
  level: z.number().int().positive(), seconds: z.number().nonnegative(), levelEvidence: z.string().min(1),
  frame: z.string().regex(/^detail-\d+\.png$/), frameSha256: sha256, templateSha256: sha256,
  values: z.array(z.object({ slot: z.number().int().nonnegative(), value: z.string().regex(/^\d+(?:\.\d+)?%?$/), context: z.string().min(1) })).min(1),
  notes: z.array(z.string()),
});
const manifestSchema = z.object({
  schemaVersion: z.literal(1), status: z.literal("video-display-unverified"),
  source: z.object({ id: z.string().min(1), fileName: z.string().min(1), sha256, durationSeconds: z.number().positive() }),
  entries: z.array(entrySchema),
}).superRefine((data, context) => {
  const ids = new Set<string>();
  for (const entry of data.entries) {
    const id = `${entry.season}:${entry.nodeId}:${entry.level}`;
    if (ids.has(id) || entry.seconds >= data.source.durationSeconds || new Set(entry.values.map(value => value.slot)).size !== entry.values.length) {
      context.addIssue({ code: "custom", message: `Invalid video observation: ${id}` });
    }
    ids.add(id);
  }
});

export const VIDEO_VALUE_EVIDENCE = manifestSchema.parse(manifest);
export type VideoValueEntry = z.infer<typeof entrySchema>;
export const videoTimestamp = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;

// Original observations remain immutable. These exact template transitions were reviewed
// when configuration evidence replaced masked units and 6001401 blueprint quantities.
const CONFIG_UPGRADES: Record<string, { oldHash: string; newHash: string; slots: readonly (number | null)[] }> = {
  "s0:1003306:1": { oldHash: "a2d1417918ce7aad14d6a1050d802012272f44084a6a6cdac00d738c883a94f3", newHash: "4cfdcdd31079da1383e9ee939a422a2801fccd742f8d1545b2068fb62605c1ee", slots: [null, 0] },
  "s0:1003306:2": { oldHash: "07736f75257a17f6c58fb8597c92fe84a809322ed961f108ddeeff95aa5029c9", newHash: "901454433cb65f1057131399d9914b7587b00764234dd532a67e1c727edb2835", slots: [null, 0] },
  "s0:1003306:3": { oldHash: "945b4786ba57816f63fa412c4123d0b2ebe108976a9a015f3884975838763eaa", newHash: "ea3bd37f3a8f282c26ccd88e34c344df06bed921158da3599da1547547535186", slots: [null, 0] },
  "s0:1003404:1": { oldHash: "3c7e75de1cf13b54a1b6ee4b513ca070e3c7aa9e44153cb21730e9b5fd367071", newHash: "821b95e4f8660c8059316f2ee905800fb7eace66bec03447221e725e859d51b1", slots: [null] },
  "s0:1003404:2": { oldHash: "59e0050502dc28b6ada651de139440643443374a65769034c798764a5a24bd7c", newHash: "43574c4b45a0ac3949039daef135000b748fa1b08a90204911c1fd4610d50afd", slots: [null] },
  "s0:1003604:1": { oldHash: "ee2487e240f0eac15ce75712fd2a52cf8ce68631f1312b95343eface15460029", newHash: "a2821e3f91e4c431cae083dc6c312909c3f5d3383865211b3eeb59f96e32b3d6", slots: [null, 0] },
  "s0:1003608:1": { oldHash: "a02f4b85c19ee76fd968e7a58575aeff39d9ffbb90bc3af1ee1e91197c4125c8", newHash: "d681fe3ad14e68b219e6e146d001847ff0b6e85effb52bff93f4863f3e8fed40", slots: [null, null] },
  "s0:1001608:2": { oldHash: "690b3dec9a21734effca93328d08dc9c0fa1191515c51d3502137908acd4f126", newHash: "f72f67f5e573418311a434a8267848c7f6545cd6bf9ac4a9d033f3af7bdc4fa7", slots: [null] },
};

export function getVideoValuesForTemplate(template: string, entry: VideoValueEntry): VideoValueEntry["values"] {
  const hash = createHash("sha256").update(template).digest("hex");
  let values = entry.values;
  if (hash !== entry.templateSha256) {
    const upgrade = CONFIG_UPGRADES[`${entry.season}:${entry.nodeId}:${entry.level}`];
    if (!upgrade || upgrade.oldHash !== entry.templateSha256 || upgrade.newHash !== hash) {
      throw new Error(`VIDEO_TEMPLATE_DRIFT: ${entry.nodeId}/${entry.level}; review the exact missing slots again`);
    }
    values = entry.values.flatMap(value => {
      const slot = upgrade.slots[value.slot];
      if (slot === undefined) throw new Error(`VIDEO_SLOT_MISSING: ${entry.nodeId}`);
      return slot === null ? [] : [{ ...value, slot, context: template }];
    });
  }
  const count = [...template.matchAll(/〔数值待核实〕/g)].length;
  if (values.some(value => value.slot >= count)) throw new Error(`VIDEO_SLOT_MISSING: ${entry.nodeId}`);
  return values;
}

export function applyVideoValueEntry(level: LegacyTalentLevel, entry: VideoValueEntry): void {
  const template = level.descriptionTemplate;
  if (!template || !level.valueReview || level.videoReview || level.level !== entry.level) {
    throw new Error(`VIDEO_TEMPLATE_DRIFT: ${entry.nodeId}/${entry.level}; review the exact missing slots again`);
  }
  const applicable = getVideoValuesForTemplate(template, entry);
  if (!applicable.length) return;
  const values = new Map(applicable.map(value => [value.slot, value.value]));
  let slot = 0;
  // Only masked occurrences are replaceable. Live bindings and reviewed scalars remain untouched.
  level.descriptionTemplate = template.replace(/〔数值待核实〕/g, original => values.get(slot++) ?? original);
  level.videoReview = {
    status: "video-display-unverified", sourceId: VIDEO_VALUE_EVIDENCE.source.id,
    timestamp: videoTimestamp(entry.seconds), levelEvidence: entry.levelEvidence,
    values: applicable.map(value => ({ ...value })), notes: [...entry.notes],
  };
}

export function applyVideoValues(season: LegacyTalentSeason, treeId: string, nodeId: string, level: LegacyTalentLevel): void {
  const entry = VIDEO_VALUE_EVIDENCE.entries.find(item => item.season === season && item.nodeId === nodeId && item.level === level.level);
  if (!entry) return;
  if (entry.treeId !== treeId) throw new Error(`VIDEO_BRANCH_DRIFT: ${nodeId}`);
  applyVideoValueEntry(level, entry);
}
