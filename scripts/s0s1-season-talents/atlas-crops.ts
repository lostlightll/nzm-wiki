// Regions visually matched to named nodes in the supplied S0/S1 recording.
// These are reviewed extraction regions, not reconstructed PaperSprite UVs.
export const LEGACY_ATLAS_PATH = "UI/UI_Textures/Icons/Talent/TexGen/T_Talent_0_0.png";
export const LEGACY_ATLAS_PIXEL_HASH = "15fbf50525101c11bc624bd928757e2064e7de3e245dfc6796c2f52e07a9fa1e";

type AtlasReview = { row: number; column: number; nodeId: string; videoSeconds: number };
export const LEGACY_ATLAS_REVIEWS: Record<string, AtlasReview> = {
  T_Talent_0_0_talent_Crit: { row: 5, column: 3, nodeId: "1001201", videoSeconds: 130 },
  T_Talent_0_0_talent_CritDamage: { row: 5, column: 4, nodeId: "1001202", videoSeconds: 130 },
  T_Talent_0_0_talent_bd26: { row: 2, column: 1, nodeId: "1003301", videoSeconds: 60 },
  T_Talent_0_0_talent_bd24: { row: 1, column: 2, nodeId: "1001304", videoSeconds: 140 },
  T_Talent_0_0_talent_bd40: { row: 3, column: 0, nodeId: "1001308", videoSeconds: 140 },
  T_Talent_0_0_talent_bd29: { row: 5, column: 1, nodeId: "1001406", videoSeconds: 180 },
  T_Talent_0_0_talent_bd43: { row: 1, column: 6, nodeId: "1001408", videoSeconds: 180 },
  T_Talent_0_0_talent_FarDamage: { row: 5, column: 7, nodeId: "1001501", videoSeconds: 180 },
  T_Talent_0_0_talent_HP: { row: 5, column: 8, nodeId: "1001502", videoSeconds: 180 },
  T_Talent_0_0_talent_bd60: { row: 3, column: 9, nodeId: "1001506", videoSeconds: 180 },
  T_Talent_0_0_talent_CarryAmmo2: { row: 4, column: 8, nodeId: "1001508", videoSeconds: 180 },
  T_Talent_0_0_talent_bd33: { row: 10, column: 1, nodeId: "1001604", videoSeconds: 180 },
  T_Talent_0_0_talent_bd41: { row: 1, column: 5, nodeId: "1001608", videoSeconds: 180 },
  T_Talent_0_0_talent_bd42: { row: 0, column: 0, nodeId: "1001706", videoSeconds: 190 },
  T_Talent_0_0_talent_bd16: { row: 13, column: 0, nodeId: "1003206", videoSeconds: 5 },
  T_Talent_0_0_talent_skill03: { row: 12, column: 7, nodeId: "1003308", videoSeconds: 60 },
  T_Talent_0_0_talent_bd2: { row: 0, column: 5, nodeId: "1003408", videoSeconds: 60 },
  T_Talent_0_0_talent_MobDamage: { row: 5, column: 9, nodeId: "1003506", videoSeconds: 80 },
  T_Talent_0_0_talent_bd5: { row: 2, column: 5, nodeId: "1003604", videoSeconds: 92 },
  T_Talent_0_0_talent_bd30: { row: 7, column: 1, nodeId: "1003608", videoSeconds: 92 },
  T_Talent_0_0_talent_bd37: { row: 1, column: 3, nodeId: "1003706", videoSeconds: 102 },
};

export function legacyAtlasCrop(review: AtlasReview) {
  return { left: review.column * 260, top: review.row * 258, width: 258, height: 258 };
}
