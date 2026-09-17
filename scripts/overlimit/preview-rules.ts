import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { OverlimitBondCatalog, OverlimitMapRotationSchedule } from "@/types";

type Row = Record<string, unknown>;
interface RuleReview {
  schemaVersion: 1;
  season: number;
  scheduleStart: string;
  files: { path: string; sha256: string }[];
  effects: Record<string, { description: string; evidence: string[];
    applications?: { expression: { row: string; field: "base" | "coefficient" }; context: { recipient: "self" | "target" } }[];
    exclusion?: string;
    auditedRows?: { row: string; reason: string }[];
  }>;
  notes: string[];
}

function object(value: unknown): Row {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a source object");
  return value as Row;
}
function localized(value: unknown): string {
  const row = object(value);
  const text = row.LocalizedString ?? row.SourceString;
  if (typeof text !== "string" || !text) throw new Error("Missing source name");
  return text;
}
function sourceDate(value: unknown): string {
  const match = String(value).match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\\?\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) throw new Error(`Unsupported rotation time: ${value}`);
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}
function previousDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/** Reviewed source projection only; neither reads nor mutates the currently published catalog. */
export function buildPreviewRules(contentRoot: string, reviewPath = "scripts/overlimit/preview-rules-review.json") {
  const review = JSON.parse(readFileSync(reviewPath, "utf8")) as RuleReview;
  if (review.schemaVersion !== 1) throw new Error("Unsupported rules review");
  const root = path.resolve(contentRoot);
  const expected = new Map(review.files.map((file) => [file.path, file.sha256]));
  // Blueprint judgments are tied to the exact local uasset/uexp pair that was decoded.
  // A new game build must be re-reviewed rather than silently carrying these judgments forward.
  for (const [relative, hash] of expected) {
    const actual = createHash("sha256").update(readFileSync(path.join(root, relative))).digest("hex");
    if (actual !== hash) throw new Error(`Rules evidence changed; re-review required: ${relative}`);
  }
  const tables = new Map<string, Record<string, Row>>();
  function rows(relative: string) {
    if (!expected.has(relative)) throw new Error(`Unreviewed rules input: ${relative}`);
    if (!tables.has(relative)) {
      const exports: unknown[] = JSON.parse(readFileSync(path.join(root, relative), "utf8"));
      const table = exports.map(object).find((entry) => entry.Rows);
      if (!table) throw new Error(`Missing rows: ${relative}`);
      tables.set(relative, object(table.Rows) as Record<string, Row>);
    }
    return tables.get(relative)!;
  }
  const sets = rows("DataTables/LuaDataTable/WeaponModSetTable.json");
  const passives = rows("DataTables/MGE/MGEPassive_BD.json");
  const bonds: OverlimitBondCatalog = [];
  const identities: Record<string, unknown> = {};
  const providerEvidence: { name: string; count: number; passive: string; applications?: RuleReview["effects"][string]["applications"]; exclusion?: string; evidence: string[] }[] = [];
  for (const [id, set] of Object.entries(sets)) {
    if (set.IsShow !== true) continue;
    const name = localized(set.SetName);
    if (!Array.isArray(set.Effects)) throw new Error(`Missing effects: ${id}`);
    bonds.push({ name, effects: set.Effects.map((raw) => {
      const effect = object(raw);
      const skill = String(object(effect.PassiveSkillRowName).Id);
      const reviewed = review.effects[skill];
      if (!reviewed || !passives[skill]) throw new Error(`Unreviewed bond stage: ${name}/${skill}`);
      identities[skill] = { setId: id, passive: passives[skill], ...reviewed };
      providerEvidence.push({ name, count: Number(effect.RequiredCount), passive: skill,
        applications: reviewed.applications, exclusion: reviewed.exclusion, evidence: reviewed.evidence });
      return {
        count: Number(effect.RequiredCount), description: reviewed.description,
        mergeType: String(effect.MergeType), overrides: (effect.OverrideEffectLevels as number[]),
      };
    }) });
  }

  const schedule = rows("DataTables/System/Dungeon/RogueAffixesTable.json");
  const entrances = rows("DataTables/System/Dungeon/NewEntranceInfoTable.json");
  const maps = new Map<number, string>();
  for (const entry of Object.values(entrances)) {
    if (entry.is_open !== 1 || entry.is_hidden !== 0 || !Number(entry.RogueAffixesId)) continue;
    const key = Number(entry.RogueAffixesId);
    const name = localized(entry.map_name);
    if (maps.has(key) && maps.get(key) !== name) throw new Error(`Ambiguous map for rogue affixes ${key}`);
    maps.set(key, name);
  }
  const selected = Object.entries(schedule).map(([row, value]) => ({
    row, value, start: sourceDate(value.Begin_Time), end: sourceDate(value.End_Time),
  })).filter((entry) => entry.end > review.scheduleStart && maps.has(Number(entry.value.RogueAffixes_Id)));
  // These client rows contain a preseason baseline. The reviewed window starts at the
  // first S4 change boundary, not the game launch date; original times remain in evidence.
  const boundaries = [...new Set([review.scheduleStart, ...selected.flatMap((entry) => [entry.start, entry.end])])]
    .filter((date) => date >= review.scheduleStart).sort();
  const periods: OverlimitMapRotationSchedule["periods"] = [];
  for (let index = 0; index < boundaries.length - 1; index++) {
    const startDate = boundaries[index];
    const periodMaps = [...maps].flatMap(([id, name]) => {
      const matches = selected.filter((entry) => Number(entry.value.RogueAffixes_Id) === id && entry.start <= startDate && entry.end > startDate);
      if (matches.length > 1) throw new Error(`Overlapping rotation: ${name}/${startDate}`);
      if (!matches.length) return [];
      const activeBonds = String(matches[0].value.AffixesGroup_Id).split(",").map((id) => {
        const set = sets[id.trim()];
        if (!set || set.IsShow !== true) throw new Error(`Inactive bond in preview rotation: ${id}`);
        return localized(set.SetName);
      });
      return [{ name, activeBonds }];
    });
    if (periodMaps.length) periods.push({ startDate, endDate: previousDate(boundaries[index + 1]), maps: periodMaps });
  }
  if (!periods.length) throw new Error("No reviewed preview map periods");
  const mapRotation: OverlimitMapRotationSchedule = { season: review.season, timezone: "Asia/Shanghai", periods };
  const modifierRows = rows("Attributes/AutoGenerate/numerical_modifier_config.json");
  const selectedModifierRows: Record<string, Row> = {};
  const auditedRows = Object.entries(review.effects).flatMap(([passive, effect]) =>
    (effect.auditedRows ?? []).map((entry) => {
      const raw = modifierRows[entry.row.replace(/^lc:/, "")];
      if (!raw) throw new Error(`Missing audited modifier ${entry.row}`);
      return { passive, ...entry, raw };
    }));
  for (const provider of providerEvidence) for (const application of provider.applications ?? []) {
    const rowName = application.expression.row.replace(/^lc:/, "");
    if (!modifierRows[rowName]) throw new Error(`Missing reviewed modifier ${rowName}`);
    selectedModifierRows[rowName] = modifierRows[rowName];
  }
  return {
    bonds, mapRotation, provenanceFiles: review.files,
    providerEvidence: providerEvidence.map((provider) => ({
      name: provider.name, count: provider.count,
      selected: (provider.applications ?? []).map((application) => ({
        expression: application.expression,
        raw: selectedModifierRows[application.expression.row.replace(/^lc:/, "")],
        recipient: application.context.recipient === "target" ? "enemy" as const : "self" as const,
      })),
      basis: [...provider.evidence, ...(provider.exclusion ? [provider.exclusion] : [])],
      exclusion: provider.exclusion,
    })), selectedModifierRows,
    evidence: { bondStages: identities, auditedRows, scheduleRows: selected, scheduleStart: review.scheduleStart,
      scheduleTime: "02:00 Asia/Shanghai; source end times are 01:59:58", notes: review.notes },
  };
}
