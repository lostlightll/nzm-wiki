/**
 * 导出 Notion CMS 武器数据为 JSON 文件
 * 使用方法: pnpm update:weapons
 */

import { config } from "dotenv";
// 加载 .env.local 文件
config({ path: ".env.local" });

import fs from "fs";
import path from "path";
import type {
  Weapon,
  WeaponType,
  ElementType,
  WeaponTag,
  Rarity,
  ScopeType,
} from "../types";

const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

// 当前赛季
const CURRENT_SEASON = "s0";

function getHeaders() {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) {
    throw new Error("NOTION_API_KEY environment variable is not set");
  }
  return {
    Authorization: `Bearer ${apiKey}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

// Notion property helpers
type NotionProperty = {
  type: string;
  title?: { plain_text: string }[];
  rich_text?: { plain_text: string }[];
  number?: number | null;
  select?: { name: string } | null;
  multi_select?: { name: string }[];
  checkbox?: boolean;
};

function getTitle(prop: NotionProperty): string {
  if (prop?.type === "title" && prop.title) {
    return prop.title.map((t) => t.plain_text).join("");
  }
  return "";
}

function getRichText(prop: NotionProperty): string {
  if (prop?.type === "rich_text" && prop.rich_text) {
    return prop.rich_text.map((t) => t.plain_text).join("");
  }
  return "";
}

function getNumber(prop: NotionProperty): number {
  if (prop?.type === "number") {
    return prop.number ?? 0;
  }
  return 0;
}

function getSelect(prop: NotionProperty): string {
  if (prop?.type === "select") {
    return prop.select?.name ?? "";
  }
  return "";
}

function getMultiSelect(prop: NotionProperty): string[] {
  if (prop?.type === "multi_select" && prop.multi_select) {
    return prop.multi_select.map((s) => s.name);
  }
  return [];
}

interface NotionPage {
  id: string;
  properties: Record<string, NotionProperty>;
}

interface QueryDatabaseResponse {
  results: NotionPage[];
  next_cursor: string | null;
  has_more: boolean;
}

async function queryAllPages(databaseId: string): Promise<NotionPage[]> {
  const pages: NotionPage[] = [];
  let cursor: string | undefined = undefined;

  do {
    const body: Record<string, unknown> = {};
    if (cursor) {
      body.start_cursor = cursor;
    }

    const response = await fetch(
      `${NOTION_API_BASE}/databases/${databaseId}/query`,
      {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Notion API error: ${response.status} - ${error}`);
    }

    const data: QueryDatabaseResponse = await response.json();
    pages.push(...data.results);
    cursor = data.next_cursor ?? undefined;
  } while (cursor);

  return pages;
}

function mapNotionPageToWeapon(page: NotionPage): Weapon {
  const props = page.properties;
  const name = getTitle(props.Name as NotionProperty);

  return {
    id: getRichText(props.id as NotionProperty) || page.id,
    name,
    type: getSelect(props.weaponType as NotionProperty) as WeaponType,
    elementType: getSelect(props.elementType as NotionProperty) as ElementType,
    tags: getMultiSelect(props.tags as NotionProperty) as WeaponTag[],
    rarity: (getSelect(props.rarity as NotionProperty) as Rarity) || "普通",
    scope: (getSelect(props.scope as NotionProperty) as ScopeType) || undefined,
    stats: {
      damage: getNumber(props.damage as NotionProperty),
      fireRate: getNumber(props.fireRate as NotionProperty),
      magazine: getNumber(props.magazine as NotionProperty),
      totalAmmo: getNumber(props.totalAmmo as NotionProperty),
      accuracy: getNumber(props.accuracy as NotionProperty),
      stability: getNumber(props.stability as NotionProperty),
      weaknessMultiplier: getNumber(props.weeknessMulti as NotionProperty),
      toughnessBase: getNumber(props.toughnessBase as NotionProperty),
      reloadTime: getNumber(props.reloadTime as NotionProperty),
    },
    skillCooldown: 0,
    skills: [],
    description: undefined,
  };
}

async function main() {
  const databaseId = process.env.NOTION_WEAPONS_DATABASE_ID;
  if (!databaseId) {
    throw new Error(
      "NOTION_WEAPONS_DATABASE_ID environment variable is not set",
    );
  }

  console.log("Fetching weapons from Notion...");
  const pages = await queryAllPages(databaseId);
  console.log(`Found ${pages.length} weapons`);

  const weapons = pages.map(mapNotionPageToWeapon);

  // 确保目录存在
  const outputDir = path.join(process.cwd(), `data/${CURRENT_SEASON}`);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 写入 JSON 文件
  const outputPath = path.join(outputDir, "weapons.json");
  fs.writeFileSync(outputPath, JSON.stringify(weapons, null, 2), "utf-8");

  console.log(`Exported to ${outputPath}`);
}

main().catch((err) => {
  console.error("Export failed:", err);
  process.exit(1);
});
