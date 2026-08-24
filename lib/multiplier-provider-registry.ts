import { z } from "zod";

import { numModifierModeSchema } from "@/lib/num-modifier-data-lock";

const nonEmptyString = z.string().trim().min(1);
const numModifierRowKeySchema = z.templateLiteral([
  numModifierModeSchema,
  z.literal(":"),
  nonEmptyString,
]);

const perkSourceSchema = z.strictObject({
  type: z.literal("perk"),
  itemId: nonEmptyString,
  slot: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  slug: nonEmptyString,
  overlimitCard: z.boolean(),
});

const weaponSourceSchema = z.strictObject({
  type: z.literal("weapon"),
  slug: nonEmptyString,
  skillName: nonEmptyString,
  component: z.enum(["ActiveSkill", "PassiveSkill"]),
});

const cardSourceSchema = z.strictObject({
  type: z.literal("card"),
  cardId: z.number().int().positive(),
  slug: nonEmptyString,
});

const overlimitBondSourceSchema = z.strictObject({
  type: z.literal("overlimit-bond"),
  name: nonEmptyString,
  count: z.union([z.literal(2), z.literal(4), z.literal(6)]),
});

const postSourceSchema = z.strictObject({
  type: z.literal("post"),
  slug: nonEmptyString,
});

const seasonTalentSourceSchema = z
  .strictObject({
    type: z.literal("season-talent"),
    season: nonEmptyString,
    tree: nonEmptyString.optional(),
    nodeId: nonEmptyString.optional(),
    passiveId: nonEmptyString.optional(),
  })
  .refine((source) => Boolean(source.nodeId || source.passiveId), {
    message: "season-talent source requires nodeId or passiveId",
  });

export const multiplierProviderSourceSchema = z.discriminatedUnion("type", [
  perkSourceSchema,
  weaponSourceSchema,
  cardSourceSchema,
  overlimitBondSourceSchema,
  postSourceSchema,
  seasonTalentSourceSchema,
]);

const attackLevelChainSchema = z.strictObject({
  sourceMgeId: z.number().int().positive(),
  level: z.number().int().positive(),
  passiveSkillId: z.number().int().positive(),
  modifierMgeId: z.number().int().positive(),
});

const cardChainSchema = z.strictObject({
  functionIds: z.array(z.number().int().positive()).min(1),
  mgeIds: z.array(z.number().int().positive()).min(1),
  buffIds: z.array(z.number().int().positive()).min(1).optional(),
  attackLevelChain: attackLevelChainSchema.optional(),
});

const sharedEvidenceFields = {
  passiveSkillId: nonEmptyString.optional(),
  descriptionRowKey: nonEmptyString.optional(),
  descriptionRowKeys: z.array(nonEmptyString).min(1).optional(),
  numModifierRows: z.array(numModifierRowKeySchema).min(1).optional(),
};

const gpModifierEvidenceSchema = z.strictObject({
  kind: z.literal("gp-modifier"),
  ...sharedEvidenceFields,
  numModifierRows: z.array(numModifierRowKeySchema).min(1),
  cardChain: cardChainSchema.optional(),
});

const reviewedOverrideEvidenceSchema = z.strictObject({
  kind: z.literal("reviewed-override"),
  ...sharedEvidenceFields,
  basis: z.array(nonEmptyString).min(1),
});

export const multiplierProviderEvidenceSchema = z.discriminatedUnion("kind", [
  gpModifierEvidenceSchema,
  reviewedOverrideEvidenceSchema,
]);

const providerSchema = z.strictObject({
  id: nonEmptyString,
  label: nonEmptyString,
  source: multiplierProviderSourceSchema,
  modifierTypeIds: z.array(nonEmptyString).min(1).optional(),
  evidence: multiplierProviderEvidenceSchema,
});

const exclusionEvidenceSchema = z.strictObject({
  passiveSkillId: nonEmptyString.optional(),
  descriptionRowKey: nonEmptyString.optional(),
  descriptionRowKeys: z.array(nonEmptyString).min(1).optional(),
  staleGpModifierIds: z.array(nonEmptyString).min(1).optional(),
  basis: z.array(nonEmptyString).min(1).optional(),
  numModifierRows: z.array(numModifierRowKeySchema).min(1).optional(),
});

const exclusionSchema = z.strictObject({
  id: nonEmptyString,
  label: nonEmptyString,
  source: multiplierProviderSourceSchema,
  reasonCode: z.enum(["independent-damage-event", "not-damage-multiplier"]),
  reason: nonEmptyString,
  evidence: exclusionEvidenceSchema.optional(),
});

export const multiplierProviderRegistrySchema = z
  .strictObject({
    schemaVersion: z.literal(2),
    evidencePriority: z.array(nonEmptyString).min(1),
    providers: z.array(providerSchema),
    exclusions: z.array(exclusionSchema),
  })
  .superRefine((registry, context) => {
    const ids = new Set<string>();
    for (const entry of [...registry.providers, ...registry.exclusions]) {
      if (ids.has(entry.id)) {
        context.addIssue({
          code: "custom",
          message: `duplicate provider/exclusion id ${entry.id}`,
        });
      }
      ids.add(entry.id);
    }
    for (const provider of registry.providers) {
      if (
        provider.evidence.kind === "gp-modifier" &&
        provider.modifierTypeIds !== undefined
      ) {
        context.addIssue({
          code: "custom",
          message: `${provider.id} copies modifierTypeIds for direct Num evidence`,
        });
      }
      if (
        provider.evidence.kind === "reviewed-override" &&
        provider.modifierTypeIds === undefined
      ) {
        context.addIssue({
          code: "custom",
          message: `${provider.id} reviewed override requires modifierTypeIds`,
        });
      }
    }
  });

export type MultiplierProviderRegistry = z.infer<
  typeof multiplierProviderRegistrySchema
>;
export type MultiplierProviderRegistryEntry =
  MultiplierProviderRegistry["providers"][number];
export type MultiplierProviderRegistryExclusion =
  MultiplierProviderRegistry["exclusions"][number];
export type MultiplierProviderRegistrySource = z.infer<
  typeof multiplierProviderSourceSchema
>;

export function parseMultiplierProviderRegistry(
  input: unknown,
): MultiplierProviderRegistry {
  const result = multiplierProviderRegistrySchema.safeParse(input);
  if (!result.success) {
    throw new Error(`multiplier-providers.json is invalid:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
