import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { NUM_MODIFIER_RESOLVER as resolver } from "../../lib/num-modifier-data";
import type { NumModifierValueExpression } from "../../lib/num-modifier";
import { readRangeEvidence, reviewRangeValue, type RangeEvidence } from "./range-values";

/** Offline review only. Current Main identity is not proof of historical behavior. */
export const S0_REVIEW_PATHS = {
  basic: "DataTables/SeasonTalent/SeasonTalentBasicTable.json",
  structure1: "DataTables/SeasonTalent/SeasonTalentStructure1Table.json",
  structure3: "DataTables/SeasonTalent/SeasonTalentStructure3Table.json",
  passive: "DataTables/MGE/MGEPassiveMainTable.json",
  params: "DataTables/MGE/DT_MGEParamConfig_Main.json",
  mgeDescriptions: "DataTables/MGE/DT_GPMGESkillDesConfigTable_Main.json",
  mgeClasses: "DataTables/MGE/GPModularGameplayEffectTable.json",
  skillDescriptions: "DataTables/Ability/DT_SkillDesConfig_Main.json",
  activeSkills: "DataTables/GPActiveSkillDataTable.json",
  numerical: "DataTables/numerical_config_playerskill.json",
  query: "DataTables/AlwaysCook/GPFuncQueryDataTable.json",
  loadConfig: "DataTables/MainDataTablesLoadConfig.json",
} as const;
type Table = keyof typeof S0_REVIEW_PATHS;
export interface S0ReviewEvidence {
  season: "s0";
  tables: Record<Table, Record<string, unknown>>;
  sources?: readonly { path: string; sha256: string }[];
  range?: RangeEvidence;
  armBlueprint?: {
    asset: Record<string, unknown>;
    skill: Record<string, unknown>;
    sources: { path: string; sha256: string }[];
  };
}
export interface S0ValueInput { nodeId: string; level: number; skillIds: readonly number[] }
export interface S0EvidenceStep { source: string; value: unknown }
export interface S0ValueProvenance {
  id: string;
  originalText: string;
  originalValue: string;
  /** Offset in tag-stripped originalText, not in the generated template. */
  offset: number;
  semantic: string;
  status: "resolved" | "missing";
  reason: string;
  source: string;
  chain: S0EvidenceStep[];
  expression?: NumModifierValueExpression;
  structuredValue?: number;
  replacement?: string;
  historicalEffectStatus: "unverified";
  evidenceKind?: "description-token-only";
}
export interface S0ValueReview {
  nodeId: string;
  level: number;
  descriptionTemplate: string;
  descriptionBindings: Record<string, NumModifierValueExpression>;
  provenance: S0ValueProvenance[];
  resolvedCount: number;
  remaining: number;
  issues: string[];
  valueReview: {
    sources: string[];
    notes: string[];
    applications: Array<{ expression: NumModifierValueExpression; context: { recipient: "self" } }>;
  };
  indexedApplications: Array<{
    expression: NumModifierValueExpression;
    context: { recipient: "self" };
    source: string;
    provenanceId: string;
    historicalEffectStatus: "unverified";
  }>;
}

const basicSchema = z.object({ UniqueID: z.number(), SeasonID: z.literal(1), SeasonPhaseID: z.literal(0),
  TalentID: z.number(), TalentILevel: z.number(), TalentType: z.number(), PhaseID: z.number(), ColumnID: z.number(),
  TalentSkillsID: z.number(), AttributeSkillsID: z.number(), SeasonSkill: z.number() });
const passiveSchema = z.object({ PassiveSkillID: z.number(), PassiveSkillLevel: z.string(),
  MGE: z.object({ Name: z.literal("MGE"), Id: z.string() }),
  MGEConfig: z.object({ Name: z.literal("MGEConfig"), Id: z.string() }), MGEDescriptionId: z.number() });
const textSchema = z.object({ LocalizedString: z.string().optional(), SourceString: z.string().optional() });
const descriptionSchema = z.object({ MGEId: z.number(), TextID: z.number(), MGEDescription: textSchema });
const parameterSchema = z.object({ Type: z.string(), Name: z.string(), Value: z.string() });
const configSchema = z.object({ ConfigId: z.number(), Parameters: z.array(parameterSchema) });
const localText = (raw: unknown) => { const t = textSchema.parse(raw); return t.LocalizedString ?? t.SourceString ?? ""; };
const at = (table: Table, row: string, field: string) => `NZM/Content/${S0_REVIEW_PATHS[table]}#${row}.${field}`;
const step = (table: Table, row: string, field: string, value: unknown): S0EvidenceStep => ({ source: at(table, row, field), value });
const plainText = (s: string) => s.replace(/<br\s*\/?\s*>/gi, "\n").replace(/<[^>]*>/g, "");
const quantities = () => /\{[^{}]*\}|[+-]?\d+(?:\.\d+)?[%％]?|[零〇一二两三四五六七八九十百千万半]+(?=[个枚颗发层次秒米点种倍])/g;
const UNVERIFIED = "〔数值待核实〕";
const ARM_PATH = "Abilities/Skills/Season/S1/HeavyMachineGunMode3P";
const ARM_ASSET = "DA_S1_HeavyMachineGunMode3P";
const ARM_SKILL = "SKT_S1_HeavyMachineGunMode3P";

function readArmBlueprint(root: string): NonNullable<S0ReviewEvidence["armBlueprint"]> {
  const sources: { path: string; sha256: string }[] = [];
  const read = (file: string, name: string) => {
    const path = `${ARM_PATH}/${file}.json`;
    const bytes = readFileSync(join(root, "refs/Exports/NZM/Content", path));
    const objects = z.array(z.object({ Name: z.string() }).passthrough()).parse(JSON.parse(bytes.toString("utf8")));
    const matches = objects.filter(object => object.Name === name);
    if (matches.length !== 1) fail(`arm blueprint object ${name}`);
    sources.push({ path: `NZM/Content/${path}`, sha256: createHash("sha256").update(bytes).digest("hex") });
    return matches[0];
  };
  return { asset: read(ARM_ASSET, ARM_ASSET), skill: read(ARM_SKILL, `Default__${ARM_SKILL}_C`), sources };
}

