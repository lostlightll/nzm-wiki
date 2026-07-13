import fs from "fs";
import path from "path";
import { readContentCatalog } from "./content-catalog";
import { resolveContentPath, STATIC_PAGE_ROUTES } from "./content-routes";

const SITE_URL = "https://nzm-wiki.pages.dev";
const baseDir = path.join(process.cwd(), "data");

interface PageEntry {
  url: string;
  lastmod?: string;
}

function generateSitemap() {
  console.log("Generating sitemap...");

  const pages = readContentCatalog(baseDir).flatMap((document) => {
    if (document.metadata.draft) return [];
    const url = resolveContentPath(document.slug);
    return url ? [{ url, lastmod: document.lastModified }] : [];
  });

  // 添加静态页面
  const staticPages: PageEntry[] = STATIC_PAGE_ROUTES.map((url) => ({ url }));

  const allPages = [...staticPages, ...pages].filter(
    (page, index, entries) =>
      entries.findIndex((candidate) => candidate.url === page.url) === index,
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages
  .map(
    (page) => `  <url>
    <loc>${escapeXml(`${SITE_URL}${page.url}`)}</loc>${
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

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

generateSitemap();
