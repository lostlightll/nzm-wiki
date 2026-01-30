import fs from "fs";
import path from "path";
import matter from "gray-matter";

const baseDir = path.join(process.cwd(), "data");

//  获取某个分类下的所有文章（用于列表页）
export function getMDXList(folder: string) {
  const dirPath = path.join(baseDir, folder);
  if (!fs.existsSync(dirPath)) return [];

  const files = fs.readdirSync(dirPath);

  const result = files
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => {
      const { data } = matter(
        fs.readFileSync(path.join(dirPath, file), "utf-8")
      );
      return {
        slug: file.replace(".mdx", ""),
        ...data,
      };
    });

  return result;
}

// 获取单篇文章详情（用于详情页）
export function getMDXDetail(folder: string, slug: string) {
  // 解码 URL 回中文，不然可能是 %E6%AD%BB... 之类
  const decodedSlug = decodeURIComponent(slug);

  const filePath = path.join(baseDir, folder, `${decodedSlug}.mdx`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`file not exist: ${filePath}`);
  }

  // 使用 gray-matter 解析 frontmatter (元数据) 和 content (正文)
  const filestream = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(filestream);

  return {
    slug,
    metadata: data,
    content,
  };
}
