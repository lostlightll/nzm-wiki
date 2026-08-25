import { z } from "zod";

import { numModifierModeSchema } from "@/lib/num-modifier-data-lock";
import { modifierRecipientSchema } from "@/lib/num-modifier-semantics";

const nonEmptyString = z.string().trim().min(1);
const rowKeySchema = z.templateLiteral([
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

export const modifierProviderSourceSchema = z.discriminatedUnion("type", [
  perkSourceSchema,
  weaponSourceSchema,
  cardSourceSchema,
  overlimitBondSourceSchema,
  postSourceSchema,
  seasonTalentSourceSchema,
]);

const expressionSchema = z.strictObject({
  row: rowKeySchema,
  field: z.enum(["base", "coefficient"]),
  scale: z.number().finite().positive().optional(),
});
const applicationSchema = z.strictObject({
  expression: expressionSchema,
  context: z.strictObject({ recipient: modifierRecipientSchema }),
});

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

const evidenceSchema = z.strictObject({
  kind: z.enum(["gp-modifier", "reviewed-chain", "reviewed-override"]),
  passiveSkillId: nonEmptyString.optional(),
  descriptionRowKey: nonEmptyString.optional(),
  descriptionRowKeys: z.array(nonEmptyString).min(1).optional(),
  cardChain: cardChainSchema.optional(),
  basis: z.array(nonEmptyString).min(1).optional(),
});

const providerSchema = z
  .strictObject({
    id: nonEmptyString,
    label: nonEmptyString,
    source: modifierProviderSourceSchema,
    applications: z.array(applicationSchema).min(1).optional(),
    reviewedFacetIds: z.array(nonEmptyString).min(1).optional(),
    evidence: evidenceSchema,
  })
  .superRefine((provider, context) => {
    if (provider.evidence.kind === "reviewed-override") {
      if (provider.applications !== undefined || !provider.reviewedFacetIds) {
        context.addIssue({
          code: "custom",
          message: `${provider.id} reviewed override requires facets and forbids Num applications`,
        });
      }
      if (!provider.evidence.basis) {
        context.addIssue({
          code: "custom",
          message: `${provider.id} reviewed override requires basis`,
        });
      }
    } else if (!provider.applications || provider.reviewedFacetIds !== undefined) {
      context.addIssue({
        code: "custom",
        message: `${provider.id} Num-backed source requires applications and derived facets`,
      });
    }
  });

const exclusionEvidenceSchema = z.strictObject({
  passiveSkillId: nonEmptyString.optional(),
  descriptionRowKey: nonEmptyString.optional(),
  descriptionRowKeys: z.array(nonEmptyString).min(1).optional(),
  staleGpModifierIds: z.array(nonEmptyString).min(1).optional(),
  basis: z.array(nonEmptyString).min(1).optional(),
  applications: z.array(applicationSchema).min(1).optional(),
});
const exclusionSchema = z.strictObject({
  id: nonEmptyString,
  label: nonEmptyString,
  source: modifierProviderSourceSchema,
  reasonCode: z.enum(["independent-damage-event", "not-damage-multiplier"]),
  reason: nonEmptyString,
  evidence: exclusionEvidenceSchema.optional(),
});

export const modifierProviderRegistrySchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    evidencePriority: z.array(nonEmptyString).min(1),
    providers: z.array(providerSchema),
    exclusions: z.array(exclusionSchema),
  })
  .superRefine((registry, context) => {
    const ids = new Set<string>();
    for (const entry of [...registry.providers, ...registry.exclusions]) {
      if (ids.has(entry.id)) {
        context.addIssue({ code: "custom", message: `duplicate source id ${entry.id}` });
      }
      ids.add(entry.id);
    }
  });

export type ModifierProviderRegistry = z.infer<
  typeof modifierProviderRegistrySchema
>;
export type ModifierProviderRegistryEntry =
  ModifierProviderRegistry["providers"][number];
export type ModifierProviderRegistryExclusion =
  ModifierProviderRegistry["exclusions"][number];
export type ModifierProviderRegistrySource = z.infer<
  typeof modifierProviderSourceSchema
>;

export function parseModifierProviderRegistry(
  input: unknown,
): ModifierProviderRegistry {
  const result = modifierProviderRegistrySchema.safeParse(input);
  if (!result.success) {
    throw new Error(
      `modifier-providers.json is invalid:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}
