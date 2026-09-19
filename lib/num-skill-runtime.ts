import { z } from "zod";

const text = z.string().trim().min(1);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const asset = z.string().regex(/^NZM\/Content\/.+\.uasset$/);
export const runtimeKeySchema = z.string().regex(/^(?:weapons|current|[a-z0-9.-]+-preview):[1-9]\d*:duration$/);
export const runtimeReferenceSchema = z.strictObject({ runtime: runtimeKeySchema, with_mge: z.number().int().positive().optional() });
const location = z.strictObject({ function: text, statement: z.number().int().nonnegative() });
const flow = z.strictObject({
  asset, sha256: hash, read: location, apply: location,
  boundary: z.enum(["blueprint", "native-call"]), evidence: text,
});
const baseSource = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("blueprint_default"), asset, sha256: hash, object: text, field: text, value: z.number().finite().nonnegative() }),
  z.strictObject({ kind: z.literal("blueprint_constant"), asset, sha256: hash, function: text, statement: z.number().int().nonnegative(), value: z.number().finite().nonnegative() }),
  z.strictObject({ kind: z.literal("weapon_parameter"), row_name: z.string().regex(/^[1-9]\d*_1$/), name: z.enum(["BuffDuration", "FieldDuration"]), sha256: hash }),
]);
export const runtimeBindingSchema = z.strictObject({
  game_skill_id: z.number().int().positive(), source: baseSource, flow,
  dataset: z.enum(["live", "test", "unknown"]), build: text.optional(),
  modifiers: z.array(z.strictObject({
    mge_id: z.number().int().positive(), operation: z.literal("add_fraction"),
    value: z.number().finite().nonnegative(), coefficient: location, flow,
  })),
}).superRefine((binding, ctx) => {
  if (new Set(binding.modifiers.map(entry => entry.mge_id)).size !== binding.modifiers.length) ctx.addIssue({ code: "custom", message: "Duplicate runtime MGE condition" });
  if (binding.source.kind === "weapon_parameter" && binding.source.row_name !== `${binding.game_skill_id}_1`) ctx.addIssue({ code: "custom", message: "Runtime PVE identity mismatch" });
});
export const runtimeBindingsSchema = z.record(runtimeKeySchema, runtimeBindingSchema).superRefine((bindings, ctx) => {
  for (const [key, binding] of Object.entries(bindings)) {
    if (Number(key.split(":")[1]) !== binding.game_skill_id) ctx.addIssue({ code: "custom", message: `Runtime identity mismatch: ${key}` });
  }
});
export type RuntimeBinding = z.infer<typeof runtimeBindingSchema>;
export type RuntimeReference = z.infer<typeof runtimeReferenceSchema>;

/** Explicit audited branch selection, not inference from names, tags or loadout text. */
export function resolveRuntimeDuration(reference: RuntimeReference, context: {
  channel: string; gameSkillId?: number; bindings?: Record<string, RuntimeBinding>;
  pveParameters?: unknown; pveSourceHash?: string;
}): number {
  runtimeReferenceSchema.parse(reference);
  const [channel, skillId] = reference.runtime.split(":");
  if (channel !== context.channel) throw new Error("Cross-channel runtime reference");
  if (Number(skillId) !== context.gameSkillId) throw new Error("Runtime skill identity mismatch");
  const raw = context.bindings?.[reference.runtime];
  if (!raw) throw new Error(`Missing audited runtime binding: ${reference.runtime}`);
  const binding = runtimeBindingSchema.parse(raw);
  if (binding.game_skill_id !== context.gameSkillId) throw new Error("Runtime binding identity mismatch");
  let value: number;
  if (binding.source.kind === "weapon_parameter") {
    const source = binding.source;
    if (context.pveSourceHash !== source.sha256 || !Array.isArray(context.pveParameters)) throw new Error("Runtime PVE evidence is stale or missing");
    const matches = context.pveParameters.filter(row => row?.Name === source.name);
    const tag = source.name === "FieldDuration" ? "SkillParamConfig.SummonerDuration" : "SkillParamConfig.EffectDuration";
    if (matches.length !== 1 || !Array.isArray(matches[0].Tags) || !matches[0].Tags.includes(tag) || !["string", "number"].includes(typeof matches[0].Value) || String(matches[0].Value).trim() === "") throw new Error("Invalid runtime PVE parameter");
    value = Number(matches[0].Value);
  } else value = binding.source.value;
  if (reference.with_mge !== undefined) {
    const modifier = binding.modifiers.find(entry => entry.mge_id === reference.with_mge);
    if (!modifier) throw new Error(`Unaudited runtime MGE: ${reference.with_mge}`);
    value += value * modifier.value;
  }
  if (!Number.isFinite(value) || value < 0) throw new Error("Invalid runtime duration");
  return value;
}
