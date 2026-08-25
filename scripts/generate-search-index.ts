import fs from "fs";
import path from "path";
import { pathToFileURL } from "node:url";
import matter from "gray-matter";
import { pinyin } from "pinyin-pro";
import {
  getFullReloadTime,
  getMainDamageSource,
  getResolvedFieldValue,
} from "../lib/weapon-consumers";
import type { ResolvedWeapon } from "../lib/weapon-resolver";
import { getAllOverlimitCards } from "../lib/overlimit-cards";
import { getStatusEffectSearchDocuments } from "../lib/status-effects";
import { getSummonSearchDocuments } from "../lib/summons";
import { getAllResolvedWeapons } from "../lib/weapons";
import type { OverlimitCard } from "../types";

export interface SearchItem {
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
  weapons: "武器",
  perks: "特性",
  traps: "陷阱",
  "enemies/lc/boss": "首领",
  "enemies/td": "塔防敌人",
  cards: "卡牌",
  posts: "文章",
  builds: "搭配攻略",
};

// 路径映射（用于生成实际的访问路径）
const pathMap: Record<string, string> = {
  weapons: "/weapons",
  perks: "/perks",
  traps: "/traps",
  "enemies/lc/boss": "/bosses",
  "enemies/td": "/enemies/td",
  cards: "/cards",
  posts: "/posts",
  builds: "/builds",
};

export function getBuildGuideSearchKeywords(data: Record<string, unknown>): string[] {
  const weapons = data.weapons as
    | { primary?: unknown; secondary?: unknown; melee?: unknown }
    | undefined;
  const perks = data.perks as
    | {
        primary?: Record<string, unknown>;
        secondary?: Record<string, unknown>;
      }
    | undefined;
  const talent = data.talent as
    | { tree?: unknown; passive?: unknown; route?: unknown }
    | undefined;
  const treeNames: Record<string, string> = {
    zero: "零点",
    "grappling-hook": "劫掠钩锁",
    "iron-fist": "铁拳狂徒",
  };
  const passiveFile = path.join(
    baseDir,
    "season-talents",
    "s3",
    "passives.json",
  );
  const passiveNames = fs.existsSync(passiveFile)
    ? new Map(
        (
          JSON.parse(fs.readFileSync(passiveFile, "utf8")) as {
            passives: Array<{ id: string; name: string }>;
          }
        ).passives.map((passive) => [passive.id, passive.name]),
      )
    : new Map<string, string>();
  const perkSlugs = [
    ...Object.values(perks?.primary ?? {}),
    ...Object.values(perks?.secondary ?? {}),
  ].filter((value): value is string => typeof value === "string");
  const tree = typeof talent?.tree === "string" ? talent.tree : "";
  const passive = typeof talent?.passive === "string" ? talent.passive : "";

  return [
    "S3",
    typeof data.summary === "string" ? data.summary : "",
    typeof data.source === "string" ? data.source : "",
    typeof weapons?.primary === "string" ? weapons.primary : "",
    typeof weapons?.secondary === "string" ? weapons.secondary : "",
    typeof weapons?.melee === "string" ? weapons.melee : "",
    ...perkSlugs,
    ...perkSlugs.map((slug) => slug.split("/").at(-1) ?? slug),
    tree,
    treeNames[tree] ?? "",
    passive,
    passiveNames.get(passive) ?? "",
    typeof talent?.route === "string" ? talent.route : "",
  ].filter(Boolean);
}

