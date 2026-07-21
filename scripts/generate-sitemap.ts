import fs from "fs";
import path from "path";
import matter from "gray-matter";

const SITE_URL = "https://nzm-wiki.pages.dev";
const baseDir = path.join(process.cwd(), "data");

// 路径映射（与 generate-search-index.ts 保持一致）
const pathMap: Record<string, string> = {
  weapons: "/weapons",
  weapons_td: "/weapons/td",
  perks: "/perks",
  traps: "/traps",
  "enemies/lc/boss": "/enemies/lc",
  "enemies/td": "/enemies/td",
  cards: "/cards",
  posts: "/posts",
};

interface PageEntry {
  url: string;
  lastmod?: string;
}

function scanDirectory(dirPath: string, relativePath: string = ""): PageEntry[] {
  const results: PageEntry[] = [];

  if (!fs.existsSync(dirPath)) {
    return results;
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
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

      // draft 文章不加入 sitemap
      if (data.draft) continue;

      const fileName = entry.name.replace(/\.mdx$/, "");
      const slug = relativePath ? `${relativePath}/${fileName}` : fileName;

      // 确定 URL 路径
      let urlPath = "";
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

      // 获取文件修改时间
      const stat = fs.statSync(fullPath);
      const lastmod = stat.mtime.toISOString().split("T")[0];

      results.push({ url: urlPath, lastmod });
    }
  }

  return results;
}

function generateSitemap() {
  console.log("Generating sitemap...");

  const pages = scanDirectory(baseDir);

  // 添加静态页面
  const staticPages: PageEntry[] = [
    { url: "/" },
    { url: "/weapons" },
    { url: "/perks" },
    { url: "/overlimit" },
    { url: "/tower-defense" },
    { url: "/traps" },
    { url: "/enemies" },
    { url: "/enemies/lc" },
    { url: "/enemies/td" },
    { url: "/posts" },
    { url: "/damage" },
    { url: "/credits" },
  ];

  const overlimitFile = path.join(baseDir, "overlimit-cards.json");
  const overlimitLastmod = fs.existsSync(overlimitFile)
    ? fs.statSync(overlimitFile).mtime.toISOString().split("T")[0]
    : undefined;
  const overlimitPages: PageEntry[] = fs.existsSync(overlimitFile)
    ? (JSON.parse(fs.readFileSync(overlimitFile, "utf-8")) as Array<{
        id: string;
      }>).map((card) => ({
        url: `/overlimit/${card.id}`,
        lastmod: overlimitLastmod,
      }))
    : [];

  const allPages = [...staticPages, ...pages, ...overlimitPages];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages
  .map(
    (page) => `  <url>
    <loc>${SITE_URL}${page.url}</loc>${
      page.lastmod ? `\n    <lastmod>${page.lastmod}</lastmod>` : ""
    }
  </url>`
  )
  .join("\n")}
</urlset>
`;

  const outputPath = path.join(process.cwd(), "public", "sitemap.xml");
  fs.writeFileSync(outputPath, xml, "utf-8");

  console.log(`Generated sitemap with ${allPages.length} URLs`);
  console.log(`Output: ${outputPath}`);
}

generateSitemap();
