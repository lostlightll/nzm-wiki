import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import weaponDataLockJson from "@/data/weapon-data-lock.json";
import { RARITY_ORDER } from "@/constants/common";
import { WEAPON_TYPES } from "@/constants/weapons";
import type { Weapon } from "@/types";
import { parseWeaponDataLock } from "./weapon-data-lock";
import { resolveWeapon, toLegacyWeapon } from "./weapon-resolver";

const WEAPONS_DIR = path.join(process.cwd(), "data/weapons");
const TD_WEAPONS_DIR = path.join(process.cwd(), "data/weapons_td");
const isDev = process.env.NODE_ENV === "development";
const weaponDataLock = parseWeaponDataLock(weaponDataLockJson);
const weaponTypeOrder = new Map(
  WEAPON_TYPES.map((item, index) => [item.type, index]),
);

function transformWeapon(
  raw: Record<string, unknown>,
  slug: string,
  table: "lc" | "td",
): Weapon {
  return toLegacyWeapon(
    resolveWeapon(raw, {
      slug,
      expectedTable: table,
      lock: weaponDataLock,
    }),
  );
}

function weaponSorter(left: Weapon, right: Weapon): number {
  const rarityLeft = left.rarity ? RARITY_ORDER[left.rarity] : 0;
  const rarityRight = right.rarity ? RARITY_ORDER[right.rarity] : 0;
  if (rarityLeft !== rarityRight) return rarityRight - rarityLeft;

  const typeLeft = left.weapon_type
    ? (weaponTypeOrder.get(left.weapon_type) ?? 99)
    : 99;
  const typeRight = right.weapon_type
    ? (weaponTypeOrder.get(right.weapon_type) ?? 99)
    : 99;
  if (typeLeft !== typeRight) return typeLeft - typeRight;
  return left.title.localeCompare(right.title, "zh-CN");
}

function readWeapons(directory: string, table: "lc" | "td"): Weapon[] {
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory)
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => {
      const content = fs.readFileSync(path.join(directory, file), "utf8");
      const { data } = matter(content);
      return transformWeapon(data, file.replace(/\.mdx$/, ""), table);
    })
    .filter((weapon) => !weapon.draft || isDev)
    .sort(weaponSorter);
}

export async function getAllWeapons(): Promise<Weapon[]> {
  if (!fs.existsSync(WEAPONS_DIR)) {
    console.warn(`Weapons directory not found: ${WEAPONS_DIR}`);
  }
  return readWeapons(WEAPONS_DIR, "lc");
}

export async function getAllTDWeapons(): Promise<Weapon[]> {
  return readWeapons(TD_WEAPONS_DIR, "td");
}

function readWeaponBySlug(
  directory: string,
  slug: string,
  table: "lc" | "td",
): Weapon | null {
  const decodedSlug = decodeURIComponent(slug);
  const filePath = path.join(directory, `${decodedSlug}.mdx`);
  if (!fs.existsSync(filePath)) return null;
  const { data } = matter(fs.readFileSync(filePath, "utf8"));
  return transformWeapon(data, decodedSlug, table);
}

export async function getWeaponBySlug(slug: string): Promise<Weapon | null> {
  return readWeaponBySlug(WEAPONS_DIR, slug, "lc");
}

export async function getTDWeaponBySlug(slug: string): Promise<Weapon | null> {
  return readWeaponBySlug(TD_WEAPONS_DIR, slug, "td");
}
