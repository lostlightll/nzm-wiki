import fs from "fs";
import path from "path";
import { pinyin } from "pinyin-pro";
import {
  readContentCatalog,
  type ContentDocument,
} from "./content-catalog";
import { getContentRouteRule, resolveContentPath } from "./content-routes";

interface SearchItem {
  title: string;
  slug: string;
  path: string;
  category: string;
  keywords: string[];
  pinyin: string[];  // 预计算的拼音
}

const baseDir = path.join(process.cwd(), "data");

function buildSearchItems(documents: ContentDocument[]): SearchItem[] {
  const results: SearchItem[] = [];

  function addString(keywords: string[], value: unknown): void {
    if (typeof value === "string" && value) keywords.push(value);
  }

  function addStrings(keywords: string[], value: unknown): void {
    if (Array.isArray(value)) {
      keywords.push(...value.filter((item): item is string => typeof item === "string"));
    } else {
      addString(keywords, value);
    }
  }

  for (const document of documents) {
    const { fileName, metadata: data, slug } = document;
    const routeRule = getContentRouteRule(slug);
    const urlPath = resolveContentPath(slug);

    if (data.draft || !routeRule?.searchable || !urlPath) continue;

      // 收集关键词
      const keywords: string[] = [];

      // 添加文件名作为关键词
      keywords.push(fileName);

      // 添加 title
      addString(keywords, data.title);

      // 添加 nickname（陷阱、敌人等有此字段）
      addString(keywords, data.nickname);

      // 添加自定义 keywords 字段
      addStrings(keywords, data.keywords);

      // 添加 tags（武器有此字段）
      addStrings(keywords, data.tags);

      // 添加 weapon_type
      addString(keywords, data.weapon_type);

      // 添加 element
      addString(keywords, data.element);

      // 添加 rarity
      addString(keywords, data.rarity);

      // 添加 tag（文章有此字段）
      addStrings(keywords, data.tag);

      // 生成拼音索引（全拼和首字母）
      const title = typeof data.title === "string" ? data.title : fileName;
      const allText = [title, ...keywords];
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
        title,
        slug,
        path: urlPath,
        category: routeRule.category,
        keywords: [...new Set(keywords.filter(Boolean).map(String))],
        pinyin: [...pinyinSet],
      });
  }

  return results;
}

function generateSearchIndex(documents: ContentDocument[]) {
  console.log("Generating search index...");

  const items = buildSearchItems(documents);

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

function generateWeaponStats(documents: ContentDocument[]) {
  console.log("Generating weapon stats...");

  interface WeaponStat {
    title: string;
    use_type: string | null;
    weapon_type: string | null;
    element: string | null;
    rarity: string | null;
    damage_base: number | null;
    weekness_multiplier: number | null;
    file_rate: number | null;
    magazine: number | null;
    reload_time: number | null;
    attenuation_begin: number | null;
    attenuation_end: number | null;
    attenuation_scale: number | null;
    enable_critical: boolean | null;
    game_mode: "lc" | "td" | null;
    pinyin: string[];
  }

  function scanCatalog(contentPrefix: "weapons" | "weapons_td"): WeaponStat[] {
    const result: WeaponStat[] = [];

    for (const document of documents) {
      if (!document.slug.startsWith(`${contentPrefix}/`)) continue;
      const data = document.metadata;
      const damage =
        data.damage && typeof data.damage === "object" && !Array.isArray(data.damage)
          ? (data.damage as Record<string, unknown>)
          : undefined;

      const title = typeof data.title === "string" ? data.title : document.fileName;

      // 过滤近战武器
      if (data.use_type === "近战武器") continue;

      // 拼音
      const pinyinSet = new Set<string>();
      const fullPy = pinyin(String(title), { toneType: "none", type: "array" }).join("");
      if (fullPy) pinyinSet.add(fullPy.toLowerCase());
      const initials = pinyin(String(title), { pattern: "first", toneType: "none", type: "array" }).join("");
      if (initials) pinyinSet.add(initials.toLowerCase());

      result.push({
        title,
        use_type: typeof data.use_type === "string" ? data.use_type : null,
        weapon_type: typeof data.weapon_type === "string" ? data.weapon_type : null,
        element: typeof data.element === "string" ? data.element : null,
        rarity: typeof data.rarity === "string" ? data.rarity : null,
        damage_base: typeof damage?.base === "number" ? damage.base : null,
        weekness_multiplier: typeof data.weekness_multiplier === "number" ? data.weekness_multiplier : null,
        file_rate: typeof data.file_rate === "number" ? data.file_rate : null,
        magazine: typeof data.magazine === "number" ? data.magazine : null,
        reload_time: typeof data.reload_time === "number" ? data.reload_time : null,
        attenuation_begin: typeof data.attenuation_begin === "number" ? data.attenuation_begin : null,
        attenuation_end: typeof data.attenuation_end === "number" ? data.attenuation_end : null,
        attenuation_scale: typeof data.attenuation_scale === "number" ? data.attenuation_scale : null,
        enable_critical:
          typeof data.enable_critical === "boolean" ? data.enable_critical : null,
        game_mode:
          data.game_mode === "lc" || data.game_mode === "td"
            ? data.game_mode
            : contentPrefix === "weapons_td"
              ? "td"
              : "lc",
        pinyin: [...pinyinSet],
      });
    }
    return result;
  }

  const weapons = [
    ...scanCatalog("weapons"),
    ...scanCatalog("weapons_td"),
  ];

  weapons.sort((a, b) => {
    // 一级：稀有度降序（传说 > 史诗 > 稀有）
    const rarityOrder: Record<string, number> = { "传说": 3, "史诗": 2, "稀有": 1 };
    const ra = rarityOrder[a.rarity ?? ""] ?? 0;
    const rb = rarityOrder[b.rarity ?? ""] ?? 0;
    if (ra !== rb) return rb - ra;
    // 二级：use_type 主武器优先
    const ua = a.use_type === "主武器" ? 0 : 1;
    const ub = b.use_type === "主武器" ? 0 : 1;
    if (ua !== ub) return ua - ub;
    // 三级：中文名排序
    return a.title.localeCompare(b.title, "zh-CN");
  });

  const outputPath = path.join(process.cwd(), "public", "weapon-stats.json");
  fs.writeFileSync(outputPath, JSON.stringify(weapons, null, 2), "utf-8");

  console.log(`Generated weapon stats with ${weapons.length} items`);
  console.log(`Output: ${outputPath}`);
}

const documents = readContentCatalog(baseDir);
generateSearchIndex(documents);
generateWeaponStats(documents);