function reviewArmBlueprint(skillId: number, level: number, slot: number, shape: string, evidence: S0ReviewEvidence) {
  if (!evidence.armBlueprint) return;
  const field = skillId === 1318105001 && slot === 1 && shape === RULES[1318105001].shape
    ? "MGE_1318105001_SmallPeriodLaunchNum"
    : skillId === 1318111001 && slot === 0 && shape === RULES[1318111001].shape
      ? "MGE_1318111001_DeathMomentPlus_LaunchLargeInterval"
      : skillId === 1318115001 && level === 1 && slot < 2 && shape === "释放机械之舞时，每有#层聚能状态，机械之舞时间延长#秒。"
        ? "MGE_1318115001_DeathMoment_AddDuration" : undefined;
  if (!field) return;
  const active = z.object({ AbilityID: z.literal(6001401), AbilityAssetSoftPath: z.object({ AssetPathName: z.literal(`/Game/${ARM_PATH}/${ARM_ASSET}.${ARM_ASSET}`) }) }).parse(evidence.tables.activeSkills["6001401"]);
  const asset = z.object({ Name: z.literal(ARM_ASSET), Properties: z.object({ AbilityBlueprint: z.object({ ObjectPath: z.literal(`NZM/Content/${ARM_PATH}/${ARM_SKILL}.99`) }) }) }).parse(evidence.armBlueprint.asset);
  const skill = z.object({ Name: z.literal(`Default__${ARM_SKILL}_C`), Type: z.literal(`${ARM_SKILL}_C`), Properties: z.object({ SkillID: z.literal(6001401) }).catchall(z.unknown()) }).parse(evidence.armBlueprint.skill);
  const value = z.number().finite().nonnegative().parse(skill.Properties[field]);
  if (skillId === 1318115001) {
    const passive = passiveSchema.parse(evidence.tables.passive[`${skillId}_1`]);
    if (passive.MGEConfig.Id !== "1318115001") fail("arm duration config identity");
    const config = configSchema.parse(evidence.tables.params["1318115001"]);
    if (config.Parameters.length) fail("arm duration has unreviewed parameter override");
    z.object({ MGEId: z.literal(1318115001), MGEClass: z.object({ AssetPathName: z.literal("/Game/Abilities/Build/CBT3/Season/HeavyMachineGun/MGE_1318115001.MGE_1318115001_C") }) }).parse(evidence.tables.mgeClasses["1318115001"]);
  }
  return { value: skillId === 1318115001 && slot === 0 ? 1 : value, field, chain: [
    step("activeSkills", "6001401", "AbilityAssetSoftPath", active.AbilityAssetSoftPath),
    { source: `NZM/Content/${ARM_PATH}/${ARM_ASSET}.json#${ARM_ASSET}.Properties.AbilityBlueprint`, value: asset.Properties.AbilityBlueprint },
    { source: `NZM/Content/${ARM_PATH}/${ARM_SKILL}.json#${skill.Name}.Properties.SkillID`, value: skill.Properties.SkillID },
    { source: `NZM/Content/${ARM_PATH}/${ARM_SKILL}.json#${skill.Name}.Properties.${field}`, value },
  ] };
}

// Explicit Basic identities, including every selected level. No ID arithmetic or name joins.
const NODES: Record<string, readonly [number, number]> = {
  "1001106": [6001301, 1], "1001201": [1701000101, 1], "1001202": [1701000102, 1], "1001206": [1319013012, 3],
  "1001301": [1319014005, 1], "1001302": [1701000104, 1], "1001304": [1319013008, 2], "1001306": [1319013009, 1], "1001308": [1319013005, 3],
  "1001401": [1319014002, 1], "1001402": [1701000106, 1], "1001404": [1319013002, 2], "1001406": [1319013016, 3], "1001408": [1319013014, 1],
  "1001501": [1701000103, 1], "1001502": [1319014001, 1], "1001504": [1319013010, 2], "1001506": [1319013006, 1], "1001508": [1319013007, 2],
  "1001601": [1701000105, 1], "1001602": [1319014004, 1], "1001604": [1319013011, 2], "1001608": [1319013003, 2],
  "1001704": [1319013013, 3], "1001706": [1319013015, 1], "1001708": [1319013004, 2],
  "1003106": [6001401, 1], "1003201": [1701000101, 1], "1003202": [1701000102, 1], "1003206": [1318103001, 3],
  "1003301": [1319014005, 1], "1003302": [1701000104, 1], "1003304": [1318106001, 1], "1003306": [1318105001, 3], "1003308": [1318107001, 3],
  "1003401": [1319014002, 1], "1003402": [1701000106, 1], "1003404": [1318102001, 3], "1003406": [1318124001, 1], "1003408": [1318123001, 2],
  "1003501": [1701000103, 1], "1003502": [1319014001, 1], "1003504": [1318114001, 3], "1003506": [1318110001, 1], "1003508": [1318101001, 2],
  "1003601": [1701000105, 1], "1003602": [1319014004, 1], "1003604": [1318111001, 2], "1003608": [1318115001, 1],
  "1003704": [1318117001, 1], "1003706": [1318116001, 2], "1003708": [1318122001, 2],
};

interface BindingRule {
  slot: number;
  parameter: string;
  /** Denominator of a reviewed per-layer/per-second parameter, not a description literal. */
  unitBasis?: "layer" | "second";
  tuple?: { skillId: number; name: string };
  semantic: string;
  percent?: boolean;
  modifier?: { ids: readonly number[]; attribute: string; indexable?: boolean };
}
interface ReviewRule { shape: string; configs: readonly number[]; bindings: readonly BindingRule[] }
const tuple = (slot: number, name: string, semantic: string, skillId = 6001301, percent = false): BindingRule =>
  ({ slot, parameter: "SkillParameterModifiers", tuple: { skillId, name }, semantic, percent });
