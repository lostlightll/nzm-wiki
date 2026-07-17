/**
 * 从 refs 导入肉鸽猎场的超限卡片图鉴数据和图标。
 *
 * 用法：pnpm exec tsx scripts/import-overlimit-cards.ts
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";

const ROOT_DIR = process.cwd();
const REFS_DIR = path.join(ROOT_DIR, "refs/Exports/NZM/Content");
const OUTPUT_FILE = path.join(ROOT_DIR, "data/overlimit-cards.json");
const CARD_ICON_DIR = path.join(ROOT_DIR, "public/icons/overlimit/cards");
const SET_ICON_DIR = path.join(ROOT_DIR, "public/icons/overlimit/sets");

const REF_FILES = {
  cards:
    "DataTables/HuntingGroundRoguelike/HuntingGroundRoguelikeWeaponModTable.json",
  mods: "DataTables/LuaDataTable/WeaponModItemData.json",
  items: "DataTables/System/Items/CommonItemDataTable.json",
  sets: "DataTables/LuaDataTable/WeaponModSetTable.json",
} as const;

interface LocalizedText {
  CultureInvariantString?: string | null;
  LocalizedString?: string | null;
  SourceString?: string | null;
}

interface AssetReference {
  AssetPathName?: string;
}

interface CardRow {
  ModId: number;
  IconPath?: AssetReference;
  OverrideDesc?: LocalizedText;
  OverrideQuality?: number;
  IsShow?: boolean;
}

interface ModRow {
  MODItemID: number;
  MODName?: LocalizedText;
  MODSlotIndex?: {
    Values?: number[];
  };
  ModSets?: string;
}

interface ItemRow {
  Name?: LocalizedText;
  Quality?: number;
}

interface SetRow {
  SetId: number;
  SetName?: LocalizedText;
  SetSimpleIcon?: AssetReference;
  SetIcon?: AssetReference;
  SetColor?: string;
  IsShow?: boolean;
}

interface OverlimitTag {
  id: string;
  name: string;
  icon: string;
  tone: string;
}

interface OverlimitCard {
  id: string;
  name: string;
  description: string;
  icon: string;
  quality: number;
  slot: 1 | 2 | 3 | 4;
  tags: OverlimitTag[];
}

const SET_ICON_FALLBACKS: Record<string, string> = {
  "1008": "UI/UI_Textures/Icons/Rogue/T_Icons_Rogue_Frenzy.png",
};

function loadRows<T>(relativePath: string): Record<string, T> {
  const filePath = path.join(REFS_DIR, relativePath);
  const exports = JSON.parse(fs.readFileSync(filePath, "utf8")) as Array<{
    Rows?: Record<string, T>;
  }>;
  const rows = exports.find((entry) => entry.Rows)?.Rows;
  if (!rows) {
    throw new Error(`Rows not found: ${relativePath}`);
  }
  return rows;
}

function textValue(value?: LocalizedText): string {
  return cleanText(
    value?.LocalizedString ??
      value?.SourceString ??
      value?.CultureInvariantString ??
      "",
  );
}

function cleanText(value: string): string {
  return value
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sourcePathFromAsset(assetPath?: string): string | null {
  if (!assetPath || assetPath === "None") return null;
  const relativePath = assetPath.split(".")[0].replace(/^\/Game\//, "");
  return path.join(REFS_DIR, `${relativePath}.png`);
}

function copyAsset(
  sourcePath: string,
  outputDir: string,
  publicDir: string,
): string {
  const fileName = path.basename(sourcePath);
  const outputPath = path.join(outputDir, fileName);
  fs.copyFileSync(sourcePath, outputPath);
  return `${publicDir}/${fileName}`;
}

async function optimizeAsset(publicUrl: string): Promise<void> {
  const relativePath = publicUrl.replace(/^\//, "");
  const sourcePath = path.join(ROOT_DIR, "public", relativePath);
  const outputPath = path.join(
    ROOT_DIR,
    "public/webp",
    relativePath.replace(/\.png$/i, ".webp"),
  );

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  await sharp(sourcePath)
    .webp({ quality: 85, alphaQuality: 100 })
    .toFile(outputPath);
}

function parseSetIds(value?: string): string[] {
  return String(value ?? "")
    .split(";")
    .map((id) => id.trim())
    .filter(Boolean);
}

function assertValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  const cardRows = loadRows<CardRow>(REF_FILES.cards);
  const modRows = loadRows<ModRow>(REF_FILES.mods);
  const itemRows = loadRows<ItemRow>(REF_FILES.items);
  const setRows = loadRows<SetRow>(REF_FILES.sets);

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.mkdirSync(CARD_ICON_DIR, { recursive: true });
  fs.mkdirSync(SET_ICON_DIR, { recursive: true });

  const tagById = new Map<string, OverlimitTag>();
  const missingSetIcons: string[] = [];

  for (const [id, set] of Object.entries(setRows)) {
    if (set.IsShow === false) continue;

    const name = textValue(set.SetName);
    assertValue(name, `Missing set name: ${id}`);

    const preferredSource = sourcePathFromAsset(set.SetSimpleIcon?.AssetPathName);
    const fullSizeSource = sourcePathFromAsset(set.SetIcon?.AssetPathName);
    const fallbackSource = SET_ICON_FALLBACKS[id]
      ? path.join(REFS_DIR, SET_ICON_FALLBACKS[id])
      : null;
    const sourcePath = [preferredSource, fullSizeSource, fallbackSource].find(
      (candidate): candidate is string => Boolean(candidate && fs.existsSync(candidate)),
    );

    let icon = "";
    if (sourcePath) {
      icon = copyAsset(sourcePath, SET_ICON_DIR, "/icons/overlimit/sets");
    } else {
      missingSetIcons.push(`${id} ${name}`);
    }

    tagById.set(id, {
      id,
      name,
      icon,
      tone: set.SetColor ?? "",
    });
  }

  const cards: OverlimitCard[] = [];
  const copiedCardIcons = new Set<string>();
  const qualityCounts = new Map<number, number>();

  for (const [id, card] of Object.entries(cardRows)) {
    if (card.IsShow === false) continue;

    const mod = modRows[id];
    const item = itemRows[id];
    assertValue(mod, `Missing WeaponModItemData row: ${id}`);
    assertValue(item, `Missing CommonItemDataTable row: ${id}`);

    const name = textValue(item.Name) || textValue(mod.MODName);
    const description = textValue(card.OverrideDesc);
    const quality = card.OverrideQuality || item.Quality || 0;
    const slotValues = mod.MODSlotIndex?.Values ?? [];
    assertValue(name, `Missing card name: ${id}`);
    assertValue(description, `Missing card description: ${id}`);
    assertValue(quality, `Missing card quality: ${id}`);
    assertValue(slotValues.length === 1, `Expected one slot for card ${id}`);
    const slot = slotValues[0];
    assertValue(
      slot === 1 || slot === 2 || slot === 3 || slot === 4,
      `Invalid slot ${slot} for card ${id}`,
    );

    const sourceIcon = sourcePathFromAsset(card.IconPath?.AssetPathName);
    assertValue(sourceIcon, `Missing card icon reference: ${id}`);
    assertValue(fs.existsSync(sourceIcon), `Missing card icon file: ${id} ${sourceIcon}`);
    const icon = copyAsset(
      sourceIcon,
      CARD_ICON_DIR,
      "/icons/overlimit/cards",
    );
    copiedCardIcons.add(icon);

    const setIds = parseSetIds(mod.ModSets);
    assertValue(setIds.length === 2, `Expected two sets for card ${id}`);
    const tags = setIds.map((setId) => {
      const tag = tagById.get(setId);
      assertValue(tag, `Unknown set ${setId} on card ${id}`);
      return tag;
    });

    cards.push({ id, name, description, icon, quality, slot, tags });
    qualityCounts.set(quality, (qualityCounts.get(quality) ?? 0) + 1);
  }

  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(cards, null, 2)}\n`, "utf8");

  const copiedAssets = new Set([
    ...copiedCardIcons,
    ...[...tagById.values()].map((tag) => tag.icon).filter(Boolean),
  ]);
  await Promise.all([...copiedAssets].map(optimizeAsset));

  const qualitySummary = [...qualityCounts.entries()]
    .sort(([a], [b]) => a - b)
    .map(([quality, count]) => `${quality}=${count}`)
    .join(", ");
  console.log(`Imported ${cards.length} overlimit cards.`);
  console.log(`Card icons: ${copiedCardIcons.size} unique files.`);
  console.log(`WebP assets: ${copiedAssets.size} files.`);
  console.log(`Tags: ${tagById.size}; every card has exactly two.`);
  console.log(`Quality distribution: ${qualitySummary}.`);
  console.log(`Output: ${path.relative(ROOT_DIR, OUTPUT_FILE)}`);
  if (missingSetIcons.length > 0) {
    console.warn(
      `Set icon assets not exported (${missingSetIcons.length}): ${missingSetIcons.join(", ")}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
