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

export function applyVideoValueEntry(level: LegacyTalentLevel, entry: VideoValueEntry): void {
  const template = level.descriptionTemplate;
  if (!template || !level.valueReview || level.videoReview || level.level !== entry.level || createHash("sha256").update(template).digest("hex") !== entry.templateSha256) {
    throw new Error(`VIDEO_TEMPLATE_DRIFT: ${entry.nodeId}/${entry.level}; review the exact missing slots again`);
  }
  const count = [...template.matchAll(/〔数值待核实〕/g)].length;
  if (entry.values.some(value => value.slot >= count)) throw new Error(`VIDEO_SLOT_MISSING: ${entry.nodeId}`);
  const values = new Map(entry.values.map(value => [value.slot, value.value]));
  let slot = 0;
  // Only masked occurrences are replaceable. Live bindings and reviewed scalars remain untouched.
  level.descriptionTemplate = template.replace(/〔数值待核实〕/g, original => values.get(slot++) ?? original);
  level.videoReview = {
    status: "video-display-unverified", sourceId: VIDEO_VALUE_EVIDENCE.source.id,
    timestamp: videoTimestamp(entry.seconds), levelEvidence: entry.levelEvidence,
    values: entry.values.map(value => ({ ...value })), notes: [...entry.notes],
  };
}

export function applyVideoValues(season: LegacyTalentSeason, treeId: string, nodeId: string, level: LegacyTalentLevel): void {
  const entry = VIDEO_VALUE_EVIDENCE.entries.find(item => item.season === season && item.nodeId === nodeId && item.level === level.level);
  if (!entry) return;
  if (entry.treeId !== treeId) throw new Error(`VIDEO_BRANCH_DRIFT: ${nodeId}`);
  applyVideoValueEntry(level, entry);
}
