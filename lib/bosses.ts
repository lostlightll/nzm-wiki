import fs from "fs";
import path from "path";
import { readMDXFile } from "@/lib/content-loader";
import type { Boss, Enemy } from "@/types";
const BOSSES_DIR = path.join(process.cwd(), "data/enemies/lc/boss");
const isDev = process.env.NODE_ENV === "development";
let productionBosses: Boss[] | undefined;

/**
 * 从 MDX frontmatter 获取所有猎场首领数据
 */
export async function getAllBosses(): Promise<Boss[]> {
  if (productionBosses) return productionBosses;

  if (!fs.existsSync(BOSSES_DIR)) {
    console.warn(`Bosses directory not found: ${BOSSES_DIR}`);
    return [];
  }

  const files = fs.readdirSync(BOSSES_DIR).filter((f) => f.endsWith(".mdx"));

  const bosses = files.map((file) => {
    const filePath = path.join(BOSSES_DIR, file);
    const { metadata: data } = readMDXFile(filePath);
    const slug = file.replace(/\.mdx$/, "");

    return {
      slug,
      ...data,
    } as Boss;
  });

  if (!isDev) productionBosses = bosses;
  return bosses;
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

  const { metadata: data } = readMDXFile(filePath);

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
    linkPrefix: "/enemies/lc",
  };
}
