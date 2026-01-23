import fs from "fs";
import path from "path";
import type { Perk, PerkSlot, Rarity } from "@/types";

const PERKS_DATA_DIR = path.join(process.cwd(), "data/s0/perks");

export function getAllPerks(): Perk[] {
  if (!fs.existsSync(PERKS_DATA_DIR)) return [];

  const perks: Perk[] = [];

  // 遍历 slot-1 到 slot-4 子目录
  for (let slot = 1; slot <= 4; slot++) {
    const slotDir = path.join(PERKS_DATA_DIR, `slot-${slot}`);
    if (!fs.existsSync(slotDir)) continue;

    const files = fs.readdirSync(slotDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const filePath = path.join(slotDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const perk = JSON.parse(content) as Perk;
      perks.push(perk);
    }
  }

  return perks;
}

export function getPerkById(id: string): Perk | null {
  // 在所有槽位目录中查找
  for (let slot = 1; slot <= 4; slot++) {
    const filePath = path.join(PERKS_DATA_DIR, `slot-${slot}`, `${id}.json`);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(content) as Perk;
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
