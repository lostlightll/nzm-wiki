import { z } from "zod";

import {
  numModifierModeSchema,
  type NumModifierMode,
} from "@/lib/num-modifier-data-lock";

const nonEmptyString = z.string().trim().min(1);
const rowKeySchema = z.templateLiteral([
  numModifierModeSchema,
  z.literal(":"),
  nonEmptyString,
]);

export const modifierEffectDirectionSchema = z.enum([
  "increase",
  "decrease",
  "neutral",
  "unknown",
]);
export type ModifierEffectDirection = z.infer<
  typeof modifierEffectDirectionSchema
>;

export const modifierRecipientSchema = z.enum([
  "self",
  "ally",
  "enemy",
  "damage-event",
  "unknown",
]);
export type ModifierRecipient = z.infer<typeof modifierRecipientSchema>;

export const modifierOperationModelSchema = z.enum([
  "delta",
  "multiply",
  "override",
  "execution",
  "unknown",
]);
export type ModifierOperationModel = z.infer<
  typeof modifierOperationModelSchema
>;

const operationRuleSchema = z.strictObject({
  model: modifierOperationModelSchema,
  direction: z.enum(["same-sign", "inverse-sign", "unknown"]).optional(),
});

const facetSchema = z.strictObject({
  id: nonEmptyString,
  label: nonEmptyString,
  consumer: z.enum(["damage", "stat", "index"]),
});

const attributeTypeSchema = z.strictObject({
  label: nonEmptyString,
  family: z.enum([
    "offense",
    "defense",
    "toughness",
    "mobility",
    "weapon-handling",
    "resource",
    "control",
    "survivability",
    "other",
  ]),
  quantity: z.enum([
    "ratio",
    "points",
    "seconds",
    "count",
    "distance",
    "rate",
    "boolean",
    "opaque",
  ]),
  default_format: z.enum([
    "number",
    "percent",
    "signed-number",
    "signed-percent",
  ]),
  facets: z
    .object({
      increase: facetSchema.optional(),
      decrease: facetSchema.optional(),
      neutral: facetSchema.optional(),
      unknown: facetSchema.optional(),
    })
    .strict(),
});

const indexedAttributeSchema = z.strictObject({
  status: z.literal("indexed"),
  attribute_type: nonEmptyString,
  scope: z.enum([
    "persistent-stat",
    "weapon-stat",
    "damage-event",
    "target-stat",
    "other",
  ]),
  label: nonEmptyString.optional(),
  operations: z.record(nonEmptyString, operationRuleSchema).optional(),
});

const knownUnindexedAttributeSchema = z.strictObject({
  status: z.literal("known-unindexed"),
  label: nonEmptyString,
  reason: nonEmptyString,
});

const unmappedAttributeSchema = z.strictObject({
  status: z.literal("unmapped"),
  label: nonEmptyString,
  reason: nonEmptyString,
});

const invalidAttributeSchema = z.strictObject({
  status: z.literal("invalid"),
  label: nonEmptyString,
  reason: nonEmptyString,
  rows: z.array(rowKeySchema).min(1),
});

const attributeSemanticsSchema = z.discriminatedUnion("status", [
  indexedAttributeSchema,
  knownUnindexedAttributeSchema,
  unmappedAttributeSchema,
  invalidAttributeSchema,
]);

const reviewedSemanticsSchema = z.strictObject({
  expected: z.strictObject({
    attribute_name: nonEmptyString,
    operation: nonEmptyString,
    level: z.number().int().positive(),
    base: z.number().finite(),
    coefficient: z.number().finite(),
  }),
  model: modifierOperationModelSchema,
  direction: modifierEffectDirectionSchema,
  facet_ids: z.array(nonEmptyString).min(1),
  recipient: modifierRecipientSchema,
  factor_base: z.number().finite().optional(),
  reason: nonEmptyString,
});

export const numModifierSemanticsSchema = z
  .strictObject({
    schema_version: z.literal(1),
    operation_families: z.record(nonEmptyString, operationRuleSchema),
    attribute_types: z.record(nonEmptyString, attributeTypeSchema),
    attributes: z.record(z.string(), attributeSemanticsSchema),
    reviewed_semantics: z.record(rowKeySchema, reviewedSemanticsSchema),
  })
  .superRefine((catalog, context) => {
    const facetIds = new Map<string, string>();
    for (const [typeId, type] of Object.entries(catalog.attribute_types)) {
      for (const facet of Object.values(type.facets)) {
        if (!facet) continue;
        const previous = facetIds.get(facet.id);
        if (previous && previous !== typeId) {
          context.addIssue({
            code: "custom",
            message: `facet ${facet.id} belongs to both ${previous} and ${typeId}`,
          });
        }
        facetIds.set(facet.id, typeId);
      }
    }
    for (const [attributeName, attribute] of Object.entries(catalog.attributes)) {
      if (
        attribute.status === "indexed" &&
        !Object.hasOwn(catalog.attribute_types, attribute.attribute_type)
      ) {
        context.addIssue({
          code: "custom",
          message: `${attributeName} references unknown attribute type ${attribute.attribute_type}`,
        });
      }
    }
    for (const [rowKey, reviewed] of Object.entries(catalog.reviewed_semantics)) {
      for (const facetId of reviewed.facet_ids) {
        if (!facetIds.has(facetId)) {
          context.addIssue({
            code: "custom",
            message: `${rowKey} references unknown reviewed facet ${facetId}`,
          });
        }
      }
    }
  });

export type NumModifierSemantics = z.infer<typeof numModifierSemanticsSchema>;
export type AttributeSemantics = z.infer<typeof attributeSemanticsSchema>;
export type AttributeTypeSemantics = z.infer<typeof attributeTypeSchema>;
export type ModifierFacet = z.infer<typeof facetSchema>;
export type ReviewedModifierSemantics = z.infer<typeof reviewedSemanticsSchema>;
export type SemanticNumModifierRowKey = `${NumModifierMode}:${string}`;

export function parseNumModifierSemantics(input: unknown): NumModifierSemantics {
  const parsed = numModifierSemanticsSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(
      `num-modifier-semantics.json is invalid:\n${z.prettifyError(parsed.error)}`,
    );
  }
  return parsed.data;
}
