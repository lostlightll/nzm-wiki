import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import iconOverrides from "../../data/origin/talent-icon-overrides.json";
import type { OriginTalent, OriginTalentBranchId, OriginTalentCatalog } from "../../lib/origin-talents";

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, "refs/Exports/NZM/Content");
const TARGET = path.join(ROOT, "data/origin/talents.json");
const ICONS = path.join(ROOT, "public/icons/origin/talents");
export const TALENT_TABLE = "DataTables/LuaDataTable/RoguelikeTechEffectConfig.json";

export interface RawTalent {
  RoguelikeTech_Key: number;
  TechSkill_Id: number;
  SeasonId: number;
  BranchId: number;
  LineId: number;
  TechSkillLevel: number;
  TechSkillName: string;
  TechSkillDesc: { LocalizedString?: string; SourceString?: string };
  IconPath: { AssetPathName: string };
  AffixID: number;
  TotalTechSkillNum: number;
  PreTechSkill: string;
  UnlockCostId: string;
}

function iconSource(assetPath: string): string {
  const match = /^\/Game\/(UI\/UI_Textures\/HuntingRou\/(?:SP|TexGen)\/([A-Za-z0-9_]+))\.\2$/.exec(assetPath);
  if (!match) throw new Error(`Invalid talent icon: ${assetPath}`);
  return `${match[1]}.png`;
}

export function projectOriginTalents(rows: Record<string, RawTalent>, availableIcons: ReadonlySet<string> = new Set()): OriginTalentCatalog {
  const overrides: Record<string, { icon: string }> = iconOverrides;
  const grouped = new Map<string, RawTalent[]>();
  for (const [key, row] of Object.entries(rows)) {
    if (key !== String(row.RoguelikeTech_Key) || row.SeasonId !== 0 ||
      ![1, 2, 3, 4].includes(row.BranchId) || !Number.isInteger(row.LineId) || row.LineId < 1 || row.LineId > 9) {
      throw new Error(`Invalid talent identity: ${key}`);
    }
    const id = String(row.TechSkill_Id);
    const group = grouped.get(id) ?? [];
    group.push(row);
    grouped.set(id, group);
  }
  const talents: OriginTalent[] = [];
  for (const [id, group] of grouped) {
    group.sort((a, b) => a.TechSkillLevel - b.TechSkillLevel);
    const first = group[0];
    const prerequisites = first.PreTechSkill ? first.PreTechSkill.split("&").map((part) => {
      const match = /^(\d+):(\d+)$/.exec(part);
      if (!match) throw new Error(`Invalid prerequisite: ${id}`);
      return { id: match[1], level: Number(match[2]) };
    }) : [];
    const levels = group.map((row, index) => {
      if (row.TechSkillLevel !== index + 1 || row.BranchId !== first.BranchId || row.LineId !== first.LineId ||
        row.TechSkillName !== first.TechSkillName || row.IconPath.AssetPathName !== first.IconPath.AssetPathName ||
        row.PreTechSkill !== first.PreTechSkill || row.TotalTechSkillNum !== first.TotalTechSkillNum) {
        throw new Error(`Inconsistent talent levels: ${id}`);
      }
      const cost = /^45210010004:(\d+)$/.exec(row.UnlockCostId);
      if (!cost) throw new Error(`Invalid talent cost: ${id}`);
      const description = (row.TechSkillDesc?.LocalizedString || row.TechSkillDesc?.SourceString)?.trim();
      if (!description) throw new Error(`Missing talent description: ${id} level ${row.TechSkillLevel}`);
      return { level: row.TechSkillLevel, description, cost: Number(cost[1]), sourceRow: String(row.RoguelikeTech_Key), affixId: row.AffixID };
    });
    const source = iconSource(first.IconPath.AssetPathName);
    talents.push({ id, name: first.TechSkillName.trim(), description: levels[0].description,
      branchId: first.BranchId as OriginTalentBranchId, row: first.LineId,
      icon: overrides[id]?.icon ?? (availableIcons.has(source) ? `/icons/origin/talents/${path.basename(source, ".png")}.webp` : ""),
      maxLevel: levels.length, prerequisites, requiredTotalLevels: first.TotalTechSkillNum, levels });
  }
  talents.sort((a, b) => Number(a.id) - Number(b.id));
  for (const talent of talents) {
    for (const prerequisite of talent.prerequisites) {
      const parent = talents.find((entry) => entry.id === prerequisite.id);
      if (!parent || parent.branchId !== talent.branchId || parent.row >= talent.row ||
        prerequisite.level < 1 || prerequisite.level > parent.maxLevel) throw new Error(`Invalid prerequisite: ${talent.id}`);
    }
  }
  if (talents.length !== 29 || Object.keys(rows).length !== 67 ||
    talents.filter((talent) => talent.branchId !== 4).reduce((sum, talent) => sum + talent.maxLevel, 0) !== 66) {
    throw new Error("Unexpected talent catalog size");
  }
  // Branch labels are verified against the in-game talent screen.
  return { schemaVersion: 1, branches: [{ id: 1, name: "战斗" }, { id: 2, name: "幸运" }, { id: 3, name: "技巧" }], talents };
}

