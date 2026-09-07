export type LegacySeason = "s0" | "s1";

const assetRoot = "/webp/images/season-talents/s0s1/";
export const legacyAsset = (name: string) => `${assetRoot}${name}.webp`;

export const LEGACY_TALENT_CATALOG = [
  { season: "s0", id: "frost-barrage", name: "急冻弹幕", subtitle: "区域控制", color: "#65cde8", icon: "T_SeasonTalent_0_0_SeasonalTalent_IconS0_01", confirmed: true },
  { season: "s0", id: "mechanical-dance", name: "机械之舞", subtitle: "持续进攻", color: "#e2cf68", icon: "T_SeasonTalent_0_0_SeasonalTalent_IconS0_02", confirmed: true },
  { season: "s0", id: "destruction-dream", name: "毁灭之梦", subtitle: "历史配置 · 录像未收录", color: "#a9c6cf", icon: "T_Talent_0_0_talent_Skill_6001103", confirmed: false },
  { season: "s1", id: "kunlun-wood", name: "昆仑神木", subtitle: "强化治疗与增益能力", color: "#78d9aa", icon: "T_TalentCandleTomb_SP_Icon_001", confirmed: true },
  { season: "s1", id: "phantom-form", name: "行境幻化", subtitle: "强化区域控制能力", color: "#ec967b", icon: "T_TalentCandleTomb_SP_Icon_002", confirmed: true },
  { season: "s1", id: "forbidden-eye", name: "禁忌之瞳", subtitle: "强化单体爆发能力", color: "#c298ec", icon: "T_TalentCandleTomb_SP_Icon_003", confirmed: true },
] as const;

export function legacyTalentHref(season: string, id: string) {
  return `/guides/season-talents/${season}/${id}`;
}

export function legacyPresentation(season: string, id: string) {
  return LEGACY_TALENT_CATALOG.find(t => t.season === season && t.id === id);
}
