import type { OverlimitBondName } from "@/types";

/** Shared by display and version capture so archived bonds retain their artwork. */
export const OVERLIMIT_BOND_ICON_PATHS: Partial<Record<OverlimitBondName, string>> = {
  弹药: "/icons/overlimit/sets/T_Icons_Rogue_Munition.png",
  技战: "/icons/overlimit/sets/T_Icons_Rogue_Skill.png",
  异化: "/icons/overlimit/sets/T_Icons_Rogue_Anomaly.png",
  游击: "/icons/overlimit/sets/T_Icons_Rogue_Guerrilla.png",
  壁垒: "/icons/overlimit/sets/T_Icons_Rogue_Survival.png",
  狙击: "/icons/overlimit/sets/T_Icons_Rogue_Precision.png",
  爆韧: "/icons/overlimit/sets/T_Icons_Rogue_Demolition.png",
  共振: "/icons/overlimit/sets/T_Icons_Rogue_Support.png",
  狂战: "/icons/overlimit/sets/T_Icons_Rogue_Frenzy.png",
  狩猎: "/icons/overlimit/sets/T_Icons_Rogue_grow.png",
  叠叠乐: "/icons/overlimit/sets/T_Icons_Rogue_Lamination_.png",
  瞬暴: "/icons/overlimit/sets/T_Icons_Rogue_Critical.png",
  力场: "/icons/overlimit/sets/T_Icons_Rogue_Stan.png",
};
