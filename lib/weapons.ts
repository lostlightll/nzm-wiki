import fs from "fs";
import path from "path";
import type { Weapon } from "@/types";
import { CURRENT_SEASON } from "@/constants/season";

const WEAPONS_JSON_PATH = path.join(process.cwd(), `data/${CURRENT_SEASON}/weapons.json`);

/**
 * 从 JSON 文件获取所有武器数据（用于生产环境）
 */
export function getAllWeaponsFromJSON(): Weapon[] {
  if (!fs.existsSync(WEAPONS_JSON_PATH)) {
    console.warn(`Weapons JSON not found: ${WEAPONS_JSON_PATH}`);
    return [];
  }

  const content = fs.readFileSync(WEAPONS_JSON_PATH, "utf-8");
  return JSON.parse(content) as Weapon[];
}

/**
 * 获取所有武器数据
 */
export async function getAllWeapons(): Promise<Weapon[]> {
  return getAllWeaponsFromJSON();
}

export function getWeaponsByType(weapons: Weapon[], type: string): Weapon[] {
  return weapons.filter((w) => w.type === type);
}

export function getWeaponById(weapons: Weapon[], id: string): Weapon | null {
  return weapons.find((w) => w.id === id) ?? null;
}
