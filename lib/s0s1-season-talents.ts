import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NUM_MODIFIER_RESOLVER } from "@/lib/num-modifier-data";
import type { NumModifierResolver, NumModifierRowKey, NumModifierValueBindings, NumModifierValueExpression } from "@/lib/num-modifier";
import type { ModifierRecipient } from "@/lib/num-modifier-semantics";

export type LegacyTalentSeason = "s0" | "s1";
export type LegacyTalentHistoricalStatus = "video-confirmed" | "unconfirmed";

export interface LegacyTalentFact {
  label: string;
  value: string;
  source: string;
  modifierRow?: NumModifierRowKey;
  displayValue?: string;
  evidenceKind?: "basic-identity" | "current-same-id" | "current-description-token";
  /** Current configuration truth does not establish the effect of the historical node. */
  historicalEffectStatus?: "unverified" | "semantic-conflict";
  conflictIds?: string[];
}

export interface LegacyTalentSemanticConflict {
  id: string;
  mgeId: number;
  parameterSource: string;
  descriptionSource: string;
  modifierRows: string[];
  summary: string;
}

export interface LegacyTalentLevel {
  level: number;
  description: string;
  /** Sanitized prose with only supported GPModifier tokens retained for live resolution. */
  descriptionTemplate?: string;
  descriptionBindings?: NumModifierValueBindings;
  /** Recording text is a display fallback, never configuration or multiplier evidence. */
  videoReview?: {
    status: "video-display-unverified";
    sourceId: string;
    timestamp: string;
    levelEvidence: string;
    values: Array<{ slot: number; value: string; context: string }>;
    notes: string[];
  };
  valueReview?: {
    sources: string[];
    notes: string[];
    applications: Array<{ expression: NumModifierValueExpression; context: { recipient: ModifierRecipient } }>;
    resolvedCount?: number;
    remaining?: number;
  };
  modifierRows: string[];
  facts: LegacyTalentFact[];
  warnings: string[];
  semanticConflicts?: LegacyTalentSemanticConflict[];
}

export interface LegacyTalentNode {
  id: string;
  name: string;
  phase: number;
  column: number;
  maxLevel: number;
  isRoot: boolean;
  icon: string;
  afterIds: string[];
  levels: LegacyTalentLevel[];
  skillIds: number[];
}

export interface LegacyTalentTree {
  season: LegacyTalentSeason;
  id: string;
  name: string;
  subtitle: string;
  icon: string;
  nodeCount: number;
  nodes: LegacyTalentNode[];
  /** Branch appearance only; this does not confirm individual nodes or historical values. */
  historicalStatus: LegacyTalentHistoricalStatus;
  evidenceNotes: string[];
}

export function resolveLegacyTalentFact(
  fact: LegacyTalentFact,
  resolver: NumModifierResolver = NUM_MODIFIER_RESOLVER,
): LegacyTalentFact {
  if (!fact.modifierRow) return { ...fact };
  const row = resolver.getRow(fact.modifierRow, "legacy-talents.fact.modifierRow");
  const attribute = resolver.describeAttribute(row.attributeName, "legacy-talents.fact.modifierRow");
  const technical = `AttributeName=${row.attributeName}; BaseValue=${row.baseValue}; CoefValue=${row.coefficient}; GPModifierOp=${row.operation}; Level=${row.level}`;
  let displayValue = `原值 Base=${row.baseValue}; Coef=${row.coefficient}; op=${row.operation}`;
  // Only B1 with a registered quantity has a reviewed additive display convention.
  if (row.operation === "B1" && attribute.quantity && attribute.quantity !== "opaque") {
    const format = attribute.quantity === "ratio" || attribute.quantity === "rate" ? "signed-percent" : "signed-number";
    const base = resolver.resolveValue({ row: row.key, field: "base" }, format).text;
    const coefficient = resolver.resolveValue({ row: row.key, field: "coefficient" }, format).text;
    displayValue = `加法 Base ${base}${row.coefficient ? `; Coef ${coefficient}（系数，未推定作用变量）` : ""}`;
  }
  return { ...fact, label: `${attribute.label} (${row.operation})`, value: technical, displayValue };
}

export function resolveLegacyTalentCatalog(
  trees: readonly LegacyTalentTree[],
  resolver: NumModifierResolver = NUM_MODIFIER_RESOLVER,
): LegacyTalentTree[] {
  return trees.map((tree) => ({ ...tree, nodes: tree.nodes.map((node) => ({ ...node, levels: node.levels.map((level) => {
    const at = `${tree.season}/${tree.id}/${node.id}/${level.level}`;
    const template = resolver.resolveTemplate(level.descriptionTemplate ?? level.description, level.descriptionBindings ?? {}, at);
    const resolution = resolver.resolveGameModifierTokens(template, at);
    if (resolution.unresolvedTokens.length) throw new Error(`Unresolved legacy talent tokens: ${resolution.unresolvedTokens.join(", ")}`);
    return { ...level, description: resolution.text, facts: level.facts.map((fact) => resolveLegacyTalentFact(fact, resolver)) };
  }) })) }));
}

// Node built-ins enforce the server boundary. The existing adapter is the sole Lock importer.
export function getLegacyTalentCatalog(season: string): LegacyTalentTree[] {
  if (season !== "s0" && season !== "s1") return [];
  return resolveLegacyTalentCatalog(JSON.parse(readFileSync(join(process.cwd(), "data/season-talents", season, "trees.json"), "utf8")));
}

export function getLegacyTalentTree(season: string, id: string): LegacyTalentTree | undefined {
  return getLegacyTalentCatalog(season).find((tree) => tree.id === id);
}