const scalar = (slot: number, parameter: string, semantic: string): BindingRule => ({ slot, parameter, semantic });
const common = (shape: string, id: number, attribute: string, slot = 0, indexable = false): ReviewRule => ({
  shape, configs: [id], bindings: [{ slot, parameter: "CharacterModifierList", semantic: shape,
    modifier: { ids: [id], attribute, indexable } }],
});
const RULES: Record<number, ReviewRule> = {
  1701000101: common("暴击率提高#。", 1701000101, "GPAttributeSetCritical.CriticalRatio"),
  1701000102: common("暴击伤害增幅提高#。", 1701000102, "GPAttributeSetCritical.CriticalDamageRatio", 0, true),
  1701000103: common("弱点伤害增幅提高#。", 1701000103, "GPAttributeSetGiveDamageRatio.WeaknessDamageRatio", 0, true),
  1701000104: common("暴击率提高#。", 1701000104, "GPAttributeSetCritical.CriticalRatio"),
  1701000105: common("武器对#米内的敌人造成的伤害提高#。", 1701000105, "GPAttributeSetGiveDamageRatio.CloseRangeDamageRatio", 1, true),
  1701000106: common("武器对#米外的敌人造成的伤害提高#。", 1701000106, "GPAttributeSetGiveDamageRatio.LongRangeDamageRatio", 1, true),
  1319013002: { shape: "技能发动期间获得#伤害减免。", configs: [1319013001, 1319013002], bindings: [
    { ...tuple(0, "SteelFrame", "技能期间伤害减免"), modifier: { ids: [160102004, 160102009], attribute: "GPAttributeSetBearDamageRatio.DamageBearRatio" } },
  ] },
  1319013003: { shape: "释放技能时，每有#层聚能，技能的持续时间额外增加#秒。", configs: [1319013003, 1319013004], bindings: [
    { ...tuple(0, "TimePerLayer", "TimePerLayer 的单位基数：每层聚能"), unitBasis: "layer" },
    tuple(1, "TimePerLayer", "每层聚能增加技能持续时间"),
  ] },
  1319013005: { shape: "飞弹发射的间隔减少#秒。", configs: [1319013007, 1319013008, 1319013009], bindings: [tuple(0, "FireInternal", "飞弹发射间隔减少量（秒）")] },
  1319013007: { shape: "技能期间每命中#名敌人，提升#秒技能持续时间，最多触发#次。", configs: [1319013010, 1319013011], bindings: [tuple(1, "TimePerLayer2", "命中增加技能持续时间（秒）")] },
  1319013010: { shape: "取消技能后，根据所剩时间返还一定的技能充能，每剩余#秒，返还#充能。", configs: [1319013014, 1319013015], bindings: [
    { ...tuple(0, "RestorePerSec", "RestorePerSec 的单位基数：每秒"), unitBasis: "second" },
    tuple(1, "RestorePerSec", "每剩余秒返还的充能比例", 6001301, true),
  ] },
  1319013011: { shape: "技能持续时间内，获得临时可用的突进能力，可使用#次。", configs: [1319013016, 1319013017], bindings: [scalar(0, "UseNum", "突进可用次数")] },
  1318101001: { shape: "获得“聚能”要求的武器命中次数降低#。", configs: [1318101001, 1318101002], bindings: [scalar(0, "ModifyEachStrength", "聚能命中要求减少量")] },
  1318102001: { shape: "释放赛季技能时，每拥有#层聚能状态，额外增加机械臂#秒持续时间。", configs: [1318102001, 1318102002, 1318102003], bindings: [
    { ...tuple(0, "MGE_1318102001_AddDuration", "已审定每层聚能持续时间参数的单位基数", 6001401), unitBasis: "layer" },
    tuple(1, "MGE_1318102001_AddDuration", "每层聚能增加机械臂持续时间（秒）", 6001401),
  ] },
  1318103001: { shape: "机械臂造成的伤害提高#。", configs: [1318103001, 1318103002, 1318103003], bindings: [
    { ...scalar(0, "ModifierId", "机械臂伤害增幅；接收者及运行时应用范围未独立确认，不进入索引"), modifier: { ids: [160101001, 160101002, 160101003], attribute: "GPAttributeSetGiveDamageRatio.AllDamageRatio" } },
  ] },
  1318105001: { shape: "机械臂展开后，武器射击每命中#次，释放#枚飞弹，造成#攻击力伤害。", configs: [1318105001, 1318105002, 1318105003], bindings: [scalar(0, "CheckNum", "武器命中触发次数")] },
  1318106001: { shape: "聚能上限增加#层。", configs: [1318106001], bindings: [scalar(0, "AddNum", "聚能层数上限增加量")] },
  1318111001: { shape: "机械之舞持续期间，每#秒向敌人释放#枚飞弹，造成#攻击力伤害。", configs: [1318111001, 1318111002], bindings: [tuple(1, "MGE_1318111001_DeathMoment_SmallPeriodLaunchNum", "机械之舞飞弹数量", 6001401)] },
  1318122001: { shape: "使用武器技能后，增加#层聚能状态。", configs: [1318122001, 1318122002], bindings: [scalar(0, "addSkillStregth", "使用武器技能增加聚能层数")] },
  1318124001: { shape: "技能结束时，获得死神时刻增益，持续#秒；\n死神时刻：武器射击每命中#次，机械臂发射#枚导弹，造成#攻击力伤害。", configs: [1318124001], bindings: [scalar(1, "CheckHitNumber", "死神时刻武器命中触发次数")] },
};

