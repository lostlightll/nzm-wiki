import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { NUM_MODIFIER_RESOLVER as resolver } from "../../lib/num-modifier-data";
import type { LegacyTalentLevel } from "../../lib/s0s1-season-talents";
import { getLegacyTalentCatalog } from "../../lib/s0s1-season-talents";
import { reviewS1SkillNumerical } from "./s1-skill-numerical";
import { applyReportedValues, REPORTED_VALUES } from "./reported-values";
import { auditS1ReviewedValues, compactS1ReviewEvidence, compactS1TabooBlueprintEvidence, reviewS1TabooBlueprintValue, reviewS1Values, type S1ReviewEvidence, type S1TabooBlueprintEvidence } from "./s1-reviewed-values";

function fixture(id: number, level: number, configId: number, description: string, parameters: Array<{ Name: string; Value: string; Type?: string }>, mgeId = id, textId = level): S1ReviewEvidence {
  return { sources: [], tables: {
    basic: { exact: { SeasonID: 1, SeasonPhaseID: 1, TalentType: 1, TalentID: 1011201, TalentILevel: level, TalentSkillsID: id, AttributeSkillsID: 0, SeasonSkill: 0 } },
    structure1: { exact: { SeasonID: 1, SeasonPhaseID: 1, TalentColumn1: 1011201 } }, structure2: {}, structure3: {},
    passive: { exact: { PassiveSkillID: id, PassiveSkillLevel: String(level), MGE: { Id: String(mgeId) }, MGEConfig: { Id: String(configId) }, MGEDescriptionId: textId } },
    params: { [configId]: { ConfigId: configId, Parameters: parameters.map(p => ({ Type: "EMGEParameterType::Numerical", ...p })) } },
    descriptions: { exact: { MGEId: mgeId, TextID: textId, MGEDescription: { LocalizedString: description } } },
    skills: {}, active: {}, mge: {},
  } };
}
const review = (evidence: S1ReviewEvidence, id: number, level = 1) => reviewS1Values({ nodeId: "1011201", level, skillIds: [id] }, evidence);
const render = (result: ReturnType<typeof review>) => resolver.resolveGameModifierTokens(resolver.resolveTemplate(result.descriptionTemplate, result.descriptionBindings)).text;

test("reported supplements are isolated and reject missing or repeated slots", () => {
  const entry = REPORTED_VALUES.entries[0];
  const makeLevel = (descriptionTemplate = entry.from, level = 1): LegacyTalentLevel => ({ level, description: "", descriptionTemplate, facts: [], modifierRows: [], warnings: [] });
  for (const [season, nodeId, level] of [["s0", entry.nodeId, 1], ["s1", "other", 1], ["s1", entry.nodeId, 2]] as const) {
    const value = makeLevel(entry.from, level);
    const before = structuredClone(value);
    applyReportedValues(season, nodeId, value);
    assert.deepEqual(value, before);
  }
  const value = makeLevel();
  applyReportedValues("s1", entry.nodeId, value);
  assert.equal(value.descriptionTemplate, entry.to);
  assert.equal(value.reportedReview?.count, 1);
  assert.equal(value.valueReview, undefined);
  assert.throws(() => applyReportedValues("s1", entry.nodeId, value), /REPORTED_VALUE_DRIFT/);
  assert.throws(() => applyReportedValues("s1", entry.nodeId, makeLevel(entry.from.repeat(2))), /REPORTED_VALUE_DRIFT/);
  assert.throws(() => applyReportedValues("s1", entry.nodeId, makeLevel("changed")), /REPORTED_VALUE_DRIFT/);
});

