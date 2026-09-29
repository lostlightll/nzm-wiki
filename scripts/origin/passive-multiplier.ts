import fs from "node:fs";
import path from "node:path";
import multiplier from "../../data/guides/multiplier.json";
import { NUM_MODIFIER_LOCK, NUM_MODIFIER_RESOLVER, NUM_MODIFIER_SEMANTICS } from "../../lib/num-modifier-data";
import type { ModifierProviderRegistry } from "../../lib/modifier-provider-registry";

// Worktrees have no refs/ checkout; NZM_REFS points at the main repo's read-only refs directory.
export const PASSIVE_TABLE = path.join(process.env.NZM_REFS ?? path.join(process.cwd(), "refs"),
  "Exports/NZM/Content/DataTables/MGE/MGEPassiveMainTable.json");

export type PassiveRow = { PassiveSkillID: number; MGE: { Id: string }; MGEConfig: { Id: string } };
type RawRow = { ID: number; Level: number; AttributeName: string; GPModifierOp: string; BaseValue: number; CoefValue: number };
export type ProviderApplications = NonNullable<ModifierProviderRegistry["providers"][number]["applications"]>;

export function readPassiveRows(file = PASSIVE_TABLE): Record<string, PassiveRow> {
  const table = JSON.parse(fs.readFileSync(file, "utf8")) as { Rows: Record<string, PassiveRow> }[];
  if (table.length !== 1 || !table[0]?.Rows) throw new Error(`Invalid source table: ${file}`);
  return table[0].Rows;
}

const numericalRows = Object.entries(NUM_MODIFIER_LOCK.rows.lc)
  .map(([key, row]) => [key, row.raw as RawRow] as const);
const damageFacets = new Set(multiplier.damageChannelMatrix.channels.map((channel) => channel.facetId));

/**
 * Level-1 Numerical rows share the passive's identity either directly (the passive ID itself)
 * or through the 1300xxxx? segment derived from its digits. Reviewed IDs pin the exact rows when
 * the segment also holds rows owned by other sources.
 */
export function passiveDamageApplications(passiveId: string, sourceKey: string, reviewedIds?: readonly number[]) {
  const prefix = `1300${passiveId.slice(-5, -1)}`;
  const candidates = numericalRows.filter(([, row]) =>
    row.Level === 1 && (reviewedIds
      ? reviewedIds.includes(row.ID)
      : String(row.ID) === passiveId || (String(row.ID).length === 9 && String(row.ID).startsWith(prefix))));
  const applications: ProviderApplications = [];
  for (const [key, row] of candidates) {
    if (NUM_MODIFIER_SEMANTICS.attributes[row.AttributeName]?.status !== "indexed") continue;
    const expression = { row: `lc:${key}` as const, field: row.BaseValue !== 0 ? "base" as const : "coefficient" as const };
    const recipient = row.AttributeName.startsWith("Numerical.ExecutionCtx.") ? "damage-event" as const : "self" as const;
    const resolved = NUM_MODIFIER_RESOLVER.resolveEffect(expression, { recipient }, sourceKey);
    if (resolved.facets.some((facet) => damageFacets.has(facet.id))) applications.push({ expression, context: { recipient } });
  }
  return { candidateKeys: candidates.map(([key]) => key), applications };
}

export const NUMERICAL_SOURCE_PATH = `NZM/Content/${NUM_MODIFIER_LOCK.sources.lc.modifiers.source_path}`;
