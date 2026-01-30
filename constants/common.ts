import type { Rarity, ElementType } from "@/types";

// 稀有度数字 -> 中文映射
export const RARITY_NUM_MAP: Record<number, Rarity> = {
  1: "稀有",
  2: "史诗",
  3: "传说",
};

// 稀有度筛选选项（用于 Filter 组件）
export const RARITY_OPTIONS: { type: Rarity; color: string }[] = [
  { type: "稀有", color: "text-[#5589ab]" },
  { type: "史诗", color: "text-[#a65aae]" },
  { type: "传说", color: "text-[#d1ac69]" },
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
  稀有: "bg-[#5589ab]",
  史诗: "bg-[#a65aae]",
  传说: "bg-[#d1ac69]",
};

// 稀有度卡片样式（用于 Perk 卡片边框等）
export const RARITY_CARD_STYLES: Record<
  string,
  { border: string; bg: string; text: string }
> = {
  common: {
    border: "border-gray-600/50",
    bg: "bg-gray-700/20",
    text: "text-gray-300",
  },
  rare: {
    border: "border-[#5589ab]/60",
    bg: "bg-[#5589ab]/10",
    text: "text-[#5589ab]",
  },
  epic: {
    border: "border-[#a65aae]/60",
    bg: "bg-[#a65aae]/10",
    text: "text-[#a65aae]",
  },
  legendary: {
    border: "border-[#d1ac69]/60",
    bg: "bg-[#d1ac69]/10",
    text: "text-[#d1ac69]",
  },
};

// 元素类型颜色
export const ELEMENT_COLORS: Record<ElementType, string> = {
  物理: "text-gray-300",
  火焰: "text-[#f8c618]",
  寒冷: "text-[#90f5ff]",
  电弧: "text-[rgb(160,158,255)]",
  腐蚀: "text-[#c3db2a]",
};
