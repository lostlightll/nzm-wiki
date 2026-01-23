import fs from "fs";
import path from "path";
import type { Perk } from "@/types";

const PERKS_DATA_DIR = path.join(process.cwd(), "data/perks");

export function getAllPerks(): Perk[] {
  if (!fs.existsSync(PERKS_DATA_DIR)) return [];

  const perks: Perk[] = [];
  const files = fs.readdirSync(PERKS_DATA_DIR).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    const filePath = path.join(PERKS_DATA_DIR, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const perk = JSON.parse(content) as Perk;
    perks.push(perk);
  }

  return perks;
}

export function getPerkById(id: string): Perk | null {
  const filePath = path.join(PERKS_DATA_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;

  const content = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(content) as Perk;
}

export function getPerksByCategory(category: string): Perk[] {
  return getAllPerks().filter((perk) => perk.category === category);
}