test("remaining multilevel Modifier displays use exact rows and fields", () => {
  const evidence: S1ReviewEvidence = JSON.parse(readFileSync("data/season-talents/s1/audit.json", "utf8")).valueEvidence.s1;
  for (const [nodeId, skill, values, basis] of [
    ["1013609", 1319022007, ["5%", "10%", "15%"], "passive-config"],
    ["1012405", 1319021006, ["8%", "16%", "24%"], "passive-config"],
    ["1013305", 1319022010, ["17%", "34%"], "passive-config"],
    ["1012505", 1319021009, ["5%", "10%", "15%"], "description-token"],
    ["1012709", 1319021015, ["6%", "12%"], "description-token"],
  ] as const) {
    values.forEach((value, i) => {
      const result = reviewS1Values({ nodeId, level: i + 1, skillIds: [skill] }, evidence);
      assert.ok(render(result).includes(value));
      assert.equal(result.provenance.length, 1);
      assert.equal(result.provenance[0].basis, basis);
      assert.equal(resolver.getRow(result.provenance[0].expression!.row).level, i + 1);
      assert.equal(result.indexedApplications.length, 0);
    });
  }
});

test("ray upgrades and wound coefficient read skill Numerical, never same-ID modifiers", () => {
  const evidence: S1ReviewEvidence = JSON.parse(readFileSync("data/season-talents/s1/audit.json", "utf8")).valueEvidence.s1;
  for (const level of [1, 2, 3]) {
    const result = reviewS1Values({ nodeId: "1013509", level, skillIds: [1319022006] }, evidence);
    assert.equal(render(result), `射线伤害增加${level * 6}%。`);
    assert.equal(result.indexedApplications.length, 0);
  }
  const wound = reviewS1Values({ nodeId: "1013507", level: 1, skillIds: [1319022015] }, evidence);
  assert.ok(render(wound).endsWith("3.5%。"));
  assert.ok(render(wound).includes("〔数值待核实〕次"));
  const bad = structuredClone(evidence.skillNumerical!);
  delete bad.rows["160202003_1"];
  assert.throws(() => reviewS1SkillNumerical(1319022006, 2, 160202003, bad));
  assert.throws(() => reviewS1SkillNumerical(1319022006, 2, 160202002, evidence.skillNumerical!), /IDENTITY_DRIFT/);
  const changed = structuredClone(evidence.skillNumerical!);
  changed.baseActor.numericalId = 160202002;
  assert.throws(() => reviewS1SkillNumerical(1319022006, 1, 160202002, changed), /IDENTITY_DRIFT/);
});

test("user-supplied thresholds are separately labelled and do not override per-level stacks", () => {
  const nodes = getLegacyTalentCatalog("s1").flatMap(tree => tree.nodes);
  const quick = nodes.find(node => node.id === "1013609")!;
  for (const level of quick.levels) {
    assert.ok(level.description.includes("3秒内命中5次）弱点后，下1次"));
    assert.ok(level.reportedReview || level.videoReview);
  }
  const stationary = nodes.find(node => node.id === "1013605")!;
  stationary.levels.forEach((level, i) => {
    assert.ok(level.description.includes(`获得${i + 1}层共振`));
    assert.ok(level.description.includes("持续6秒。冷却10秒"));
  });
  const wound = nodes.find(node => node.id === "1013507")!.levels[0];
  assert.ok(wound.description.includes("造成1次伤害"));
  assert.equal(wound.reportedReview?.count, 1);
});

test("taboo charge speed binds each B2 level without inferring a damage multiplier", () => {
  const evidence: S1ReviewEvidence = JSON.parse(readFileSync("data/season-talents/s1/audit.json", "utf8")).valueEvidence.s1;
  for (const [level, row, value] of [[1, "lc:160202005_1_0", "8%"], [2, "lc:160202005_2_1", "16%"], [3, "lc:160202005_3_2", "24%"]] as const) {
    const result = reviewS1Values({ nodeId: "1013409", level, skillIds: [1319022017] }, evidence);
    assert.equal(render(result), `赛季技能充能速度提高${value}。`);
    assert.equal(result.provenance.length, 1);
    assert.equal(result.provenance[0].expression?.row, row);
    assert.equal(result.provenance[0].basis, "passive-config");
    assert.equal(result.indexedApplications.length, 0);
    assert.ok(result.provenance[0].notes.some(note => note.includes("B2")));
  }
  delete evidence.tables.params["1319022029"];
  assert.throws(() => reviewS1Values({ nodeId: "1013409", level: 2, skillIds: [1319022017] }, evidence), /S1_REVIEW_CONFIG_MISSING/);
});

