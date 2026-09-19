import { z } from "zod";
import { runtimeBindingsSchema, runtimeReferenceSchema, resolveRuntimeDuration } from "./num-skill-runtime";

const text = z.string().trim().min(1);
const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const rowKey = z.string().regex(/^(?:weapons|current|[a-z0-9.-]+-preview):(?:gp|pve):[1-9]\d*(?:_1)?$/);

export const skillParameterSchema = z.union([
  z.strictObject({ weapon_charge: z.enum(["time", "count"]) }),
  runtimeReferenceSchema,
  z.strictObject({ row: rowKey, field: z.enum(["Duration", "bPauseChargeDuringActivation", "ChargeNeedTime", "SkillCount", "CooldownDuration", "MaxChargeStackCount"]) }),
  z.strictObject({ literal: z.union([z.number().finite(), z.boolean()]), reason: text, evidence: text }),
]);
export const skillParametersSchema = z.strictObject({
  cooldown: skillParameterSchema.optional(), duration: skillParameterSchema.optional(),
  count: skillParameterSchema.optional(), blocking: skillParameterSchema.optional(),
  panel_duration: skillParameterSchema.optional(),
});
export const numSkillDefinitionSchema = z.strictObject({
  id, kind: z.enum(["active", "passive"]), name: text, icon: text.optional(), tag: text.optional(),
  game_skill_id: z.number().int().positive().optional(),
  display: z.boolean().optional(),
  parameters: skillParametersSchema.optional(),
  modifier_sources: z.array(text).optional(),
}).superRefine((skill, ctx) => {
  if (skill.display !== false && !skill.icon) ctx.addIssue({ code: "custom", message: "Visible skill requires an icon" });
  if (new Set(skill.modifier_sources).size !== (skill.modifier_sources?.length ?? 0)) ctx.addIssue({ code: "custom", message: "Duplicate modifier source" });
});
export const numSkillDefinitionsSchema = z.array(numSkillDefinitionSchema).superRefine((skills, ctx) => {
  if (new Set(skills.map(skill => skill.id)).size !== skills.length) ctx.addIssue({ code: "custom", message: "Duplicate skill identity" });
});
export const numSkillLockSchema = z.strictObject({
  schema_version: z.literal(1),
  runtime: runtimeBindingsSchema.optional(),
  rows: z.record(rowKey, z.strictObject({
    row_name: text, raw: z.record(text, z.json()),
    source: z.strictObject({ path: text, sha256: z.string().regex(/^[a-f0-9]{64}$/) }),
    pve_absence: z.strictObject({ row_name: text, source_path: text, sha256: z.string().regex(/^[a-f0-9]{64}$/) }).optional(),
  })),
});
export const skillVariantReferenceSchema = z.strictObject({
  weapon_slug: text, base_skill: id, variant: text,
  operation: z.literal("replace"),
});
export const skillVariantCatalogSchema = z.strictObject({
  schema_version: z.literal(1),
  variants: z.array(z.strictObject({
    key: text, channel: text, base_game_skill_id: z.number().int().positive(),
    skill: numSkillDefinitionSchema,
    evidence: z.array(text).min(1),
  })),
}).superRefine((catalog, ctx) => {
  if (new Set(catalog.variants.map(variant => variant.key)).size !== catalog.variants.length) ctx.addIssue({ code: "custom", message: "Duplicate variant identity" });
});

export type NumSkillDefinition = z.infer<typeof numSkillDefinitionSchema>;
export type NumSkillLock = z.infer<typeof numSkillLockSchema>;
export type SkillVariantReference = z.infer<typeof skillVariantReferenceSchema>;
export type SkillParameterName = keyof z.infer<typeof skillParametersSchema>;
export interface ResolvedNumSkill {
  id: string; kind: "active" | "passive"; name: string; icon?: string; tag?: string;
  gameSkillId?: number; display: boolean;
  parameters: { cooldown?: number; duration?: number; count?: number; blocking?: boolean; panel_duration?: number };
  modifierSources: string[];
  provenance: Partial<Record<SkillParameterName, z.infer<typeof skillParameterSchema>>>;
}

export const resolvedNumSkillSchema = z.strictObject({
  id, kind: z.enum(["active", "passive"]), name: text, icon: text.optional(), tag: text.optional(),
  gameSkillId: z.number().int().positive().optional(), display: z.boolean(),
  parameters: z.strictObject({
    cooldown: z.number().finite().nonnegative().optional(), duration: z.number().finite().optional(),
    count: z.number().int().positive().optional(), blocking: z.boolean().optional(), panel_duration: z.number().finite().optional(),
  }),
  modifierSources: z.array(text), provenance: skillParametersSchema,
}).superRefine((skill, ctx) => {
  const parameterKeys = Object.keys(skill.parameters).sort();
  if (JSON.stringify(parameterKeys) !== JSON.stringify(Object.keys(skill.provenance).sort())) ctx.addIssue({ code: "custom", message: "Every resolved skill parameter requires exactly one provenance expression" });
  for (const [parameter, expression] of Object.entries(skill.provenance)) {
    if ("runtime" in expression && (Number(expression.runtime.split(":")[1]) !== skill.gameSkillId || !["duration", "panel_duration"].includes(parameter))) ctx.addIssue({ code: "custom", message: "Resolved runtime provenance identity or parameter mismatch" });
    if ("row" in expression) {
      const [, kind, rowId] = expression.row.split(":");
      const expectedRow = kind === "pve" ? `${skill.gameSkillId}_1` : String(skill.gameSkillId);
      const fields: Record<string, string> = { cooldown: kind === "pve" ? "ChargeNeedTime" : "CooldownDuration", count: kind === "pve" ? "SkillCount" : "MaxChargeStackCount", duration: "Duration", panel_duration: "Duration", blocking: "bPauseChargeDuringActivation" };
      if (!skill.gameSkillId || rowId !== expectedRow || expression.field !== fields[parameter] || (kind === "pve" && parameter !== "cooldown" && parameter !== "count")) ctx.addIssue({ code: "custom", message: "Resolved skill provenance identity or field mismatch" });
    }
  }
});
export const resolvedSkillVariantSchema = z.strictObject({
  reference: skillVariantReferenceSchema,
  original: z.strictObject({ id: z.number().int().positive(), name: text }),
  skill: resolvedNumSkillSchema,
});
export type ResolvedSkillVariant = z.infer<typeof resolvedSkillVariantSchema>;

