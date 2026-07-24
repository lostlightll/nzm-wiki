import fs from "fs";
import path from "path";
import matter from "gray-matter";
import type { Perk, PerkSlot, Rarity } from "@/types";
import { isValidDateKey } from "@/lib/date-key";

const PERKS_DATA_DIR = path.join(process.cwd(), "data/perks");

function parseNumberArray(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined;

  return value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
}

function parseStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseReleaseDate(
  value: unknown,
  filePath: string,
): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (!isValidDateKey(value)) {
    throw new Error(
      `插件 release_date 必须是有效的 YYYY-MM-DD 日期: ${filePath}`,
    );
  }
  return value;
}

export function getAllPerks(): Perk[] {
  if (!fs.existsSync(PERKS_DATA_DIR)) return [];

  const perks: Perk[] = [];

  // 遍历 slot-1 到 slot-4 子目录
  for (let slot = 1; slot <= 4; slot++) {
    const slotDir = path.join(PERKS_DATA_DIR, `slot-${slot}`);
    if (!fs.existsSync(slotDir)) continue;

    const files = fs.readdirSync(slotDir).filter((f) => f.endsWith(".mdx"));
    for (const file of files) {
      const filePath = path.join(slotDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const { data } = matter(content);
      const perk: Perk = {
        id: file.replace(".mdx", ""),
        slug: `slot-${slot}/${file.replace(".mdx", "")}`,
        name: data.title,
        slot: data.slot as PerkSlot,
        rarity: data.rarity as Rarity,
        category: data.category || "其他",
        icon: data.icon,
        effects: [],
        description: data.description,
        weaponType: parseNumberArray(data.weaponType),
        weaponNames: parseStringArray(data.weaponNames),
        collectModItem: data.CollectMODItem as 0 | 1 | undefined,
        makeModItem: data.MakeMODItem as 0 | 1 | undefined,
        isCooked: data.IsCooked as boolean | undefined,
        releaseDate: parseReleaseDate(data.release_date, filePath),
      };
      perks.push(perk);
    }
  }

  return perks;
}

export function getPerkByName(name: string): Perk | null {
  // 在所有槽位目录中查找
  for (let slot = 1; slot <= 4; slot++) {
    const slotDir = path.join(PERKS_DATA_DIR, `slot-${slot}`);
    if (!fs.existsSync(slotDir)) continue;

    const filePath = path.join(slotDir, `${name}.mdx`);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      const { data } = matter(content);
      return {
        id: name,
        slug: `slot-${slot}/${name}`,
        name: data.title,
        slot: data.slot as PerkSlot,
        rarity: data.rarity as Rarity,
        category: data.category || "其他",
        icon: data.icon,
        effects: [],
        description: data.description,
        weaponType: parseNumberArray(data.weaponType),
        weaponNames: parseStringArray(data.weaponNames),
        collectModItem: data.CollectMODItem as 0 | 1 | undefined,
        makeModItem: data.MakeMODItem as 0 | 1 | undefined,
        isCooked: data.IsCooked as boolean | undefined,
        releaseDate: parseReleaseDate(data.release_date, filePath),
      };
    }
  }
  return null;
}

export function getPerksByCategory(category: string): Perk[] {
  return getAllPerks().filter((perk) => perk.category === category);
}

export function getPerksBySlot(slot: PerkSlot): Perk[] {
  return getAllPerks().filter((perk) => perk.slot === slot);
}

export function getPerksByRarity(rarity: Rarity): Perk[] {
  return getAllPerks().filter((perk) => perk.rarity === rarity);
}
