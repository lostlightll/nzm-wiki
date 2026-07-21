import fs from "fs";
import path from "path";
import matter from "gray-matter";
import bossOrderData from "@/data/enemies/lc/boss/order.json";
import { LC_MAPS } from "@/lib/lc-maps";
import type { Boss, Enemy } from "@/types";

const BOSSES_DIR = path.join(process.cwd(), "data/enemies/lc/boss");
const BOSS_ORDER_BY_MAP: Readonly<Record<string, readonly string[]>> =
  bossOrderData;
const BOSS_SLUG_COLLATOR = new Intl.Collator("zh-CN");

function createBossOrderIndex(): ReadonlyMap<string, number> {
  const configuredMaps = new Map<string, string>();

  for (const [mapName, slugs] of Object.entries(BOSS_ORDER_BY_MAP)) {
    for (const slug of slugs) {
      const previousMap = configuredMaps.get(slug);
      if (previousMap) {
        throw new Error(
          `Duplicate boss slug in order config: ${slug} (${previousMap}, ${mapName})`,
        );
      }
      configuredMaps.set(slug, mapName);
    }
  }

  const index = new Map<string, number>();
  for (const map of LC_MAPS) {
    for (const slug of BOSS_ORDER_BY_MAP[map.name] ?? []) {
      index.set(slug, index.size);
    }
  }

  return index;
}

const BOSS_ORDER_INDEX = createBossOrderIndex();
let hasValidatedBossOrder = false;

function getBossMaps(boss: Boss): string[] {
  return Array.isArray(boss.map) ? boss.map : [boss.map];
}

function validateBossOrder(bosses: Boss[]): void {
  if (hasValidatedBossOrder) return;
  hasValidatedBossOrder = true;

  const bossBySlug = new Map(bosses.map((boss) => [boss.slug, boss]));
  const knownMaps = new Set(LC_MAPS.map((map) => map.name));

  for (const [mapName, slugs] of Object.entries(BOSS_ORDER_BY_MAP)) {
    if (!knownMaps.has(mapName)) {
      console.warn(`Unknown map in boss order config: ${mapName}`);
    }

    for (const slug of slugs) {
      const boss = bossBySlug.get(slug);
      if (!boss) {
        console.warn(`Unknown boss slug in order config: ${slug} (${mapName})`);
        continue;
      }
      if (!getBossMaps(boss).includes(mapName)) {
        console.warn(
          `Boss order map mismatch: ${slug} is not assigned to ${mapName}`,
        );
      }
    }
  }

  const unorderedBosses = bosses
    .filter((boss) => !BOSS_ORDER_INDEX.has(boss.slug))
    .map((boss) => boss.slug)
    .sort(BOSS_SLUG_COLLATOR.compare);
  if (unorderedBosses.length > 0) {
    console.warn(
      `Bosses missing from order config will be appended: ${unorderedBosses.join(", ")}`,
    );
  }
}

function compareBossOrder(a: Boss, b: Boss): number {
  const orderA = BOSS_ORDER_INDEX.get(a.slug);
  const orderB = BOSS_ORDER_INDEX.get(b.slug);

  if (orderA === undefined && orderB === undefined) {
    return BOSS_SLUG_COLLATOR.compare(a.slug, b.slug);
  }
  if (orderA === undefined) return 1;
  if (orderB === undefined) return -1;
  return orderA - orderB;
}

/**
 * 从 MDX frontmatter 获取所有猎场首领数据
 */
export async function getAllBosses(): Promise<Boss[]> {
  if (!fs.existsSync(BOSSES_DIR)) {
    console.warn(`Bosses directory not found: ${BOSSES_DIR}`);
    return [];
  }

  const files = fs.readdirSync(BOSSES_DIR).filter((f) => f.endsWith(".mdx"));

  const bosses = files.map((file) => {
    const filePath = path.join(BOSSES_DIR, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const { data } = matter(content);
    const slug = file.replace(/\.mdx$/, "");

    return {
      slug,
      ...data,
    } as Boss;
  });

  validateBossOrder(bosses);
  return bosses.sort(compareBossOrder);
}

/**
 * 根据 slug 获取单个猎场首领数据
 */
export async function getBossBySlug(slug: string): Promise<Boss | null> {
  const decodedSlug = decodeURIComponent(slug);
  const filePath = path.join(BOSSES_DIR, `${decodedSlug}.mdx`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const { data } = matter(content);

  return {
    slug: decodedSlug,
    ...data,
  } as Boss;
}

export function bossToEnemy(boss: Boss): Enemy {
  return {
    ...boss,
    type: "boss",
    iconPrefix: "lc/boss",
    linkPrefix: "/bosses",
  };
}
