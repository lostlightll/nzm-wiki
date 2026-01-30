import fs from "fs";
import path from "path";
import matter from "gray-matter";
import type { Weapon } from "@/types";
import { CURRENT_SEASON } from "@/constants/season";

const WEAPONS_DIR = path.join(process.cwd(), `data/${CURRENT_SEASON}/weapons`);

/**
 * 从 MDX frontmatter 获取所有武器数据
 */
export async function getAllWeapons(): Promise<Weapon[]> {
  if (!fs.existsSync(WEAPONS_DIR)) {
    console.warn(`Weapons directory not found: ${WEAPONS_DIR}`);
    return [];
  }

  const files = fs.readdirSync(WEAPONS_DIR).filter((f) => f.endsWith(".mdx"));

  return files.map((file) => {
    const filePath = path.join(WEAPONS_DIR, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const { data } = matter(content);
    const slug = file.replace(/\.mdx$/, "");

    return {
      slug,
      ...data,
    } as Weapon;
  });
}

/**
 * 根据 slug 获取单个武器数据
 */
export async function getWeaponBySlug(slug: string): Promise<Weapon | null> {
  const decodedSlug = decodeURIComponent(slug);
  const filePath = path.join(WEAPONS_DIR, `${decodedSlug}.mdx`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const { data } = matter(content);

  return {
    slug: decodedSlug,
    ...data,
  } as Weapon;
}