const REVIEWED_CLASSES: Record<number, string> = {
  1319013002: "/Script/GameFramework.GeneralMGE_SkillParametersModify",
  1319013003: "/Script/GameFramework.GeneralMGE_SkillParametersModify",
  1319013005: "/Script/GameFramework.GeneralMGE_SkillParametersModify",
  1319013007: "/Script/GameFramework.GeneralMGE_SkillParametersModify",
  1319013010: "/Script/GameFramework.GeneralMGE_SkillParametersModify",
  1319013011: "/Game/Abilities/Skills/Season/S1/BombingMode/MGE/MGE_1319013011.MGE_1319013011_C",
  1318101001: "/Game/Abilities/Build/CBT3/Season/HeavyMachineGun/MGE_1318101001.MGE_1318101001_C",
  1318102001: "/Script/GameFramework.GeneralMGE_SkillParametersModify",
  1318103001: "/Game/Abilities/Build/CBT3/Season/HeavyMachineGun/MGE_1318103001.MGE_1318103001_C",
  1318105001: "/Game/Abilities/Build/CBT3/Season/HeavyMachineGun/MGE_1318105001.MGE_1318105001_C",
  1318106001: "/Game/Abilities/Build/CBT3/Season/HeavyMachineGun/MGE_1318106001.MGE_1318106001_C",
  1318111001: "/Script/GameFramework.GeneralMGE_SkillParametersModify",
  1318122001: "/Game/Abilities/Build/CBT3/Season/HeavyMachineGun/MGE_1318122001.MGE_1318122001_C",
  1318124001: "/Game/Abilities/Build/CBT3/Season/HeavyMachineGun/MGE_1318124001.MGE_1318124001_C",
  2001004001: "/Script/GameFrameWork.MGE_2001004001_GeneralPropertyInit",
};

const LIMITATIONS: Record<number, string> = {
  1319014001: "Passive 的 MGEConfig=None；Common/MGE_1319014001 蓝图导出缺失，恢复比例未绑定。",
  1319014004: "Passive 的 MGEConfig=None；Common/MGE_1319014004 蓝图导出缺失，范围与眩晕时间未绑定。",
  1319014005: "Passive 的 MGEConfig=None；Common/MGE_1319014005 蓝图导出缺失，按元素状态增加暴击的链未绑定。",
  1319013008: "Ratio 参数已定位，但爆炸范围消费字段及单位未确认；不能仅凭同值把通用 Ratio 解释成范围增幅。",
  1319013016: "TimeNormal/TimeSpecial 已定位；武器分类到 TimeSpecial 的消费分支未导出，不能只凭数值相同选择。",
  1319013012: "LuoShuang 参数只给档位；持续时间及技能执行链缺失。仅精确白名单 GPNumericalID 可展示 token-only 结构值；其余数量不绑定。",
  1319013013: "IceRoad 参数只给档位；持续时间及技能执行链缺失。仅精确白名单 GPNumericalID 可展示 token-only 结构值；其余数量不绑定。",
  1318107001: "BaseMinSpeedFireInterval 是间隔绝对值；基础射速、最终射速公式及改动范围未确证，不能换算描述百分比。",
  1318114001: "精确等级 Config.NumericalID 指向 HealthThenShieldPercentRecover（生命/护盾恢复），不是描述中的移速；禁止转绑或以描述值补齐。",
  1318123001: "一级 Config 参数为空，二级 Config 缺失，MGE_1318123001 蓝图导出缺失；增伤、层数和持续时间均未绑定。",
  1318110001: "DeathMomentAOENumericalID 已定位，但 Main 的 MGEClass 指向 MGE_1318110002；该蓝图发射 Perk 投射物，旧机械之舞语义与当前执行链不能直接合并。",
  1318115001: "Config 参数为空；技能 CDO 有 MGE_1318115001_DeathMoment_AddDuration=0.1，但缺本 MGE 消费蓝图，不能将默认字段直接认定为节点效果。",
  1318116001: "MGE_1318116001_MissileCount=300/225 已定位，但字段名与射速阈值语义不等价，换算/触发逻辑未导出；不以同值绑定。",
};

