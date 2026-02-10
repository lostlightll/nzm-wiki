import type { ElementType, WeaponType } from "@/types";

// 精灵图配置
export interface SpriteConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  sheet: "common" | "hud" | "weapon_type";
}

// 元素类型图标坐标 (common.png)
export const ELEMENT_SPRITES: Record<ElementType, SpriteConfig> = {
  火焰: { x: 752, y: 128, width: 32, height: 32, sheet: "common" },
  寒冷: { x: 752, y: 160, width: 32, height: 32, sheet: "common" },
  电弧: { x: 720, y: 128, width: 32, height: 32, sheet: "common" },
  腐蚀: { x: 720, y: 160, width: 32, height: 32, sheet: "common" },
  物理: { x: 752, y: 192, width: 32, height: 32, sheet: "common" },
};

// 武器属性图标坐标 (common.png)
export const STAT_SPRITES: Record<string, SpriteConfig> = {
  damage: { x: 688, y: 128, width: 32, height: 32, sheet: "common" },      // 单发伤害
  fireRate: { x: 688, y: 160, width: 32, height: 32, sheet: "common" },    // 射速
  weaknessMultiplier: { x: 816, y: 96, width: 32, height: 32, sheet: "common" }, // 弱点倍率
  totalAmmo: { x: 816, y: 128, width: 32, height: 32, sheet: "common" },   // 总弹量
  accuracy: { x: 784, y: 128, width: 32, height: 32, sheet: "common" },    // 精准度
  stability: { x: 784, y: 160, width: 32, height: 32, sheet: "common" },   // 稳定度
  range: { x: 848, y: 128, width: 32, height: 32, sheet: "common" },       // 射程
  magazine: { x: 816, y: 160, width: 32, height: 32, sheet: "common" },    // 弹夹
};

// 武器类型图标坐标 (weapon_type.png)
// TODO: 需要根据实际的 weapon_type.png 精灵图调整坐标
export const WEAPON_TYPE_SPRITES: Record<WeaponType, SpriteConfig> = {
  突击步枪: { x: 0, y: 0, width: 64, height: 32, sheet: "weapon_type" },
  狙击步枪: { x: 0, y: 32, width: 64, height: 32, sheet: "weapon_type" },
  霰弹枪: { x: 0, y: 64, width: 64, height: 32, sheet: "weapon_type" },
  火箭发射器: { x: 0, y: 96, width: 64, height: 32, sheet: "weapon_type" },
  冲锋枪: { x: 0, y: 128, width: 64, height: 32, sheet: "weapon_type" },
  机枪: { x: 0, y: 160, width: 64, height: 32, sheet: "weapon_type" },
  手枪: { x: 0, y: 192, width: 64, height: 32, sheet: "weapon_type" },
  单发榴弹: { x: 0, y: 224, width: 64, height: 32, sheet: "weapon_type" },
  弓箭: { x: 0, y: 256, width: 64, height: 32, sheet: "weapon_type" },
  喷射器: { x: 0, y: 288, width: 64, height: 32, sheet: "weapon_type" },
  射手步枪: { x: 0, y: 320, width: 64, height: 32, sheet: "weapon_type" },
  连发榴弹: { x: 0, y: 352, width: 64, height: 32, sheet: "weapon_type" },
};

// 精灵图路径
export const SPRITE_SHEETS = {
  common: "/spritesheets/common.png",
  hud: "/spritesheets/hud.png",
  weapon_type: "/spritesheets/weapon_type.png",
} as const;
