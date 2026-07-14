import type { Rarity, ElementType, EnemyType } from "@/types";

// 稀有度数字 -> 中文映射
export const RARITY_NUM_MAP: Record<number, Rarity> = {
  1: "稀有",
  2: "史诗",
  3: "传说",
};

// 稀有度筛选选项（用于 Filter 组件）
export const RARITY_OPTIONS: { type: Rarity; color: string }[] = [
  { type: "传说", color: "text-[#d1ac69]" },
  { type: "史诗", color: "text-[#a65aae]" },
  { type: "稀有", color: "text-[#5589ab]" },
];

// 稀有度排序权重（值越大越靠前）
export const RARITY_ORDER: Record<Rarity, number> = {
  稀有: 1,
  史诗: 2,
  传说: 3,
};

// 稀有度中文 -> 英文映射
export const RARITY_KEY_MAP: Record<Rarity, string> = {
  稀有: "rare",
  史诗: "epic",
  传说: "legendary",
};

// 稀有度背景色（用于标签/徽章）
export const RARITY_BG_COLORS: Record<Rarity, string> = {
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

// 敌人类型卡片样式
export const ENEMY_CARD_STYLES: Record<
  EnemyType,
  {
    border: string;
    bg: string;
    text: string;
    label: string;
    hoverBorder: string;
    hoverBg: string;
    hoverShadow: string;
    hoverText: string;
    divider: string;
  }
> = {
  normal: {
    border: "border-gray-600/30",
    bg: "bg-gray-600/5",
    text: "text-gray-300",
    label: "普通",
    hoverBorder: "hover:border-gray-500/80",
    hoverBg: "hover:bg-gray-600/10",
    hoverShadow: "hover:shadow-[0_0_20px_-5px_rgba(156,163,175,0.2)]",
    hoverText: "group-hover:text-gray-300",
    divider: "border-gray-600/10",
  },
  elite: {
    border: "border-[#a65aae]/30",
    bg: "bg-[#a65aae]/5",
    text: "text-[#a65aae]",
    label: "精英",
    hoverBorder: "hover:border-[#a65aae]/80",
    hoverBg: "hover:bg-[#a65aae]/10",
    hoverShadow: "hover:shadow-[0_0_20px_-5px_rgba(166,90,174,0.2)]",
    hoverText: "group-hover:text-[#a65aae]",
    divider: "border-[#a65aae]/10",
  },
  boss: {
    border: "border-[#d1ac69]/30",
    bg: "bg-[#d1ac69]/5",
    text: "text-[#d1ac69]",
    label: "首领",
    hoverBorder: "hover:border-[#d1ac69]/80",
    hoverBg: "hover:bg-[#d1ac69]/10",
    hoverShadow: "hover:shadow-[0_0_20px_-5px_rgba(209,172,105,0.2)]",
    hoverText: "group-hover:text-[#d1ac69]",
    divider: "border-[#d1ac69]/10",
  },
};

// 敌人光晕颜色
export const ENEMY_GLOW_COLOR: Record<EnemyType, string> = {
  normal: "from-gray-400/20",
  elite: "from-[#a65aae]/20",
  boss: "from-[#d1ac69]/20",
};
