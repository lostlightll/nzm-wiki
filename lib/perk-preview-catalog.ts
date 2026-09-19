import { z } from "zod";
import { resolvedSkillVariantSchema, skillVariantReferenceSchema } from "@/lib/num-skill";
import type { Perk } from "@/types";
import type { TriggerDamageEntry } from "@/lib/trigger-damage";
import { independentDamageEntrySchema, resolvedPerkEffectSchema } from "@/lib/overlimit-catalog";

const text = z.string().trim().min(1);
const slot = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
const rarity = z.union([z.enum(["稀有", "史诗", "传说"]), z.literal(1), z.literal(2), z.literal(3)]);
const previewChange = z.enum(["new", "changed", "existing"]);
export const perkIndependentDamageSnapshotSchema = z.array(independentDamageEntrySchema).min(1);

/** Explicit reviewed values only; absent snapshots never inherit current trigger data. */
export function parsePerkIndependentDamageSnapshot(value: unknown): TriggerDamageEntry[] {
  return value === undefined ? [] : perkIndependentDamageSnapshotSchema.parse(value);
}
const perkSchema = z.strictObject({
  skillVariants: z.array(resolvedSkillVariantSchema).min(1).optional(),
  id: text, itemId: z.string().regex(/^\d+$/),
  slug: z.string().regex(/^preview\/slot-[1-4]\/[^/\\]+$/).refine(value => !value.includes("..")),
  name: text, season: text, slot, rarity, category: text,
  previewChange,
  icon: z.string().regex(/^[^/\\.?#]+$/).optional(),
  weaponType: z.array(z.number().int()).optional(), weaponNames: z.array(text).optional(),
  effects: z.array(z.strictObject({ slot, description: z.string(), values: z.record(text, z.number()).optional() })),
  description: z.string().optional(), effectValues: z.array(resolvedPerkEffectSchema).optional(),
  independentDamageSources: z.array(z.strictObject({ weaponSlug: text, damageSourceId: text, trigger: text, interval: text })).optional(),
  collectModItem: z.union([z.literal(0), z.literal(1)]).optional(),
  makeModItem: z.union([z.literal(0), z.literal(1)]).optional(),
  isCooked: z.boolean().optional(), releaseDate: z.iso.date().optional(),
});
const fileEvidence = z.strictObject({ path: text, sha256: z.string().regex(/^[a-f0-9]{64}$/) });
const schema = z.strictObject({
  schemaVersion: z.literal(1),
  season: z.strictObject({ id: text, key: text, label: text, status: z.literal("preload") }),
  provenance: z.strictObject({ files: z.array(fileEvidence).min(1) }),
  entries: z.array(z.strictObject({
    perk: perkSchema, content: z.string(), source: text,
    metadata: z.object({ title: text, id: text, season: text, slot, rarity, preview_change: previewChange,
      independent_damage_snapshot: perkIndependentDamageSnapshotSchema.optional(),
    }).catchall(z.json()),
    independentDamage: z.array(independentDamageEntrySchema),
  })).min(1),
}).superRefine((catalog, ctx) => {
  const ids = new Set<string>();
  const slugs = new Set<string>();
  for (const [index, entry] of catalog.entries.entries()) {
    const perk = entry.perk;
    const variantReferences = entry.metadata.skill_variants;
    if (perk.skillVariants || variantReferences !== undefined) {
      const references = z.array(skillVariantReferenceSchema).min(1).safeParse(variantReferences);
      if (!references.success || references.data.length !== perk.skillVariants?.length ||
          references.data.some((reference, index) => JSON.stringify(reference) !== JSON.stringify(perk.skillVariants![index].reference))) {
        ctx.addIssue({ code: "custom", message: "Published skill variant references mismatch", path: ["entries", index] });
      }
      for (const variant of perk.skillVariants ?? []) {
        if (variant.skill.kind !== "active" || !variant.skill.gameSkillId || variant.skill.gameSkillId === variant.original.id ||
            Object.values(variant.skill.provenance).some(expression => {
              if (!expression) return false;
              const key = "row" in expression ? expression.row : "runtime" in expression ? expression.runtime : undefined;
              return !key || key.split(":")[0] !== perk.season;
            })) {
          ctx.addIssue({ code: "custom", message: "Invalid or cross-channel published skill variant", path: ["entries", index] });
        }
      }
    }
    if (ids.has(perk.itemId) || slugs.has(perk.slug)) {
      ctx.addIssue({ code: "custom", message: `Duplicate preview identity: ${perk.itemId}`, path: ["entries", index] });
    }
    ids.add(perk.itemId); slugs.add(perk.slug);
    if (perk.previewChange !== entry.metadata.preview_change) {
      ctx.addIssue({ code: "custom", message: "Preview change classification mismatch", path: ["entries", index] });
    }
    if (perk.season !== catalog.season.key || entry.metadata.season !== perk.season ||
        entry.metadata.id !== perk.itemId || entry.metadata.title !== perk.name ||
        entry.metadata.slot !== perk.slot || !perk.slug.startsWith(`preview/slot-${perk.slot}/`)) {
      ctx.addIssue({ code: "custom", message: "Preview identity or channel mismatch", path: ["entries", index] });
    }
    if (/\{\{num:|\{GP(?:Modifier|NumericalID):/.test(perk.description ?? "")) {
      ctx.addIssue({ code: "custom", message: "Published preview contains unresolved numbers", path: ["entries", index] });
    }
    if (entry.metadata.draft) ctx.addIssue({ code: "custom", message: "Draft cannot be published", path: ["entries", index] });
  }
});

export interface PerkPreviewEntry {
  perk: Perk;
  content: string;
  source: string;
  metadata: Record<string, unknown>;
  independentDamage: TriggerDamageEntry[];
}
export interface PerkPreviewCatalog {
  schemaVersion: 1;
  season: { id: string; key: string; label: string; status: "preload" };
  provenance: { files: { path: string; sha256: string }[] };
  entries: PerkPreviewEntry[];
}

/** Published values are validated, never re-resolved against current locks. */
export function parsePerkPreviewCatalog(value: unknown): PerkPreviewCatalog {
  return schema.parse(value) as unknown as PerkPreviewCatalog;
}
