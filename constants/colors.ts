// 文字颜色
export const TEXT_COLORS = {
  red: "#cf5148",
  yellow: "#cb9434",
  green: "#50946e",
  grey: "#7d7a75",
  orange: "#d27b2d",
  brown: "#9f765a",
  blue: "#387dc9",
  purple: "#9a6bb4",
  pink: "#c14c8a",
  // 元素属性
  fire: "#f8c618",
  ice: "#90f5ff",
  shock: "#a09eff",
  corrosive: "#c3db2a",
  kinetic: "#becacc",
} as const;

// 荧光笔高亮颜色
export const HIGHLIGHT_COLORS = {
  sunny: "#faeb7b",
  peach: "#f6c9b6",
  cyan: "#bee2dc",
  violet: "#b8bcfa",
  magenta: "#e9b5fa",
  hazy: "#d3d3d3",
} as const;

// Callout 加粗颜色
export const CALLOUT_BOLD_COLOR = "#baa24a";

export type TextColor = keyof typeof TEXT_COLORS;
export type HighlightColor = keyof typeof HIGHLIGHT_COLORS;
