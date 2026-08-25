/**
 * 从 refs 导入肉鸽猎场的超限卡片图鉴数据和图标。
 *
 * 用法：pnpm exec tsx scripts/import-overlimit-cards.ts
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { WEAPON_TYPE_ID_MAP } from "@/constants/weapons";

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
  weaponItems: "DataTables/WeaponItemTable.json",
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

interface ValueList {
  Values?: number[];
}

interface CardRow {
  ModId: number;
  IconPath?: AssetReference;
  OverrideDesc?: LocalizedText;
  OverrideQuality?: number;
  Weight?: number;
  SuitableWeaponTypeList?: ValueList;
  SuitableWeaponItemIdList?: ValueList;
  IsShow?: boolean;
}

interface ModRow {
  MODItemID: number;
  MODName?: LocalizedText;
  MODSlotIndex?: ValueList;
  ModSets?: string;
}

interface ItemRow {
  Name?: LocalizedText;
  Quality?: number;
}

interface WeaponItemRow {
  WeaponName?: string;
  ModelID?: string | number;
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
  weight: number;
  slot: 1 | 2 | 3 | 4;
  weaponType: number[];
  weaponItems: number[];
  weaponNames: string[];
  tags: OverlimitTag[];
}

const SET_ICON_FALLBACKS: Record<string, string> = {
  "1008": "UI/UI_Textures/Icons/Rogue/T_Icons_Rogue_Frenzy.png",
};

// Source data assigns these two cards to weapon 20101000024 instead of 20103000024.
const WEAPON_ITEM_OVERRIDES: Record<string, number[]> = {
  "20703040344": [20103000024],
  "20703040346": [20103000024],
};

// Card text can lag behind reviewed Numerical or execution-config values.
const REVIEWED_DESCRIPTION_OVERRIDES: Record<string, string> = {
  "20703040437": "武器命中有 5% 概率产生爆炸伤害（CD2秒）",
  "20703040474": "暴击时，向身前投射一个毒液罐，爆炸留下毒属性伤害区域并且减速敌人（CD5秒）。",
  "20703040072": "距离13米内，每接近1米武器伤害提高5%，距离6米内达到最高35%。",
  "20703040085": "持续开火每射出一发子弹，武器伤害增加0.4%，最多叠加80层。",
  "20703040407": "爆炸伤害增加120%，造成多次伤害后可获得急速狂热（CD13秒）。",
  "20703040435": "保持不释放武器技能，每5秒增加30%伤害，最多10层，释放技能清零。",
  "20703040459": "武器技能充能效率+10%",
  "20703040464": "爆炸伤害+30%",
  "20704040478": "全部爆炸弹的直击伤害提升300%，爆炸范围缩减50%。",
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
  const weaponItemRows = loadRows<WeaponItemRow>(REF_FILES.weaponItems);
  const setRows = loadRows<SetRow>(REF_FILES.sets);

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.mkdirSync(CARD_ICON_DIR, { recursive: true });
  fs.mkdirSync(SET_ICON_DIR, { recursive: true });

  const tagById = new Map<string, OverlimitTag>();
  const missingSetIcons: string[] = [];
  const weaponNamesById = new Map<number, Set<string>>();

  const addWeaponName = (id: number, name: string) => {
    if (!Number.isFinite(id) || !name) return;
    const names = weaponNamesById.get(id) ?? new Set<string>();
    names.add(name);
    weaponNamesById.set(id, names);
  };

  for (const [id, weapon] of Object.entries(weaponItemRows)) {
    const name = cleanText(weapon.WeaponName ?? "");
    addWeaponName(Number(id), name);
    addWeaponName(Number(weapon.ModelID), name);
  }

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
  const applicabilityCounts = {
    universal: 0,
    typed: 0,
    exclusive: 0,
  };

  for (const [id, card] of Object.entries(cardRows)) {
    if (card.IsShow === false) continue;

    const mod = modRows[id];
    const item = itemRows[id];
    assertValue(mod, `Missing WeaponModItemData row: ${id}`);
    assertValue(item, `Missing CommonItemDataTable row: ${id}`);

    const name = textValue(item.Name) || textValue(mod.MODName);
    const description =
      REVIEWED_DESCRIPTION_OVERRIDES[id] ?? textValue(card.OverrideDesc);
    const quality = card.OverrideQuality || item.Quality || 0;
    const weight = card.Weight ?? 0;
    const slotValues = mod.MODSlotIndex?.Values ?? [];
    const weaponType = card.SuitableWeaponTypeList?.Values ?? [];
    const weaponItems =
      WEAPON_ITEM_OVERRIDES[id] ?? card.SuitableWeaponItemIdList?.Values ?? [];
    const weaponNames = Array.from(
      new Set(
        weaponItems.map((weaponItemId) => {
          const names = weaponNamesById.get(weaponItemId);
          assertValue(
            names?.size === 1,
            names
              ? `Ambiguous weapon item ${weaponItemId} for card ${id}: ${[...names].join(", ")}`
              : `Unknown weapon item ${weaponItemId} for card ${id}`,
          );
          return [...names][0];
        }),
      ),
    );
    assertValue(name, `Missing card name: ${id}`);
    assertValue(description, `Missing card description: ${id}`);
    assertValue(quality, `Missing card quality: ${id}`);
    assertValue(weight > 0, `Missing card weight: ${id}`);
    assertValue(slotValues.length === 1, `Expected one slot for card ${id}`);
    const slot = slotValues[0];
    assertValue(
      slot === 1 || slot === 2 || slot === 3 || slot === 4,
      `Invalid slot ${slot} for card ${id}`,
    );
    assertValue(
      weaponType.length === 0 || weaponItems.length === 0,
      `Card ${id} cannot be both weapon-type limited and weapon exclusive`,
    );
    for (const weaponTypeId of weaponType) {
      assertValue(
        WEAPON_TYPE_ID_MAP[weaponTypeId],
        `Unknown weapon type ${weaponTypeId} for card ${id}`,
      );
    }

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

    cards.push({
      id,
      name,
      description,
      icon,
      quality,
      weight,
      slot,
      weaponType,
      weaponItems,
      weaponNames,
      tags,
    });
    qualityCounts.set(quality, (qualityCounts.get(quality) ?? 0) + 1);
    if (weaponItems.length > 0) applicabilityCounts.exclusive += 1;
    else if (weaponType.length > 0) applicabilityCounts.typed += 1;
    else applicabilityCounts.universal += 1;
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
  console.log(
    `Applicability distribution: universal=${applicabilityCounts.universal}, ` +
      `typed=${applicabilityCounts.typed}, exclusive=${applicabilityCounts.exclusive}.`,
  );
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
