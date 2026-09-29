import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { OriginAffix, OriginAffixCatalog, OriginAffixCategory } from "../../lib/origin-affixes";

const ROOT = process.cwd();
// Worktrees have no refs/ checkout; NZM_REFS points at the main repo's read-only refs directory.
export const AFFIX_TABLE = path.join(process.env.NZM_REFS ?? path.join(ROOT, "refs"),
  "Exports/NZM/Content/DataTables/Roguelike/AffixWeapon/AffixWeaponAffixDisplayConfig.json");
const TARGET = path.join(ROOT, "data/origin/affixes.json");
// Every row shares this plugin icon; the in-game codex draws its own star instead.
const PLACEHOLDER_ICON = "/Game/UI/UI_Textures/Icons/Weapon/Plugins/T_Icons_Plugins_MGE_1314142001.T_Icons_Plugins_MGE_1314142001";
const CATEGORIES: Record<string, OriginAffixCategory> = {
  "EWeaponAffixCategory::Special": "special",
  "EWeaponAffixCategory::Normal": "normal",
};

const ZERO_WIDTH = new RegExp("[\\u200B-\\u200D\\uFEFF]", "g");

interface TextValue { LocalizedString?: string; SourceString?: string }
export interface RawAffix {
  AffixID: number;
  AffixName: TextValue;
  AffixCategory: string;
  Description: TextValue;
  Icon: { AssetPathName: string };
}

export function readAffixRows(file = AFFIX_TABLE): Record<string, RawAffix> {
  const table = JSON.parse(fs.readFileSync(file, "utf8")) as { Rows: Record<string, RawAffix> }[];
  if (table.length !== 1 || !table[0]?.Rows) throw new Error(`Invalid table: ${file}`);
  return table[0].Rows;
}

function text(value: TextValue, field: string): string {
  const result = (value.LocalizedString || value.SourceString)?.replace(ZERO_WIDTH, "").trim();
  if (!result) throw new Error(`Missing ${field}`);
  return result;
}

export function projectOriginAffixes(rows: Record<string, RawAffix>): OriginAffixCatalog {
  const affixes: OriginAffix[] = Object.entries(rows).map(([key, row]) => {
    const id = String(row.AffixID);
    if (key !== id) throw new Error(`Affix identity mismatch: ${key}`);
    const category = CATEGORIES[row.AffixCategory];
    if (!category) throw new Error(`Unknown affix category: ${id} ${row.AffixCategory}`);
    if (row.Icon?.AssetPathName !== PLACEHOLDER_ICON) throw new Error(`Affix icon changed, review icon handling: ${id}`);
    return { id, name: text(row.AffixName, `affix name ${id}`),
      description: text(row.Description, `affix description ${id}`), category };
  }).sort((a, b) => Number(a.id) - Number(b.id));
  const special = affixes.filter((affix) => affix.category === "special").length;
  if (affixes.length !== 108 || special !== 71) {
    throw new Error(`Unexpected affix catalog size: ${affixes.length} affixes, ${special} special`);
  }
  if (new Set(affixes.map((affix) => affix.name)).size !== affixes.length) throw new Error("Duplicate affix names");
  return { schemaVersion: 1, affixes };
}

function main() {
  const check = process.argv.includes("--check");
  const output = `${JSON.stringify(projectOriginAffixes(readAffixRows()), null, 2)}\n`;
  if (check) {
    if (!fs.existsSync(TARGET) || fs.readFileSync(TARGET, "utf8") !== output) {
      throw new Error("Origin affix projection is stale; run pnpm origin-affixes:project");
    }
  } else {
    fs.mkdirSync(path.dirname(TARGET), { recursive: true });
    fs.writeFileSync(TARGET, output);
  }
  console.log(`Origin affixes: ${JSON.parse(output).affixes.length} entries (${check ? "checked" : "projected"})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { main(); } catch (error: unknown) { console.error(error); process.exitCode = 1; }
}
