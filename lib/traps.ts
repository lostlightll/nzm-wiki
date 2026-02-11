import fs from "fs";
import path from "path";
import matter from "gray-matter";
import type { Trap } from "@/types";
const TRAPS_DIR = path.join(process.cwd(), "data/traps");

/**
 * 从 MDX frontmatter 获取所有陷阱数据
 */
export async function getAllTraps(): Promise<Trap[]> {
  if (!fs.existsSync(TRAPS_DIR)) {
    console.warn(`Traps directory not found: ${TRAPS_DIR}`);
    return [];
  }

  const files = fs.readdirSync(TRAPS_DIR).filter((f) => f.endsWith(".mdx"));

  return files.map((file) => {
    const filePath = path.join(TRAPS_DIR, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const { data } = matter(content);
    const slug = file.replace(/\.mdx$/, "");

    return {
      slug,
      ...data,
    } as Trap;
  });
}

/**
 * 根据 slug 获取单个陷阱数据
 */
export async function getTrapBySlug(slug: string): Promise<Trap | null> {
  const decodedSlug = decodeURIComponent(slug);
  const filePath = path.join(TRAPS_DIR, `${decodedSlug}.mdx`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const { data } = matter(content);

  return {
    slug: decodedSlug,
    ...data,
  } as Trap;
}
