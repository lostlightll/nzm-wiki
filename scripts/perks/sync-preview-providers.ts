import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import matter from "gray-matter";
import { getActivePreview, getPreviewSeasonKey, isPreviewSeason } from "../../lib/content-preview";
import { parseModifierProviderRegistry } from "../../lib/modifier-provider-registry";
import { NUM_MODIFIER_SOURCE_PATH } from "../num-modifier/lock";

type Row = Record<string, unknown>;
const { values } = parseArgs({ options: {
  "content-root": { type: "string" }, "baseline-root": { type: "string" },
  write: { type: "boolean", default: false },
} });
if (!values["content-root"] || !values["baseline-root"]) {
  throw new Error("Usage: tsx scripts/perks/sync-preview-providers.ts --content-root PATH --baseline-root PATH [--write]");
}
const preview = getActivePreview();
if (!preview) throw new Error("Register the preview before synchronizing providers");
const season = getPreviewSeasonKey(preview);
const readRows = (root: string, file: string): Record<string, Row> =>
  JSON.parse(fs.readFileSync(path.join(root, file), "utf8"))[0].Rows;
const itemFile = "DataTables/LuaDataTable/WeaponModItemData.json";
const currentItems = readRows(values["content-root"], itemFile);
const baselineItems = readRows(values["baseline-root"], itemFile);
const currentNumerical = readRows(values["content-root"], NUM_MODIFIER_SOURCE_PATH);
const baselineNumerical = readRows(values["baseline-root"], NUM_MODIFIER_SOURCE_PATH);
const passives = readRows(values["content-root"], "DataTables/MGE/MGEPassive_BD.json");
const descriptions = {
  ...readRows(values["content-root"], "DataTables/MGE/DT_GPMGESkillDesConfig_BD.json"),
  ...readRows(values["content-root"], "DataTables/MGE/DT_GPMGESkillDesConfigTable_Main.json"),
};
const evidence = JSON.parse(fs.readFileSync("data/perk-preview-modifiers.json", "utf8")) as {
  season: string; rows: Record<string, Row>;
};
if (evidence.season !== preview.season) throw new Error("Preview Numerical evidence season mismatch");
const registryFile = "data/modifier-providers.json";
const registry = parseModifierProviderRegistry(JSON.parse(fs.readFileSync(registryFile, "utf8")));
const entries = [...registry.providers, ...registry.exclusions];
const registered = new Set(entries.flatMap(entry => entry.source.type === "perk" && entry.source.season === season
  ? [entry.source.itemId] : []));
const current = new Map(entries.flatMap(entry => entry.source.type === "perk" && !isPreviewSeason(entry.source.season)
  ? [[entry.source.itemId, entry] as const] : []));
const seen = new Set<string>();
let providers = 0;
let exclusions = 0;
let unreviewed = 0;
const changes: string[] = [];
const addedRows: string[] = [];
const fields = ["ID", "Level", "AttributeName", "GPModifierOp", "BaseValue", "CoefValue"] as const;

