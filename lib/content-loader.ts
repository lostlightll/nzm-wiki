import fs from "node:fs";
import matter from "gray-matter";

interface ParsedMDXFile {
  content: string;
  metadata: ReturnType<typeof matter>["data"];
}

interface CacheEntry extends ParsedMDXFile {
  mtimeMs: number;
}

const fileCache = new Map<string, CacheEntry>();
const isDev = process.env.NODE_ENV === "development";

export function readMDXFile(filePath: string): ParsedMDXFile {
  const cached = fileCache.get(filePath);
  if (cached && !isDev) return cached;

  const mtimeMs = fs.statSync(filePath).mtimeMs;
  if (cached?.mtimeMs === mtimeMs) return cached;

  const source = fs.readFileSync(filePath, "utf-8");
  const { content, data } = matter(source);
  const parsed: CacheEntry = {
    content,
    metadata: data,
    mtimeMs,
  };
  fileCache.set(filePath, parsed);
  return parsed;
}
