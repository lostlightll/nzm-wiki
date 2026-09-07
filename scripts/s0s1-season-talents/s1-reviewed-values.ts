import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { NUM_MODIFIER_RESOLVER } from "../../lib/num-modifier-data";
import type { NumModifierResolver, NumModifierValueExpression, NumModifierValueFormat } from "../../lib/num-modifier";
import { readRangeEvidence, reviewRangeValue, type RangeEvidence } from "./range-values";
import { readS1SkillNumerical, reviewS1SkillNumerical, type S1SkillNumericalEvidence } from "./s1-skill-numerical";

/** Offline audit only. Current Main identities never establish historical availability. */
export const S1_REVIEW_PATHS = {
  basic: "SeasonTalent/SeasonTalentBasicTable.json",
  structure1: "SeasonTalent/SeasonTalentStructure1Table.json",
  structure2: "SeasonTalent/SeasonTalentStructure2Table.json",
  structure3: "SeasonTalent/SeasonTalentStructure3Table.json",
  passive: "MGE/MGEPassiveMainTable.json",
  params: "MGE/DT_MGEParamConfig_Main.json",
  descriptions: "MGE/DT_GPMGESkillDesConfigTable_Main.json",
  skills: "Ability/DT_SkillDesConfig_Main.json",
  active: "GPActiveSkillDataTable.json",
  mge: "MGE/GPModularGameplayEffectTable.json",
} as const;
type Table = keyof typeof S1_REVIEW_PATHS;
export interface S1ReviewEvidence {
  skillNumerical?: S1SkillNumericalEvidence;
  range?: RangeEvidence;
  taboo?: S1TabooBlueprintEvidence;
  tables: Record<Table, Record<string, unknown>>;
  sources: Array<{ path: string; sha256: string }>;
}
export interface S1EvidenceStep { source: string; value: unknown }
export interface S1ValueBinding {
  alias: string;
  original: string;
  semantic: string;
  source: string;
  span: { start: number; end: number };
  chain: S1EvidenceStep[];
  expression?: NumModifierValueExpression;
  format: NumModifierValueFormat | "game-token";
  value: number;
  display: string;
  basis: "passive-config" | "description-token" | "active-field" | "blueprint-execution";
  historicalEffectStatus: "unverified";
  notes: string[];
}
export interface S1MissingValue {
  original: string;
  semantic: string;
  source: string;
  span: { start: number; end: number };
  reason: string;
  chain: S1EvidenceStep[];
}
export interface S1IndexedApplication {
  expression: NumModifierValueExpression;
  context: { recipient: "self" };
  source: string;
  historicalEffectStatus: "unverified";
}
export interface S1ValueReview {
  treeId: string;
  nodeId: string;
  level: number;
  descriptionTemplate: string;
  descriptionBindings: Record<string, NumModifierValueExpression>;
  provenance: S1ValueBinding[];
  missing: S1MissingValue[];
  resolvedCount: number;
  remaining: number;
  indexedApplications: S1IndexedApplication[];
  warnings: string[];
  valueReview: {
    sources: string[];
    notes: string[];
    applications: Array<{ expression: NumModifierValueExpression; context: { recipient: "self" } }>;
  };
}
const textSchema = z.object({ LocalizedString: z.string().optional(), SourceString: z.string().optional() });
const basicSchema = z.object({ SeasonID: z.number(), SeasonPhaseID: z.number(), TalentType: z.number(), TalentID: z.number(), TalentILevel: z.number(), TalentSkillsID: z.number(), AttributeSkillsID: z.number(), SeasonSkill: z.number() });
const passiveSchema = z.object({ PassiveSkillID: z.number(), PassiveSkillLevel: z.string(), MGE: z.object({ Id: z.string() }), MGEConfig: z.object({ Id: z.string() }), MGEDescriptionId: z.number() });
const configSchema = z.object({ ConfigId: z.number(), Parameters: z.array(z.object({ Type: z.string(), Name: z.string(), Value: z.string() })) });
const descSchema = z.object({ MGEId: z.number(), TextID: z.number(), MGEDescription: textSchema });
const skillSchema = z.object({ SkillId: z.number(), SkillLevel: textSchema, SkillDescription: textSchema });
const localText = (raw: z.infer<typeof textSchema>) => raw.LocalizedString ?? raw.SourceString ?? "";
const source = (table: Table, row: string, field = "") => `NZM/Content/DataTables/${S1_REVIEW_PATHS[table]}#${row}${field ? `.${field}` : ""}`;
const treeIds = ["kunlun-wood", "phantom-form", "forbidden-eye"] as const;
const UNVERIFIED = "〔数值待核实〕";

const tabooBase = "NZM/Content/Abilities/Skills/Season/S2/TabooEyes/";
const tabooFiles = { actor: "BP_TabooEyes2", virtualGun: "BP_TabooEyes_VirtualGunComp", config: "TabooEyes_Config", wound: "HitToCreateWeaponSpawnableConfig_TabooEyes" } as const;
export interface S1TabooBlueprintEvidence {
  hangItem: unknown;
  actor: unknown[];
  virtualGun: unknown[];
  config: unknown[];
  wound: unknown[];
  sources: Array<{ path: string; sha256: string }>;
}

/** The supplied actor export must include CUE4Parse ReadScriptData output, not function signatures alone. */
export function readS1TabooBlueprintEvidence(root: string, actorScriptFile: string): S1TabooBlueprintEvidence {
  const sources: S1TabooBlueprintEvidence["sources"] = [];
  const read = (path: string, file: string) => {
    const bytes = readFileSync(file);
    sources.push({ path, sha256: createHash("sha256").update(bytes).digest("hex") });
    return z.array(z.unknown()).parse(JSON.parse(bytes.toString("utf8")));
  };
  const exports = Object.fromEntries(Object.entries(tabooFiles).map(([name, file]) => [name,
    read(`${tabooBase}${file}.json`, name === "actor" ? actorScriptFile : join(root, "refs/Exports", tabooBase, `${file}.json`)),
  ])) as Pick<S1TabooBlueprintEvidence, "actor" | "virtualGun" | "config" | "wound">;
  const path = "NZM/Content/DataTables/Avatar/Character/LinkHangItemSet_Char.json";
  const tables = read(path, join(root, "refs/Exports", path)).filter(item => getAt(item, ["Rows"]) !== undefined);
  if (tables.length !== 1) throw new Error("S1_BLUEPRINT: ambiguous hang-item table");
  const evidence = { ...exports, hangItem: getAt(tables[0], ["Rows", "S2_TabooEyes"]), sources };
  for (const id of [1319022005, 1319022009, 1319022013]) reviewS1TabooBlueprintValue(id, evidence);
  return evidence;
}

