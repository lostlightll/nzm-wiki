import type { ElementType, WeaponType } from "@/types";

// 精灵图配置
export interface SpriteConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  sheet: "common" | "hud" | "weapon_type";
  rotated?: boolean; // 精灵图中是否旋转存储（顺时针90度）
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

// 武器类型图标坐标 (weapon_type.png, 748x1360)
// 坐标来自 UE PaperSprite 的 BakedSourceUV / BakedSourceDimension
// rotated=true 表示精灵图中宽高互换（顺时针旋转90度存储）
export const WEAPON_TYPE_SPRITES: Record<WeaponType, SpriteConfig> = {
  喷射器:     { x: 1, y: 1,    width: 438, height: 148, sheet: "weapon_type" },            // Blaster
  机枪:       { x: 1, y: 151,  width: 438, height: 148, sheet: "weapon_type" },            // MG
  连发榴弹:   { x: 1, y: 301,  width: 438, height: 148, sheet: "weapon_type" },            // MultiGrenade
  手枪:       { x: 1, y: 451,  width: 438, height: 148, sheet: "weapon_type" },            // Pistol
  突击步枪:   { x: 1, y: 601,  width: 438, height: 148, sheet: "weapon_type" },            // Rifle
  霰弹枪:     { x: 1, y: 751,  width: 438, height: 148, sheet: "weapon_type" },            // ShotGun
  单发榴弹:   { x: 1, y: 901,  width: 438, height: 148, sheet: "weapon_type" },            // SingleGrenade
  冲锋枪:     { x: 1, y: 1051, width: 438, height: 148, sheet: "weapon_type" },            // SMG
  狙击步枪:   { x: 1, y: 1201, width: 438, height: 148, sheet: "weapon_type" },            // Sniper
  弓箭:       { x: 441, y: 1,    width: 438, height: 148, sheet: "weapon_type", rotated: true }, // Bow
  射手步枪:   { x: 441, y: 441,  width: 438, height: 148, sheet: "weapon_type", rotated: true }, // DMR
  火箭发射器: { x: 441, y: 881,  width: 438, height: 148, sheet: "weapon_type", rotated: true }, // Launcher
};

// 武器槽位图标（复用武器类型精灵）
export const WEAPON_SLOT_SPRITES: Record<string, SpriteConfig> = {
  主武器:   WEAPON_TYPE_SPRITES["突击步枪"],   // Rifle
  副武器:   WEAPON_TYPE_SPRITES["手枪"],       // Pistol
  近战武器: { x: 591, y: 881, width: 438, height: 148, sheet: "weapon_type", rotated: true }, // Melee
};

// 精灵图路径
export const SPRITE_SHEETS = {
  common: "/spritesheets/common.png",
  hud: "/spritesheets/hud.png",
  weapon_type: "/spritesheets/weapon_type.png",
} as const;
