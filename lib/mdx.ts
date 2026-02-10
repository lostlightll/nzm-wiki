import fs from "fs";
import path from "path";
import matter from "gray-matter";

const baseDir = path.join(process.cwd(), "data");

/**
 * 递归获取某个分类下的所有文章（用于列表页）
 * 路由组目录（以括号开头）不会包含在 slug 中
 */
export function getMDXList(folder: string) {
  const dirPath = path.join(baseDir, folder);

  if (!fs.existsSync(dirPath)) {
    console.warn(`[MDX Warning] Directory not found: ${dirPath}`);
    return [];
  }

  const results: Array<{ slug: string; [key: string]: unknown }> = [];

  function scanDir(currentPath: string, slugPrefix: string = "") {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        // 路由组目录（以括号开头）不包含在 slug 中
        if (entry.name.startsWith("(")) {
          scanDir(fullPath, slugPrefix);
        } else {
          scanDir(fullPath, slugPrefix ? `${slugPrefix}/${entry.name}` : entry.name);
        }
      } else if (entry.name.endsWith(".mdx")) {
        const fileContent = fs.readFileSync(fullPath, "utf-8");
        const { data } = matter(fileContent);
        const fileName = entry.name.replace(/\.mdx$/, "");

        results.push({
          slug: slugPrefix ? `${slugPrefix}/${fileName}` : fileName,
          ...data,
        });
      }
    }
  }

  scanDir(dirPath);
  return results;
}

/**
 * 递归查找文件（支持路由组目录）
 */
function findMDXFile(dirPath: string, slug: string): string | null {
  if (!fs.existsSync(dirPath)) {
    return null;
  }

  // 直接路径匹配
  const directPath = path.join(dirPath, `${slug}.mdx`);
  if (fs.existsSync(directPath)) {
    return directPath;
  }

  // 在路由组目录中查找
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith("(")) {
      const found = findMDXFile(path.join(dirPath, entry.name), slug);
      if (found) return found;
    }
  }

  // 如果 slug 包含子路径，递归查找
  const slashIndex = slug.indexOf("/");
  if (slashIndex > 0) {
    const firstPart = slug.slice(0, slashIndex);
    const restPart = slug.slice(slashIndex + 1);
    const subDir = path.join(dirPath, firstPart);
    if (fs.existsSync(subDir) && fs.statSync(subDir).isDirectory()) {
      return findMDXFile(subDir, restPart);
    }
  }

  return null;
}

/**
 * 获取单篇文章详情（用于详情页）
 * @param folder 分类文件夹 (如 "s0/weapons")
 * @param slug 传入的路径参数 (可能是中文，也可能是 URL 编码后的字符串)
 */
export function getMDXDetail(folder: string, slug: string) {
  // 1. 核心修复：无论 Next.js 传进来的是什么，先统一解码为中文
  const decodedSlug = decodeURIComponent(slug);

  // 2. 查找文件路径（支持路由组目录）
  const folderPath = path.join(baseDir, folder);
  const filePath = findMDXFile(folderPath, decodedSlug);

  // 3. 增强错误提示，帮助在 GitHub Actions 日志中快速定位问题
  if (!filePath) {
    console.error(`[MDX Error] Cannot find file for slug: ${decodedSlug} in ${folderPath}`);
    throw new Error(`File not exist: ${decodedSlug}`);
  }

  // 4. 解析文件内容
  const filestream = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(filestream);

  return {
    slug: decodedSlug,
    metadata: data,
    content,
  };
}
