import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import reference from "./s4-perk-index-reference.json";
import { NUM_MODIFIER_SOURCE_PATH } from "./num-modifier/lock";
import { createHash } from "node:crypto";
import { parseModifierProviderRegistry } from "../lib/modifier-provider-registry";

const rootIndex = process.argv.indexOf("--content-root");
if (rootIndex < 0 || !process.argv[rootIndex + 1]) throw new Error("Required: --content-root <preload Content>");
const contentRoot = path.resolve(process.argv[rootIndex + 1]);
const read = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));
const numericalBytes = fs.readFileSync(path.join(contentRoot, NUM_MODIFIER_SOURCE_PATH));
const numerical = JSON.parse(numericalBytes.toString("utf8"))[0].Rows;
const mods = read(path.join(contentRoot, "DataTables/LuaDataTable/WeaponModItemData.json"))[0].Rows;
const preview = read("data/perk-preview-modifiers.json");
const registry = read("data/modifier-providers.json");
const local = new Map<string, { file: string; slug: string; data: Record<string, unknown> }>();
for (const slot of [1, 2, 3, 4]) {
  const directory = `data/perk-preview/slot-${slot}`;
  for (const file of (fs.existsSync(directory) ? fs.readdirSync(directory) : []).filter(file => file.endsWith(".mdx"))) {
    const filePath = `${directory}/${file}`;
    const { data } = matter.read(filePath);
    local.set(String(data.id), { file: filePath, slug: file.slice(0, -4), data });
  }
}

const sourceFor = (entry: { source: { itemId: string }; evidence?: { passiveSkillId?: string } }) => {
  const item = local.get(entry.source.itemId);
  const mod = mods[entry.source.itemId];
  if (!item || !mod) throw new Error(`Missing ItemID ${entry.source.itemId}`);
  if (entry.evidence?.passiveSkillId && String(mod.PassiveSkill_ID).split(":")[0] !== entry.evidence.passiveSkillId) {
    throw new Error(`Passive identity drift: ${entry.source.itemId}`);
  }
  return { type: "perk", itemId: entry.source.itemId, slot: Number(item.data.slot), slug: item.slug, overlimitCard: false, season: "s4-preview" };
};
const provenance = `用户指定 ${reference.reference.url}@${reference.reference.commit} 为 S4 乘区覆盖验收标准；无直连行的分类采用该版本人工审定，不将描述数值作为配置真值。`;
const providers = reference.providers.map(entry => {
  const source = sourceFor(entry);
  const rowNames = entry.evidence.numericalRows.map(row => row.rowKey);
  // Both fields are explicitly present on the current Light/Dark Cold Flame MGE.
  if (entry.source.itemId === "20703040546") rowNames.push("121400044_1_0");
  const applications = rowNames.map(rowName => {
    const raw = numerical[rowName];
    const expected = entry.evidence.numericalRows.find(row => row.rowKey === rowName);
    if (!raw || (expected && raw.AttributeName !== expected.attributeName)) throw new Error(`Numerical identity drift: ${rowName}`);
    preview.rows[rowName] = raw;
    return { expression: { row: `lc:${rowName}`, field: raw.BaseValue === 0 && raw.CoefValue !== 0 ? "coefficient" : "base" }, context: { recipient: entry.source.itemId === "20703040533" ? "ally" : "self" } };
  });
  const evidence = {
    kind: applications.length ? "reviewed-chain" : "reviewed-override",
    passiveSkillId: entry.evidence.passiveSkillId,
    descriptionRowKey: entry.evidence.descriptionRowKey,
    basis: [provenance, ...(entry.evidence.basis ?? []),
      ...(entry.source.itemId === "20703040546" ? ["当前 MGE_1312080003 CDO 同时记录爆炸增伤=121400043、命中增伤=121400044；后者实际为 AllDamageRatio，补充全伤害通道，保留参考站爆炸通道。"] : [])],
  };
  return { id: entry.id, label: entry.label, source, ...(applications.length ? { applications } : { reviewedFacetIds: entry.modifierTypeIds }), evidence };
});
// Maintainer correction supersedes the pinned reference's old exclusion.
const pureLight = reference.exclusions.find(entry => entry.source.itemId === "20703040540")!;
const pureLightRow = numerical["1400090107_1_0"];
if (pureLightRow?.AttributeName !== "GPAttributeSetGiveDamageRatio.WeaknessDamageRatio") {
  throw new Error("Numerical identity drift: 1400090107_1_0");
}
preview.rows["1400090107_1_0"] = pureLightRow;
providers.push({
  id: pureLight.id,
  label: pureLight.label,
  source: sourceFor({ ...pureLight, evidence: { passiveSkillId: "1312080001" } }),
  applications: [{ expression: { row: "lc:1400090107_1_0", field: "base" }, context: { recipient: "self" } }],
  evidence: {
    kind: "gp-modifier",
    passiveSkillId: "1312080001",
    descriptionRowKey: "1312080001_1",
    basis: ["维护者确认纯白之光归入弱点增伤，覆盖参考站旧排除；预载 ItemID 20703040540 → PassiveSkill 1312080001 → MGE 描述 GPModifier 1400090107 → Numerical WeaknessDamageRatio。"],
  },
});
const exclusions = reference.exclusions.filter(entry => entry.id !== pureLight.id).map(entry => ({
  id: entry.id, label: entry.label, source: sourceFor(entry), reasonCode: entry.reasonCode,
  reason: entry.reason,
  evidence: { basis: [provenance, entry.reason] },
}));
for (const entry of [...providers, ...exclusions]) {
  const existing = [...registry.providers, ...registry.exclusions].find((candidate: {
    source: { type: string; season?: string; itemId?: string };
  }) => candidate.source.type === "perk" && candidate.source.season === "s4-preview" && candidate.source.itemId === entry.source.itemId);
  entry.id = existing?.id ?? `perk:s4-preview:${entry.source.itemId}`;
}
const itemIds = new Set([...providers, ...exclusions].map(entry => entry.source.itemId));
const isReplaced = (entry: { source: { type: string; season?: string; itemId?: string } }) =>
  entry.source.type === "perk" && entry.source.season === "s4-preview" && itemIds.has(entry.source.itemId ?? "");
registry.providers = [...registry.providers.filter((entry: Parameters<typeof isReplaced>[0]) => !isReplaced(entry)), ...providers];
registry.exclusions = [...registry.exclusions.filter((entry: Parameters<typeof isReplaced>[0]) => !isReplaced(entry)), ...exclusions];
parseModifierProviderRegistry(registry);
preview.source.sha256 = createHash("sha256").update(numericalBytes).digest("hex");
for (const id of itemIds) {
  const item = local.get(id)!;
  if (item.data.season === "s4-preview") continue;
  const original = fs.readFileSync(item.file, "utf8");
  if (!/^season: .+$/m.test(original)) throw new Error(`Missing season: ${item.file}`);
  fs.writeFileSync(item.file, original.replace(/^season: .+$/m, 'season: "s4-preview"'));
}
fs.writeFileSync("data/modifier-providers.json", JSON.stringify(registry, null, 2) + "\n");
fs.writeFileSync("data/perk-preview-modifiers.json", JSON.stringify(preview, null, 2) + "\n");
console.log(`S4 index: ${providers.length} providers, ${exclusions.length} exclusions. Run pnpm num-modifier:project next.`);
