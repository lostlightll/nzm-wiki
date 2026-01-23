import type { Rarity, ElementType } from "@/types";

// 稀有度筛选选项（用于 Filter 组件）
export const RARITY_OPTIONS: { type: Rarity; color: string }[] = [
  { type: "稀有", color: "text-[#578caf]" },
  { type: "史诗", color: "text-[#ac69b6]" },
  { type: "传说", color: "text-[#d0ab67]" },
];

// 稀有度中文 -> 英文映射
export const RARITY_KEY_MAP: Record<Rarity, string> = {
  普通: "common",
  稀有: "rare",
  史诗: "epic",
  传说: "legendary",
};

// 稀有度背景色（用于标签/徽章）
export const RARITY_BG_COLORS: Record<Rarity, string> = {
  普通: "bg-gray-500",
  稀有: "bg-blue-500",
  史诗: "bg-purple-500",
  传说: "bg-orange-500",
};

// 稀有度卡片样式（用于 Perk 卡片边框等）
export const RARITY_CARD_STYLES: Record<
  string,
  { border: string; bg: string; text: string }
> = {
  common: {
    border: "border-gray-500",
    bg: "bg-gray-900/50",
    text: "text-gray-300",
  },
  rare: {
    border: "border-blue-500",
    bg: "bg-blue-900/50",
    text: "text-blue-300",
  },
  epic: {
    border: "border-purple-500",
    bg: "bg-purple-900/50",
    text: "text-purple-300",
  },
  legendary: {
    border: "border-amber-400",
    bg: "bg-amber-900/50",
    text: "text-amber-300",
  },
};

// 元素类型颜色
export const ELEMENT_COLORS: Record<ElementType, string> = {
  物理: "text-gray-300",
  火焰: "text-orange-400",
  寒冷: "text-cyan-400",
  电弧: "text-yellow-400",
  腐蚀: "text-green-400",
};
