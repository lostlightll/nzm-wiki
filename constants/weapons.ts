import type { WeaponType, WeaponStats } from "@/types";
import { ELEMENT_COLORS } from "./common";

export { ELEMENT_COLORS };
export { RARITY_OPTIONS, RARITY_BG_COLORS } from "./common";

export const WEAPON_TYPES: { type: WeaponType; icon: string }[] = [
  { type: "突击步枪", icon: "🔫" },
  { type: "狙击步枪", icon: "🎯" },
  { type: "霰弹枪", icon: "💥" },
  { type: "火箭发射器", icon: "🚀" },
  { type: "冲锋枪", icon: "⚡" },
  { type: "机枪", icon: "🔥" },
  { type: "手枪", icon: "🔫" },
  { type: "单发榴弹", icon: "💣" },
  { type: "弓箭", icon: "🏹" },
  { type: "射手步枪", icon: "🎯" },
  { type: "连发榴弹", icon: "💣" },
  { type: "喷火器", icon: "🔥" },
];

export const ELEMENT_TYPES: { type: keyof typeof ELEMENT_COLORS; icon: string; color: string }[] = [
  { type: "火焰", icon: "🔥", color: ELEMENT_COLORS["火焰"] },
  { type: "寒冷", icon: "❄️", color: ELEMENT_COLORS["寒冷"] },
  { type: "电弧", icon: "⚡", color: ELEMENT_COLORS["电弧"] },
  { type: "腐蚀", icon: "☣️", color: ELEMENT_COLORS["腐蚀"] },
  { type: "物理", icon: "✧", color: ELEMENT_COLORS["物理"] },
];

export const STAT_FIELDS: {
  label: string;
  key: keyof WeaponStats;
  suffix?: string;
}[] = [
  { label: "单发伤害", key: "damage" },
  { label: "射速", key: "fireRate" },
  { label: "弹夹", key: "magazine" },
  { label: "总弹量", key: "totalAmmo" },
  { label: "精准度", key: "accuracy" },
  { label: "稳定度", key: "stability" },
  { label: "弱点倍率", key: "weaknessMultiplier", suffix: "x" },
];
