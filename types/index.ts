// ============================================================
// 逆战未来 Wiki - 数据类型定义
// ============================================================

// ------------------------------------------------------------
// 武器相关类型
// ------------------------------------------------------------

// prettier-ignore
export type WeaponType =
  | "突击步枪"
  | "狙击步枪"
  | "霰弹枪"
  | "火箭发射器"
  | "冲锋枪"
  | "机枪"
  | "手枪"
  | "单发榴弹"
  | "弓箭"
  | "喷火器"
  | "射手步枪"
  | "连发榴弹";

export type ElementType = "物理" | "火焰" | "冰冻" | "电弧" | "腐蚀";

export type WeaponTag = "高倍镜" | "穿透" | "破甲" | "爆炸" | "连发" | "三连发" | "自瞄" | "快速连发";

export type Rarity = "普通" | "稀有" | "史诗" | "传说";

export type ScopeType = "低倍镜" | "中倍镜" | "高倍镜";

export type ToughnessType = "冲击" | "贯穿" | "爆炸";

/**
 * 武器伤害数据（来自 frontmatter）
 */
export interface WeaponDamage {
  base: number;
  impulse: number;
  toughness: number;
  flesh: number;
  hurtable: number;
}

/**
 * 完整武器数据接口（匹配 MDX frontmatter）
 */
export interface Weapon {
  slug: string;
  title: string;
  use_type?: string;
  weapon_type?: WeaponType;
  element: ElementType;
  rarity?: Rarity;
  tags?: WeaponTag[] | string;
  scope?: ScopeType | string;
  damage: WeaponDamage;
  toughness_type: ToughnessType;
  enable_critical: boolean;
  weekness_multiplier: number;
  file_rate?: number | string;
  magazine?: number | string;
  total_ammo?: number | string;
  accuracy?: number | string;
  stability?: number | string;
  reload_time?: number | string | null;
  range?: number | string;
  explosion_range?: number | string;
  ignore_shield: boolean;
  element_add_rate: number;
}

// ------------------------------------------------------------
// 插件 (Perk) 相关类型
// ------------------------------------------------------------

export type PerkSlot = 1 | 2 | 3 | 4;

// prettier-ignore
export type PerkCategory =
  | "装填类"
  | "伤害类"
  | "生存类"
  | "辅助类";

export interface PerkEffect {
  slot: PerkSlot;
  description: string;
  values?: {
    [key: string]: number;
  };
}

export interface Perk {
  id: string;
  name: string;
  slot: PerkSlot;
  rarity: Rarity;
  category: PerkCategory;
  icon?: string;
  effects: PerkEffect[];
  description?: string;
}

// ------------------------------------------------------------
// 伤害计算器相关类型
// ------------------------------------------------------------

export interface DamageCalculation {
  weapon: Weapon;
  equippedPerks: {
    slot1?: Perk;
    slot2?: Perk;
    slot3?: Perk;
    slot4?: Perk;
  };
  targetType: "普通" | "精英" | "Boss";
  distance: number;
  isHeadshot: boolean;
  isBackstab: boolean;
}

// prettier-ignore
export interface DamageResult {
  baseDamage: number
  finalDamage: number
  dps: number
  ttk: number
  modifiers: {
    name: string
    value: number
    type: "add" | "multiply"
  }[]
}