export function compactS1TabooBlueprintEvidence(evidence: S1TabooBlueprintEvidence): S1TabooBlueprintEvidence {
  const names = {
    actor: ["ExecuteUbergraph_BP_TabooEyes2", "UpdateTalent", "HasTalent"],
    virtualGun: ["Default__BP_TabooEyes_VirtualGunComp_C"],
    config: ["TabooEyes_Config", "InstantHitFireRaySubComponent_0", "InstantHitFireRaySubComponent_1", "InstantHitFireRaySubComponent_2", "InstantHitFireRaySubComponent_3", "NZHitToCreateSpawnableActorSubComponent_0"],
    wound: ["HitToCreateWeaponSpawnableConfig_TabooEyes"],
  };
  const compact = { hangItem: structuredClone(evidence.hangItem), sources: structuredClone(evidence.sources) } as S1TabooBlueprintEvidence;
  for (const key of Object.keys(names) as (keyof typeof names)[]) compact[key] = structuredClone(evidence[key].filter(item => names[key].includes(String(getAt(item, ["Name"])))).map(item => {
    const fields = z.record(z.string(), z.unknown()).parse(item);
    return Object.fromEntries(Object.entries(fields).filter(([key]) => ["Name", "Type", "Properties", "ScriptBytecode"].includes(key)));
  }));
  return compact;
}

function getAt(value: unknown, path: readonly (string | number)[]): unknown {
  for (const key of path) {
    if (value === null || typeof value !== "object") return undefined;
    value = Reflect.get(value, key);
  }
  return value;
}

