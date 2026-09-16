/** Finalize the reviewed S4 import without changing the official Numerical lock.
 * Run import-perks.ts with the reviewed ItemIDs first, then this command with
 * --content-root <preload Content> --icon-root <reference-site/public/icons/perks>.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import matter from "gray-matter";
import YAML from "yaml";
import sharp from "sharp";
import { NUM_MODIFIER_SOURCE_PATH } from "./num-modifier/lock";

type Raw = Record<string, unknown>;
interface Review {
  bindings?: Record<string, { row: string; field: "base" | "coefficient"; scale?: number }>;
  replacements?: { from: string; to: string }[];
  description?: string;
  evidence: string[];
  warnings: string[];
}

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1] || process.argv[index + 1].startsWith("--")) {
    throw new Error(`Missing ${name}`);
  }
  return path.resolve(process.argv[index + 1]);
}

function rows(contentRoot: string, relative: string): Record<string, Raw> {
  return JSON.parse(fs.readFileSync(path.join(contentRoot, relative), "utf8"))[0].Rows;
}

function localized(value: unknown): string {
  const text = value as { LocalizedString?: string; SourceString?: string } | undefined;
  return text?.LocalizedString ?? text?.SourceString ?? "";
}

function normalize(text: string): string {
  let depth = 0;
  const result = text.replace(/[\u200b\ufeff]/g, "")
    .replace(/<(?:qiangdiao|emphasize|Shock|T\d+)>|<\/>/gi, tag => {
      if (tag.startsWith("</")) {
        if (!depth) return "";
        depth -= 1;
        return depth === 0 ? "</strong>" : "";
      }
      depth += 1;
      return depth === 1 ? "<strong>" : "";
    });
  return `${result}${depth ? "</strong>" : ""}`.trim();
}

async function main() {
  const contentRoot = argument("--content-root");
  const iconRoot = argument("--icon-root");
  const review = JSON.parse(fs.readFileSync("scripts/s4-preview-perks-review.json", "utf8")) as Record<string, Review>;
  const mods = rows(contentRoot, "DataTables/LuaDataTable/WeaponModItemData.json");
  const items = rows(contentRoot, "DataTables/System/Items/CommonItemDataTable.json");
  const descriptions = rows(contentRoot, "DataTables/MGE/DT_GPMGESkillDesConfig_BD.json");
  const mainDescriptions = rows(contentRoot, "DataTables/MGE/DT_GPMGESkillDesConfigTable_Main.json");
  const numerical = rows(contentRoot, NUM_MODIFIER_SOURCE_PATH);
  const selectedRows: Record<string, Raw> = {};
  const files = [1, 2, 3, 4].flatMap(slot => {
    const directory = `data/perks/slot-${slot}`;
    return fs.readdirSync(directory).filter(file => file.endsWith(".mdx")).map(file => path.join(directory, file));
  });
  const local = new Map(files.map(file => [String(matter.read(file).data.id), file]));
  const plans: { file: string; text: string; icon: string; image: Buffer }[] = [];
  for (const [id, entry] of Object.entries(review)) {
    const file = local.get(id);
    if (!file) throw new Error(`Import ItemID ${id} with import-perks.ts first`);
    const document = matter.read(file);
    const mod = Object.values(mods).find(row => String(row.MODItemID) === id);
    const item = items[id];
    if (!mod || !item || localized(item.Name) !== document.data.title) throw new Error(`Identity mismatch: ${id}`);
    const skill = String(mod.PassiveSkill_ID).replace(":", "_");
    let description = normalize(entry.description ?? localized((descriptions[skill] ?? mainDescriptions[skill])?.MGEDescription));
    if (!description) throw new Error(`No reviewed description: ${id}`);
    const bindings = { ...entry.bindings };
    for (const replacement of entry.replacements ?? []) {
      if (!description.includes(replacement.from)) throw new Error(`Description drift ${id}: ${replacement.from}`);
      description = description.replaceAll(replacement.from, replacement.to);
    }
    description = description.replace(/\{GPModifier:(\d+):(BaseValue|CoefValue):(\d+):(\d+)(?::(\d+))?\}/g,
      (token, modifierId: string, field: string, index: string, format: string, level = "1") => {
        const rowName = `${modifierId}_${level}_${index}`;
        const row = numerical[rowName];
        if (!row || Number(row.ID) !== Number(modifierId) || Number(row.Level) !== Number(level)) {
          throw new Error(`Unresolved token ${id}: ${token}`);
        }
        const valueField = field === "BaseValue" ? "base" : "coefficient";
        const alias = `modifier-${modifierId}-${index}-${valueField}`;
        bindings[alias] = { row: `lc:${rowName}`, field: valueField };
        const valueFormat = ["2", "10", "13", "15"].includes(format) && !String(row.AttributeName).endsWith("AddPoint") ? "percent" : "number";
        return `{{num:${alias}|${valueFormat}}}`;
      });
    if (/\{GPModifier:|\?\?|<qiangdiao>/.test(description)) throw new Error(`Unresolved description: ${id}`);
    description = description
      .replace(/[（(]\s*CD\s*(\d+(?:\.\d+)?)\s*秒?\s*[)）]/gi, "，冷却时间<strong>$1</strong>秒")
      .replace(/\bCD\s*(\d+(?:\.\d+)?)\s*秒?/gi, "冷却时间<strong>$1</strong>秒");
    for (const binding of Object.values(bindings)) {
      const key = binding.row.replace(/^lc:/, "");
      if (!numerical[key]) throw new Error(`Missing Numerical ${binding.row}`);
      selectedRows[key] = numerical[key];
    }
    const iconPath = (item.IconPath as { NormalIcon: { AssetPathName: string } }).NormalIcon.AssetPathName;
    const iconBasename = iconPath.split(".")[0].split("/").pop()!;
    const expectedIcon = iconBasename.replace(/^T_Icons_Plugins_MGE_/, "");
    const source = path.join(iconRoot, `${expectedIcon}.png`);
    const image = fs.readFileSync(source);
    let icon = expectedIcon;
    const existing = path.join("public/icons/perks", `${icon}.png`);
    if (fs.existsSync(existing) && !fs.readFileSync(existing).equals(image)) icon = `${icon}-${id}`;
    const target = path.join("public/icons/perks", `${icon}.png`);
    if (fs.existsSync(target) && !fs.readFileSync(target).equals(image)) throw new Error(`Icon collision: ${target}`);
    const data: Record<string, unknown> = { ...document.data, icon, season: "s4-preview", description };
    delete data.draft;
    if (Object.keys(bindings).length) data.num_modifier_values = bindings;
    // gray-matter uses YAML 1.1: unquoted 1312071002_1 becomes a number.
    const text = `---\n${YAML.stringify(data, { lineWidth: 0, defaultStringType: "QUOTE_DOUBLE" })}---\n`;
    const roundTrip = matter(text).data;
    if (roundTrip.icon !== icon || roundTrip.id !== id) throw new Error(`Frontmatter identity changed: ${id}`);
    plans.push({ file, text, icon, image });
  }
  // Complete all identity, text and image preflight checks before publishing.
  fs.writeFileSync("data/perk-preview-modifiers.json", JSON.stringify({
    schema_version: 1,
    source: { path: NUM_MODIFIER_SOURCE_PATH, sha256: createHash("sha256").update(fs.readFileSync(path.join(contentRoot, NUM_MODIFIER_SOURCE_PATH))).digest("hex") },
    rows: selectedRows,
  }, null, 2) + "\n");
  for (const plan of plans) {
    fs.writeFileSync(plan.file, plan.text);
    fs.writeFileSync(path.join("public/icons/perks", `${plan.icon}.png`), plan.image);
    await sharp(plan.image).webp({ quality: 85 }).toFile(path.join("public/webp/icons/perks", `${plan.icon}.webp`));
  }
  console.log(`Published ${plans.length} S4 preview perks, ${Object.keys(selectedRows).length} Numerical evidence rows, PNG and WebP icons.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
