import fs from "fs";
import path from "path";
import type { Weapon } from "@/types";

const WEAPONS_DATA_DIR = path.join(process.cwd(), "data/s0/weapons");

export function getAllWeapons(): Weapon[] {
  const weapons: Weapon[] = [];

  if (!fs.existsSync(WEAPONS_DATA_DIR)) return weapons;

  const files = fs.readdirSync(WEAPONS_DATA_DIR).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    const filePath = path.join(WEAPONS_DATA_DIR, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const weapon = JSON.parse(content) as Weapon;
    weapons.push(weapon);
  }

  return weapons;
}

export function getWeaponsByType(type: string): Weapon[] {
  return getAllWeapons().filter((w) => w.type === type);
}

export function getWeaponById(id: string): Weapon | null {
  if (!fs.existsSync(WEAPONS_DATA_DIR)) return null;

  const files = fs.readdirSync(WEAPONS_DATA_DIR).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    const filePath = path.join(WEAPONS_DATA_DIR, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const weapon = JSON.parse(content) as Weapon;
    if (weapon.id === id) return weapon;
  }

  return null;
}