/** A narrow reviewed Kismet data-flow check, not a general Blueprint interpreter. */
export function reviewS1TabooBlueprintValue(id: number, evidence: S1TabooBlueprintEvidence) {
  const specs = {
    1319022005: { call: 1899, set: 1927, variable: "CallFunc_HasTalent_Result", tag: "Weapon.Attribute.S1.TabooEyes.ShootRange" },
    1319022009: { call: 1996, set: 2024, variable: "CallFunc_HasTalent_Result_2", tag: "Weapon.Attribute.S1.TabooEyes.Penetration" },
    1319022013: { call: 2093, set: 2121, variable: "CallFunc_HasTalent_Result_3", tag: "Weapon.Attribute.S1.Laser.Wound" },
  };
  const spec = specs[id as keyof typeof specs];
  if (!spec) throw new Error(`S1_BLUEPRINT: unreviewed passive ${id}`);
  const chain: S1EvidenceStep[] = [];
  const expect = (raw: unknown, path: readonly (string | number)[], expected: unknown) => {
    if (JSON.stringify(getAt(raw, path)) !== JSON.stringify(expected)) throw new Error(`S1_BLUEPRINT_DRIFT: ${id} ${path.join(".")}`);
  };
  const object = (key: keyof typeof tabooFiles, name: string) => {
    const matches = evidence[key].filter(item => getAt(item, ["Name"]) === name);
    if (matches.length !== 1) throw new Error(`S1_BLUEPRINT: missing/ambiguous ${name}`);
    const fields = z.record(z.string(), z.unknown()).parse(matches[0]);
    chain.push({ source: `${tabooBase}${tabooFiles[key]}.json#${name}`, value: Object.fromEntries(Object.entries(fields).filter(([key]) => ["Name", "Type", "Properties", "ScriptBytecode"].includes(key))) });
    return matches[0];
  };
  expect(evidence.hangItem, ["Rule"], "AllGender|SkillEquipped=6002201");
  expect(evidence.hangItem, ["AssetData", "HangItemConfig", "HangItemClass", "AssetPathName"], "/Game/Abilities/Skills/Season/S2/TabooEyes/BP_TabooEyes2.BP_TabooEyes2_C");
  chain.push({ source: "NZM/Content/DataTables/Avatar/Character/LinkHangItemSet_Char.json#S2_TabooEyes", value: evidence.hangItem });
  const actor = object("actor", "ExecuteUbergraph_BP_TabooEyes2");
  const code = z.array(z.record(z.string(), z.unknown())).parse(getAt(actor, ["ScriptBytecode"]));
  const statement = (index: number) => {
    const found = code.filter(item => item.StatementIndex === index);
    if (found.length !== 1) throw new Error(`S1_BLUEPRINT: statement ${index}`);
    return found[0];
  };
  const update = object("actor", "UpdateTalent");
  expect(update, ["ScriptBytecode", 1, "Token"], "EX_LocalFinalFunction");
  expect(update, ["ScriptBytecode", 1, "Function", "ObjectName"], "Function'BP_TabooEyes2_C:ExecuteUbergraph_BP_TabooEyes2'");
  expect(update, ["ScriptBytecode", 1, "Parameters", 0, "Value"], 2861);
  // Follow actual unconditional flow from UpdateTalent. An added branch/instruction invalidates the review.
  const route = [2861, 2880, 1587, 1656, 1684, 1761, 1830, 1899, 1927, 1996, 2024, 2093, 2121, 2190];
  for (const [position, index] of route.entries()) {
    const row = statement(index);
    if (index === 2190) { expect(row, ["Token"], "EX_PopExecutionFlow"); break; }
    const next = index === 2880 ? row.CodeOffset : code[code.indexOf(row) + 1]?.StatementIndex;
    if (next !== route[position + 1]) throw new Error(`S1_BLUEPRINT_FLOW: ${index}`);
    if (index === 2880) expect(row, ["Token"], "EX_Jump");
    else if (!["EX_LetObj", "EX_Let", "EX_LetBool", "EX_LocalVirtualFunction"].includes(String(row.Token))) throw new Error(`S1_BLUEPRINT_FLOW: ${index} ${row.Token}`);
  }
  const has = object("actor", "HasTalent");
  if (z.array(z.unknown()).parse(getAt(has, ["ScriptBytecode"])).length !== 5) throw new Error("S1_BLUEPRINT: HasTalent flow drift");
  expect(has, ["ScriptBytecode", 0, "Token"], "EX_LetObj");
  expect(has, ["ScriptBytecode", 0, "Variable", "Variable", "Property", "Name"], "CallFunc_GetOwner_ReturnValue");
  expect(has, ["ScriptBytecode", 0, "Expression", "Function", "ObjectName"], "Function'Actor:GetOwner'");
  expect(has, ["ScriptBytecode", 1, "Expression", "Function", "ObjectName"], "Function'NZSeasonDataComponent:HasSeasonTalent'");
  expect(has, ["ScriptBytecode", 1, "Expression", "Parameters", 0, "Variable", "Property", "Name"], "CallFunc_GetOwner_ReturnValue");
  expect(has, ["ScriptBytecode", 1, "Expression", "Parameters", 1, "Variable", "Property", "Name"], "TalentID");
  expect(has, ["ScriptBytecode", 1, "Variable", "Variable", "Property", "Name"], "CallFunc_HasSeasonTalent_ReturnValue");
  expect(has, ["ScriptBytecode", 2, "Variable", "Variable", "Property", "Name"], "Result");
  expect(has, ["ScriptBytecode", 2, "Expression", "Variable", "Property", "Name"], "CallFunc_HasSeasonTalent_ReturnValue");
  expect(has, ["ScriptBytecode", 3, "Token"], "EX_Return");
  expect(has, ["ScriptBytecode", 4, "Token"], "EX_EndOfScript");
  expect(statement(spec.call), ["Function"], "HasTalent");
  expect(statement(spec.call), ["Parameters", 0, "Token"], "EX_IntConst");
  expect(statement(spec.call), ["Parameters", 0, "Value"], id);
  expect(statement(spec.call), ["Parameters", 1, "Variable", "Property", "Name"], spec.variable);
  const setter = getAt(statement(spec.set), ["Expression"]);
  expect(setter, ["Function", "ObjectName"], "Function'DynamicDataObserverBlueprintLibrary:SetBool'");
  expect(setter, ["Parameters", 0, "Variable", "Property", "Name"], "WeaponConfig");
  expect(setter, ["Parameters", 1, "Properties", 0, "Value"], spec.tag);
  expect(setter, ["Parameters", 2, "Variable", "Property", "Name"], spec.variable);
  expect(statement(2775), ["Expression", "Function", "ObjectName"], "Function'CommonFireVerifyLibrary:CreateCommonFireVerifyByComponent'");
  expect(statement(2775), ["Expression", "Parameters", 0, "Value", "ObjectPath"], `${tabooBase}BP_TabooEyes_VirtualGunComp.0`);
  expect(statement(2775), ["Expression", "Parameters", 4, "Variable", "Property", "Name"], "CallFunc_CreateCommonFireVerifyByComponent_DataObserverWrapper");
  if (code[code.indexOf(statement(2775)) + 1]?.StatementIndex !== 2824) throw new Error("S1_BLUEPRINT_FLOW: weapon creation");
  expect(statement(2824), ["Variable", "Variable", "Property", "Name"], "WeaponConfig");
  expect(statement(2824), ["Expression", "Variable", "Property", "Name"], "CallFunc_CreateCommonFireVerifyByComponent_DataObserverWrapper");
  expect(object("virtualGun", "Default__BP_TabooEyes_VirtualGunComp_C"), ["Properties", "ComponentPrefab", "ObjectPath"], `${tabooBase}TabooEyes_Config.72`);
  const collection = object("config", "TabooEyes_Config");
  const component = (name: string, exportIndex: number, conditions: Array<[string, string]>) => {
    const members = z.array(z.unknown()).parse(getAt(collection, ["Properties", "SubComponents"]));
    const selected = members.filter(item => getAt(item, ["ObjectPath"]) === `${tabooBase}TabooEyes_Config.${exportIndex}`);
    if (selected.length !== 1) throw new Error(`S1_BLUEPRINT_COMPONENT: ${name}`);
    const value = object("config", name);
    expect(selected[0], ["ObjectName"], `${String(getAt(value, ["Type"]))}'TabooEyes_Config:${name}'`);
    const actual = getAt(value, ["Properties", "EnableConditions", "GroupConditions", "RuntimeInstancedStructs", "Structs"]);
    const entries = z.array(z.unknown()).parse(actual);
    if (entries.length !== conditions.length) throw new Error(`S1_BLUEPRINT_CONDITIONS: ${name}`);
    for (const [[tag, compare], index] of conditions.map((item, index) => [item, index] as const)) {
      expect(entries[index], ["TargetTag", "TagName"], tag);
      expect(entries[index], ["Compare"], `EEqualCompare::${compare}`);
      expect(entries[index], ["TargetValue"], true);
    }
    return value;
  };
  const shoot = "Weapon.Attribute.S1.TabooEyes.ShootRange";
  const penetrate = "Weapon.Attribute.S1.TabooEyes.Penetration";
  let value: number;
  const numberField = (raw: unknown, key: "config" | "wound", field: string) => {
    const value = z.number().finite().nonnegative().parse(getAt(raw, ["Properties", field]));
    chain.push({ source: `${tabooBase}${tabooFiles[key]}.json#${String(getAt(raw, ["Name"]))}.Properties.${field}`, value });
    return value;
  };
  let note = "当前 Kismet 的 HasSeasonTalent -> SetBool -> 已装载组件条件及结构字段；不从描述取值，不证明历史版本。";
  if (id === 1319022013) {
    const spawn = component("NZHitToCreateSpawnableActorSubComponent_0", 54, [[spec.tag, "Equal"]]);
    expect(spawn, ["Properties", "HitToCreateWeaponSpawnableConfigAsset", "AssetObject", "AssetPathName"], "/Game/Abilities/Skills/Season/S2/TabooEyes/HitToCreateWeaponSpawnableConfig_TabooEyes.HitToCreateWeaponSpawnableConfig_TabooEyes");
    const wound = object("wound", "HitToCreateWeaponSpawnableConfig_TabooEyes");
    expect(wound, ["Properties", "SpawnableActorClass", "ObjectPath"], `${tabooBase}BP_TabooEyes_WoundActor.9`);
    value = numberField(wound, "wound", "LifeTime");
  } else {
    const ray = (name: string, index: number, range: boolean, penetration: boolean) => component(name, index, [[shoot, range ? "Equal" : "NotEqual"], [penetrate, penetration ? "Equal" : "NotEqual"]]);
    if (id === 1319022009) {
      const normal = ray("InstantHitFireRaySubComponent_2", 50, false, true);
      const extended = ray("InstantHitFireRaySubComponent_3", 51, true, true);
      value = z.number().int().parse(numberField(normal, "config", "PenetrateCount"));
      expect(extended, ["Properties", "PenetrateCount"], value);
    } else {
      const base = z.number().positive().parse(numberField(ray("InstantHitFireRaySubComponent_1", 47, false, false), "config", "MaxTraceDistance"));
      const increased = numberField(ray("InstantHitFireRaySubComponent_0", 46, true, false), "config", "MaxTraceDistance");
      expect(ray("InstantHitFireRaySubComponent_2", 50, false, true), ["Properties", "MaxTraceDistance"], base);
      expect(ray("InstantHitFireRaySubComponent_3", 51, true, true), ["Properties", "MaxTraceDistance"], increased);
      value = increased / base - 1;
      note += ` 射程增幅按 MaxTraceDistance ${increased}/${base}-1 推导；不按描述四舍五入为整数百分比。`;
    }
  }
  return { value, chain, note };
}