test("precision shooting binds exact Passive levels despite the default-level display token", () => {
  const evidence: S1ReviewEvidence = JSON.parse(readFileSync("data/season-talents/s1/audit.json", "utf8")).valueEvidence.s1;
  for (const [level, row, value] of [[1, "lc:160202004_1_0", "0.4%"], [2, "lc:160202004_2_1", "0.8%"], [3, "lc:160202004_3_2", "1.2%"]] as const) {
    const result = reviewS1Values({ nodeId: "1013309", level, skillIds: [1319022004] }, evidence);
    assert.equal(render(result), `弱点倍率增加${value}。`);
    assert.equal(result.provenance.length, 1);
    assert.equal(result.provenance[0].basis, "passive-config");
    assert.equal(result.provenance[0].expression?.row, row);
  }
  const changed = structuredClone(evidence);
  delete changed.tables.params["1319022003"];
  assert.throws(() => reviewS1Values({ nodeId: "1013309", level: 2, skillIds: [1319022004] }, changed), /S1_REVIEW_CONFIG_MISSING/);
});

// Minimal projection of the reviewed ReadScriptData AST; no refs dependency.
function tabooFixture(): S1TabooBlueprintEvidence {
  const base = "NZM/Content/Abilities/Skills/Season/S2/TabooEyes/";
  const variable = (Name: string) => ({ Variable: { Property: { Name } } });
  const call = (ObjectName: string) => ({ ObjectName: `Function'${ObjectName}'` });
  const route = [1587, 1656, 1684, 1761, 1830, 1899, 1927, 1996, 2024, 2093, 2121, 2190];
  const code: Array<Record<string, unknown>> = route.map(StatementIndex => ({ StatementIndex, Token: StatementIndex === 2190 ? "EX_PopExecutionFlow" : "EX_Let" }));
  for (const [id, index, name, tag] of [
    [1319022005, 1899, "CallFunc_HasTalent_Result", "Weapon.Attribute.S1.TabooEyes.ShootRange"],
    [1319022009, 1996, "CallFunc_HasTalent_Result_2", "Weapon.Attribute.S1.TabooEyes.Penetration"],
    [1319022013, 2093, "CallFunc_HasTalent_Result_3", "Weapon.Attribute.S1.Laser.Wound"],
  ] as const) {
    Object.assign(code.find(row => row.StatementIndex === index)!, { Token: "EX_LocalVirtualFunction", Function: "HasTalent", Parameters: [{ Token: "EX_IntConst", Value: id }, variable(name)] });
    Object.assign(code.find(row => row.StatementIndex === index + 28)!, { Expression: { Function: call("DynamicDataObserverBlueprintLibrary:SetBool"), Parameters: [variable("WeaponConfig"), { Properties: [{ Value: tag }] }, variable(name)] } });
  }
  const wrapper = "CallFunc_CreateCommonFireVerifyByComponent_DataObserverWrapper";
  code.push(
    { StatementIndex: 2775, Token: "EX_LetObj", Expression: { Function: call("CommonFireVerifyLibrary:CreateCommonFireVerifyByComponent"), Parameters: [{ Value: { ObjectPath: `${base}BP_TabooEyes_VirtualGunComp.0` } }, {}, {}, {}, variable(wrapper)] } },
    { StatementIndex: 2824, Token: "EX_Let", Variable: variable("WeaponConfig"), Expression: variable(wrapper) },
    { StatementIndex: 2861, Token: "EX_LetObj" },
    { StatementIndex: 2880, Token: "EX_Jump", CodeOffset: 1587 },
  );
  const conditions = (range: boolean, penetration: boolean) => [
    ["Weapon.Attribute.S1.TabooEyes.ShootRange", range], ["Weapon.Attribute.S1.TabooEyes.Penetration", penetration],
  ] as const;
  const enabled = (entries: ReadonlyArray<readonly [string, boolean]>) => ({ GroupConditions: { RuntimeInstancedStructs: { Structs: entries.map(([TagName, equal]) => ({ TargetTag: { TagName }, Compare: `EEqualCompare::${equal ? "Equal" : "NotEqual"}`, TargetValue: true })) } } });
  const rays = [[true, false, 46], [false, false, 47], [false, true, 50], [true, true, 51]] as const;
  const components = rays.map(([range, penetration], i) => ({ Name: `InstantHitFireRaySubComponent_${i}`, Type: "InstantHitFireRaySubComponent", Properties: { MaxTraceDistance: range ? 10000 : 6666, ...(penetration ? { PenetrateCount: 1 } : {}), EnableConditions: enabled(conditions(range, penetration)) } }));
  const woundName = "NZHitToCreateSpawnableActorSubComponent_0";
  return {
    sources: [],
    hangItem: { Rule: "AllGender|SkillEquipped=6002201", AssetData: { HangItemConfig: { HangItemClass: { AssetPathName: "/Game/Abilities/Skills/Season/S2/TabooEyes/BP_TabooEyes2.BP_TabooEyes2_C" } } } },
    actor: [
      { Name: "ExecuteUbergraph_BP_TabooEyes2", Type: "Function", ScriptBytecode: code, Flags: "unused export metadata" },
      { Name: "UpdateTalent", ScriptBytecode: [{}, { Token: "EX_LocalFinalFunction", Function: call("BP_TabooEyes2_C:ExecuteUbergraph_BP_TabooEyes2"), Parameters: [{ Value: 2861 }] }] },
      { Name: "HasTalent", ScriptBytecode: [
        { Token: "EX_LetObj", Variable: variable("CallFunc_GetOwner_ReturnValue"), Expression: { Function: call("Actor:GetOwner") } },
        { Variable: variable("CallFunc_HasSeasonTalent_ReturnValue"), Expression: { Function: call("NZSeasonDataComponent:HasSeasonTalent"), Parameters: [variable("CallFunc_GetOwner_ReturnValue"), variable("TalentID")] } },
        { Variable: variable("Result"), Expression: variable("CallFunc_HasSeasonTalent_ReturnValue") },
        { Token: "EX_Return" }, { Token: "EX_EndOfScript" },
      ] },
      { Name: "UnrelatedFunction" },
    ],
    virtualGun: [{ Name: "Default__BP_TabooEyes_VirtualGunComp_C", Properties: { ComponentPrefab: { ObjectPath: `${base}TabooEyes_Config.72` } } }],
    config: [
      ...components,
      { Name: woundName, Type: "NZHitToCreateSpawnableActorSubComponent", Properties: { EnableConditions: enabled([["Weapon.Attribute.S1.Laser.Wound", true]]), HitToCreateWeaponSpawnableConfigAsset: { AssetObject: { AssetPathName: "/Game/Abilities/Skills/Season/S2/TabooEyes/HitToCreateWeaponSpawnableConfig_TabooEyes.HitToCreateWeaponSpawnableConfig_TabooEyes" } } } },
      { Name: "TabooEyes_Config", Properties: { SubComponents: [
        ...components.map((item, i) => ({ ObjectName: `${item.Type}'TabooEyes_Config:${item.Name}'`, ObjectPath: `${base}TabooEyes_Config.${rays[i][2]}` })),
        { ObjectName: `NZHitToCreateSpawnableActorSubComponent'TabooEyes_Config:${woundName}'`, ObjectPath: `${base}TabooEyes_Config.54` },
      ] } },
    ],
    wound: [{ Name: "HitToCreateWeaponSpawnableConfig_TabooEyes", Properties: { LifeTime: 10, SpawnableActorClass: { ObjectPath: `${base}BP_TabooEyes_WoundActor.9` } } }],
  };
}

