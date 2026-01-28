import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import type { Weapon, WeaponType, ElementType, WeaponTag, Rarity, ScopeType } from "@/types";
import {
  queryAllPages,
  getTitle,
  getRichText,
  getNumber,
  getSelect,
  getMultiSelect,
} from "./notion";

const WEAPONS_DATABASE_ID = process.env.NOTION_WEAPONS_DATABASE_ID;

// Map Notion page to Weapon type
function mapNotionPageToWeapon(page: PageObjectResponse): Weapon {
  const props = page.properties;
  const name = getTitle(props.Name);

  return {
    id: getRichText(props.id) || page.id,
    name,
    type: getSelect(props.weaponType) as WeaponType,
    elementType: getSelect(props.elementType) as ElementType,
    tags: getMultiSelect(props.tags) as WeaponTag[],
    rarity: (getSelect(props.rarity) as Rarity) || "普通",
    scope: (getSelect(props.scope) as ScopeType) || undefined,
    stats: {
      damage: getNumber(props.damage),
      fireRate: getNumber(props.fireRate),
      magazine: getNumber(props.magazine),
      totalAmmo: getNumber(props.totalAmmo),
      accuracy: getNumber(props.accuracy),
      stability: getNumber(props.stability),
      weaknessMultiplier: getNumber(props.weeknessMulti),
      toughnessBase: getNumber(props.toughnessBase),
      reloadTime: getNumber(props.reloadTime),
    },
    skillCooldown: 0,
    skills: [],
    // 图片路径由武器名称生成，实际是否存在由前端处理
    image: `/icons/weapons/large/${name}.png`,
    description: undefined,
  };
}

// Cache for weapons data
let weaponsCache: Weapon[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 60 * 1000; // 1 minute cache

export async function getAllWeaponsFromNotion(): Promise<Weapon[]> {
  if (!WEAPONS_DATABASE_ID) {
    throw new Error("NOTION_WEAPONS_DATABASE_ID environment variable is not set");
  }

  // Return cached data if still valid
  const now = Date.now();
  if (weaponsCache && now - cacheTimestamp < CACHE_TTL) {
    return weaponsCache;
  }

  const pages = await queryAllPages(WEAPONS_DATABASE_ID);
  const weapons = pages.map(mapNotionPageToWeapon);

  // Update cache
  weaponsCache = weapons;
  cacheTimestamp = now;

  return weapons;
}

export async function getWeaponsByTypeFromNotion(type: string): Promise<Weapon[]> {
  const weapons = await getAllWeaponsFromNotion();
  return weapons.filter((w) => w.type === type);
}

export async function getWeaponByIdFromNotion(id: string): Promise<Weapon | null> {
  const weapons = await getAllWeaponsFromNotion();
  return weapons.find((w) => w.id === id) ?? null;
}