function matchingRows(table: Record<string, unknown>, fields: Record<string, unknown>) {
  return Object.entries(table).filter(([, raw]) => raw !== null && typeof raw === "object" && Object.entries(fields).every(([field, value]) => Reflect.get(raw, field) === value));
}

// Exact reviewed quantities, not a name-to-number or same-ID lookup heuristic.
const parameterReviews = [
  { id: 1319023013, configs: [1319023013, 1319023113, 1319023213], name: "HealingTriggerNum", values: [80, 60, 40], pattern: /当触发(\d+)次治疗/, format: "number" },
  { id: 1319023014, configs: [1319023014, 1319023114], name: "HealingTriggerNum", values: [360, 180], pattern: /当累计施加(\d+)点治疗量/, format: "number" },
  { id: 1319023015, configs: [1319023015, 1319023115, 1319023215], name: "HealingTriggerNum", values: [800, 600, 400], pattern: /当累计施加(\d+)点治疗量/, format: "number" },
  { id: 1319021001, configs: [1319021001, 1319021002, 1319021003], name: "RadiusRatio", skill: 6002101, values: [0.04, 0.08, 0.12], pattern: /虚数空间的生效范围增加(\d+(?:\.\d+)?%)/, format: "percent" },
  { id: 1319021003, configs: [1319021007, 1319021008, 1319021009], name: "DurationRatio", skill: 6002101, values: [0.09, 0.18, 0.27], pattern: /虚数空间的存在时间提升(\d+(?:\.\d+)?%)/, format: "percent" },
  { id: 1319022003, configs: [1319022001], name: "DamageCountThreshold", skill: 6002201, values: [25], pattern: /受到超过(\d+)次伤害/, format: "number" },
  { id: 1319022014, configs: [1319022023, 1319022024, 1319022025], name: "StackCount", values: [1, 2, 3], pattern: /(\{Passive:1319022014:[123]:StackCount\})层共振/, format: "number" },
  { id: 1319022012, configs: [1319022019, 1319022020, 1319022021], name: "StackCount", values: [1, 2, 3], pattern: /(\{Passive:1319022012:[123]:StackCount\})层共振/, format: "number" },
  { id: 1319022016, configs: [1319022027], name: "Possibility", values: [0.25], pattern: /(\{Passive:1319022016:1:Possibility:13\})概率/, format: "percent" },
  { id: 1319021014, configs: [1319021028], name: "Possibility", values: [0.5], pattern: /(\{Passive:1319021014:1:Possibility:13\})概率/, format: "percent" },
] satisfies Array<{ id: number; configs: number[]; name: string; skill?: number; values: number[]; pattern: RegExp; format: NumModifierValueFormat }>;

const modifierReviews: Array<{ id: number; configs: number[]; name: string; skill?: number; modifier: number; attribute: string; rows: NumModifierValueExpression["row"][]; pattern: RegExp; index: boolean; operation?: "B1" | "B2"; field?: "base" | "coefficient"; tokenOnly?: boolean }> = [
  { id: 1319022007, configs: [1319022009, 1319022010, 1319022011], name: "ModifyID", modifier: 160202006, attribute: "GPAttributeSetCharacterWeaponAdjust.ChangeClipTimeAdjust", rows: ["lc:160202006_1_0", "lc:160202006_2_0", "lc:160202006_3_0"], pattern: /换弹速度提高(\{GPModifier:160202006:BaseValue:0:13\})/, index: false },
  { id: 1319021006, configs: [1319021015, 1319021016, 1319021017], name: "ModifyID", modifier: 160201010, attribute: "GPAttributeSetHumanSkill.SeasonSkillChargeSpeed", rows: ["lc:160201010_1_0", "lc:160201010_2_1", "lc:160201010_3_2"], pattern: /充能速度提高(\{GPModifier:160201010:BaseValue:0:13\})/, index: false, operation: "B2" },
  { id: 1319022010, configs: [1319022014, 1319022015], name: "MoJinFu", skill: 6002201, modifier: 160202010, attribute: "GPAttributeSetBearDamageRatio.DamageBearRatio", rows: ["lc:160202010_1_0", "lc:160202010_2_1"], pattern: /期间获得(\{GPModifier:160202010:BaseValue:0:13\})/, index: false },
  { id: 1319021009, configs: [1319021020, 1319021021, 1319021022], name: "", modifier: 160201011, attribute: "GPAttributeSetBearDamageRatio.DamageBearRatio", rows: ["lc:160201011_1_0", "lc:160201011_2_1", "lc:160201011_3_2"], pattern: /自身获得(\{GPModifier:160201011:BaseValue:0:13\})/, index: false, tokenOnly: true },
  { id: 1319021015, configs: [1319021029, 1319021030], name: "", modifier: 160201007, attribute: "GPAttributeSetGiveDamageRatio.WeaponSkillDamageRatio", rows: ["lc:160201007_1_0", "lc:160201007_2_1"], pattern: /伤害增加(\{GPModifier:160201007:CoefValue:0:13\})/, index: false, field: "coefficient", tokenOnly: true },
  { id: 1319022017, configs: [1319022028, 1319022029, 1319022030], name: "ModifyID", modifier: 160202005, attribute: "GPAttributeSetHumanSkill.SeasonSkillChargeSpeed", rows: ["lc:160202005_1_0", "lc:160202005_2_1", "lc:160202005_3_2"], pattern: /赛季技能充能速度提高(\{GPModifier:160202005:BaseValue:0:13\})/, index: false },
  { id: 1319022004, configs: [1319022002, 1319022003, 1319022004], name: "ModifyID", modifier: 160202004, attribute: "GPAttributeSetGiveDamageRatio.WeaknessDamageRatio", rows: ["lc:160202004_1_0", "lc:160202004_2_1", "lc:160202004_3_2"], pattern: /弱点倍率增加(\{GPModifier:160202004:BaseValue:0:2\})/, index: false },
  { id: 1701000101, configs: [1701000101], name: "CharacterModifierList", modifier: 1701000101, attribute: "GPAttributeSetCritical.CriticalRatio", rows: ["lc:1701000101_1_0"], pattern: /暴击率提高(\d+(?:\.\d+)?%)/, index: false },
  { id: 1701000103, configs: [1701000103], name: "CharacterModifierList", modifier: 1701000103, attribute: "GPAttributeSetGiveDamageRatio.WeaknessDamageRatio", rows: ["lc:1701000103_1_0"], pattern: /弱点伤害增幅提高(\d+(?:\.\d+)?%)/, index: true },
  { id: 1701000105, configs: [1701000105], name: "CharacterModifierList", modifier: 1701000105, attribute: "GPAttributeSetGiveDamageRatio.CloseRangeDamageRatio", rows: ["lc:1701000105_1_0"], pattern: /造成的伤害提高(\d+(?:\.\d+)?%)/, index: true },
  { id: 1319021004, configs: [1319021010, 1319021011, 1319021012], name: "ModifyID", modifier: 160201008, attribute: "GPAttributeSetGiveDamageRatio.WeaponSkillDamageRatio", rows: ["lc:160201008_1_0", "lc:160201008_2_1", "lc:160201008_3_2"], pattern: /武器技能的伤害提升(\d+(?:\.\d+)?%)/, index: true },
];