test("optional range evidence binds structured meters and survives compaction", () => {
  const evidence = fixture(1701000105, 1, 1701000105, "武器对999米内的敌人造成的伤害提高2.4%。", [{ Name: "CharacterModifierList", Value: "1701000105" }], 2001004001, 15);
  evidence.range = {
    constants: { CloseRangeDamageThreshold: { Constant: 1000, UsedSituation: 1, TableRowPlatformCookRule: "EUEDataTableRowCookRule::Default" } },
    system: { Name: "Default__BP_NumericalConfigSystem_C", Type: "BP_NumericalConfigSystem_C", Properties: { SettlementConstantConfigTablePath: { AssetPathName: "/Game/DataTables/NumericalSettlementConstantConfig.NumericalSettlementConstantConfig" } } },
    preset: { SystemConfigPreset: [{ SoftSystemClass: { AssetPathName: "/Game/Numerical/Systems/BP_NumericalConfigSystem.BP_NumericalConfigSystem_C" }, SystemClass: null, Flags: 3 }] }, sources: [],
  };
  const result = review(evidence, 1701000105);
  assert.equal(render(result), "武器对10米内的敌人造成的伤害提高2.4%。");
  assert.equal(result.remaining, 0);
  assert.equal(result.indexedApplications.length, 1);
  assert.deepEqual(review(compactS1ReviewEvidence(evidence), 1701000105), result);
});

