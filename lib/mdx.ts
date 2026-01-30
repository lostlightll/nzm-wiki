import fs from "fs";
import path from "path";
import matter from "gray-matter";

const baseDir = path.join(process.cwd(), "data");

/**
 * 获取某个分类下的所有文章（用于列表页）
 */
export function getMDXList(folder: string) {
  const dirPath = path.join(baseDir, folder);

  if (!fs.existsSync(dirPath)) {
    console.warn(`[MDX Warning] Directory not found: ${dirPath}`);
    return [];
  }

  const files = fs.readdirSync(dirPath);

  return files
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => {
      const filePath = path.join(dirPath, file);
      const fileContent = fs.readFileSync(filePath, "utf-8");
      const { data } = matter(fileContent);

      return {
        // slug 保持为原始中文文件名，不包含 .mdx
        slug: file.replace(/\.mdx$/, ""),
        ...data,
      };
    });
}

/**
 * 获取单篇文章详情（用于详情页）
 * @param folder 分类文件夹 (如 "s0/weapons")
 * @param slug 传入的路径参数 (可能是中文，也可能是 URL 编码后的字符串)
 */
export function getMDXDetail(folder: string, slug: string) {
  // 1. 核心修复：无论 Next.js 传进来的是什么，先统一解码为中文
  const decodedSlug = decodeURIComponent(slug);

  // 2. 拼接完整的文件路径
  const filePath = path.join(baseDir, folder, `${decodedSlug}.mdx`);

  // 3. 增强错误提示，帮助在 GitHub Actions 日志中快速定位问题
  if (!fs.existsSync(filePath)) {
    console.error(`[MDX Error] Cannot find file: ${filePath}`);
    // 你也可以选择返回 null 而不是抛出异常，然后在页面处理 404
    throw new Error(`File not exist: ${filePath}`);
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
