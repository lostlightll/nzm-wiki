import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import matter from "gray-matter";
import { parseModifierProviderRegistry } from "../lib/modifier-provider-registry";
import { NUM_MODIFIER_SOURCE_PATH } from "./num-modifier/lock";

const REVIEW_PATH = "scripts/s4-perk-index-review.json";
const REGISTRY_PATH = "data/modifier-providers.json";
const PREVIEW_PATH = "data/perk-preview-modifiers.json";
const read = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));
type Row = Record<string, unknown>;

/** Names and descriptions cannot add Numerical rows to this locally reviewed manifest. */
export function validateS4Review(input: unknown) {
  const review = parseModifierProviderRegistry(input);
  const itemIds = new Set<string>();
  for (const entry of [...review.providers, ...review.exclusions]) {
    if (entry.source.type !== "perk" || entry.source.season !== "s4-preview") {
      throw new Error(`Expected an S4 preview perk: ${entry.id}`);
    }
    if (itemIds.has(entry.source.itemId)) throw new Error(`Duplicate ItemID: ${entry.source.itemId}`);
    itemIds.add(entry.source.itemId);
    if (!entry.evidence?.passiveSkillId || !entry.evidence.basis?.length) {
      throw new Error(`Missing local identity evidence: ${entry.id}`);
    }
  }
  for (const provider of review.providers) {
    if (!provider.applications?.length || provider.reviewedFacetIds) {
      throw new Error(`Missing direct Numerical applications: ${provider.id}`);
    }
  }
  return review;
}

export function projectS4PerkIndex(contentRoot: string, write = false) {
  const review = validateS4Review(read(REVIEW_PATH));
  const registry = parseModifierProviderRegistry(read(REGISTRY_PATH));
  const preview = read(PREVIEW_PATH);
  if (preview.season !== "s4") throw new Error("Expected S4 Numerical evidence");
  const rows = (file: string): Record<string, Row> => read(path.join(contentRoot, file))[0].Rows;
  const mods = rows("DataTables/LuaDataTable/WeaponModItemData.json");
  const passives = rows("DataTables/MGE/MGEPassive_BD.json");
  const mges = rows("DataTables/MGE/GPModularGameplayEffectTable.json");
  const numerical = rows(NUM_MODIFIER_SOURCE_PATH);
  const targetIds = new Set<string>();

  for (const entry of [...review.providers, ...review.exclusions]) {
    const source = entry.source;
    if (source.type !== "perk") throw new Error(`Invalid perk source: ${entry.id}`);
    targetIds.add(source.itemId);
    const file = `data/perk-preview/slot-${source.slot}/${source.slug}.mdx`;
    const metadata = matter.read(file).data;
    if (String(metadata.id) !== source.itemId || metadata.season !== source.season ||
        metadata.slot !== source.slot || metadata.title !== entry.label) {
      throw new Error(`Local MDX identity drift: ${file}`);
    }
    const mod = mods[source.itemId];
    const [skillId, level = "1"] = String(mod?.PassiveSkill_ID ?? "").split(":");
    if (skillId !== entry.evidence?.passiveSkillId?.split("_")[0]) {
      throw new Error(`Passive identity drift: ${source.itemId}`);
    }
    const passive = passives[`${skillId}_${level}`];
    const mgeId = String((passive?.MGE as Row | undefined)?.Id ?? "");
    const asset = (mges[mgeId]?.MGEClass as Row | undefined)?.AssetPathName;
    if (typeof asset !== "string" || !asset.startsWith("/Game/")) {
      throw new Error(`Missing Passive → MGE class: ${source.itemId}`);
    }
    const assetPath = asset.split(".")[0].replace(/^\/Game\//, "") + ".json";
    if (!fs.existsSync(path.join(contentRoot, assetPath))) throw new Error(`Missing local MGE: ${assetPath}`);
    if (!entry.evidence?.basis?.some(basis => basis.includes(assetPath))) {
      throw new Error(`Reviewed MGE class drift: ${source.itemId} → ${assetPath}`);
    }
    const applications = "reasonCode" in entry ? entry.evidence?.applications : entry.applications;
    for (const application of applications ?? []) {
      const key = application.expression.row.replace(/^lc:/, "");
      const raw = numerical[key];
      const reviewed = preview.rows[key];
      if (!raw || !reviewed) throw new Error(`Missing reviewed Numerical row: ${key}`);
      for (const field of ["ID", "Level", "AttributeName", "GPModifierOp", "BaseValue", "CoefValue"]) {
        if (raw[field] !== reviewed[field]) throw new Error(`Numerical drift requires review: ${key}.${field}`);
      }
    }
  }

  // Preserve ordering, unrelated sources and other channels; never edit MDX or a lock.
  const identity = (entry: { source: { type: string; season?: string; itemId?: string } }) =>
    entry.source.type === "perk" && entry.source.season === "s4-preview" ? entry.source.itemId : undefined;
  const merge = <T extends { source: { type: string; season?: string; itemId?: string } }>(current: T[], selected: T[]) => {
    const pending = new Map(selected.map(entry => [identity(entry), entry]));
    const result: T[] = [];
    for (const entry of current) {
      const id = identity(entry);
      if (!id || !targetIds.has(id)) result.push(entry);
      else if (pending.has(id)) { result.push(pending.get(id)!); pending.delete(id); }
    }
    return [...result, ...pending.values()];
  };
  registry.providers = merge(registry.providers, review.providers);
  registry.exclusions = merge(registry.exclusions, review.exclusions);
  parseModifierProviderRegistry(registry);
  if (write) fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + "\n");
  console.log(`S4 local review: ${review.providers.length} providers, ${review.exclusions.length} exclusions; ${write ? "published" : "validated (no writes)"}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const index = process.argv.indexOf("--content-root");
  if (index < 0 || !process.argv[index + 1] || process.argv[index + 1].startsWith("--")) {
    throw new Error("Required: --content-root <preload Content> [--write]");
  }
  projectS4PerkIndex(path.resolve(process.argv[index + 1]), process.argv.includes("--write"));
}