test("Kismet talent booleans select exact ray geometry and wound lifetime, not prose", () => {
  for (const [id, description, expected, value] of [
    [1319022005, "射线射程提高999%", "射线射程提高50.0150015%", 10000 / 6666 - 1],
    [1319022009, "射线可以穿透999个敌人", "射线可以穿透1个敌人", 1],
    [1319022013, "灼热裂口，持续999秒", "灼热裂口，持续10秒", 10],
  ] as const) {
    const evidence = fixture(id, 1, id, description, []);
    assert.equal(review(evidence, id).remaining, 1);
    evidence.taboo = tabooFixture();
    const result = review(evidence, id);
    assert.equal(render(result), expected);
    assert.equal(result.resolvedCount, 1);
    assert.equal(result.provenance[0].value, value);
    assert.equal(result.provenance[0].basis, "blueprint-execution");
    assert.deepEqual(result.valueReview.applications, []);
    assert.deepEqual(result.descriptionBindings, {});
    assert.deepEqual(review(JSON.parse(JSON.stringify(compactS1ReviewEvidence(evidence))), id), result);
    assert.equal(compactS1TabooBlueprintEvidence(evidence.taboo).actor.length, 3);
    assert.deepEqual(compactS1TabooBlueprintEvidence(compactS1TabooBlueprintEvidence(evidence.taboo)), compactS1TabooBlueprintEvidence(evidence.taboo));
  }
});