/** Reads complete Main tables, including passive-selected config/description rows omitted by extract.ts. */
export function readS1ReviewInput(root = process.cwd(), options: { tabooScriptFile?: string } = {}): S1ReviewEvidence {
  const tables = {} as S1ReviewEvidence["tables"];
  const sources: S1ReviewEvidence["sources"] = [];
  for (const [name, relative] of Object.entries(S1_REVIEW_PATHS) as [Table, string][]) {
    const buffer = readFileSync(join(root, "refs/Exports/NZM/Content/DataTables", relative));
    const exports = z.array(z.object({ Rows: z.record(z.string(), z.unknown()).optional() })).parse(JSON.parse(buffer.toString("utf8")));
    const rows = exports.filter(item => item.Rows);
    if (rows.length !== 1) throw new Error(`S1_REVIEW_TABLE: ${relative}: expected one Rows export`);
    tables[name] = rows[0].Rows!;
    sources.push({ path: `NZM/Content/DataTables/${relative}`, sha256: createHash("sha256").update(buffer).digest("hex") });
  }
  return { tables, sources, range: readRangeEvidence(root), skillNumerical: readS1SkillNumerical(root), ...(options.tabooScriptFile ? { taboo: readS1TabooBlueprintEvidence(root, options.tabooScriptFile) } : {}) };
}

function selectedBasics(evidence: S1ReviewEvidence) {
  return matchingRows(evidence.tables.basic, { SeasonID: 1, SeasonPhaseID: 1 }).map(([key, raw]) => ({ key, row: basicSchema.parse(raw) })).filter(({ row }) => {
    if (row.SeasonID !== 1 || row.SeasonPhaseID !== 1 || row.TalentType < 1 || row.TalentType > 3) return false;
    return Object.values(evidence.tables[`structure${row.TalentType}` as Table]).some(raw => {
      const structure = z.object({ SeasonID: z.number(), SeasonPhaseID: z.number() }).catchall(z.number()).parse(raw);
      return structure.SeasonID === 1 && structure.SeasonPhaseID === 1 && Array.from({ length: 9 }, (_, i) => structure[`TalentColumn${i + 1}`]).includes(row.TalentID);
    });
  });
}

/** Whole source-row snapshots only; hashes describe original files, not this projection. */
export function compactS1ReviewEvidence(evidence: S1ReviewEvidence): S1ReviewEvidence {
  const tables = Object.fromEntries(Object.keys(S1_REVIEW_PATHS).map(name => [name, {}])) as S1ReviewEvidence["tables"];
  const retain = (table: Table, key: string) => {
    if (Object.hasOwn(evidence.tables[table], key)) tables[table][key] = structuredClone(evidence.tables[table][key]);
  };
  for (const table of ["structure1", "structure2", "structure3"] as const) {
    for (const [key] of matchingRows(evidence.tables[table], { SeasonID: 1, SeasonPhaseID: 1 })) retain(table, key);
  }
  for (const { key, row } of selectedBasics(evidence)) {
    retain("basic", key);
    for (const id of [row.TalentSkillsID, row.AttributeSkillsID].filter(Boolean)) {
      let mgeId = id;
      let textId = row.TalentILevel;
      const passives = matchingRows(evidence.tables.passive, { PassiveSkillID: id }).filter(([, raw]) => Number(passiveSchema.parse(raw).PassiveSkillLevel) === row.TalentILevel);
      if (passives.length > 1) throw new Error(`S1_REVIEW_PASSIVE: duplicate ${id}/${row.TalentILevel}`);
      for (const [passiveKey, raw] of passives) {
        const passive = passiveSchema.parse(raw);
        retain("passive", passiveKey);
        retain("params", passive.MGEConfig.Id);
        retain("mge", passive.MGE.Id);
        mgeId = Number(passive.MGE.Id);
        textId = passive.MGEDescriptionId;
      }
      for (const [descKey] of matchingRows(evidence.tables.descriptions, { MGEId: mgeId, TextID: textId })) retain("descriptions", descKey);
    }
    if (row.SeasonSkill) {
      retain("active", String(row.SeasonSkill));
      for (const [skillKey, raw] of matchingRows(evidence.tables.skills, { SkillId: row.SeasonSkill })) {
        if (Number(localText(skillSchema.parse(raw).SkillLevel)) === row.TalentILevel) retain("skills", skillKey);
      }
    }
  }
  return { tables, sources: structuredClone(evidence.sources), ...(evidence.skillNumerical ? { skillNumerical: structuredClone(evidence.skillNumerical) } : {}), ...(evidence.range ? { range: structuredClone(evidence.range) } : {}), ...(evidence.taboo ? { taboo: compactS1TabooBlueprintEvidence(evidence.taboo) } : {}) };
}

