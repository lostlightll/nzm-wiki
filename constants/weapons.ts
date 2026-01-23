import type { WeaponType, ElementType, Rarity, WeaponStats } from "@/types";

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

export const ELEMENT_TYPES: { type: ElementType; icon: string; color: string }[] = [
  { type: "火焰", icon: "🔥", color: "text-orange-400" },
  { type: "寒冷", icon: "❄️", color: "text-cyan-400" },
  { type: "电弧", icon: "⚡", color: "text-yellow-400" },
  { type: "腐蚀", icon: "☣️", color: "text-green-400" },
  { type: "物理", icon: "✧", color: "text-gray-300" },
];

export const RARITY_TYPES: { type: Rarity; color: string }[] = [
  { type: "稀有", color: "text-[#578caf]" },
  { type: "史诗", color: "text-[#ac69b6]" },
  { type: "传说", color: "text-[#d0ab67]" },
];

export const RARITY_COLORS: Record<Rarity, string> = {
  普通: "bg-gray-500",
  稀有: "bg-blue-500",
  史诗: "bg-purple-500",
  传说: "bg-orange-500",
};

export const ELEMENT_COLORS: Record<ElementType, string> = {
  物理: "text-gray-300",
  火焰: "text-orange-400",
  寒冷: "text-cyan-400",
  电弧: "text-yellow-400",
  腐蚀: "text-green-400",
};

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