test("missing bytecode, altered identities, flow and component references fail closed", () => {
  const mutate = (root: unknown, path: Array<string | number>, value: unknown) => {
    let target = root;
    for (const key of path.slice(0, -1)) {
      assert.ok(target && typeof target === "object");
      target = Reflect.get(target, key);
    }
    assert.ok(target && typeof target === "object");
    Reflect.set(target, path[path.length - 1], value);
  };
  for (const [path, value] of [
    [["actor", 0, "ScriptBytecode"], undefined],
    [["actor", 0, "ScriptBytecode", 15, "CodeOffset"], 1899],
    [["actor", 0, "ScriptBytecode", 5, "Parameters", 0, "Value"], 1319022006],
    [["actor", 0, "ScriptBytecode", 6, "Expression", "Parameters", 2, "Variable", "Property", "Name"], "UnrelatedResult"],
    [["actor", 0, "ScriptBytecode", 12, "Expression", "Parameters", 4, "Variable", "Property", "Name"], "UnrelatedWrapper"],
    [["actor", 2, "ScriptBytecode", 1, "Expression", "Parameters", 1, "Variable", "Property", "Name"], "WrongTalentID"],
    [["hangItem", "Rule"], "AllGender|SkillEquipped=6002101"],
    [["virtualGun", 0, "Properties", "ComponentPrefab", "ObjectPath"], "Unrelated.72"],
    [["config", 5, "Properties", "SubComponents", 0, "ObjectName"], "WrongComponent"],
    [["config", 0, "Properties", "EnableConditions", "GroupConditions", "RuntimeInstancedStructs", "Structs", 0, "Compare"], "EEqualCompare::NotEqual"],
  ] satisfies Array<[Array<string | number>, unknown]>) {
    const evidence = tabooFixture();
    mutate(evidence, path, value);
    assert.throws(() => reviewS1TabooBlueprintValue(1319022005, evidence), undefined, path.join("."));
  }
  assert.throws(() => reviewS1TabooBlueprintValue(1319022006, tabooFixture()), /unreviewed/);
});

test("common nodes follow Passive MGE/description identities, never displayed numbers", () => {
  const evidence = fixture(1701000101, 1, 1701000101, "暴击率提高999%。", [{ Name: "CharacterModifierList", Value: "1701000101" }], 2001004001, 11);
  const result = review(evidence, 1701000101);
  assert.equal(render(result), "暴击率提高5%。");
  assert.deepEqual(Object.values(result.descriptionBindings), [{ row: "lc:1701000101_1_0", field: "base" }]);
  assert.equal(result.provenance[0].original, "999%");
  assert.ok(result.provenance[0].chain.some(step => step.source.includes("MGEPassiveMainTable")));
  assert.equal(result.indexedApplications.length, 0);
});

test("near range bonus resolves but its description-only distance remains missing", () => {
  const result = review(fixture(1701000105, 1, 1701000105, "武器对10米内的敌人造成的伤害提高2.4%。", [{ Name: "CharacterModifierList", Value: "1701000105" }], 2001004001, 15), 1701000105);
  assert.equal(render(result), "武器对〔数值待核实〕米内的敌人造成的伤害提高2.4%。");
  assert.equal(result.remaining, 1);
  assert.equal(result.valueReview.applications[0].context.recipient, "self");
  assert.equal(result.valueReview.applications[0].expression.row, "lc:1701000105_1_0");
});

test("exact per-level config wins over misleading same-ID config and prose", () => {
  const evidence = fixture(1319023013, 2, 1319023113, "当触发777次治疗时，随机获得一个增益效果，持续15秒。", [{ Name: "HealingTriggerNum", Value: "60" }]);
  evidence.tables.params["1319023013"] = { ConfigId: 1319023013, Parameters: [{ Type: "EMGEParameterType::Numerical", Name: "HealingTriggerNum", Value: "80" }] };
  const result = review(evidence, 1319023013, 2);
  assert.ok(render(result).startsWith("当触发60次治疗"));
  assert.ok(result.provenance[0].chain.some(step => step.source.includes("#1319023113.Parameters[0]")));
  assert.equal(result.missing.length, 2);
  assert.ok(result.missing.some(item => item.original === "15"));
});

test("Passive token level and config drift fail closed", () => {
  const evidence = fixture(1319022014, 2, 1319022024, "获得{Passive:1319022014:1:StackCount}层共振", [{ Name: "StackCount", Value: "2" }]);
  assert.throws(() => review(evidence, 1319022014, 2), /TOKEN_LEVEL/);
  assert.throws(() => review(fixture(1319023013, 2, 1319023013, "当触发60次治疗", [{ Name: "HealingTriggerNum", Value: "80" }]), 1319023013, 2), /CONFIG_DRIFT/);
});