/** Spans refer to tag-stripped source text. Values in prose are never parsed as evidence. */
export function reviewS1Values(input: { nodeId: string; level: number; skillIds: readonly number[] }, evidence: S1ReviewEvidence, resolver: NumModifierResolver = NUM_MODIFIER_RESOLVER): S1ValueReview {
  const basics = selectedBasics(evidence).filter(({ row }) => String(row.TalentID) === input.nodeId && row.TalentILevel === input.level);
  if (basics.length !== 1) throw new Error(`S1_REVIEW_IDENTITY: ${input.nodeId}/${input.level}`);
  const { key, row: basic } = basics[0];
  const expectedIds = [basic.TalentSkillsID, basic.AttributeSkillsID, basic.SeasonSkill].filter(Boolean);
  if ([...new Set(input.skillIds)].sort().join() !== [...new Set(expectedIds)].sort().join()) throw new Error(`S1_REVIEW_SKILLS: ${input.nodeId}/${input.level}`);
  const result: S1ValueReview = { treeId: treeIds[basic.TalentType - 1], nodeId: input.nodeId, level: input.level, descriptionTemplate: "", descriptionBindings: {}, provenance: [], missing: [], resolvedCount: 0, remaining: 0, indexedApplications: [], warnings: ["CURRENT_MAIN_NOT_HISTORICAL: 完整当前链与描述 Token 均不证明历史效果；索引项仍需集成方历史来源策略。"], valueReview: { sources: [], notes: [], applications: [] } };
  const templates: string[] = [];
  for (const field of ["TalentSkillsID", "AttributeSkillsID", "SeasonSkill"] as const) {
    const id = basic[field];
    if (!id) continue;
    const chain: S1EvidenceStep[] = [{ source: source("basic", key, field), value: id }, { source: source("basic", key, "TalentILevel"), value: input.level }];
    let config: z.infer<typeof configSchema> | undefined;
    let configKey = "";
    let description = "";
    let descriptionSource = source("basic", key, field);
    let missingReason = "未找到与该语义及等级对应的结构化字段；不从描述取值。";
    if (field === "SeasonSkill") {
      const descriptions = matchingRows(evidence.tables.skills, { SkillId: id }).map(([key, raw]) => ({ key, row: skillSchema.parse(raw) })).filter(({ row }) => Number(localText(row.SkillLevel)) === input.level);
      if (descriptions.length > 1) throw new Error(`S1_REVIEW_DESCRIPTION: duplicate skill ${id}`);
      if (descriptions.length) { description = localText(descriptions[0].row.SkillDescription); descriptionSource = source("skills", descriptions[0].key, "SkillDescription"); }
      missingReason = "主动技能 Duration=0 不证明区域/射线/治疗时长；效果参数资产未导出，不能采用其他描述。";
    } else {
      const passives = matchingRows(evidence.tables.passive, { PassiveSkillID: id }).map(([key, raw]) => ({ key, row: passiveSchema.parse(raw) })).filter(({ row }) => Number(row.PassiveSkillLevel) === input.level);
      if (passives.length > 1) throw new Error(`S1_REVIEW_PASSIVE: duplicate ${id}/${input.level}`);
      let mgeId = id;
      let textId = input.level;
      if (passives.length) {
        const passive = passives[0];
        mgeId = Number(passive.row.MGE.Id);
        textId = passive.row.MGEDescriptionId;
        configKey = passive.row.MGEConfig.Id;
        chain.push({ source: source("passive", passive.key), value: passive.row });
        if (configKey !== String(id)) result.warnings.push(`PASSIVE_CONFIG_SELECTION: ${id}/${input.level} -> ${configKey}; 旧提取器直接查同 ID Config 的路径已纠正，不能把旧路径的冲突套到此链；此映射本身仍不确认历史效果或目标语义。`);
        if (evidence.tables.params[configKey] !== undefined) {
          config = configSchema.parse(evidence.tables.params[configKey]);
          if (String(config.ConfigId) !== configKey) throw new Error(`S1_REVIEW_CONFIG_ID: ${configKey}`);
          chain.push({ source: source("params", configKey, "Parameters"), value: config.Parameters });
          missingReason = config.Parameters.length ? "已沿 Passive 的 MGEConfig.Id 检查参数，但未审定目标语义/单位或缺少执行公式。" : "Passive 精确指向的 Main Config 参数为空；缺少 MGE/技能执行资产中的目标字段。";
        } else missingReason = `Passive 指向 Config=${configKey}，Main 中缺行；不回退同 ID/旧表。`;
        const mge = evidence.tables.mge[String(mgeId)];
        if (mge) chain.push({ source: source("mge", String(mgeId)), value: mge });
        if (id >= 1319024001 && id <= 1319024009) missingReason = "SEMANTIC_CONFLICT: Main 与 Season Passive 均指向 1319022030.ModifyID=160202005（赛季充能），不支持虫群描述；Main MGE 无注册，完整挂载按 1319024 名称检索为零。此命名和身份路径无执行包可用，不宣称全量删除。";
      } else missingReason = `缺少 PassiveSkillID=${id}, Level=${input.level} 的精确 Main 行。`;
      const descriptions = matchingRows(evidence.tables.descriptions, { MGEId: mgeId, TextID: textId }).map(([key, raw]) => ({ key, row: descSchema.parse(raw) }));
      if (descriptions.length > 1) throw new Error(`S1_REVIEW_DESCRIPTION: duplicate ${mgeId}/${textId}`);
      if (descriptions.length) { description = localText(descriptions[0].row.MGEDescription); descriptionSource = source("descriptions", descriptions[0].key, "MGEDescription"); }
    }
    const plain = description.replace(/<[^>]*>/g, "");
    if (!plain) {
      result.missing.push({ original: "", semantic: "缺少精确等级描述", source: descriptionSource, span: { start: 0, end: 0 }, reason: missingReason, chain });
      templates.push("当前配置缺少该等级描述。");
      continue;
    }
    const replacements = new Map<number, { end: number; text: string }>();
    const add = (start: number, end: number, value: number, format: NumModifierValueFormat, steps: S1EvidenceStep[], basis: S1ValueBinding["basis"], expression?: NumModifierValueExpression, notes: string[] = []) => {
      const alias = `s1-${input.nodeId}-${input.level}-${result.provenance.length}`;
      const display = expression ? resolver.resolveValue(expression, format, descriptionSource).text : `${Number((value * (format === "percent" ? 100 : 1)).toFixed(8))}${format === "percent" ? "%" : ""}`;
      if (expression) result.descriptionBindings[alias] = expression;
      replacements.set(start, { end, text: expression ? `{{num:${alias}|${format}}}` : display });
      result.provenance.push({ alias, original: plain.slice(start, end), semantic: plain, source: descriptionSource, span: { start, end }, chain: [...chain, ...steps], expression, format, value, display, basis, historicalEffectStatus: "unverified", notes });
    };
    const matchValue = (pattern: RegExp) => {
      const matches = [...plain.matchAll(new RegExp(pattern.source, "gd"))];
      if (matches.length !== 1 || !matches[0].indices?.[1]) throw new Error(`S1_REVIEW_TEXT_DRIFT: ${input.nodeId}/${input.level}: ${pattern}`);
      return matches[0].indices[1];
    };
    const readParameter = (name: string, skill?: number) => {
      if (!config) throw new Error(`S1_REVIEW_CONFIG_MISSING: ${id}/${input.level}`);
      const candidates = config.Parameters.flatMap((parameter, index) => {
        const at = source("params", configKey, `Parameters[${index}]`);
        if (skill === undefined) return parameter.Name === name ? [{ value: Number(parameter.Value), steps: [{ source: at, value: parameter }] }] : [];
        if (parameter.Type !== "EMGEParameterType::SkillModifierList" || parameter.Name !== "SkillParameterModifiers") return [];
        const matches = [...parameter.Value.matchAll(/\(SkillID=(\d+),Name=([A-Za-z0-9_]+),Value=([-+\d.eE]+)\)/g)];
        if (`(${matches.map(match => match[0]).join(",")})` !== parameter.Value) throw new Error(`S1_REVIEW_TUPLE_DRIFT: ${at}`);
        return matches.filter(match => Number(match[1]) === skill && match[2] === name).map(match => ({ value: Number(match[3]), steps: [{ source: at, value: parameter }, { source: `${at}.Value[SkillID=${skill},Name=${name}].Value`, value: Number(match[3]) }] }));
      });
      if (candidates.length !== 1 || !Number.isFinite(candidates[0].value)) throw new Error(`S1_REVIEW_PARAMETER: ${id}/${input.level}/${name}`);
      return candidates[0];
    };
    for (const review of parameterReviews.filter(review => review.id === id)) {
      if (Number(configKey) !== review.configs[input.level - 1]) throw new Error(`S1_REVIEW_CONFIG_DRIFT: ${id}/${input.level}`);
      const parameter = readParameter(review.name, "skill" in review ? review.skill : undefined);
      if (parameter.value !== review.values[input.level - 1]) throw new Error(`S1_REVIEW_VALUE_DRIFT: ${id}/${input.level}`);
      const [start, end] = matchValue(review.pattern);
      const token = /^\{Passive:(\d+):(\d+):/.exec(plain.slice(start, end));
      if (token && (Number(token[1]) !== id || Number(token[2]) !== input.level)) throw new Error(`S1_REVIEW_TOKEN_LEVEL: ${id}/${input.level}`);
      add(start, end, parameter.value, review.format, parameter.steps, "passive-config");
    }
    for (const review of modifierReviews.filter(review => review.id === id)) {
      if (Number(configKey) !== review.configs[input.level - 1]) throw new Error(`S1_REVIEW_CONFIG_DRIFT: ${id}/${input.level}`);
      if (review.tokenOnly && (!config || config.Parameters.length || review.index)) throw new Error(`S1_REVIEW_TOKEN_CONFIG_DRIFT: ${id}/${input.level}`);
      const parameter = review.tokenOnly ? { value: review.modifier, steps: [] } : readParameter(review.name, review.skill);
      if (parameter.value !== review.modifier) throw new Error(`S1_REVIEW_MODIFIER_DRIFT: ${id}/${input.level}`);
      const expression: NumModifierValueExpression = { row: review.rows[input.level - 1], field: review.field ?? "base" };
      const row = resolver.getRow(expression.row);
      // Charge's format-13 token establishes percent display, not the B2 execution formula.
      const chargeDisplay = review.id === 1319022017 || review.operation === "B2";
      const tokenPercent = chargeDisplay || review.id === 1319022007;
      if (row.id !== review.modifier || row.level !== input.level || row.attributeName !== review.attribute || row.operation !== (chargeDisplay ? "B2" : "B1") || (tokenPercent ? row.coefficient !== 0 : resolver.describeAttribute(row.attributeName).quantity !== "ratio")) throw new Error(`S1_REVIEW_NUM_DRIFT: ${expression.row}`);
      const [start, end] = matchValue(review.pattern);
      add(start, end, expression.field === "coefficient" ? row.coefficient : row.baseValue, "percent", [...parameter.steps, { source: `data/num-modifier-lock.json#${row.key}`, value: { AttributeName: row.attributeName, BaseValue: row.baseValue, CoefValue: row.coefficient, GPModifierOp: row.operation, Level: row.level } }], review.tokenOnly ? "description-token" : "passive-config", expression,
        [review.tokenOnly ? "逐级 Passive/描述中的 Modifier 身份与主表同等级精确行匹配；仅作分级参数展示，空 Config 不证明执行链，不进入乘区。" : "逐级 Passive Config + 精确 Num 行；不通过描述值选择行。"]);
      if (chargeDisplay) result.provenance.at(-1)!.notes.push("仅按原 Token 格式码 13 展示充能速度参数百分比；保留 B2，不推导实际充能时间或乘区。");
      if (review.index) result.indexedApplications.push({ expression, context: { recipient: "self" }, source: result.provenance.at(-1)!.chain.map(step => step.source).join(" -> "), historicalEffectStatus: "unverified" });
      if (id === 1701000105 && evidence.range) {
        const range = reviewRangeValue(id, evidence.range);
        const [rangeStart, rangeEnd] = matchValue(/武器对(\d+(?:\.\d+)?)米内/);
        add(rangeStart, rangeEnd, range.value, "number", [...parameter.steps, ...range.chain], "passive-config", undefined, [range.note]);
      }
    }
    if (evidence.skillNumerical && [1319022006, 1319022015].includes(id)) {
      const damage = id === 1319022006;
      const expectedConfig = damage ? [1319022006, 1319022007, 1319022008][input.level - 1] : 1319022026;
      if (Number(configKey) !== expectedConfig) throw new Error(`S1_REVIEW_CONFIG_DRIFT: ${id}/${input.level}`);
      const parameter = readParameter(damage ? "NumericalID_Talent" : "WoundID", 6002201);
      const proof = reviewS1SkillNumerical(id, input.level, parameter.value, evidence.skillNumerical);
      const [start, end] = matchValue(damage ? /射线伤害增加(\d+(?:\.\d+)?%)/ : /(\{GPNumericalID:160102005:HpCalScale:2\})/);
      add(start, end, proof.value, "percent", [...parameter.steps, ...proof.chain], "passive-config", undefined, [proof.note]);
    }
    if (id === 6002301 && input.level === 1) {
      const active = z.object({ AbilityID: z.number(), CooldownDuration: z.number().finite().nonnegative() }).parse(evidence.tables.active[String(id)]);
      if (active.AbilityID !== id) throw new Error(`S1_REVIEW_ACTIVE_ID: ${id}`);
      const [start, end] = matchValue(/冷却[：:](\d+(?:\.\d+)?)秒/);
      add(start, end, active.CooldownDuration, "number", [{ source: source("active", String(id), "CooldownDuration"), value: active.CooldownDuration }], "active-field", undefined, ["当前结构冷却覆盖描述旧值；不推定历史冷却。"]);
    }
    if (evidence.taboo && input.level === 1 && [1319022005, 1319022009, 1319022013].includes(id)) {
      const proof = reviewS1TabooBlueprintValue(id, evidence.taboo);
      const pattern = id === 1319022005 ? /射线射程提高(\d+(?:\.\d+)?%)/ : id === 1319022009 ? /射线可以穿透(\d+)个敌人/ : /灼热裂口，持续(\d+(?:\.\d+)?)秒/;
      const [start, end] = matchValue(pattern);
      add(start, end, proof.value, id === 1319022005 ? "percent" : "number", proof.chain, "blueprint-execution", undefined, [proof.note]);
    }
    // Token identity is independent of the passive config. Default Level=1 stays explicit.
    for (const match of plain.matchAll(/\{GPModifier:(\d+):(BaseValue|CoefValue):(\d+):[^:}]+(?::(\d+))?\}[%％]?/g)) {
      // An exact Passive/Config binding takes precedence over a display token's default level.
      if ([...replacements].some(([start, replacement]) => start <= match.index && replacement.end >= match.index + match[0].length)) continue;
      const rows = resolver.getRowsById("lc", Number(match[1])).filter(row => row.level === Number(match[4] ?? 1) && row.index === Number(match[3]));
      if (rows.length !== 1) continue;
      const row = rows[0];
      const attribute = resolver.describeAttribute(row.attributeName);
      if (!attribute.quantity || attribute.quantity === "opaque") {
        const token = match[0].replace(/[%％]$/, "");
        const resolution = resolver.resolveGameModifierTokens(token, descriptionSource);
        if (resolution.unresolvedTokens.length) continue;
        const suffix = match[0].slice(token.length);
        const retainedSuffix = /[%％]$/.test(resolution.text) ? "" : suffix;
        const start = match.index;
        const end = start + match[0].length;
        replacements.set(start, { end, text: token + retainedSuffix });
        result.provenance.push({
          alias: `s1-${input.nodeId}-${input.level}-${result.provenance.length}`,
          original: match[0], semantic: plain, source: descriptionSource, span: { start, end },
          chain: [...chain, { source: `${descriptionSource}#token`, value: token }, { source: `data/num-modifier-lock.json#${row.key}`, value: { AttributeName: row.attributeName, BaseValue: row.baseValue, CoefValue: row.coefficient, GPModifierOp: row.operation, Level: row.level, Index: row.index } }],
          format: "game-token", value: match[2] === "BaseValue" ? row.baseValue : row.coefficient,
          display: resolution.text + retainedSuffix, basis: "description-token", historicalEffectStatus: "unverified",
          notes: ["保留现有 Resolver 按格式码解析的合法 Token；quantity 未审定，不创建自定义 Num binding，不进入索引。", ...(!match[4] ? ["Token 未声明 Level，精确采用默认 Level=1；不替换为天赋等级。"] : [])],
        });
        continue;
      }
      const format = attribute.quantity === "ratio" || attribute.quantity === "rate" ? "percent" : "number";
      const expression: NumModifierValueExpression = { row: row.key, field: match[2] === "BaseValue" ? "base" : "coefficient" };
      add(match.index, match.index + match[0].length, expression.field === "base" ? row.baseValue : row.coefficient, format,
        [{ source: `${descriptionSource}#token`, value: match[0] }, { source: `data/num-modifier-lock.json#${row.key}`, value: { AttributeName: row.attributeName, BaseValue: row.baseValue, CoefValue: row.coefficient, GPModifierOp: row.operation, Level: row.level, Index: row.index } }, { source: `NumModifierResolver.describeAttribute(${row.attributeName}).quantity`, value: attribute.quantity }],
        "description-token", expression, ["仅确认 Token 指向当前 Num；未证明 MGE 执行链，不进入索引。", ...(!match[4] ? ["Token 未声明 Level，精确采用默认 Level=1；不替换为天赋等级。"] : []), ...(expression.field === "coefficient" ? ["只展示 coefficient；作用变量与叠层公式不由此推导。"] : [])]);
    }
    const numeric = /\{[^{}]*\}[%％]?|[+-]?\d+(?:\.\d+)?[%％]?|[零〇一二两三四五六七八九十百千万半]+(?=[个枚颗发层次秒米点种倍只名道])/g;
    for (const match of plain.matchAll(numeric)) {
      const start = match.index;
      const end = start + match[0].length;
      if ([...replacements].some(([at, replacement]) => at <= start && replacement.end >= end)) continue;
      result.missing.push({ original: match[0], semantic: plain, source: descriptionSource, span: { start, end }, reason: match[0].startsWith("{GPModifier:") ? "Token 缺少精确 Num 行或现有 Resolver 无法解析；未猜测数值。" : missingReason, chain });
      replacements.set(start, { end, text: UNVERIFIED });
    }
    let template = "";
    let cursor = 0;
    for (const [start, replacement] of [...replacements].sort(([a], [b]) => a - b)) {
      if (start < cursor) throw new Error(`S1_REVIEW_OVERLAP: ${descriptionSource}`);
      template += plain.slice(cursor, start) + replacement.text;
      cursor = replacement.end;
    }
    templates.push(template + plain.slice(cursor));
  }
  result.descriptionTemplate = templates.join("\n");
  result.resolvedCount = result.provenance.length;
  result.remaining = result.missing.length;
  result.valueReview = {
    sources: [...new Set(result.provenance.flatMap(binding => [binding.source, ...binding.chain.map(step => step.source)]))],
    notes: [...result.warnings, ...new Set(result.provenance.flatMap(binding => binding.notes)), ...new Set(result.missing.map(item => item.reason)), `RESOLVED=${result.resolvedCount}; REMAINING=${result.remaining}`],
    applications: result.indexedApplications.map(({ expression, context }) => ({ expression, context })),
  };
  return result;
}

