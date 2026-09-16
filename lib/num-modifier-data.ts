import rawLock from "@/data/num-modifier-lock.json";
import rawPerkPreview from "@/data/perk-preview-modifiers.json";
import rawSemantics from "@/data/num-modifier-semantics.json";
import { z } from "zod";
import { parseNumModifierDataLock } from "@/lib/num-modifier-data-lock";
import { createNumModifierResolver } from "@/lib/num-modifier";
import { parseNumModifierSemantics } from "@/lib/num-modifier-semantics";

export const NUM_MODIFIER_LOCK = parseNumModifierDataLock(rawLock);
export const NUM_MODIFIER_SEMANTICS = parseNumModifierSemantics(rawSemantics);
export const NUM_MODIFIER_RESOLVER = createNumModifierResolver(
  NUM_MODIFIER_LOCK,
  NUM_MODIFIER_SEMANTICS,
);

const perkPreviewSchema = z.strictObject({
  schema_version: z.literal(1),
  source: z.strictObject({
    path: z.string().trim().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  }),
  rows: z.record(z.string().trim().min(1), z.object({
    ID: z.number().int().positive(),
    Level: z.number().int().positive(),
    AttributeName: z.string().trim().min(1),
    GPModifierOp: z.string().trim().min(1),
    BaseValue: z.number().finite(),
    CoefValue: z.number().finite(),
  }).catchall(z.json())),
});

/** Preview overrides are scoped to perk consumers; the official Lock is immutable. */
export function createPerkModifierResolverSelector(previewEvidence: unknown) {
  const preview = perkPreviewSchema.parse(previewEvidence);
  const previewRows = Object.fromEntries(
    Object.entries(preview.rows).map(([rowName, raw]) => [
      rowName,
      { row_name: rowName, raw },
    ]),
  );
  const previewResolver = createNumModifierResolver(
    {
      ...NUM_MODIFIER_LOCK,
      rows: { lc: { ...NUM_MODIFIER_LOCK.rows.lc, ...previewRows } },
    },
    NUM_MODIFIER_SEMANTICS,
  );
  return (season: unknown) =>
    season === "s4-preview" ? previewResolver : NUM_MODIFIER_RESOLVER;
}

export const getPerkModifierResolver = createPerkModifierResolverSelector(rawPerkPreview);
