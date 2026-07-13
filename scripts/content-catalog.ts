import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export interface ContentDocument {
  fileName: string;
  filePath: string;
  metadata: Record<string, unknown>;
  lastModified?: string;
  slug: string;
}

export function readContentCatalog(
  baseDir = path.join(process.cwd(), "data"),
): ContentDocument[] {
  const documents: ContentDocument[] = [];

  function scanDirectory(dirPath: string, relativePath = ""): void {
    if (!fs.existsSync(dirPath)) return;

    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        const nextRelativePath = entry.name.startsWith("(")
          ? relativePath
          : relativePath
            ? `${relativePath}/${entry.name}`
            : entry.name;
        scanDirectory(fullPath, nextRelativePath);
        continue;
      }

      if (!entry.name.endsWith(".mdx")) continue;

      const fileName = entry.name.replace(/\.mdx$/, "");
      const slug = relativePath ? `${relativePath}/${fileName}` : fileName;
      const source = fs.readFileSync(fullPath, "utf-8");
      const parsed = matter(source);
      const lastModified = normalizeDate(parsed.data.updated ?? parsed.data.date);

      documents.push({
        fileName,
        filePath: fullPath,
        metadata: parsed.data as Record<string, unknown>,
        lastModified,
        slug,
      });
    }
  }

  scanDirectory(baseDir);
  return documents;
}

function normalizeDate(value: unknown): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().split("T")[0];
  }
  if (typeof value !== "string" || value.trim() === "") return undefined;

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp)
    ? undefined
    : new Date(timestamp).toISOString().split("T")[0];
}
