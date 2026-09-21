import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import type { OverlimitCatalog } from "../../lib/overlimit-catalog";
import type { NumModifierResolver } from "../../lib/num-modifier";
import { modifierRecipientSchema } from "../../lib/num-modifier-semantics";
import type { ModifierProviderRegistry } from "../../lib/modifier-provider-registry";
import multiplierData from "../../data/guides/multiplier.json";

const expression = z.object({ row: z.templateLiteral(["lc:", z.string()]), field: z.enum(["base", "coefficient"]), scale: z.number().optional() });
const evidenceSchema = z.object({ schemaVersion: z.literal(1), season: z.string(), cards: z.array(z.object({
  id: z.string(), publicationDescription: z.string(),
  selected: z.array(z.object({ expression, recipient: modifierRecipientSchema, raw: z.record(z.string(), z.unknown()) })),
})) });
const indexedFacets = new Set(multiplierData.damageChannelMatrix.channels.map(channel => channel.facetId));

/** Audit exact reviewed applications: a description/config token is not an execution call. */
export function auditReviewedEffects(catalog: OverlimitCatalog, evidenceValue: unknown,
  resolver: NumModifierResolver, registry: ModifierProviderRegistry,
  runtimeCardIds: ReadonlySet<string>, descriptionOverrides: Record<string, string> = {}) {
  const evidence = evidenceSchema.parse(evidenceValue);
  if (evidence.season !== catalog.season.id) throw new Error("Current effect evidence belongs to another version");
  const byId = new Map(evidence.cards.map(card => [card.id, card]));
  if (byId.size !== evidence.cards.length || byId.size !== catalog.cards.length || catalog.cards.some(card => !byId.has(card.id))) {
    throw new Error("Reviewed evidence must cover the exact current card pool");
  }
  const errors: string[] = [];
  let verifiedEffects = 0;
  for (const card of catalog.cards) {
    const reviewed = byId.get(card.id)!;
    const expected = new Map<string, Set<string>>();
    for (const item of reviewed.selected) {
      const row = resolver.getRow(item.expression.row);
      if (!isDeepStrictEqual(row.raw, item.raw)) errors.push(`${card.id}: stale Numerical evidence ${item.expression.row}`);
      const resolved = resolver.resolveEffect(item.expression, { recipient: item.recipient });
      const facet = resolved.facets.find(value => value.consumer === "damage" || value.consumer === "stat" || indexedFacets.has(value.id));
      if (!facet) { errors.push(`${card.id}: unclassified selected row ${item.expression.row}`); continue; }
      const format = facet.consumer === "index" ? "number" : resolved.attribute.quantity === "ratio" ? "signed-percent" : "signed-number";
      const value = resolver.resolveValue(item.expression, format).text;
      const identity = `${facet.consumer === "damage" ? "damage" : "stat"}:${facet.id}`;
      const values = expected.get(identity) ?? new Set<string>();
      values.add(value); expected.set(identity, values);
    }
    const actual = new Map((card.effectValues ?? []).map(effect => [
      `${effect.kind}:${effect.kind === "damage" ? effect.modifierTypeId : effect.statId}`,
      new Set(effect.stages.map(stage => stage.value)),
    ]));
    if (actual.size !== (card.effectValues?.length ?? 0)) errors.push(`${card.id}: duplicate effect facet`);
    if (!isDeepStrictEqual(actual, expected)) errors.push(`${card.id}: published effects differ from exact reviewed Numerical expressions`);
    verifiedEffects += expected.size;
    if (card.description !== (descriptionOverrides[card.id] ?? reviewed.publicationDescription)) errors.push(`${card.id}: description differs from reviewed mechanics/announcement`);
    const matches = [...registry.providers, ...registry.exclusions].filter(entry =>
      entry.source.type === "overlimit-card" && !entry.source.season && entry.source.id === card.id);
    if (matches.length !== 1) { errors.push(`${card.id}: expected exactly one current overlimit provider or exclusion`); continue; }
    const registered = matches[0];
    const applications = "applications" in registered ? registered.applications : registered.evidence?.applications;
    const expectedApplications = reviewed.selected.map(item => ({ expression: item.expression, context: { recipient: item.recipient } }));
    if (!isDeepStrictEqual(applications ?? [], expectedApplications)) errors.push(`${card.id}: provider applications differ from reviewed expressions`);
    if (!("reasonCode" in registered) && !runtimeCardIds.has(card.id)) {
      errors.push(`${card.id}: missing current runtime provider`);
    }
  }
  if (errors.length) throw new Error(`超限卡片审定来源审计失败：\n${errors.join("\n")}`);
  return { cards: catalog.cards.length, verifiedEffects };
}
