import { NUM_MODIFIER_RESOLVER } from "../../lib/num-modifier-data";
import { resolveLegacyTalentCatalog, type LegacyTalentTree } from "../../lib/s0s1-season-talents";
import { reviewS0Values, type S0ReviewEvidence } from "./s0-reviewed-values";
import { reviewS1Values, type S1ReviewEvidence } from "./s1-reviewed-values";
import { applyVideoValues } from "./video-values";
import { applyReportedValues } from "./reported-values";

export interface LegacyValueEvidence { s0?: S0ReviewEvidence; s1?: S1ReviewEvidence }

export function applyLegacyValueReviews(trees: LegacyTalentTree[], evidence?: LegacyValueEvidence): LegacyTalentTree[] {
  if (!evidence) return trees;
  for (const tree of trees) {
    if (tree.historicalStatus !== "video-confirmed") continue;
    for (const node of tree.nodes) for (const level of node.levels) {
      const input = { nodeId: node.id, level: level.level, skillIds: node.skillIds };
      let references: NonNullable<typeof level.descriptionReferences> = [];
      if (tree.season === "s0" && evidence.s0) {
        const review = reviewS0Values(input, evidence.s0);
        level.descriptionTemplate = review.descriptionTemplate;
        level.descriptionBindings = review.descriptionBindings;
        references = review.provenance.filter(value => value.status === "missing").map(value => ({ text: value.originalValue, source: value.source, reason: value.reason }));
        level.valueReview = {
          ...review.valueReview,
          resolvedCount: review.resolvedCount, remaining: review.remaining,
        };
      } else if (tree.season === "s1" && evidence.s1) {
        const review = reviewS1Values(input, evidence.s1);
        level.descriptionTemplate = review.descriptionTemplate;
        level.descriptionBindings = review.descriptionBindings;
        references = review.missing.filter(value => value.original).map(value => ({ text: value.original, source: value.source, reason: value.reason }));
        level.valueReview = { ...review.valueReview, resolvedCount: review.resolvedCount, remaining: review.remaining };
      }
      if (level.valueReview?.remaining) level.warnings.push(`VALUE_REVIEW_PENDING: ${level.valueReview.remaining} quantities lack verified structured bindings.`);
      applyVideoValues(tree.season, tree.id, node.id, level);
      const videoSlots = new Set(level.videoReview?.values.map(value => value.slot) ?? []);
      references = references.filter((_, slot) => !videoSlots.has(slot));
      applyReportedValues(tree.season, node.id, level, (start, count) => references.splice(start, count));
      if (references.length !== [...(level.descriptionTemplate ?? "").matchAll(/〔数值待核实〕/g)].length) throw new Error(`DESCRIPTION_REFERENCE_DRIFT: ${tree.season}/${node.id}/${level.level}`);
      if (references.length) level.descriptionReferences = references;
      else delete level.descriptionReferences;
      // Validate every expression now; the server resolves them again against the current Lock.
      for (const expression of Object.values(level.descriptionBindings ?? {})) NUM_MODIFIER_RESOLVER.getRow(expression.row);
    }
  }
  return resolveLegacyTalentCatalog(trees);
}