/** No source fallback: every table reference is bound to an explicit namespace. */
export function resolveNumSkill(
  input: unknown,
  context: { channel: string; lock: NumSkillLock; charge?: { cooldown?: number; count?: number }; gameSkillId?: number; pveParameters?: unknown; pveSourceHash?: string },
): ResolvedNumSkill {
  const skill = numSkillDefinitionSchema.parse(input);
  const parameters: ResolvedNumSkill["parameters"] = {};
  for (const [key, expression] of Object.entries(skill.parameters ?? {})) {
    const parameter = key as SkillParameterName;
    let value: unknown;
    if ("literal" in expression) value = expression.literal;
    else if ("runtime" in expression) {
      if (skill.kind !== "active" || (parameter !== "duration" && parameter !== "panel_duration")) throw new Error(`${skill.id}: runtime duration used for ${parameter}`);
      if (context.lock.runtime?.[expression.runtime]?.source.kind === "weapon_parameter" && context.gameSkillId !== skill.game_skill_id) throw new Error(`${skill.id}: runtime PVE context identity mismatch`);
      value = resolveRuntimeDuration(expression, { ...context, gameSkillId: skill.game_skill_id, bindings: context.lock.runtime });
    } else if ("weapon_charge" in expression) {
      if (skill.kind !== "active" || !skill.game_skill_id || skill.game_skill_id !== context.gameSkillId) throw new Error(`${skill.id}: weapon charge identity mismatch`);
      if ((parameter !== "cooldown" || expression.weapon_charge !== "time") && (parameter !== "count" || expression.weapon_charge !== "count")) throw new Error(`${skill.id}: invalid weapon charge parameter`);
      value = expression.weapon_charge === "time" ? context.charge?.cooldown : context.charge?.count;
    } else {
      const [channel, kind, rowId] = expression.row.split(":");
      if (channel !== context.channel) throw new Error(`${skill.id}: cross-channel skill reference ${expression.row}`);
      const row = context.lock.rows[expression.row];
      if (!row || row.row_name !== rowId) throw new Error(`${skill.id}: missing or mismatched skill row ${expression.row}`);
      const expectedId = kind === "pve" ? `${skill.game_skill_id}_1` : String(skill.game_skill_id);
      if (rowId !== expectedId) throw new Error(`${skill.id}: skill row does not match game identity`);
      if (kind === "pve" && (row.raw.SkillID !== skill.game_skill_id || row.raw.Level !== 1)) throw new Error(`${skill.id}: invalid PVE identity`);
      const allowed = {
        cooldown: kind === "pve" ? "ChargeNeedTime" : "CooldownDuration",
        count: kind === "pve" ? "SkillCount" : "MaxChargeStackCount",
        duration: "Duration", panel_duration: "Duration", blocking: "bPauseChargeDuringActivation",
      };
      if (expression.field !== allowed[parameter] || (kind === "pve" && parameter !== "cooldown" && parameter !== "count")) throw new Error(`${skill.id}: field does not match ${parameter}`);
      if (kind === "gp" && (parameter === "cooldown" || parameter === "count") && context.lock.rows[`${channel}:pve:${skill.game_skill_id}_1`]) throw new Error(`${skill.id}: GP charge fallback forbidden when PVE exists`);
      if (kind === "gp" && (parameter === "cooldown" || parameter === "count") && (row.pve_absence?.row_name !== `${skill.game_skill_id}_1` || row.pve_absence.source_path !== "DataTables/SkillConfigTable_Weapon_PVE.json")) throw new Error(`${skill.id}: GP charge fallback requires PVE absence evidence`);
      value = row.raw[expression.field];
    }
    if (parameter === "blocking") {
      if (typeof value !== "boolean") throw new Error(`${skill.id}: blocking must be boolean`);
      parameters.blocking = value;
    } else {
      if (typeof value !== "number" || !Number.isFinite(value) ||
          (parameter === "cooldown" && value < 0) ||
          (parameter === "count" && (!Number.isSafeInteger(value) || value < 1))) throw new Error(`${skill.id}: invalid ${parameter}`);
      parameters[parameter] = value;
    }
  }
  return {
    id: skill.id, kind: skill.kind, name: skill.name, icon: skill.icon, tag: skill.tag,
    gameSkillId: skill.game_skill_id, display: skill.display !== false,
    parameters, modifierSources: skill.modifier_sources ?? [], provenance: skill.parameters ?? {},
  };
}
