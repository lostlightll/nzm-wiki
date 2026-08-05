import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import weaponDataLockJson from "@/data/weapon-data-lock.json";
import { RARITY_ORDER } from "@/constants/common";
import { WEAPON_TYPES } from "@/constants/weapons";
import { getResolvedFieldValue } from "./weapon-consumers";
import { parseWeaponDataLock } from "./weapon-data-lock";
import { resolveWeapon, type ResolvedWeapon } from "./weapon-resolver";
import type { NumericalTable } from "./weapon-source-v2";

const WEAPON_DIRECTORIES: Record<NumericalTable, string> = {
  lc: path.join(process.cwd(), "data/weapons"),
  td: path.join(process.cwd(), "data/weapons_td"),
};
const isDev = process.env.NODE_ENV === "development";
const weaponDataLock = parseWeaponDataLock(weaponDataLockJson);
const weaponTypeOrder = new Map(
  WEAPON_TYPES.map((item, index) => [item.type, index]),
);

export interface ResolvedWeaponDocument {
  weapon: ResolvedWeapon;
  content: string;
  page: {
    toc: boolean;
    pageWidth?: string;
  };
}

function resolveWeaponFile(
  filePath: string,
  slug: string,
  table: NumericalTable,
): ResolvedWeaponDocument {
  const parsed = matter(fs.readFileSync(filePath, "utf8"));
  const weapon = resolveWeapon(parsed.data, {
    slug,
    expectedTable: table,
    lock: weaponDataLock,
  });
  const pageWidth = parsed.data["page-width"];
  return {
    weapon,
    content: parsed.content,
    page: {
      toc: parsed.data.toc !== false,
      pageWidth:
        typeof pageWidth === "string" && pageWidth.trim()
          ? pageWidth.trim()
          : undefined,
    },
  };
}

function weaponSorter(left: ResolvedWeapon, right: ResolvedWeapon): number {
  const leftRarity = getResolvedFieldValue(left.rarity);
  const rightRarity = getResolvedFieldValue(right.rarity);
  const rarityLeft = leftRarity ? RARITY_ORDER[leftRarity] : 0;
  const rarityRight = rightRarity ? RARITY_ORDER[rightRarity] : 0;
  if (rarityLeft !== rarityRight) return rarityRight - rarityLeft;

  const leftType = getResolvedFieldValue(left.weaponType);
  const rightType = getResolvedFieldValue(right.weaponType);
  const typeLeft = leftType ? (weaponTypeOrder.get(leftType) ?? 99) : 99;
  const typeRight = rightType ? (weaponTypeOrder.get(rightType) ?? 99) : 99;
  if (typeLeft !== typeRight) return typeLeft - typeRight;
  return left.title.localeCompare(right.title, "zh-CN");
}

function readResolvedWeapons(table: NumericalTable): ResolvedWeapon[] {
  const directory = WEAPON_DIRECTORIES[table];
  if (!fs.existsSync(directory)) {
    console.warn(`Weapons directory not found: ${directory}`);
    return [];
  }

  return fs
    .readdirSync(directory)
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => {
      const slug = file.replace(/\.mdx$/, "");
      return resolveWeaponFile(path.join(directory, file), slug, table).weapon;
    })
    .filter((weapon) => !weapon.draft || isDev)
    .sort(weaponSorter);
}

export async function getAllResolvedWeapons(
  table: NumericalTable,
): Promise<ResolvedWeapon[]> {
  return readResolvedWeapons(table);
}

export async function getResolvedWeaponBySlug(
  slug: string,
  table: NumericalTable,
): Promise<ResolvedWeapon | null> {
  return (await getResolvedWeaponDocument(slug, table))?.weapon ?? null;
}

export async function getResolvedWeaponDocument(
  slug: string,
  table: NumericalTable,
): Promise<ResolvedWeaponDocument | null> {
  const decodedSlug = decodeURIComponent(slug);
  const filePath = path.join(WEAPON_DIRECTORIES[table], `${decodedSlug}.mdx`);
  if (!fs.existsSync(filePath)) return null;
  const document = resolveWeaponFile(filePath, decodedSlug, table);
  if (document.weapon.draft && !isDev) return null;
  return document;
}

export async function getResolvedWeaponSlugs(
  table: NumericalTable,
): Promise<string[]> {
  return (await getAllResolvedWeapons(table)).map((weapon) => weapon.slug);
}
