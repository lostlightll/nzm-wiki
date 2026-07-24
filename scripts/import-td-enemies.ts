/**
 * 从塔防导出表发现并导入敌人图鉴数据。
 *
 * 默认仅 dry-run：
 *   pnpm exec tsx scripts/import-td-enemies.ts
 *   pnpm exec tsx scripts/import-td-enemies.ts --write
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import matter from "gray-matter";
import sharp from "sharp";
import configData from "../data/enemies/td/import-config.json";

type EnemyType = "normal" | "elite" | "boss";
type Scalar = string | number;
type Frontmatter = Record<string, unknown>;
type RowMap<T> = Record<string, T>;

interface ImportFields {
  title: string;
  type: EnemyType;
  attack: Scalar;
  hp: Scalar;
  hitback_hp: Scalar;
  hardstraight_hp: Scalar;
  weight: Scalar;
  speed: Scalar;
  kill_money?: number;
  description: string;
}

interface ImportConfig {
  presetAliases: Record<string, string>;
  excludedTitles: Record<string, string>;
  overrides: Record<string, Partial<ImportFields>>;
}

interface EnemyGroupRow {
  [key: `EnemySpawnPresetKey${number}`]: string | undefined;
}

interface SpawnPresetRow {
  UniqueMonsterID?: number;
}

interface MonsterRow {
  UniqueMonsterID?: number;
  MonsterType?: number;
  Name?: string;
  NarrativeContent?: string;
  MonsterIcon?: { AssetPathName?: string };
  NPCBodyWeight?: number;
  MaxHealth?: number;
  SpellPower?: number;
  HitBackThreshold?: number;
}

interface AIParamRow {
  KillReward?: { RewardCoins?: number };
}

interface SourceCandidate {
  title: string;
  sourceIds: number[];
  fields: ImportFields;
  iconSource: string;
}

interface FileChange {
  title: string;
  filePath: string;
  kind: "add" | "update" | "unchanged";
  changedFields: string[];
  output?: string;
}

interface IconChange {
  title: string;
  pngPath: string;
  webpPath: string;
  pngChanged: boolean;
  webpChanged: boolean;
  png: Buffer;
  webp: Buffer;
}

export interface ImportPlan {
  candidates: SourceCandidate[];
  files: FileChange[];
  icons: IconChange[];
  excluded: Array<{ title: string; reason: string }>;
  aliases: Array<{ source: string; target: string }>;
  blockers: string[];
}

const ROOT = process.cwd();
const CONTENT_DIR = path.join(ROOT, "refs", "Exports", "NZM", "Content");
const TABLE_DIR = path.join(CONTENT_DIR, "DataTables");
const ENEMY_DIR = path.join(ROOT, "data", "enemies", "td");
const PNG_DIR = path.join(ROOT, "public", "icons", "enemies", "td");
const WEBP_DIR = path.join(ROOT, "public", "webp", "icons", "enemies", "td");
const CONFIG = configData as ImportConfig;

const IMPORT_FIELD_ORDER = [
  "title",
  "nickname",
  "type",
  "attack",
  "hp",
  "hitback_hp",
  "hardstraight_hp",
  "weight",
  "speed",
  "kill_money",
  "attack_range",
  "search_range",
  "description",
] as const;

const IMPORT_OWNED_FIELDS = new Set([
  "title",
  "type",
  "attack",
  "hp",
  "hitback_hp",
  "hardstraight_hp",
  "weight",
  "speed",
  "kill_money",
  "description",
]);

function readRows<T>(relativePath: string): RowMap<T> {
  const filePath = path.join(TABLE_DIR, relativePath);
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Array<{
    Rows?: RowMap<T>;
  }>;
  const rows = parsed[0]?.Rows;
  if (!rows) throw new Error(`Data table rows not found: ${relativePath}`);
  return rows;
}

export function mapMonsterType(value: number | undefined): EnemyType | null {
  if (value === 3 || value === 4) return "normal";
  if (value === 5) return "elite";
  if (value === 7) return "boss";
  return null;
}

export function normalizeNarrative(value: string | undefined): string {
  if (!value || value === "None") return "";
  return value
    .replace(/(?:<br\s*\/?>\s*)+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function iconSourceFromAsset(assetPath: string | undefined): string | null {
  if (!assetPath || assetPath === "None") return null;
  const packagePath = assetPath.split(".")[0];
  if (!packagePath.startsWith("/Game/")) return null;
  const source = path.join(
    CONTENT_DIR,
    `${packagePath.slice("/Game/".length)}.png`,
  );
  return fs.existsSync(source) ? source : null;
}

function compareValues(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function orderedFrontmatter(data: Frontmatter): Frontmatter {
  const ordered: Frontmatter = {};
  for (const key of IMPORT_FIELD_ORDER) {
    if (key in data) ordered[key] = data[key];
  }
  for (const [key, value] of Object.entries(data)) {
    if (!(key in ordered)) ordered[key] = value;
  }
  return ordered;
}

export function mergeFrontmatter(
  existing: Frontmatter | null,
  fields: ImportFields,
): Frontmatter {
  const merged: Frontmatter = existing ? { ...existing } : {};

  if (!existing && fields.type !== "boss") merged.nickname = "";
  for (const key of IMPORT_OWNED_FIELDS) {
    if (key === "kill_money" && fields.kill_money === undefined) {
      delete merged.kill_money;
      continue;
    }
    merged[key] = fields[key as keyof ImportFields];
  }

  return orderedFrontmatter(merged);
}

function changedFieldNames(before: Frontmatter, after: Frontmatter): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((key) => !compareValues(before[key], after[key]));
}

function buildFields(
  title: string,
  monster: MonsterRow,
  aiParam: AIParamRow | undefined,
  blockers: string[],
): ImportFields | null {
  const type = mapMonsterType(monster.MonsterType);
  if (!type) {
    blockers.push(`${title}: unsupported MonsterType ${monster.MonsterType ?? "missing"}`);
    return null;
  }

  const required = {
    SpellPower: monster.SpellPower,
    MaxHealth: monster.MaxHealth,
    NPCBodyWeight: monster.NPCBodyWeight,
  };
  for (const [field, value] of Object.entries(required)) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      blockers.push(`${title}: invalid ${field}`);
      return null;
    }
  }

  const override = CONFIG.overrides[title] ?? {};
  const rawDescription = normalizeNarrative(monster.NarrativeContent);
  if (/XXX/i.test(rawDescription) && override.description === undefined) {
    blockers.push(`${title}: NarrativeContent contains placeholder text`);
    return null;
  }

  const rewardCoins = aiParam?.KillReward?.RewardCoins;
  if (
    type !== "boss" &&
    typeof rewardCoins !== "number" &&
    override.kill_money === undefined
  ) {
    blockers.push(`${title}: missing KillReward.RewardCoins`);
    return null;
  }

  const base: ImportFields = {
    title,
    type,
    attack: monster.SpellPower as number,
    hp:
      type === "boss"
        ? Math.round((monster.MaxHealth as number) * 0.5)
        : (monster.MaxHealth as number),
    hitback_hp: type === "boss" ? 36 : -1,
    hardstraight_hp: type === "boss" ? 119988 : -1,
    weight: monster.NPCBodyWeight as number,
    speed: 5,
    ...(type === "boss" ? {} : { kill_money: rewardCoins }),
    description: rawDescription,
  };

  return { ...base, ...override };
}

function sameCandidate(left: SourceCandidate, right: SourceCandidate): boolean {
  return (
    compareValues(left.fields, right.fields) &&
    left.iconSource === right.iconSource
  );
}

function readExistingFiles(): Map<string, string> {
  const files = new Map<string, string>();
  for (const file of fs.readdirSync(ENEMY_DIR).filter((name) => name.endsWith(".mdx"))) {
    const filePath = path.join(ENEMY_DIR, file);
    const parsed = matter(fs.readFileSync(filePath, "utf8"));
    if (typeof parsed.data.title === "string") {
      files.set(parsed.data.title, filePath);
    }
  }
  return files;
}

function bufferChanged(filePath: string, next: Buffer): boolean {
  return !fs.existsSync(filePath) || !fs.readFileSync(filePath).equals(next);
}

export async function createImportPlan(): Promise<ImportPlan> {
  const blockers: string[] = [];
  const aliases: ImportPlan["aliases"] = [];
  const excluded: ImportPlan["excluded"] = [];
  const groups = readRows<EnemyGroupRow>(
    "TowerDefense/TowerDefenseEnemyGroupTable.json",
  );
  const presets = readRows<SpawnPresetRow>(
    "TowerDefense/TowerDefenseSpawnPresetTable.json",
  );
  const monsters = readRows<MonsterRow>("MonsterUniqueIDTable.json");
  const aiParams = readRows<AIParamRow>(
    "TowerDefense/TowerDefenseAIParamTable.json",
  );
  const usedPresets = new Set<string>();

  for (const row of Object.values(groups)) {
    for (let index = 1; index <= 5; index += 1) {
      const key = row[`EnemySpawnPresetKey${index}`];
      if (key) usedPresets.add(key);
    }
  }

  const candidatesByTitle = new Map<string, SourceCandidate>();
  for (const sourcePreset of [...usedPresets].sort((a, b) =>
    a.localeCompare(b, "zh-CN"),
  )) {
    const targetPreset = presets[sourcePreset]
      ? sourcePreset
      : CONFIG.presetAliases[sourcePreset];
    if (!targetPreset || !presets[targetPreset]) {
      blockers.push(`${sourcePreset}: unresolved spawn preset`);
      continue;
    }
    if (targetPreset !== sourcePreset) {
      aliases.push({ source: sourcePreset, target: targetPreset });
    }

    const sourceId = presets[targetPreset].UniqueMonsterID;
    const monster = sourceId === undefined ? undefined : monsters[String(sourceId)];
    const title = monster?.Name;
    if (sourceId === undefined || !monster || !title) {
      blockers.push(`${sourcePreset}: missing UniqueMonsterID or monster row`);
      continue;
    }

    const exclusionReason = CONFIG.excludedTitles[title];
    if (exclusionReason) {
      if (!excluded.some((item) => item.title === title)) {
        excluded.push({ title, reason: exclusionReason });
      }
      continue;
    }

    const iconSource = iconSourceFromAsset(monster.MonsterIcon?.AssetPathName);
    if (!iconSource) {
      blockers.push(`${title} (${sourceId}): missing source icon`);
      continue;
    }

    const fields = buildFields(title, monster, aiParams[String(sourceId)], blockers);
    if (!fields) continue;
    const next: SourceCandidate = {
      title,
      sourceIds: [sourceId],
      fields,
      iconSource,
    };
    const previous = candidatesByTitle.get(title);
    if (!previous) {
      candidatesByTitle.set(title, next);
    } else if (!sameCandidate(previous, next)) {
      blockers.push(
        `${title}: conflicting source rows ${previous.sourceIds.join(", ")} and ${sourceId}`,
      );
    } else if (!previous.sourceIds.includes(sourceId)) {
      previous.sourceIds.push(sourceId);
    }
  }

  const candidates = [...candidatesByTitle.values()].sort((a, b) =>
    a.title.localeCompare(b.title, "zh-CN"),
  );
  const existingFiles = readExistingFiles();
  const files: FileChange[] = [];
  const icons: IconChange[] = [];

  for (const candidate of candidates) {
    const existingPath = existingFiles.get(candidate.title);
    const filePath =
      existingPath ?? path.join(ENEMY_DIR, `${candidate.title}.mdx`);
    const parsed = existingPath
      ? matter(fs.readFileSync(existingPath, "utf8"))
      : null;
    const nextData = mergeFrontmatter(parsed?.data ?? null, candidate.fields);
    const changedFields = parsed
      ? changedFieldNames(parsed.data, nextData)
      : Object.keys(nextData);
    const kind: FileChange["kind"] = !parsed
      ? "add"
      : changedFields.length > 0
        ? "update"
        : "unchanged";
    const output =
      kind === "unchanged"
        ? undefined
        : `${matter.stringify(parsed?.content ?? "", nextData).trimEnd()}\n`;
    files.push({
      title: candidate.title,
      filePath,
      kind,
      changedFields,
      output,
    });

    const png = fs.readFileSync(candidate.iconSource);
    const webp = await sharp(png)
      .webp({ quality: 80, alphaQuality: 100 })
      .toBuffer();
    const pngPath = path.join(PNG_DIR, candidate.fields.type, `${candidate.title}.png`);
    const webpPath = path.join(
      WEBP_DIR,
      candidate.fields.type,
      `${candidate.title}.webp`,
    );
    icons.push({
      title: candidate.title,
      pngPath,
      webpPath,
      pngChanged: bufferChanged(pngPath, png),
      webpChanged: bufferChanged(webpPath, webp),
      png,
      webp,
    });
  }

  return { candidates, files, icons, excluded, aliases, blockers };
}

function relative(filePath: string): string {
  return path.relative(ROOT, filePath);
}

function printPlan(plan: ImportPlan, write: boolean) {
  const added = plan.files.filter((file) => file.kind === "add");
  const updated = plan.files.filter((file) => file.kind === "update");
  const unchanged = plan.files.filter((file) => file.kind === "unchanged");
  const iconUpdates = plan.icons.filter(
    (icon) => icon.pngChanged || icon.webpChanged,
  );

  console.log(`${write ? "Writing" : "Dry run"} ${plan.candidates.length} TD enemies.`);
  console.log(
    `MDX: ${added.length} add, ${updated.length} update, ${unchanged.length} unchanged.`,
  );
  for (const file of [...added, ...updated]) {
    console.log(
      `- ${file.kind}: ${relative(file.filePath)} [${file.changedFields.join(", ")}]`,
    );
  }
  console.log(`Icons: ${iconUpdates.length} changed.`);
  for (const icon of iconUpdates) {
    const formats = [
      icon.pngChanged ? "png" : "",
      icon.webpChanged ? "webp" : "",
    ].filter(Boolean);
    console.log(`- ${icon.title}: ${formats.join(", ")}`);
  }
  console.log(`Aliases: ${plan.aliases.length}.`);
  for (const alias of plan.aliases) {
    console.log(`- ${alias.source} -> ${alias.target}`);
  }
  console.log(`Excluded: ${plan.excluded.length}.`);
  for (const item of plan.excluded) {
    console.log(`- ${item.title}: ${item.reason}`);
  }
  console.log(`Blockers: ${plan.blockers.length}.`);
  for (const blocker of plan.blockers) console.log(`- ${blocker}`);
}

async function writePlan(plan: ImportPlan) {
  for (const file of plan.files) {
    if (file.output === undefined) continue;
    fs.writeFileSync(file.filePath, file.output, "utf8");
  }
  for (const icon of plan.icons) {
    if (icon.pngChanged) {
      fs.mkdirSync(path.dirname(icon.pngPath), { recursive: true });
      fs.writeFileSync(icon.pngPath, icon.png);
    }
    if (icon.webpChanged) {
      fs.mkdirSync(path.dirname(icon.webpPath), { recursive: true });
      fs.writeFileSync(icon.webpPath, icon.webp);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes("--write");
  const unknown = args.filter((arg) => arg !== "--write");
  if (unknown.length > 0) {
    throw new Error(`Unknown argument: ${unknown.join(", ")}`);
  }

  const plan = await createImportPlan();
  printPlan(plan, write);
  if (plan.blockers.length > 0) {
    process.exitCode = 1;
    return;
  }
  if (write) {
    await writePlan(plan);
    console.log("TD enemy import completed.");
  } else {
    console.log("Run with --write to apply this import.");
  }
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (entryPath === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
