import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { pinyin } from "pinyin-pro";

interface SearchItem {
  title: string;
  slug: string;
  path: string;
  category: string;
  keywords: string[];
  pinyin: string[];  // 预计算的拼音
}

const baseDir = path.join(process.cwd(), "data");

// 分类映射
const categoryMap: Record<string, string> = {
  "s0/weapons": "武器",
  "s0/perks": "特性",
  "s0/traps": "陷阱",
  "s0/lc/boss": "首领",
  "s0/enemies/td": "塔防敌人",
  cards: "卡牌",
  posts: "文章",
};

// 路径映射（用于生成实际的访问路径）
const pathMap: Record<string, string> = {
  "s0/weapons": "/weapons",
  "s0/perks": "/perks",
  "s0/traps": "/traps",
  "s0/lc/boss": "/lc/boss",
  "s0/enemies/td": "/enemies/td",
  cards: "/cards",
  posts: "/posts",
};

function scanDirectory(dirPath: string, relativePath: string = ""): SearchItem[] {
  const results: SearchItem[] = [];

  if (!fs.existsSync(dirPath)) {
    return results;
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      // 路由组目录（以括号开头）不包含在 slug 中
      if (entry.name.startsWith("(")) {
        results.push(...scanDirectory(fullPath, relativePath));
      } else {
        const currentRelativePath = relativePath
          ? `${relativePath}/${entry.name}`
          : entry.name;
        results.push(...scanDirectory(fullPath, currentRelativePath));
      }
    } else if (entry.name.endsWith(".mdx")) {
      const fileContent = fs.readFileSync(fullPath, "utf-8");
      const { data } = matter(fileContent);

      // draft 文章不加入搜索索引
      if (data.draft) continue;

      const fileName = entry.name.replace(/\.mdx$/, "");
      const slug = relativePath ? `${relativePath}/${fileName}` : fileName;

      // 确定分类
      let category = "其他";
      let urlPath = "";

      for (const [prefix, cat] of Object.entries(categoryMap)) {
        if (slug.startsWith(prefix)) {
          category = cat;
          break;
        }
      }

      // 确定 URL 路径
      for (const [prefix, p] of Object.entries(pathMap)) {
        if (slug.startsWith(prefix)) {
          const remainder = slug.slice(prefix.length);
          urlPath = p + remainder;
          break;
        }
      }

      if (!urlPath) {
        urlPath = `/${slug}`;
      }

      // 收集关键词
      const keywords: string[] = [];

      // 添加文件名作为关键词
      keywords.push(fileName);

      // 添加 title
      if (data.title) {
        keywords.push(data.title);
      }

      // 添加 nickname（陷阱、敌人等有此字段）
      if (data.nickname) {
        keywords.push(data.nickname);
      }

      // 添加自定义 keywords 字段
      if (data.keywords) {
        if (Array.isArray(data.keywords)) {
          keywords.push(...data.keywords);
        } else if (typeof data.keywords === "string") {
          keywords.push(data.keywords);
        }
      }

      // 添加 tags（武器有此字段）
      if (data.tags && Array.isArray(data.tags)) {
        keywords.push(...data.tags);
      }

      // 添加 weapon_type
      if (data.weapon_type) {
        keywords.push(data.weapon_type);
      }

      // 添加 element
      if (data.element) {
        keywords.push(data.element);
      }

      // 添加 rarity
      if (data.rarity) {
        keywords.push(data.rarity);
      }

      // 添加 tag（文章有此字段）
      if (data.tag) {
        if (Array.isArray(data.tag)) {
          keywords.push(...data.tag);
        } else {
          keywords.push(data.tag);
        }
      }

      // 生成拼音索引（全拼和首字母）
      const allText = [data.title || fileName, ...keywords].filter(Boolean);
      const pinyinSet = new Set<string>();
      for (const text of allText) {
        // 全拼
        const fullPinyin = pinyin(String(text), { toneType: "none", type: "array" }).join("");
        if (fullPinyin) pinyinSet.add(fullPinyin.toLowerCase());
        // 首字母
        const initials = pinyin(String(text), { pattern: "first", toneType: "none", type: "array" }).join("");
        if (initials) pinyinSet.add(initials.toLowerCase());
      }

      results.push({
        title: data.title || fileName,
        slug,
        path: urlPath,
        category,
        keywords: [...new Set(keywords.filter(Boolean).map(String))],
        pinyin: [...pinyinSet],
      });
    }
  }

  return results;
}

function generateSearchIndex() {
  console.log("Generating search index...");

  const items = scanDirectory(baseDir);

  // 按分类排序
  items.sort((a, b) => {
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category, "zh-CN");
    }
    return a.title.localeCompare(b.title, "zh-CN");
  });

  const outputPath = path.join(process.cwd(), "public", "search-index.json");

  // 确保目录存在
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(items, null, 2), "utf-8");

  console.log(`Generated search index with ${items.length} items`);
  console.log(`Output: ${outputPath}`);
}

generateSearchIndex();