async function main() {
  const table = JSON.parse(fs.readFileSync(path.join(SOURCE, TALENT_TABLE), "utf8")) as { Rows: Record<string, RawTalent> }[];
  if (table.length !== 1 || !table[0]?.Rows) throw new Error("Invalid talent table");
  const rows = table[0].Rows;
  const iconSources = new Set(Object.values(rows).filter((row) => !(String(row.TechSkill_Id) in iconOverrides))
    .map((row) => iconSource(row.IconPath.AssetPathName)));
  for (const override of Object.values(iconOverrides)) {
    const metadata = await sharp(path.join(ROOT, "public", override.icon)).metadata();
    if (!metadata.width || !metadata.height) throw new Error(`Invalid reviewed icon: ${override.icon}`);
  }
  // Game textures can also be decoded directly via export-talent-icons.ps1.
  const icons = new Set([...iconSources].filter((source) => fs.existsSync(path.join(SOURCE, source)) ||
    fs.existsSync(path.join(ICONS, `${path.basename(source, ".png")}.webp`))));
  if (icons.size !== iconSources.size) throw new Error("Missing game talent icons; run scripts/origin/export-talent-icons.ps1 first");
  const catalog = projectOriginTalents(rows, icons);
  const check = process.argv.includes("--check");
  const output = `${JSON.stringify(catalog, null, 2)}\n`;
  if (check) {
    if (!fs.existsSync(TARGET) || fs.readFileSync(TARGET, "utf8") !== output) throw new Error("Stale talent projection");
  } else {
    fs.mkdirSync(path.dirname(TARGET), { recursive: true });
    fs.mkdirSync(ICONS, { recursive: true });
    fs.writeFileSync(TARGET, output);
  }
  for (const source of icons) {
    const target = path.join(ICONS, `${path.basename(source, ".png")}.webp`);
    if (!fs.existsSync(path.join(SOURCE, source))) {
      const metadata = await sharp(target).metadata();
      if (!metadata.width || !metadata.height || !metadata.hasAlpha) throw new Error(`Invalid talent icon: ${target}`);
      continue;
    }
    const image = await sharp(path.join(SOURCE, source)).webp({ quality: 90 }).toBuffer();
    if (check) {
      if (!fs.existsSync(target) || !fs.readFileSync(target).equals(image)) throw new Error(`Stale talent icon: ${target}`);
    } else fs.writeFileSync(target, image);
  }
  console.log(`Origin talents: ${catalog.talents.length} nodes, ${Object.keys(rows).length} levels, ${icons.size}/${iconSources.size} icons (${check ? "checked" : "projected"})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
}