export function auditS1ReviewedValues(evidence: S1ReviewEvidence, resolver: NumModifierResolver = NUM_MODIFIER_RESOLVER) {
  const levels = selectedBasics(evidence).map(({ row }) => reviewS1Values({ nodeId: String(row.TalentID), level: row.TalentILevel, skillIds: [row.TalentSkillsID, row.AttributeSkillsID, row.SeasonSkill].filter(Boolean) }, evidence, resolver));
  const summarize = (selected: S1ValueReview[]) => ({ nodes: new Set(selected.map(level => level.nodeId)).size, levels: selected.length, completeLevels: selected.filter(level => level.remaining === 0).length, resolvedCount: selected.reduce((sum, level) => sum + level.resolvedCount, 0), remaining: selected.reduce((sum, level) => sum + level.remaining, 0), structuredBindings: selected.reduce((sum, level) => sum + level.provenance.filter(binding => binding.basis !== "description-token").length, 0), tokenBindings: selected.reduce((sum, level) => sum + level.provenance.filter(binding => binding.basis === "description-token").length, 0), indexedApplications: selected.reduce((sum, level) => sum + level.indexedApplications.length, 0) });
  return { levels, summary: { ...summarize(levels), byTree: Object.fromEntries(treeIds.map(id => [id, summarize(levels.filter(level => level.treeId === id))])) }, sources: evidence.sources };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = auditS1ReviewedValues(readS1ReviewInput());
  console.log(JSON.stringify(process.argv.includes("--full") ? report : report.summary, null, 2));
}
