import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { numSkillLockSchema } from "../../lib/num-skill";
import type { RuntimeBinding } from "../../lib/num-skill-runtime";

const exportSchema = z.array(z.object({ Name: z.string(), Properties: z.record(z.string(), z.json()).optional(), ScriptBytecode: z.array(z.record(z.string(), z.json())).optional() }));
type Evidence = { sha256: string; exports: z.infer<typeof exportSchema> };

function nodes(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object") return [];
  const object = value as Record<string, unknown>;
  return [object, ...Object.values(object).flatMap(nodes)];
}

/** Verify locked facts against explicitly supplied snapshots; never refresh values. */
export function auditRuntimeBinding(binding: RuntimeBinding, evidence: ReadonlyMap<string, Evidence>) {
  const get = (asset: string, hash: string) => {
    const file = evidence.get(asset);
    if (!file || file.sha256 !== hash) throw new Error(`Missing or changed snapshot: ${asset}`);
    return file.exports;
  };
  const statement = (asset: string, hash: string, at: { function: string; statement: number }) => {
    const functions = get(asset, hash).filter(object => object.Name === at.function);
    const found = functions.length === 1 ? functions[0].ScriptBytecode?.filter(node => node.StatementIndex === at.statement) : undefined;
    if (found?.length !== 1) throw new Error(`Missing or ambiguous execution location: ${at.function}[${at.statement}]`);
    return found[0];
  };
  const source = binding.source;
  const read = statement(binding.flow.asset, binding.flow.sha256, binding.flow.read);
  if (source.kind === "blueprint_default") {
    const objects = get(source.asset, source.sha256).filter(object => object.Name === source.object);
    if (objects.length !== 1 || objects[0].Properties?.[source.field] !== source.value) throw new Error(`Blueprint default mismatch: ${source.object}.${source.field}`);
    if (objects[0].Properties?.SkillID !== undefined && objects[0].Properties.SkillID !== binding.game_skill_id) throw new Error("Blueprint skill identity mismatch");
    const expectedClass = source.object.replace(/^Default__/, "");
    const hasRead = nodes(read).some(node => {
      if (node.Token !== "EX_InstanceVariable") return false;
      const ref = node.Variable as { Property?: { Name?: string }; Owner?: { ObjectName?: string } } | undefined;
      return ref?.Property?.Name === source.field && ref.Owner?.ObjectName?.endsWith(`'${expectedClass}'`);
    });
    if (!hasRead) throw new Error("Runtime read does not consume the locked field and owner");
  } else if (source.kind === "blueprint_constant") {
    const node = statement(source.asset, source.sha256, source);
    if (!nodes(node).some(entry => entry.Token === "EX_FloatConst" && entry.Value === source.value)) throw new Error("Blueprint constant mismatch");
  } else {
    throw new Error("PVE bindings require their Weapon Lock hash and separate parameter-consumer audit");
  }
  statement(binding.flow.asset, binding.flow.sha256, binding.flow.apply);
  for (const modifier of binding.modifiers) {
    const read = statement(modifier.flow.asset, modifier.flow.sha256, modifier.flow.read);
    const coefficient = statement(modifier.flow.asset, modifier.flow.sha256, modifier.coefficient);
    const apply = statement(modifier.flow.asset, modifier.flow.sha256, modifier.flow.apply);
    if (!nodes(read).some(node => node.Token === "EX_IntConst" && node.Value === modifier.mge_id)) throw new Error("MGE identity mismatch");
    if (!nodes(coefficient).some(node => node.Token === "EX_FloatConst" && node.Value === modifier.value) || !JSON.stringify(coefficient).includes("Multiply_FloatFloat") || !JSON.stringify(apply).includes("Add_FloatFloat")) throw new Error("Conditional coefficient or operation mismatch");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const manifests = process.argv.slice(2);
  if (!manifests.length) throw new Error("Usage: tsx scripts/num-skills/audit-runtime.ts <manifest.json> [...manifest.json]");
  const evidence = new Map<string, Evidence>();
  for (const manifestPath of manifests) {
    const manifest = z.object({ status: z.literal("exported"), files: z.array(z.object({ asset: z.string(), path: z.string(), sha256: z.string() })) }).parse(JSON.parse(fs.readFileSync(manifestPath, "utf8").replace(/^\uFEFF/, "")));
    for (const file of manifest.files) {
      const bytes = fs.readFileSync(path.resolve(path.dirname(manifestPath), file.path));
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      if (sha256 !== file.sha256.toLowerCase()) throw new Error(`Manifest hash mismatch: ${file.asset}`);
      if (evidence.has(file.asset) && evidence.get(file.asset)!.sha256 !== sha256) throw new Error(`Ambiguous snapshot: ${file.asset}`);
      evidence.set(file.asset, { sha256, exports: exportSchema.parse(JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/, ""))) });
    }
  }
  const lock = numSkillLockSchema.parse(JSON.parse(fs.readFileSync("data/num-skill-lock.json", "utf8")));
  for (const [key, binding] of Object.entries(lock.runtime ?? {})) {
    auditRuntimeBinding(binding, evidence);
    console.log(`Verified locked runtime facts: ${key}`);
  }
  console.log("Snapshot facts verified; control-flow review and Native/runtime boundaries remain documented separately.");
}