for (const slot of [1, 2, 3, 4] as const) {
  const directory = `data/perk-preview/slot-${slot}`;
  if (!fs.existsSync(directory)) continue;
  for (const file of fs.readdirSync(directory).filter(file => file.endsWith(".mdx")).sort()) {
    const data = matter.read(path.join(directory, file)).data;
    if (data.draft) continue;
    const itemId = String(data.id);
    if (data.season !== season || data.slot !== slot || seen.has(itemId)) throw new Error(`Preview identity mismatch: ${file}`);
    seen.add(itemId);
    if (registered.has(itemId)) continue;
    const item = currentItems[itemId];
    const oldItem = baselineItems[itemId];
    if (!item || !oldItem || String(item.PassiveSkill_ID) !== String(oldItem.PassiveSkill_ID)) {
      throw new Error(`Review changed or missing ItemID → PassiveSkill identity: ${itemId}`);
    }
    if (data.CollectMODItem !== item.CollectMODItem || data.MakeMODItem !== item.MakeMODItem) {
      throw new Error(`Preview availability does not match current configuration: ${itemId}`);
    }
    const passiveSkillId = String(item.PassiveSkill_ID).split(":")[0];
    const original = current.get(itemId);
    const source = { type: "perk" as const, itemId, slot, slug: file.slice(0, -4), overlimitCard: false, season };
    const id = `perk:${season}:${itemId}`;
    const basis = `预览存量迁移：${itemId} 的 ItemID → PassiveSkill ${passiveSkillId || "未声明"} 在指定旧版/当前源中一致；正式来源 ${original?.id ?? "未登记"}，当前数值只从预览选定 Numerical 行解析。`;
    const missingReviewedRow = itemId === "20703040445" && !currentNumerical["131522800_1_0"];
    if (!original || missingReviewedRow) {
      registry.exclusions.push({ id, label: String(data.title), source, reasonCode: "unverified-evidence",
        reason: missingReviewedRow ? "当前源已移除原引用 131522800_1_0，预览移除对应数值，待重新核实来源链。"
          : "存量插件尚无已审定的 Modifier 来源链；保留预览条目，不凭展示描述推断增伤分面。",
        evidence: { ...(passiveSkillId ? { passiveSkillId } : {}), basis: [basis] } });
      exclusions++; unreviewed++;
      continue;
    }
    if (original.source.type !== "perk" || original.source.slot !== slot || original.source.slug !== source.slug ||
        (original.evidence?.passiveSkillId && original.evidence.passiveSkillId !== passiveSkillId)) {
      throw new Error(`Registered source identity drift: ${itemId}`);
    }
    const applications = "applications" in original ? original.applications : original.evidence?.applications;
    const level = String(item.PassiveSkill_ID).split(":")[1] ?? "1";
    const passive = passives[`${passiveSkillId}_${level}`];
    const descriptionKey = `${String((passive?.MGEConfig as Row | undefined)?.Id ?? passiveSkillId)}_${String(passive?.MGEDescriptionId ?? 1)}`;
    const description = descriptions[descriptionKey]?.MGEDescription as Row | undefined;
    const text = String(description?.LocalizedString ?? description?.SourceString ?? "");
    for (const application of applications ?? []) {
      const key = application.expression.row.replace(/^lc:/, "");
      const row = currentNumerical[key];
      const old = baselineNumerical[key];
      if (!row || !old) throw new Error(`Missing Numerical row: ${itemId} ${key}`);
      if (!evidence.rows[key]) { evidence.rows[key] = row; addedRows.push(key); }
      if (fields.some(field => row[field] !== evidence.rows[key][field])) {
        throw new Error(`Missing or stale preview Numerical evidence: ${itemId} ${key}`);
      }
      if ("kind" in (original.evidence ?? {}) && original.evidence?.kind === "gp-modifier" &&
          !text.includes(`{GPModifier:${String(row.ID)}:`)) {
        throw new Error(`GPModifier identity no longer linked from MGE description: ${itemId} ${key}`);
      }
      const attributeChanged = row.AttributeName !== old.AttributeName;
      const reviewedFollower = itemId === "20703040354" && key === "111041003_1_0" &&
        old.AttributeName === "GPAttributeSetGiveDamageRatio.WeaponHitDamageRatio" &&
        row.AttributeName === "GPAttributeSetGiveDamageRatio.AllDamageRatio";
      const reviewedShooting = itemId === "20703040453" && key === "131521200_1_0" &&
        old.AttributeName === "GPAttributeSetGiveDamageRatio.WeaponHitDamageRatio" &&
        row.AttributeName === "GPAttributeSetGiveDamageRatio.WeaponDamageRatio";
      if ((attributeChanged && !reviewedFollower && !reviewedShooting) || row.ID !== old.ID || row.Level !== old.Level || row.GPModifierOp !== old.GPModifierOp) {
        throw new Error(`Review Numerical identity/operation change: ${itemId} ${key}`);
      }
      if (fields.some(field => row[field] !== old[field])) changes.push(`${itemId} ${key}: ${old.AttributeName} → ${row.AttributeName}; base ${old.BaseValue} → ${row.BaseValue}, coefficient ${old.CoefValue} → ${row.CoefValue}`);
    }
    const copied = { ...original, id, source, label: String(data.title), evidence: {
      ...original.evidence, basis: [...(original.evidence?.basis ?? []), basis],
    } };
    if ("reasonCode" in copied) { registry.exclusions.push(copied); exclusions++; }
    else { registry.providers.push(copied); providers++; }
  }
}
parseModifierProviderRegistry(registry);
if (values.write) {
  fs.writeFileSync(registryFile, JSON.stringify(registry, null, 2) + "\n");
  fs.writeFileSync("data/perk-preview-modifiers.json", JSON.stringify(evidence, null, 2) + "\n");
}
console.log(JSON.stringify({ write: values.write, season, previewPerks: seen.size, addedProviders: providers,
  addedExclusions: exclusions, unreviewed, addedRows, numericalChanges: changes }, null, 2));
