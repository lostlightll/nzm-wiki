import { NUM_MODIFIER_RESOLVER } from "../../lib/num-modifier-data";
import type { LegacyTalentSeason, LegacyTalentSemanticConflict, LegacyTalentTree } from "../../lib/s0s1-season-talents";

// Targeted human review, not a keyword classifier. Exact identities and parameter values
// guard each finding; changed evidence requires review instead of inheriting the conclusion.
const REVIEWS = [
  { season: "s0", nodeId: "1001308", mgeId: 1319013005, modifierId: 160103003, parameter: "SkillParameterModifiers", value: "((SkillID=6001301,Name=SlowDownID,Value=160103003))", attribute: "GPAttributeSetSpeed.SpeedScale", description: "飞弹发射的间隔减少", meaning: "缩短飞弹发射间隔" },
  { season: "s0", nodeId: "1002206", mgeId: 1319012013, modifierId: 160102004, parameter: "SkillParameterModifiers", value: "((SkillID=6001201,Name=SteelFrame,Value=160102004))", attribute: "GPAttributeSetBearDamageRatio.DamageBearRatio", description: "武器攻击裂口时可造成弱点伤害", meaning: "生成灼热裂口并允许武器造成弱点伤害" },
  { season: "s0", nodeId: "1002704", mgeId: 1319012014, modifierId: 160102009, parameter: "SkillParameterModifiers", value: "((SkillID=6001201,Name=SteelFrame,Value=160102009))", attribute: "GPAttributeSetBearDamageRatio.DamageBearRatio", description: "充能速度提高", meaning: "按聚能提高充能速度" },
  { season: "s1", nodeId: "1012507", mgeId: 1319021010, modifierId: 160201008, parameter: "ModifyID", value: "160201008", attribute: "GPAttributeSetGiveDamageRatio.WeaponSkillDamageRatio", description: "GPModifier:160201016:", meaning: "积攒赤寰后施加减速（描述 Token 指向移动速度）" },
  { season: "s1", nodeId: "1012605", mgeId: 1319021011, modifierId: 160201008, parameter: "ModifyID", value: "160201008", attribute: "GPAttributeSetGiveDamageRatio.WeaponSkillDamageRatio", description: "GPModifier:160201017:", meaning: "换弹后施加减速（描述 Token 指向移动速度）" },
  { season: "s1", nodeId: "1012705", mgeId: 1319021012, modifierId: 160201008, parameter: "ModifyID", value: "160201008", attribute: "GPAttributeSetGiveDamageRatio.WeaponSkillDamageRatio", description: "武器技能充能", meaning: "给友方角色补充武器技能充能" },
  { season: "s1", nodeId: "1012709", mgeId: 1319021015, modifierId: 160201010, parameter: "ModifyID", value: "160201010", attribute: "GPAttributeSetHumanSkill.SeasonSkillChargeSpeed", description: "GPModifier:160201007:", meaning: "按负面状态提高武器技能伤害（描述 Token 指向伤害系数）" },
  { season: "s1", nodeId: "1013207", mgeId: 1319022011, modifierId: 160202006, parameter: "ModifyID", value: "160202006", attribute: "GPAttributeSetCharacterWeaponAdjust.ChangeClipTimeAdjust", description: "弱点伤害增幅", meaning: "按赤瞳提高弱点伤害增幅" },
  { season: "s1", nodeId: "1013305", mgeId: 1319022010, modifierId: 160202006, parameter: "ModifyID", value: "160202006", attribute: "GPAttributeSetCharacterWeaponAdjust.ChangeClipTimeAdjust", description: "GPModifier:160202010:", meaning: "发动射线期间获得伤害减免（描述 Token 指向伤害减免）" },
  { season: "s1", nodeId: "1013409", mgeId: 1319022017, modifierId: 160202008, parameter: "SkillParameterModifiers", value: "((SkillID=6002201,Name=ModifyID_XTHX,Value=160202008))", attribute: "GPAttributeSetGiveDamageRatio.WeaknessDamageRatio", description: "GPModifier:160202005:", meaning: "提高赛季技能充能速度（描述 Token 指向赛季充能）" },
  { season: "s1", nodeId: "1013505", mgeId: 1319022009, modifierId: 160202006, parameter: "ModifyID", value: "160202006", attribute: "GPAttributeSetCharacterWeaponAdjust.ChangeClipTimeAdjust", description: "射线可以穿透", meaning: "射线穿透敌人" },
] as const;

export function reviewSemanticConflict(input: {
  season: LegacyTalentSeason; nodeId: string; level: number; mgeId: number;
  parameters: readonly { Name: string; Value: string }[];
  description: string; parameterSource: string; descriptionSource: string;
}): LegacyTalentSemanticConflict | undefined {
  const review = REVIEWS.find((entry) => entry.season === input.season && entry.nodeId === input.nodeId);
  if (!review) return undefined;
  const parameterIndex = input.parameters.findIndex((parameter) => parameter.Name === review.parameter && parameter.Value === review.value);
  const rows = NUM_MODIFIER_RESOLVER.getRowsById("lc", review.modifierId);
  if (input.mgeId !== review.mgeId || parameterIndex < 0 || !input.description.replace(/<[^>]*>/g, "").includes(review.description) || !rows.length || rows.some((row) => row.attributeName !== review.attribute)) {
    throw new Error(`SEMANTIC_REVIEW_DRIFT: ${input.season}/${input.nodeId}/${input.level}; re-review exact identities, parameters, description and attribute`);
  }
  const label = NUM_MODIFIER_RESOLVER.describeAttribute(review.attribute).label;
  return {
    id: `${input.season}:${input.nodeId}:${input.level}:same-id-semantic-conflict`,
    mgeId: input.mgeId,
    parameterSource: `${input.parameterSource}.Parameters[${parameterIndex}]`,
    descriptionSource: input.descriptionSource,
    modifierRows: rows.filter((row) => row.level === input.level).map((row) => row.key),
    summary: `当前同 ID Main 参数指向「${label}」，描述语义却是「${review.meaning}」，两条证据不对应。仅作为当前同 ID 配置参考，不能认定为旧节点效果；是否发生 ID 复用或改义、具体变更版本尚未确证。`,
  };
}

export function summarizeSemanticReview(trees: readonly LegacyTalentTree[]) {
  return {
    coverage: "targeted-spot-check" as const,
    limitation: "仅对列出的节点做定向抽查；未列出不表示语义一致，所有当前事实均未确认为历史节点效果。",
    reviewedNodeIds: trees.flatMap((tree) => tree.nodes.filter((node) => node.levels.some((level) => level.semanticConflicts?.length)).map((node) => node.id)),
    conflicts: trees.flatMap((tree) => tree.nodes.flatMap((node) => node.levels.flatMap((level) => (level.semanticConflicts ?? []).map((conflict) => ({ treeId: tree.id, nodeId: node.id, nodeName: node.name, level: level.level, ...conflict }))))),
  };
}
