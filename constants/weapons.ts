import type { WeaponType } from "@/types";
import { ELEMENT_COLORS } from "./common";

export { ELEMENT_COLORS };
export { RARITY_OPTIONS, RARITY_BG_COLORS } from "./common";

export const WEAPON_TYPES: { type: WeaponType; icon: string }[] = [
  { type: "突击步枪", icon: "" },
  { type: "狙击步枪", icon: "" },
  { type: "霰弹枪", icon: "" },
  { type: "火箭发射器", icon: "" },
  { type: "冲锋枪", icon: "" },
  { type: "机枪", icon: "" },
  { type: "手枪", icon: "" },
  { type: "单发榴弹", icon: "" },
  { type: "弓箭", icon: "" },
  { type: "射手步枪", icon: "" },
  { type: "连发榴弹", icon: "" },
  { type: "喷火器", icon: "" },
];

export const ELEMENT_TYPES: { type: keyof typeof ELEMENT_COLORS; iconSrc: string; color: string }[] = [
  { type: "火焰", iconSrc: "/icons/elements/fire.png", color: ELEMENT_COLORS["火焰"] },
  { type: "寒冷", iconSrc: "/icons/elements/cryo.png", color: ELEMENT_COLORS["寒冷"] },
  { type: "电弧", iconSrc: "/icons/elements/shock.png", color: ELEMENT_COLORS["电弧"] },
  { type: "腐蚀", iconSrc: "/icons/elements/corossive.png", color: ELEMENT_COLORS["腐蚀"] },
  { type: "物理", iconSrc: "/icons/elements/kinetic.png", color: ELEMENT_COLORS["物理"] },
];
