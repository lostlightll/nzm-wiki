import fs from "fs";
import path from "path";
import matter from "gray-matter";
import type { TDEnemy } from "@/types";
import { CURRENT_SEASON } from "@/constants/season";

const TD_ENEMIES_DIR = path.join(
  process.cwd(),
  `data/${CURRENT_SEASON}/enemies/td`
);

/**
 * 从 MDX frontmatter 获取所有塔防敌人数据
 */
export async function getAllTDEnemies(): Promise<TDEnemy[]> {
  if (!fs.existsSync(TD_ENEMIES_DIR)) {
    console.warn(`TD Enemies directory not found: ${TD_ENEMIES_DIR}`);
    return [];
  }

  const files = fs.readdirSync(TD_ENEMIES_DIR).filter((f) => f.endsWith(".mdx"));

  return files.map((file) => {
    const filePath = path.join(TD_ENEMIES_DIR, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const { data } = matter(content);
    const slug = file.replace(/\.mdx$/, "");

    return {
      slug,
      ...data,
    } as TDEnemy;
  });
}

/**
 * 根据 slug 获取单个塔防敌人数据
 */
export async function getTDEnemyBySlug(slug: string): Promise<TDEnemy | null> {
  const decodedSlug = decodeURIComponent(slug);
  const filePath = path.join(TD_ENEMIES_DIR, `${decodedSlug}.mdx`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const { data } = matter(content);

  return {
    slug: decodedSlug,
    ...data,
  } as TDEnemy;
}
