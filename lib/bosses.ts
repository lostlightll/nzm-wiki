import fs from "fs";
import path from "path";
import matter from "gray-matter";
import type { Boss } from "@/types";
import { CURRENT_SEASON } from "@/constants/season";

const BOSSES_DIR = path.join(process.cwd(), `data/${CURRENT_SEASON}/lc`);

/**
 * 从 MDX frontmatter 获取所有猎场首领数据
 */
export async function getAllBosses(): Promise<Boss[]> {
  if (!fs.existsSync(BOSSES_DIR)) {
    console.warn(`Bosses directory not found: ${BOSSES_DIR}`);
    return [];
  }

  const files = fs.readdirSync(BOSSES_DIR).filter((f) => f.endsWith(".mdx"));

  return files.map((file) => {
    const filePath = path.join(BOSSES_DIR, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const { data } = matter(content);
    const slug = file.replace(/\.mdx$/, "");

    return {
      slug,
      ...data,
    } as Boss;
  });
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
