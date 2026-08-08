import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import weaponDataLockJson from "@/data/weapon-data-lock.json";
import { RARITY_ORDER } from "@/constants/common";
import { WEAPON_TYPES } from "@/constants/weapons";
import { getResolvedFieldValue } from "./weapon-consumers";
import { createWeaponResolver, type ResolvedWeapon } from "./weapon-resolver";
import type { NumericalTable } from "./weapon-source-v2";

const WEAPON_DIRECTORY = path.join(process.cwd(), "data/weapons");
const isDev = process.env.NODE_ENV === "development";
const weaponResolver = createWeaponResolver(weaponDataLockJson);
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
  const weapon = weaponResolver.resolveWeapon(parsed.data, {
    slug,
    expectedTable: table,
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
  const directory = WEAPON_DIRECTORY;
  if (!fs.existsSync(directory)) {
    console.warn(`Weapons directory not found: ${directory}`);
    return [];
  }

  return fs
    .readdirSync(directory)
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => {
      const slug = file.replace(/\.mdx$/, "");
      const filePath = path.join(directory, file);
      const parsed = matter(fs.readFileSync(filePath, "utf8"));
      if (
        !Array.isArray(parsed.data.game_modes) ||
        !parsed.data.game_modes.includes(table)
      ) {
        return null;
      }
      return resolveWeaponFile(filePath, slug, table).weapon;
    })
    .filter((weapon): weapon is ResolvedWeapon => weapon !== null)
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
  const filePath = path.join(WEAPON_DIRECTORY, `${decodedSlug}.mdx`);
  if (!fs.existsSync(filePath)) return null;
  const parsed = matter(fs.readFileSync(filePath, "utf8"));
  if (
    !Array.isArray(parsed.data.game_modes) ||
    !parsed.data.game_modes.includes(table)
  ) {
    return null;
  }
  const document = resolveWeaponFile(filePath, decodedSlug, table);
  if (document.weapon.draft && !isDev) return null;
  return document;
}

export async function getResolvedWeaponSlugs(
  table: NumericalTable,
): Promise<string[]> {
  return scanWeaponSlugs(WEAPON_DIRECTORY, table, isDev);
}

function ordinalCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function scanWeaponSlugs(
  directory: string,
  table: NumericalTable,
  includeDrafts: boolean,
): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory)
    .filter((file) => file.endsWith(".mdx"))
    .sort(ordinalCompare)
    .filter((file) => {
      const parsed = matter(fs.readFileSync(path.join(directory, file), "utf8"));
      return (
        (includeDrafts || parsed.data.draft !== true) &&
        Array.isArray(parsed.data.game_modes) &&
        parsed.data.game_modes.includes(table)
      );
    })
    .map((file) => file.replace(/\.mdx$/, ""));
}