export function scanDirectory(dirPath: string, relativePath: string = ""): SearchItem[] {
  const results: SearchItem[] = [];

  if (!fs.existsSync(dirPath)) {
    return results;
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      // 武器条目由 Resolver 单独注入；TD 沿用现有规则，不单独索引。
      if (entry.name === "weapons") continue;
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

      // 猎场精英敌人尚未有公开路由，不生成失效的旧前缀链接。
      if (slug.startsWith("enemies/lc/elite/")) continue;

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

      if (slug.startsWith("builds/")) {
        keywords.push(...getBuildGuideSearchKeywords(data));
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

function buildPinyin(texts: readonly string[]): string[] {
  const values = new Set<string>();
  for (const text of texts) {
    const full = pinyin(text, { toneType: "none", type: "array" }).join("");
    if (full) values.add(full.toLowerCase());
    const initials = pinyin(text, {
      pattern: "first",
      toneType: "none",
      type: "array",
    }).join("");
    if (initials) values.add(initials.toLowerCase());
  }
  return [...values];
}

function cleanSearchText(value: string): string {
  return value.replace(/<[^>]+>/g, "").replace(/\*\*/g, "");
}

export function createOverlimitCardSearchItem(card: OverlimitCard): SearchItem {
  const keywords = [
    card.id,
    cleanSearchText(card.description),
    `${card.quality}品质`,
    `权重${card.weight}`,
    `${card.slot}号槽位`,
    ...card.weaponNames,
    ...card.tags.map((tag) => tag.name),
    ...(card.effectValues ?? []).flatMap((effect) => [
      effect.label,
      ...effect.stages.flatMap((stage) => [
        stage.condition ?? "",
        stage.value,
      ]),
    ]),
  ];
  return {
    title: card.name,
    slug: `overlimit/${card.id}`,
    path: `/overlimit/${card.id}`,
    category: "超限卡片",
    keywords: [...new Set(keywords)],
    pinyin: buildPinyin([card.name, ...keywords]),
  };
}

type StatusEffectSearchDocument = ReturnType<
  typeof getStatusEffectSearchDocuments
>[number];

export function createStatusEffectSearchItem(
  document: StatusEffectSearchDocument,
): SearchItem {
  const route =
    document.target === "enemy" ? "enemy-buffs" : "player-buffs";
  const keywords = [
    String(document.buffId),
    ...document.keywords,
  ].filter(
    (value, index, values) =>
      value.length > 0 && values.indexOf(value) === index,
  );

  return {
    title: document.title,
    slug: `status-effects/${document.target}/${document.buffId}`,
    path: `/posts/${route}?buff=${document.buffId}#status-effect-${document.buffId}`,
    category: "状态效果",
    keywords,
    pinyin: buildPinyin([document.title, ...keywords]),
  };
}

type SummonSearchDocument = ReturnType<typeof getSummonSearchDocuments>[number];

export function createSummonSearchItem(
  document: SummonSearchDocument,
): SearchItem {
  const params = new URLSearchParams({ summon: document.summonId });
  if (document.section) params.set("section", document.section);
  const anchor = document.section
    ? `summon-${document.summonId}-${document.section}`
    : `summon-${document.summonId}`;
  const keywords = [
    "召唤物",
    document.summonId,
    ...document.keywords,
  ].filter(
    (value, index, values) => value.length > 0 && values.indexOf(value) === index,
  );
  return {
    title: document.title,
    slug: document.section
      ? `summons/${document.summonId}/mechanics/${document.section}`
      : `summons/${document.summonId}`,
    path: `/posts/summons?${params.toString()}#${anchor}`,
    category: "召唤物",
    keywords,
    pinyin: buildPinyin([document.title, ...keywords]),
  };
}

type SeasonTalentSearchDocument = {
  season: "s3" | "s4";
  tree: string;
  treeName: string;
  id: string;
  title: string;
  kind: "node" | "passive";
  keywords: string[];
};

export function createSeasonTalentSearchItem(
  document: SeasonTalentSearchDocument,
): SearchItem {
  const queryKey = document.kind === "node" ? "node" : "passive";
  const anchor =
    document.season === "s4"
      ? `season-talent-${queryKey}-${document.id}`
      : `multiplier-provider-${queryKey}-${document.id}`;
  const seasonLabel = document.season.toUpperCase();
  const keywords = [
    seasonLabel,
    "赛季天赋",
    document.treeName,
    document.id,
    ...document.keywords,
  ].filter(
    (value, index, values) =>
      value.length > 0 && values.indexOf(value) === index,
  );
  return {
    title: document.title,
    slug: `season-talents/${document.season}/${document.tree}/${queryKey}/${document.id}`,
    path: `/guides/season-talents/${document.season}/${document.tree}?${queryKey}=${document.id}#${anchor}`,
    category: "赛季天赋",
    keywords,
    pinyin: buildPinyin([document.title, ...keywords]),
  };
}

export function createWeaponSearchItem(weapon: ResolvedWeapon): SearchItem {
  const weaponType = getResolvedFieldValue(weapon.weaponType);
  const element = getResolvedFieldValue(weapon.element);
  const rarity = getResolvedFieldValue(weapon.rarity);
  const keywords = [
    weapon.slug,
    weapon.title,
    weapon.nickname,
    ...weapon.keywords,
    ...weapon.tags,
    weaponType,
    element,
    rarity,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
  return {
    title: weapon.title,
    slug: `weapons/${weapon.slug}`,
    path: `/weapons/${weapon.slug}`,
    category: "武器",
    keywords: [...new Set(keywords)],
    pinyin: buildPinyin([weapon.title, ...keywords]),
  };
}

export function generateSearchIndex(weapons: readonly ResolvedWeapon[]) {
  console.log("Generating search index...");

  const items = scanDirectory(baseDir);
  const damageSourceKeywords = [
    "伤害来源",
    "射击伤害",
    "原子伤害",
    "WeaponDamage",
    "WeaponExplosionDamage",
    "SettlementType",
    "增伤范围",
    "游戏乘区 Part 2",
  ];
  items.push({
    title: "伤害来源分类",
    slug: "multiplier?part=damage-sources",
    path: "/multiplier?part=damage-sources",
    category: "攻略机制",
    keywords: damageSourceKeywords,
    pinyin: buildPinyin(["伤害来源分类", ...damageSourceKeywords]),
  });
  items.push(...weapons.map(createWeaponSearchItem));
  items.push(
    ...getStatusEffectSearchDocuments().map(createStatusEffectSearchItem),
  );
  items.push(...getSummonSearchDocuments().map(createSummonSearchItem));
  const s3TalentSlugs = ["iron-fist", "zero", "grappling-hook"];
  for (const slug of s3TalentSlugs) {
    const talentFile = path.join(baseDir, "season-talents", "s3", `${slug}.json`);
    if (!fs.existsSync(talentFile)) continue;

    const talent = JSON.parse(fs.readFileSync(talentFile, "utf-8")) as {
      id: string;
      name: string;
      subtitle: string;
      applicableWeapons: string[];
      nodes: Array<{ id: string; name: string; descriptions: string[] }>;
    };
    const keywords = [
      "S3",
      "赛季天赋",
      ...(talent.id === "iron-fist" ? ["铁拳狂战"] : []),
      talent.subtitle,
      ...talent.applicableWeapons,
      ...talent.nodes.map((node) => node.name),
      ...talent.nodes.flatMap((node) => node.descriptions),
    ];
    const pinyinSet = new Set<string>();
    for (const text of [talent.name, ...keywords]) {
      const fullPinyin = pinyin(String(text), {
        toneType: "none",
        type: "array",
      }).join("");
      if (fullPinyin) pinyinSet.add(fullPinyin.toLowerCase());
      const initials = pinyin(String(text), {
        pattern: "first",
        toneType: "none",
        type: "array",
      }).join("");
      if (initials) pinyinSet.add(initials.toLowerCase());
    }

    items.push({
      title: `${talent.name}天赋树（S3）`,
      slug: `season-talents/s3/${slug}`,
      path: `/guides/season-talents/s3/${slug}`,
      category: "赛季天赋",
      keywords: [...new Set(keywords)],
      pinyin: [...pinyinSet],
    });

    items.push(
      ...talent.nodes.map((node) =>
        createSeasonTalentSearchItem({
          season: "s3",
          tree: slug,
          treeName: talent.name,
          id: node.id,
          title: node.name,
          kind: "node",
          keywords: [
            talent.subtitle,
            ...talent.applicableWeapons,
            ...node.descriptions.map((description) =>
              description.replace(/<[^>]+>/g, ""),
            ),
          ],
        }),
      ),
    );
  }


  const s3PassivesFile = path.join(baseDir, "season-talents", "s3", "passives.json");
  if (fs.existsSync(s3PassivesFile)) {
    const passiveData = JSON.parse(fs.readFileSync(s3PassivesFile, "utf-8")) as {
      passives: Array<{
        id: string;
        name: string;
        unlockLevel: number;
        tags: string[];
        description: string;
      }>;
    };
    items.push(
      ...passiveData.passives.map((passive) =>
        createSeasonTalentSearchItem({
          season: "s3",
          tree: "zero",
          treeName: "零点",
          id: passive.id,
          title: passive.name,
          kind: "passive",
          keywords: [
            `等级 ${passive.unlockLevel}`,
            ...passive.tags,
            passive.description.replace(/<[^>]+>/g, ""),
          ],
        }),
      ),
    );
  }

  const s4TalentSlugs = [
    "dual-star",
    "matrix-symbiosis",
    "black-hole",
  ] as const;
  const s4PassivesFile = path.join(
    baseDir,
    "season-talents",
    "s4",
    "passives.json",
  );
  const s4PassiveData = fs.existsSync(s4PassivesFile)
    ? (JSON.parse(fs.readFileSync(s4PassivesFile, "utf-8")) as {
        draft?: boolean;
        trees: Record<
          string,
          {
            light: Array<{
              id: string;
              name: string;
              description: string;
              tags: string[];
            }>;
            dark: Array<{
              id: string;
              name: string;
              description: string;
              tags: string[];
            }>;
          }
        >;
      })
    : null;

  for (const slug of s4TalentSlugs) {
    const talentFile = path.join(
      baseDir,
      "season-talents",
      "s4",
      `${slug}.json`,
    );
    if (!fs.existsSync(talentFile)) continue;
    const talent = JSON.parse(fs.readFileSync(talentFile, "utf-8")) as {
      draft?: boolean;
      name: string;
      subtitle: string;
      applicableWeapons: string;
      nodes: Array<{ id: string; name: string; descriptions: string[] }>;
    };
    if (talent.draft === true || s4PassiveData?.draft === true) continue;

    const clean = (value: string) => value.replace(/<[^>]+>/g, "");
    const keywords = [
      "S4",
      "赛季天赋",
      talent.subtitle,
      clean(talent.applicableWeapons),
      ...talent.nodes.map((node) => node.name),
    ];
    items.push({
      title: `${talent.name}天赋树（S4）`,
      slug: `season-talents/s4/${slug}`,
      path: `/guides/season-talents/s4/${slug}`,
      category: "赛季天赋",
      keywords: [...new Set(keywords)],
      pinyin: buildPinyin([talent.name, ...keywords]),
    });
    items.push(
      ...talent.nodes.map((node) =>
        createSeasonTalentSearchItem({
          season: "s4",
          tree: slug,
          treeName: talent.name,
          id: node.id,
          title: node.name,
          kind: "node",
          keywords: [
            talent.subtitle,
            clean(talent.applicableWeapons),
            ...node.descriptions.map(clean),
          ],
        }),
      ),
    );

    const treePassives = s4PassiveData?.trees[slug];
    if (!treePassives) continue;
    items.push(
      ...[...treePassives.light, ...treePassives.dark].map((passive) =>
        createSeasonTalentSearchItem({
          season: "s4",
          tree: slug,
          treeName: talent.name,
          id: passive.id,
          title: passive.name,
          kind: "passive",
          keywords: [...passive.tags, clean(passive.description)],
        }),
      ),
    );
  }
  items.push(...getAllOverlimitCards().map(createOverlimitCardSearchItem));

  const overlimitLevelsFile = path.join(baseDir, "overlimit-levels.json");
  if (fs.existsSync(overlimitLevelsFile)) {
    const keywords = [
      "超限猎场",
      "升级概率",
      "品质概率",
      "紫卡",
      "金卡",
      "橙卡",
      "4插",
      "4插卡池",
      "4插概率加成",
      "2x",
      "暴击升级",
      "重抽费用",
    ];
    const pinyinSet = new Set<string>();
    for (const text of ["等级图鉴", ...keywords]) {
      const fullPinyin = pinyin(text, {
        toneType: "none",
        type: "array",
      }).join("");
      if (fullPinyin) pinyinSet.add(fullPinyin.toLowerCase());
      const initials = pinyin(text, {
        pattern: "first",
        toneType: "none",
        type: "array",
      }).join("");
      if (initials) pinyinSet.add(initials.toLowerCase());
    }

    items.push({
      title: "等级图鉴",
      slug: "overlimit/levels",
      path: "/overlimit#levels",
      category: "超限图鉴",
      keywords,
      pinyin: [...pinyinSet],
    });
  }

  const overlimitBondsFile = path.join(baseDir, "overlimit-bonds.json");
  if (fs.existsSync(overlimitBondsFile)) {
    const bonds = JSON.parse(fs.readFileSync(overlimitBondsFile, "utf-8")) as Array<{
      name: string;
      effects: Array<{ count: number; description: string }>;
    }>;
    const keywords = [
      "超限猎场",
      "羁绊效果",
      "套装词条",
      "x2",
      "x4",
      "x6",
      ...bonds.flatMap((bond) => [
        bond.name,
        ...bond.effects.map((effect) => effect.description),
      ]),
    ];
    const pinyinSet = new Set<string>();
    for (const text of ["羁绊效果", ...keywords]) {
      const fullPinyin = pinyin(text, {
        toneType: "none",
        type: "array",
      }).join("");
      if (fullPinyin) pinyinSet.add(fullPinyin.toLowerCase());
      const initials = pinyin(text, {
        pattern: "first",
        toneType: "none",
        type: "array",
      }).join("");
      if (initials) pinyinSet.add(initials.toLowerCase());
    }

    items.push({
      title: "羁绊效果",
      slug: "overlimit/bonds",
      path: "/overlimit#bonds",
      category: "超限图鉴",
      keywords,
      pinyin: [...pinyinSet],
    });
  }

  const mapRotationFile = path.join(
    baseDir,
    "overlimit-map-rotation.json",
  );
  if (fs.existsSync(mapRotationFile)) {
    const schedule = JSON.parse(
      fs.readFileSync(mapRotationFile, "utf-8"),
    ) as {
      season: number;
      periods: Array<{
        maps: Array<{ name: string; activeBonds: string[] }>;
      }>;
    };
    const mapNames = new Set<string>();
    const bondNames = new Set<string>();

    for (const period of schedule.periods) {
      for (const map of period.maps) {
        mapNames.add(map.name);
        for (const bond of map.activeBonds) bondNames.add(bond);
      }
    }

    const keywords = [
      `${schedule.season}赛季`,
      "超限猎场",
      "地图羁绊",
      "羁绊档期",
      ...mapNames,
      ...bondNames,
    ];
    const pinyinSet = new Set<string>();
    for (const text of ["地图轮换", ...keywords]) {
      const fullPinyin = pinyin(text, {
        toneType: "none",
        type: "array",
      }).join("");
      if (fullPinyin) pinyinSet.add(fullPinyin.toLowerCase());
      const initials = pinyin(text, {
        pattern: "first",
        toneType: "none",
        type: "array",
      }).join("");
      if (initials) pinyinSet.add(initials.toLowerCase());
    }

    items.push({
      title: "地图轮换",
      slug: "overlimit/map-rotation",
      path: "/overlimit#map-rotation",
      category: "超限图鉴",
      keywords,
      pinyin: [...pinyinSet],
    });
  }

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

export interface WeaponStat {
  title: string;
  use_type: string | null;
  weapon_type: string | null;
  element: string | null;
  rarity: string | null;
  damage_base: number | null;
  weakness_multiplier: number | null;
  rpm: number | null;
  magazine: number | null;
  reload_time: number | null;
  enable_critical: boolean | null;
  game_mode: "lc";
  pinyin: string[];
}

export function createWeaponStat(weapon: ResolvedWeapon): WeaponStat | null {
  if (weapon.table !== "lc") {
    throw new Error(
      `weapon-stats only accepts LC ResolvedWeapon: ${weapon.slug}`,
    );
  }
  if (weapon.useType === "近战武器") return null;
  const source = getMainDamageSource(weapon);
  return {
    title: weapon.title,
    use_type: weapon.useType ?? null,
    weapon_type: getResolvedFieldValue(weapon.weaponType) ?? null,
    element: getResolvedFieldValue(weapon.element) ?? null,
    rarity: getResolvedFieldValue(weapon.rarity) ?? null,
    damage_base: source
      ? (getResolvedFieldValue(source.damage.base) ?? null)
      : null,
    weakness_multiplier: source
      ? (getResolvedFieldValue(source.weaknessMultiplier) ?? null)
      : null,
    rpm: source ? (getResolvedFieldValue(source.fire.rpm) ?? null) : null,
    magazine: getResolvedFieldValue(weapon.magazine) ?? null,
    reload_time: getFullReloadTime(weapon.changeClip) ?? null,
    enable_critical: source
      ? (getResolvedFieldValue(source.enableCritical) ?? null)
      : null,
    game_mode: "lc",
    pinyin: buildPinyin([weapon.title]),
  };
}

export function buildWeaponStats(
  resolvedWeapons: readonly ResolvedWeapon[],
): WeaponStat[] {
  const weapons = resolvedWeapons.flatMap((weapon) => {
    const stat = createWeaponStat(weapon);
    return stat ? [stat] : [];
  });
  const rarityOrder: Record<string, number> = {
    传说: 3,
    史诗: 2,
    稀有: 1,
  };
  return weapons.sort((left, right) => {
    const rarityDifference =
      (rarityOrder[right.rarity ?? ""] ?? 0) -
      (rarityOrder[left.rarity ?? ""] ?? 0);
    if (rarityDifference !== 0) return rarityDifference;
    const leftUseType = left.use_type === "主武器" ? 0 : 1;
    const rightUseType = right.use_type === "主武器" ? 0 : 1;
    if (leftUseType !== rightUseType) return leftUseType - rightUseType;
    return left.title.localeCompare(right.title, "zh-CN");
  });
}

export function generateWeaponStats(resolvedWeapons: readonly ResolvedWeapon[]) {
  console.log("Generating weapon stats...");
  const weapons = buildWeaponStats(resolvedWeapons);
  const outputPath = path.join(process.cwd(), "public", "weapon-stats.json");
  fs.writeFileSync(outputPath, JSON.stringify(weapons, null, 2), "utf-8");
  console.log(`Generated weapon stats with ${weapons.length} items`);
  console.log(`Output: ${outputPath}`);
}

export async function generateIndexes() {
  const weapons = await getAllResolvedWeapons("lc");
  generateSearchIndex(weapons);
  generateWeaponStats(weapons);
}

const entryPath = process.argv[1];
if (
  entryPath &&
  import.meta.url === pathToFileURL(path.resolve(entryPath)).href
) {
  void generateIndexes().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