test("structured SkillModifierList quantities retain tuple identity and units", () => {
  const result = review(fixture(1319021001, 3, 1319021003, "虚数空间的生效范围增加999%。", [{ Type: "EMGEParameterType::SkillModifierList", Name: "SkillParameterModifiers", Value: "((SkillID=6002101,Name=RadiusRatio,Value=0.12))" }]), 1319021001, 3);
  assert.equal(render(result), "虚数空间的生效范围增加12%。");
  assert.ok(result.provenance[0].chain.some(step => step.source.endsWith("Value[SkillID=6002101,Name=RadiusRatio].Value") && step.value === 0.12));
  assert.equal(result.indexedApplications.length, 0);
});

test("quantity owns Token percent formatting, including redundant external percent", () => {
  const result = review(fixture(1319022999, 1, 1319022999, "弱点倍率增加{GPModifier:160202004:BaseValue:0:2}%。", []), 1319022999);
  assert.equal(render(result), "弱点倍率增加0.4%。");
  assert.equal(result.provenance[0].format, "percent");
  assert.ok(!render(result).includes("%%"));
  assert.equal(result.indexedApplications.length, 0);
});

test("coefficient 0.006 is 0.6 percent, not a multiplier formula", () => {
  const result = review(fixture(1319022008, 1, 1319022012, "提升{GPModifier:160202007:CoefValue:0:2}造成的弱点伤害，持续6秒。", []), 1319022008);
  assert.equal(render(result), "提升0.6%造成的弱点伤害，持续〔数值待核实〕秒。");
  assert.equal(result.provenance[0].expression?.field, "coefficient");
  assert.ok(result.provenance[0].notes.some(note => note.includes("作用变量")));
});

test("without a reviewed config mapping default Token Level=1 never guesses a level or index", () => {
  const result = review(fixture(1319022999, 3, 1319022999, "弱点倍率增加{GPModifier:160202004:BaseValue:0:2}。", []), 1319022999, 3);
  assert.equal(render(result), "弱点倍率增加0.4%。");
  assert.equal(result.provenance[0].expression?.row, "lc:160202004_1_0");
  assert.ok(result.provenance[0].notes.some(note => note.includes("默认 Level=1")));
  const missing = review(fixture(1319022999, 3, 1319022999, "弱点倍率增加{GPModifier:160202004:BaseValue:0:2:3}。", []), 1319022999, 3);
  assert.equal(missing.resolvedCount, 0);
  assert.equal(missing.remaining, 1);
});

test("quantity absent on charge attribute preserves the existing legal Token without indexing", () => {
  const result = review(fixture(1319022999, 1, 1319022999, "赛季技能充能提高{GPModifier:160201010:BaseValue:0:13}。", []), 1319022999);
  assert.equal(result.resolvedCount, 1);
  assert.equal(result.remaining, 0);
  assert.equal(render(result), "赛季技能充能提高8%。");
  assert.ok(result.descriptionTemplate.includes("{GPModifier:160201010:BaseValue:0:13}"));
  assert.deepEqual(result.descriptionBindings, {});
  assert.deepEqual(result.valueReview.applications, []);
  assert.equal(result.provenance[0].format, "game-token");
});

test("ambiguous Passive identities, wrong skill IDs and S0 nodes are rejected", () => {
  const evidence = fixture(1319023013, 1, 1319023013, "当触发80次治疗", [{ Name: "HealingTriggerNum", Value: "80" }]);
  assert.throws(() => review(evidence, 1319023014), /SKILLS/);
  evidence.tables.passive.duplicate = evidence.tables.passive.exact;
  assert.throws(() => review(evidence, 1319023013), /PASSIVE/);
  assert.throws(() => reviewS1Values({ nodeId: "1001201", level: 1, skillIds: [] }, evidence), /IDENTITY/);
});

test("linked config drift fails without using same-ID fallback", () => {
  const evidence = fixture(1319023013, 1, 1319023013, "当触发80次治疗", [{ Name: "HealingTriggerNum", Value: "81" }]);
  assert.throws(() => review(evidence, 1319023013), /VALUE_DRIFT/);
  delete evidence.tables.params["1319023013"];
  assert.throws(() => review(evidence, 1319023013), /CONFIG_MISSING/);
});