/** Reads only the official Content exports. Does not write data or amend extract evidence. */
export function readS0ReviewEvidence(root = process.cwd()): S0ReviewEvidence {
  const tables = {} as S0ReviewEvidence["tables"];
  const sources: { path: string; sha256: string }[] = [];
  for (const [name, path] of Object.entries(S0_REVIEW_PATHS) as [Table, string][]) {
    const bytes = readFileSync(join(root, "refs/Exports/NZM/Content", path));
    const exports = z.array(z.object({ Rows: z.record(z.string(), z.unknown()).optional() })).parse(JSON.parse(bytes.toString("utf8")));
    const rows = exports.filter((entry) => entry.Rows);
    if (rows.length !== 1) throw new Error(`S0_REVIEW_TABLE: ${path}: expected one Rows export`);
    tables[name] = rows[0].Rows!;
    sources.push({ path: `NZM/Content/${path}`, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
  return { season: "s0", tables, sources, range: readRangeEvidence(root), armBlueprint: readArmBlueprint(root) };
}

function fail(message: string): never { throw new Error(`S0_REVIEW_DRIFT: ${message}`); }

// Explicit display references, not a skill execution chain or Modifier identity.
const FROST_TOKENS: Record<number, { ids: readonly number[]; shape: string }> = {
  1319013012: { ids: [160103007, 160103008, 160103009], shape: "每波飞弹发射时，将在目标位置生成一片寒冰区域，持续#秒，对区域内的敌人造成#攻击力的寒冷伤害，并有#概率造成冰缓异常效果。" },
  1319013013: { ids: [160103010, 160103011, 160103012], shape: "动能推进后，路径上会留下一段冰霜路径，持续#秒，对区域内的敌人造成#攻击力的寒冷伤害，并有#概率造成冰缓异常效果。" },
};

function reviewFrostToken(skillId: number, level: number, slot: number, text: string, token: string, evidence: S0ReviewEvidence) {
  const allow = FROST_TOKENS[skillId];
  const field = slot === 1 ? "HpCalScale" : slot === 2 ? "ElementAddRate" : undefined;
  if (!allow || !field || text.replace(quantities(), "#") !== allow.shape) return;
  const id = allow.ids[level - 1];
  if (token !== `{GPNumericalID:${id}:${field}:13}`) return;
  const matches = Object.entries(evidence.tables.numerical).filter(([, raw]) => z.record(z.string(), z.unknown()).parse(raw).id === id);
  if (matches.length !== 1 || matches[0][0] !== `${id}_${level}`) return;
  const [key, raw] = matches[0];
  const parsed = z.object({ id: z.literal(id), Level: z.literal(level),
    Settlements: z.tuple([
      z.object({ TagName: z.literal("Numerical.SettlementType.Element.ElementPointAdd") }),
      z.object({ TagName: z.literal("Numerical.SettlementType.Health.SkillDamage") }),
      z.object({ TagName: z.literal("None") }),
    ]), ElementType: z.literal("EElementEffectType::EDamageType_Cryo"),
    HpCalScale: z.number().finite().nonnegative(), ElementAddRate: z.number().finite().min(0).max(1),
    HpCalBase: z.literal(0), HpFloatCoef: z.literal(0),
  }).safeParse(raw);
  if (!parsed.success) return;
  const row = parsed.data;
  return { value: row[field], field, chain: [
    step("numerical", key, "id", row.id), step("numerical", key, "Level", row.Level),
    step("numerical", key, "Settlements", row.Settlements), step("numerical", key, "ElementType", row.ElementType),
    step("numerical", key, "HpCalBase", row.HpCalBase), step("numerical", key, "HpFloatCoef", row.HpFloatCoef),
    step("numerical", key, field, row[field]),
  ] };
}

function routingEvidence(evidence: S0ReviewEvidence): S0EvidenceStep[] {
  const routes = [
    ["MGE", "GlobalMGETable", "GPModularGameplayEffectTable"],
    ["MGEConfig", "GlobalMGEConfigTable", "DT_MGEParamConfig_Main"],
    ["MGEPassive", "GlobalMGEPassiveTable", "MGEPassiveMainTable"],
  ] as const;
  return routes.flatMap(([query, load, name]) => {
    const q = z.object({ Tables: z.array(z.object({ ObjectPath: z.string() })) }).parse(evidence.tables.query[query]);
    const l = z.object({ DataTablePath: z.object({ AssetPathName: z.string() }), LoadNetMode: z.string() }).parse(evidence.tables.loadConfig[load]);
    if (q.Tables.length !== 1 || q.Tables[0].ObjectPath !== `NZM/Content/DataTables/MGE/${name}.0`
      || l.DataTablePath.AssetPathName !== `/Game/DataTables/MGE/${name}.${name}` || l.LoadNetMode !== "EDataTableLoadNetMode::All") fail(`table selection ${query}`);
    return [step("query", query, "Tables[0].ObjectPath", q.Tables[0].ObjectPath),
      step("loadConfig", load, "DataTablePath.AssetPathName", l.DataTablePath.AssetPathName),
      step("loadConfig", load, "LoadNetMode", l.LoadNetMode)];
  });
}

/** Flat Unreal SkillModifierList syntax; reject extras, duplicate fields and partial matches. */
function readParameter(raw: unknown, key: string, rule: BindingRule): { value: number; chain: S0EvidenceStep[] } {
  const config = configSchema.parse(raw);
  if (String(config.ConfigId) !== key) fail(`ConfigId ${key}`);
  const matches = config.Parameters.flatMap((p, i) => p.Name === rule.parameter ? [{ p, i }] : []);
  if (matches.length !== 1) fail(`${key}.${rule.parameter}: expected one parameter`);
  const { p, i } = matches[0];
  const chain = [step("params", key, `Parameters[${i}]`, p)];
  let value = p.Value;
  if (rule.tuple) {
    if (p.Type !== "EMGEParameterType::SkillModifierList") fail(`${key}: tuple type`);
    const matches = [...value.matchAll(/\(SkillID=(\d+),Name=([A-Za-z0-9_]+),Value=([-+\d.eE]+)\)/g)];
    if (!matches.length || `(${matches.map((m) => m[0]).join(",")})` !== value) fail(`${key}: malformed tuple list`);
    const selected = matches.filter((m) => Number(m[1]) === rule.tuple!.skillId && m[2] === rule.tuple!.name);
    if (selected.length !== 1 || matches.length !== 1) fail(`${key}: unreviewed skill tuple`);
    value = selected[0][3];
    chain.push(step("params", key, `Parameters[${i}].Value(SkillID=${rule.tuple.skillId},Name=${rule.tuple.name})`, Number(value)));
  } else if (!["EMGEParameterType::ID", "EMGEParameterType::IDList", "EMGEParameterType::Numerical"].includes(p.Type)) fail(`${key}: scalar type`);
  if (!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/.test(value) || !Number.isFinite(Number(value))) fail(`${key}: nonfinite or nonnumeric value`);
  return { value: Number(value), chain };
}

/** No mutation, no refs reads, no fallback to a same-ID config or another level. */
export function reviewS0Values(input: S0ValueInput, evidence: S0ReviewEvidence): S0ValueReview {
  const expected = NODES[input.nodeId];
  if (evidence.season !== "s0" || !expected || !Number.isInteger(input.level) || input.level < 1 || input.level > expected[1]) fail(`unreviewed node/level ${input.nodeId}/${input.level}`);
  const basics = Object.entries(evidence.tables.basic).filter(([, v]) => {
    const r = z.object({ SeasonID: z.number(), SeasonPhaseID: z.number(), TalentID: z.number(), TalentILevel: z.number() }).parse(v);
    return r.SeasonID === 1 && r.SeasonPhaseID === 0 && String(r.TalentID) === input.nodeId && r.TalentILevel === input.level;
  });
  if (basics.length !== 1) fail(`Basic ${input.nodeId}/${input.level}`);
  const [basicKey, rawBasic] = basics[0];
  const basic = basicSchema.parse(rawBasic);
  const skills = [basic.TalentSkillsID, basic.AttributeSkillsID, basic.SeasonSkill].filter((id) => id > 0);
  if (String(basic.UniqueID) !== basicKey || skills.length !== 1 || skills[0] !== expected[0] || input.skillIds.length !== 1 || input.skillIds[0] !== expected[0]) fail(`Basic skill identity ${basicKey}`);
  const structureTable = basic.TalentType === 1 ? "structure1" : basic.TalentType === 3 ? "structure3" : fail(`branch ${basic.TalentType}`);
  const structures = Object.entries(evidence.tables[structureTable]).filter(([, raw]) => {
    const row = z.record(z.string(), z.unknown()).parse(raw);
    return row.SeasonID === 1 && row.SeasonPhaseID === 0 && row.PhaseID === basic.PhaseID && row[`TalentColumn${basic.ColumnID}`] === basic.TalentID;
  });
  if (structures.length !== 1) fail(`Structure membership ${input.nodeId}`);
  const skillId = expected[0];
  const identity: S0EvidenceStep[] = [...routingEvidence(evidence), step(structureTable, structures[0][0], `TalentColumn${basic.ColumnID}`, basic.TalentID),
    step("basic", basicKey, "TalentILevel", basic.TalentILevel),
    step("basic", basicKey, basic.SeasonSkill ? "SeasonSkill" : "TalentSkillsID", skillId)];
  const result: S0ValueReview = { nodeId: input.nodeId, level: input.level, descriptionTemplate: "", descriptionBindings: {}, provenance: [], resolvedCount: 0, remaining: 0, issues: [], indexedApplications: [], valueReview: { sources: [], notes: [], applications: [] } };
  let text: string;
  let source: string;
  let configKey: string | undefined;
  let descriptionId: number | undefined;
  const candidates: S0EvidenceStep[] = [];
  if (basic.SeasonSkill) {
    const active = z.object({ SkillId: z.number(), SkillLevel: textSchema, SkillDescription: textSchema }).parse(evidence.tables.skillDescriptions[String(skillId)]);
    if (active.SkillId !== skillId || localText(active.SkillLevel) !== "1") fail(`active description ${skillId}`);
    text = plainText(localText(active.SkillDescription));
    source = at("skillDescriptions", String(skillId), "SkillDescription");
  } else {
    const passiveKey = `${skillId}_${input.level}`;
    const rawPassive = evidence.tables.passive[passiveKey];
    if (!rawPassive) fail(`missing exact Passive ${passiveKey}; same-ID fallback prohibited`);
    const passive = passiveSchema.parse(rawPassive);
    if (passive.PassiveSkillID !== skillId || passive.PassiveSkillLevel !== String(input.level)) fail(`Passive ${passiveKey}`);
    identity.push(step("passive", passiveKey, "MGE.Id", passive.MGE.Id), step("passive", passiveKey, "MGEConfig.Id", passive.MGEConfig.Id), step("passive", passiveKey, "MGEDescriptionId", passive.MGEDescriptionId));
    descriptionId = passive.MGEDescriptionId;
    const expectedMge = skillId >= 1701000101 && skillId <= 1701000106 ? "2001004001" : String(skillId);
    if (passive.MGE.Id !== expectedMge) fail(`MGE identity ${passiveKey}`);
    const descriptions = Object.entries(evidence.tables.mgeDescriptions).filter(([, raw]) => {
      const d = descriptionSchema.parse(raw); return d.MGEId === Number(passive.MGE.Id) && d.TextID === descriptionId;
    });
    if (descriptions.length !== 1) fail(`exact MGE description ${passive.MGE.Id}/${descriptionId}`);
    const [descKey, description] = descriptions[0];
    text = plainText(localText(descriptionSchema.parse(description).MGEDescription));
    source = at("mgeDescriptions", descKey, "MGEDescription");
    const mge = evidence.tables.mgeClasses[passive.MGE.Id];
    if (RULES[skillId] && !mge) fail(`missing reviewed MGEClass ${passive.MGE.Id}`);
    if (mge) {
      const row = z.object({ MGEId: z.number(), MGEClass: z.object({ AssetPathName: z.string() }) }).parse(mge);
      if (String(row.MGEId) !== passive.MGE.Id) fail(`MGEClass identity ${passiveKey}`);
      if (RULES[skillId] && row.MGEClass.AssetPathName !== REVIEWED_CLASSES[Number(passive.MGE.Id)]) fail(`MGEClass changed ${passiveKey}`);
      candidates.push(step("mgeClasses", passive.MGE.Id, "MGEClass.AssetPathName", row.MGEClass.AssetPathName));
    }
    configKey = passive.MGEConfig.Id === "None" ? undefined : passive.MGEConfig.Id;
    if (configKey && evidence.tables.params[configKey]) {
      const config = configSchema.parse(evidence.tables.params[configKey]);
      if (String(config.ConfigId) !== configKey) fail(`config ${configKey}`);
      candidates.push(step("params", configKey, "Parameters", config.Parameters));
      // Recovery vs. movement conflict: retain the exact linked settlement, never bind it as speed.
      if (skillId === 1318114001) {
        const p = config.Parameters.find((p) => p.Name === "NumericalID");
        if (p) for (const [key, raw] of Object.entries(evidence.tables.numerical)) {
          const row = z.record(z.string(), z.unknown()).parse(raw);
          if (row.id === Number(p.Value) && row.Level === 1) candidates.push(step("numerical", key, "Settlements", row.Settlements), step("numerical", key, "HpCalScale", row.HpCalScale));
        }
      }
    }
  }
  const rule = RULES[skillId];
  const shape = text.replace(quantities(), "#");
  if (rule && (shape !== rule.shape || Number(configKey) !== rule.configs[input.level - 1] || descriptionId !== (skillId >= 1701000101 ? [11, 12, 13, 14, 15, 16][skillId - 1701000101] : input.level))) fail(`rule identity/semantic shape ${input.nodeId}/${input.level}`);
  const parts: string[] = [];
  let cursor = 0;
  for (const [slot, match] of [...text.matchAll(quantities())].entries()) {
    const offset = match.index;
    const p: S0ValueProvenance = { id: `s0:${input.nodeId}:${input.level}:${slot}`, originalText: text, originalValue: match[0], offset,
      semantic: "未审定的数量或描述 Token", status: "missing", reason: LIMITATIONS[skillId] ?? "未找到该数量到精确结构字段的已审定绑定；不采用描述数字。",
      source, chain: [...identity, ...candidates], historicalEffectStatus: "unverified" };
    let replacement = UNVERIFIED;
    const binding = rule?.bindings.find((b) => b.slot === slot);
    if (binding && configKey) {
      if (!evidence.tables.params[configKey]) {
        p.reason = `缺少 Passive 明确引用的 Main Config ${configKey}；未回退同 ID 或旧 Season 配置。`;
      } else {
        const parameter = readParameter(evidence.tables.params[configKey], configKey, binding);
        p.chain.push(...parameter.chain);
        p.semantic = binding.semantic;
        if (binding.modifier) {
          const id = binding.modifier.ids[input.level - 1];
          if (parameter.value !== id) fail(`Modifier identity ${p.id}`);
          // Every reviewed config selects a distinct ID whose authoritative row is Level=1.
          const key = `lc:${id}_1_0` as const;
          const row = resolver.getRow(key, p.id);
          if (row.id !== id || row.level !== 1 || row.index !== 0 || row.attributeName !== binding.modifier.attribute || row.operation !== "B1" || row.coefficient !== 0 || row.baseValue < 0) fail(`Modifier semantics ${p.id}`);
          const expression: NumModifierValueExpression = { row: key, field: "base" };
          const alias = `s0-${input.nodeId}-${input.level}-${slot}`;
          result.descriptionBindings[alias] = expression;
          replacement = `{{num:${alias}|percent}}`;
          p.expression = expression;
          p.structuredValue = resolver.resolveValue(expression, "percent", p.id).value;
          p.chain.push({ source: `data/num-modifier-lock.json#rows.lc.${row.rowName}.raw`, value: {
            ID: row.id, Level: row.level, AttributeName: row.attributeName, BaseValue: row.baseValue, CoefValue: row.coefficient, GPModifierOp: row.operation,
          } });
          if (binding.modifier.indexable) {
            const mge = z.object({ MGEClass: z.object({ AssetPathName: z.literal("/Script/GameFrameWork.MGE_2001004001_GeneralPropertyInit") }) }).parse(evidence.tables.mgeClasses["2001004001"]);
            p.chain.push(step("mgeClasses", "2001004001", "MGEClass.AssetPathName", mge.MGEClass.AssetPathName));
            result.indexedApplications.push({ expression, context: { recipient: "self" }, source, provenanceId: p.id, historicalEffectStatus: "unverified" });
          }
        } else {
          p.structuredValue = binding.unitBasis ? 1 : parameter.value;
          replacement = binding.unitBasis ? "1" : binding.percent ? `${Number((parameter.value * 100).toPrecision(12))}%` : String(parameter.value);
        }
        p.status = "resolved";
        p.reason = binding.unitBasis
          ? `Basic -> 精确等级 Passive -> Main Config -> 已审定按${binding.unitBasis === "layer" ? "层" : "秒"}参数；1 是该单位的归一化分母，不取自描述数字，未证明历史版本。`
          : "Basic -> 精确等级 Passive -> Main Config -> 已审定参数语义；数值只读取结构字段，未证明历史版本。";
        p.replacement = replacement;
      }
    } else if (basic.SeasonSkill) {
      const activeRaw = evidence.tables.activeSkills[String(skillId)];
      const active = z.object({ AbilityID: z.number(), CooldownDuration: z.number().finite(), MaxStrengthLevel: z.number().int().nonnegative(), DefaultStrengthLevelConditionCount: z.number().int().nonnegative() }).parse(activeRaw);
      if (active.AbilityID !== skillId) fail(`active identity ${skillId}`);
      const before = text.slice(0, offset);
      const after = text.slice(offset + match[0].length);
      const field = /冷却：$/.test(before) && /^秒。$/.test(after) ? "CooldownDuration"
        : /最高叠加$/.test(before) && /^层/.test(after) ? "MaxStrengthLevel"
        : skillId === 6001401 && /层数获取：每命中$/.test(before) && /^次增加/.test(after) ? "DefaultStrengthLevelConditionCount" : undefined;
      if (field) {
        p.semantic = field;
        p.structuredValue = active[field];
        replacement = String(active[field]);
        p.chain.push(step("activeSkills", String(skillId), field, active[field]));
        p.status = "resolved";
        p.reason = "主动技能身份及独立冷却/聚能上限/命中次数字段；未用 Duration 代替效果持续时间。";
        p.replacement = replacement;
      }
    }
    if (slot === 0 && evidence.range && (skillId === 1701000105 || skillId === 1701000106) && configKey && rule) {
      const modifierRule = rule.bindings[0];
      const parameter = readParameter(evidence.tables.params[configKey], configKey, modifierRule);
      const row = resolver.getRow(`lc:${skillId}_1_0`);
      if (parameter.value !== skillId || row.id !== skillId || row.level !== 1 || row.index !== 0 || row.attributeName !== modifierRule.modifier?.attribute || row.operation !== "B1" || row.coefficient !== 0) fail(`range Modifier identity ${p.id}`);
      const range = reviewRangeValue(skillId, evidence.range);
      p.chain.push(...parameter.chain, { source: `data/num-modifier-lock.json#rows.lc.${row.rowName}.raw.AttributeName`, value: row.attributeName }, ...range.chain);
      p.status = "resolved";
      p.semantic = "近/远距伤害的 PVE 结算距离阈值（米）";
      p.structuredValue = range.value;
      p.reason = range.note;
      replacement = String(range.value);
      p.replacement = replacement;
    }
    if (p.status === "missing") {
      const reviewed = reviewArmBlueprint(skillId, input.level, slot, shape, evidence);
      if (reviewed) {
        p.status = "resolved";
        p.semantic = reviewed.field;
        p.structuredValue = reviewed.value;
        p.chain.push(...reviewed.chain);
        p.reason = "精确等级 Passive -> 6001401 主动技能资源 -> 3P 技能蓝图默认字段；不采用描述数字，不混用旧第一人称蓝图。";
        replacement = String(reviewed.value);
        p.replacement = replacement;
      }
    }
    if (p.status === "missing" && match[0].startsWith("{GPNumericalID:")) {
      const reviewed = descriptionId === input.level ? reviewFrostToken(skillId, input.level, slot, text, match[0], evidence) : undefined;
      if (reviewed) {
        p.status = "resolved";
        p.evidenceKind = "description-token-only";
        p.semantic = reviewed.field === "HpCalScale" ? "描述引用的独立技能伤害比例（非增伤）" : "描述引用的寒冷元素施加概率";
        p.structuredValue = reviewed.value;
        p.chain.push({ source, value: match[0] }, ...reviewed.chain);
        p.reason = "token-only：精确描述 Token -> 唯一 Numerical 行/等级/字段，并核对结算类型和寒冷元素；仅展示当前结构值，不证明技能执行或历史效果，不生成 Modifier 或 provider。";
        replacement = `${Number((reviewed.value * 100).toPrecision(12))}%`;
        p.replacement = replacement;
      }
      const token = /^\{GPNumericalID:(\d+):(HpCalScale|ElementAddRate):13\}$/.exec(match[0]);
      if (token) for (const [key, raw] of Object.entries(evidence.tables.numerical)) {
        const row = z.record(z.string(), z.unknown()).parse(raw);
        if (row.id === Number(token[1]) && row.Level === input.level) p.chain.push(step("numerical", key, token[2], row[token[2]]), step("numerical", key, "Level", row.Level));
      }
    }
    parts.push(text.slice(cursor, offset), replacement);
    cursor = offset + match[0].length;
    result.provenance.push(p);
  }
  parts.push(text.slice(cursor));
  result.descriptionTemplate = parts.join("");
  result.resolvedCount = result.provenance.filter((p) => p.status === "resolved").length;
  result.remaining = result.provenance.length - result.resolvedCount;
  result.issues = [...new Set(result.provenance.filter((p) => p.status === "missing").map((p) => p.reason))];
  if (!result.provenance.length) result.issues.push("原文没有待绑定数量；不代表玩法或历史效果已核验。");
  result.valueReview = {
    sources: [...new Set([source, ...identity.map((s) => s.source), ...result.provenance.flatMap((p) => p.chain.map((s) => s.source))])],
    notes: ["当前 Main 的选择有 GPFuncQueryDataTable 与 MainDataTablesLoadConfig 结构证据；不是依据旧 extract 的同 ID 查找。",
      "所有绑定仅确认当前配置字段与所审原文数量的关系，不证明录像时期的效果；未确认数字继续遮蔽。",
      evidence.range ? "近/远距离阈值经对应 Modifier 属性身份与 PVE Numerical 系统常量链确认；未推断边界等号。" : "近/远距离阈值未绑定，不从描述添加米数条件。",
      "applications 仅纳入 GeneralPropertyInit -> CharacterModifierList -> 主 Num Lock 的伤害属性。",
      ...result.provenance.filter((p) => p.evidenceKind === "description-token-only").map((p) => p.reason),
      ...result.issues],
    applications: result.indexedApplications.map(({ expression, context }) => ({ expression, context })),
  };
  return result;
}

/** All 52 selected nodes / 82 levels, without touching caller trees or legacy facts. */
export function auditS0ReviewedValues(evidence: S0ReviewEvidence) {
  const reviews = Object.entries(NODES).flatMap(([nodeId, [skillId, levels]]) => Array.from({ length: levels }, (_, i) => reviewS0Values({ nodeId, level: i + 1, skillIds: [skillId] }, evidence)));
  return { reviews, summary: {
    nodes: Object.keys(NODES).length, levels: reviews.length,
    resolvedCount: reviews.reduce((sum, r) => sum + r.resolvedCount, 0),
    remaining: reviews.reduce((sum, r) => sum + r.remaining, 0),
    fullyBoundLevels: reviews.filter((r) => r.resolvedCount > 0 && r.remaining === 0).length,
    partiallyBoundLevels: reviews.filter((r) => r.resolvedCount > 0 && r.remaining > 0).length,
    unboundLevels: reviews.filter((r) => r.resolvedCount === 0 && r.remaining > 0).length,
    noQuantitiesLevels: reviews.filter((r) => r.resolvedCount === 0 && r.remaining === 0).length,
    indexedApplications: reviews.reduce((sum, r) => sum + r.indexedApplications.length, 0),
  } };
}

/** Replayable row subset; source hashes still describe the original full export files. */
export function compactS0ReviewEvidence(evidence: S0ReviewEvidence): S0ReviewEvidence {
  const audit = auditS0ReviewedValues(evidence);
  const tables = Object.fromEntries(Object.keys(S0_REVIEW_PATHS).map((name) => [name, {}])) as S0ReviewEvidence["tables"];
  const keep = (table: Table, row: string) => {
    if (Object.hasOwn(evidence.tables[table], row)) tables[table][row] = structuredClone(evidence.tables[table][row]);
  };
  for (const review of audit.reviews) {
    for (const source of review.valueReview.sources) {
      for (const [table, path] of Object.entries(S0_REVIEW_PATHS) as [Table, string][]) {
        const prefix = `NZM/Content/${path}#`;
        if (!source.startsWith(prefix)) continue;
        const suffix = source.slice(prefix.length);
        // Match known row identities rather than splitting dotted field/tuple syntax.
        const matches = Object.keys(evidence.tables[table]).filter((row) => suffix.startsWith(`${row}.`));
        if (matches.length !== 1) fail(`cannot compact source ${source}`);
        keep(table, matches[0]);
      }
    }
    const skillId = NODES[review.nodeId][0];
    const passiveRaw = evidence.tables.passive[`${skillId}_${review.level}`];
    if (passiveRaw) {
      const passive = passiveSchema.parse(passiveRaw);
      // Also retain inputs read on qualitative nodes, where there is no quantity provenance.
      keep("mgeClasses", passive.MGE.Id);
      keep("params", passive.MGEConfig.Id);
    } else {
      keep("activeSkills", String(skillId));
    }
  }
  return { season: "s0", tables, ...(evidence.sources ? { sources: structuredClone(evidence.sources) } : {}), ...(evidence.range ? { range: structuredClone(evidence.range) } : {}), ...(evidence.armBlueprint ? { armBlueprint: structuredClone(evidence.armBlueprint) } : {}) };
}
