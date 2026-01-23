import fs from "fs";
import path from "path";
import type { Weapon } from "@/types";

const WEAPONS_DATA_DIR = path.join(process.cwd(), "data/weapons");

const WEAPON_CATEGORIES = [
  "ar",
  "sr",
  "shg",
  "smg",
  "rocket",
  "flamethrower",
  "grenade-single",
  "grenade-auto",
  "pistol",
  "lmg",
  "dmr",
];

export function getAllWeapons(): Weapon[] {
  const weapons: Weapon[] = [];

  for (const category of WEAPON_CATEGORIES) {
    const categoryPath = path.join(WEAPONS_DATA_DIR, category);
    if (!fs.existsSync(categoryPath)) continue;

    const files = fs.readdirSync(categoryPath).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const filePath = path.join(categoryPath, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const weapon = JSON.parse(content) as Weapon;
      weapons.push(weapon);
    }
  }

  return weapons;
}

export function getWeaponsByCategory(category: string): Weapon[] {
  const categoryPath = path.join(WEAPONS_DATA_DIR, category);
  if (!fs.existsSync(categoryPath)) return [];

  const weapons: Weapon[] = [];
  const files = fs.readdirSync(categoryPath).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    const filePath = path.join(categoryPath, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const weapon = JSON.parse(content) as Weapon;
    weapons.push(weapon);
  }

  return weapons;
}

export function getWeaponById(id: string): Weapon | null {
  for (const category of WEAPON_CATEGORIES) {
    const categoryPath = path.join(WEAPONS_DATA_DIR, category);
    if (!fs.existsSync(categoryPath)) continue;

    const files = fs.readdirSync(categoryPath).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const filePath = path.join(categoryPath, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const weapon = JSON.parse(content) as Weapon;
      if (weapon.id === id) return weapon;
    }
  }

  return null;
}