test("review fields assign to the integration contract without modifying old facts", () => {
  const result = review(fixture(1701000103, 1, 1701000103, "弱点伤害增幅提高2%。", [{ Name: "CharacterModifierList", Value: "1701000103" }], 2001004001, 13), 1701000103);
  const level: LegacyTalentLevel = { level: 1, description: "", facts: [], modifierRows: [], warnings: [], descriptionTemplate: result.descriptionTemplate, descriptionBindings: result.descriptionBindings, valueReview: result.valueReview };
  assert.equal(level.valueReview?.applications.length, 1);
  assert.deepEqual(level.facts, []);
});

test("committed offline snapshot reproduces all three branches and accounts for every span", () => {
  const audit: { valueEvidence?: { s1?: S1ReviewEvidence } } = JSON.parse(readFileSync(new URL("../../data/season-talents/s1/audit.json", import.meta.url), "utf8"));
  const evidence = audit.valueEvidence?.s1;
  assert.ok(evidence, "audit.valueEvidence.s1 is required; do not fall back to refs");
  const before = JSON.stringify(evidence);
  const report = auditS1ReviewedValues(evidence);
  const compact = compactS1ReviewEvidence(evidence);
  const replay = auditS1ReviewedValues(JSON.parse(JSON.stringify(compact)));
  assert.deepEqual(replay, report);
  assert.deepEqual(compactS1ReviewEvidence(compact), compact);
  assert.equal(Object.keys(compact.tables.basic).length, 136);
  assert.deepEqual(compact, evidence);
  const withUnrelatedRows = structuredClone(evidence);
  for (const table of Object.values(withUnrelatedRows.tables)) table.unrelated = { SeasonID: 9, SeasonPhaseID: 9 };
  assert.deepEqual(compactS1ReviewEvidence(withUnrelatedRows), compact);
  assert.ok(Object.keys(compact.tables.params).length < 100);
  assert.ok(!Object.hasOwn(compact.tables.params, "1319023001"));
  assert.equal(report.summary.nodes, 91);
  assert.equal(report.summary.levels, 136);
  const added = (evidence.range ? 3 : 0) + (evidence.taboo ? 3 : 0) + (evidence.skillNumerical ? 4 : 0);
  assert.equal(report.summary.structuredBindings, 50 + added);
  assert.equal(report.summary.tokenBindings, 14);
  assert.equal(report.summary.resolvedCount, 64 + added);
  assert.equal(report.summary.remaining, 214 - added);
  assert.equal(report.summary.indexedApplications, 9);
  assert.equal(report.sources.length, 10);
  assert.ok(report.sources.every(item => /^[a-f0-9]{64}$/.test(item.sha256)));
  assert.equal(JSON.stringify(evidence), before);
  for (const result of report.levels) {
    assert.equal(result.resolvedCount, result.provenance.length);
    assert.equal(result.remaining, result.missing.length);
    assert.doesNotThrow(() => render(result));
    assert.deepEqual(resolver.resolveGameModifierTokens(resolver.resolveTemplate(result.descriptionTemplate, result.descriptionBindings)).unresolvedTokens, []);
    for (const item of [...result.provenance, ...result.missing]) {
      if (item.original) assert.equal(item.semantic.slice(item.span.start, item.span.end), item.original);
    }
  }
  const common = report.levels.filter(result => /^(101[123]201|101[123]501|101[123]601)$/.test(result.nodeId));
  assert.equal(common.length, 9);
  assert.ok(common.every(result => result.resolvedCount === (evidence.range && /^101[123]601$/.test(result.nodeId) ? 2 : 1)));
  for (const node of ["1012507", "1012605", "1012705", "1012709", "1013207", "1013305", "1013409", "1013505"]) {
    assert.ok(report.levels.filter(level => level.nodeId === node).every(level => level.indexedApplications.length === 0));
  }
});
