import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import highlightedDescriptions from "../../data/origin/rune-descriptions.json";
import type { OriginRune, OriginRuneCatalog, OriginRuneCategory, OriginRuneQuality } from "../../lib/origin-runes";

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, "refs/Exports/NZM/Content");
const TABLES = path.join(SOURCE, "DataTables/Roguelike");
const TARGET = path.join(ROOT, "data/origin/runes.json");
const ICONS = path.join(ROOT, "public/icons/origin/runes");
const ICON_PREFIX = "/Game/UI/UI_Textures/Icons/Rogue/Runes/";

interface TextValue { LocalizedString?: string; SourceString?: string }
interface RawRune {
  RuneId: number;
  DisplayName: TextValue;
  Description: TextValue;
  Quality: number;
  Icon: { AssetPathName: string };
  Tag: { Values: number[] };
}
interface RawTag { Tag: number; DisplayName: TextValue }

function readRows<T>(name: string): Record<string, T> {
  const table = JSON.parse(fs.readFileSync(path.join(TABLES, `${name}.json`), "utf8")) as
    { Rows: Record<string, T> }[];
  if (table.length !== 1 || !table[0]?.Rows) throw new Error(`Invalid table: ${name}`);
  return table[0].Rows;
}

function text(value: TextValue, field: string): string {
  const result = value.LocalizedString || value.SourceString;
  if (!result?.trim()) throw new Error(`Missing ${field}`);
  return result.trim();
}

function iconName(assetPath: string): string {
  if (!assetPath.startsWith(ICON_PREFIX)) throw new Error(`Unexpected rune icon: ${assetPath}`);
  const name = assetPath.slice(ICON_PREFIX.length).split(".");
  if (name.length !== 2 || name[0] !== name[1] || !/^[A-Za-z0-9_]+$/.test(name[0])) {
    throw new Error(`Invalid rune icon: ${assetPath}`);
  }
  return name[0];
}

export function projectOriginRunes(
  special: Record<string, RawRune>,
  normal: Record<string, RawRune>,
  rawTags: Record<string, RawTag>,
): OriginRuneCatalog {
  const tags = Object.entries(rawTags).map(([key, row]) => {
    if (String(row.Tag) !== key) throw new Error(`Tag identity mismatch: ${key}`);
    return { id: row.Tag, name: text(row.DisplayName, `tag ${key}`) };
  });
  const tagIds = new Set(tags.map((tag) => tag.id));
  const descriptions: Record<string, string> = highlightedDescriptions;
  const ids = new Set<string>();
  const runes: OriginRune[] = [];
  for (const [category, rows] of [["special", special], ["normal", normal]] as const) {
    for (const [key, row] of Object.entries(rows)) {
      const id = String(row.RuneId);
      if (key !== id || ids.has(id)) throw new Error(`Rune identity collision: ${key}`);
      ids.add(id);
      if (![3, 4, 5].includes(row.Quality)) throw new Error(`Invalid quality: ${id}`);
      if (!Array.isArray(row.Tag?.Values) || !row.Tag.Values.length ||
        row.Tag.Values.some((tagId) => !tagIds.has(tagId))) throw new Error(`Invalid tags: ${id}`);
      // Highlight display text only; these numbers are not verified numerical effects.
      const sourceDescription = text(row.Description, `rune description ${id}`);
      const description = descriptions[id];
      if (!description) throw new Error(`Missing highlighted rune description: ${id}`);
      const plainDescription = description.replace(/\*\*([^*\n。]+)\*\*/g, "$1");
      if (plainDescription === description || plainDescription !== sourceDescription) {
        throw new Error(`Rune highlights must preserve the source description: ${id}`);
      }
      const icon = iconName(row.Icon.AssetPathName);
      runes.push({ id, name: text(row.DisplayName, `rune ${id}`), description,
        category: category as OriginRuneCategory, quality: row.Quality as OriginRuneQuality,
        icon: `/icons/origin/runes/${icon}.webp`, tagIds: row.Tag.Values });
    }
  }
  if (runes.length !== 174 || tags.length !== 20) throw new Error(`Unexpected catalog size: ${runes.length} runes, ${tags.length} tags`);
  if (Object.keys(descriptions).length !== ids.size || Object.keys(descriptions).some((id) => !ids.has(id))) {
    throw new Error("Highlighted rune descriptions do not match the source IDs");
  }
  return { schemaVersion: 2, tags, runes };
}

async function main() {
  const check = process.argv.includes("--check");
  const catalog = projectOriginRunes(
    readRows<RawRune>("RoguelikeSpecialRuneTable"),
    readRows<RawRune>("RoguelikeRuneTable"),
    readRows<RawTag>("RoguelikeRuneTagTable"),
  );
  const output = `${JSON.stringify(catalog, null, 2)}\n`;
  if (check) {
    if (!fs.existsSync(TARGET) || fs.readFileSync(TARGET, "utf8") !== output) {
      throw new Error("Origin rune projection is stale; run pnpm origin-runes:project");
    }
  } else {
    fs.mkdirSync(path.dirname(TARGET), { recursive: true });
    fs.writeFileSync(TARGET, output);
    fs.mkdirSync(ICONS, { recursive: true });
  }
  const names = [...new Set(catalog.runes.map((rune) => path.basename(rune.icon, ".webp")))];
  if (names.length !== 37) throw new Error(`Unexpected rune icon count: ${names.length}`);
  for (const name of names) {
    const source = path.join(SOURCE, "UI/UI_Textures/Icons/Rogue/Runes", `${name}.png`);
    if (!fs.existsSync(source)) throw new Error(`Missing rune icon: ${source}`);
    const target = path.join(ICONS, `${name}.webp`);
    const image = await sharp(source).webp({ quality: 90 }).toBuffer();
    if (check) {
      if (!fs.existsSync(target) || !fs.readFileSync(target).equals(image)) throw new Error(`Stale rune icon: ${target}`);
    } else {
      fs.writeFileSync(target, image);
    }
  }
  console.log(`Origin runes: ${catalog.runes.length} entries, ${catalog.tags.length} tags, ${names.length} icons (${check ? "checked" : "projected"})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
}
