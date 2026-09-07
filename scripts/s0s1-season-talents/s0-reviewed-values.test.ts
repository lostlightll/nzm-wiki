import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { NUM_MODIFIER_RESOLVER as resolver } from "../../lib/num-modifier-data";
import type { LegacyTalentLevel } from "../../lib/s0s1-season-talents";
import { auditS0ReviewedValues, compactS0ReviewEvidence, readS0ReviewEvidence, reviewS0Values, type S0ReviewEvidence } from "./s0-reviewed-values";

function fixture(): S0ReviewEvidence {
  const evidence: S0ReviewEvidence = { season: "s0", tables: {
    basic: { "10012021": { UniqueID: 10012021, SeasonID: 1, SeasonPhaseID: 0, TalentID: 1001202,
      TalentILevel: 1, TalentType: 1, PhaseID: 2, ColumnID: 2, TalentSkillsID: 1701000102, AttributeSkillsID: 0, SeasonSkill: 0 } },
    structure1: { "1002": { SeasonID: 1, SeasonPhaseID: 0, PhaseID: 2, TalentColumn2: 1001202 } }, structure3: {},
    passive: { "1701000102_1": { PassiveSkillID: 1701000102, PassiveSkillLevel: "1", MGE: { Name: "MGE", Id: "2001004001" }, MGEConfig: { Name: "MGEConfig", Id: "1701000102" }, MGEDescriptionId: 12 } },
    params: { "1701000102": { ConfigId: 1701000102, Parameters: [{ Type: "EMGEParameterType::IDList", Name: "CharacterModifierList", Value: "1701000102" }] } },
    mgeDescriptions: { "2001004001_12": { MGEId: 2001004001, TextID: 12, MGEDescription: { LocalizedString: "<qiangdiao>暴击伤害</>增幅提高<qiangdiao>999%</>。" } } },
    mgeClasses: { "2001004001": { MGEId: 2001004001, MGEClass: { AssetPathName: "/Script/GameFrameWork.MGE_2001004001_GeneralPropertyInit" } } },
    activeSkills: {}, skillDescriptions: {}, numerical: {}, query: {}, loadConfig: {},
  } };
  for (const [query, load, name] of [
    ["MGE", "GlobalMGETable", "GPModularGameplayEffectTable"],
    ["MGEConfig", "GlobalMGEConfigTable", "DT_MGEParamConfig_Main"],
    ["MGEPassive", "GlobalMGEPassiveTable", "MGEPassiveMainTable"],
  ]) {
    evidence.tables.query[query] = { Tables: [{ ObjectPath: `NZM/Content/DataTables/MGE/${name}.0` }] };
    evidence.tables.loadConfig[load] = { DataTablePath: { AssetPathName: `/Game/DataTables/MGE/${name}.${name}` }, LoadNetMode: "EDataTableLoadNetMode::All" };
  }
  return evidence;
}
const input = { nodeId: "1001202", level: 1, skillIds: [1701000102] };
const render = (review: ReturnType<typeof reviewS0Values>) => resolver.resolveGameModifierTokens(
  resolver.resolveTemplate(review.descriptionTemplate, review.descriptionBindings), "s0-review-test",
).text;

test("offline: raw description numbers never override the main Num Lock", () => {
  const evidence = fixture();
  const before = structuredClone(evidence);
  const review = reviewS0Values(input, evidence);
  assert.equal(render(review), "暴击伤害增幅提高15%。");
  assert.equal(review.provenance[0].originalValue, "999%");
  assert.equal(review.provenance[0].structuredValue, 0.15);
  assert.deepEqual(review.provenance[0].expression, { row: "lc:1701000102_1_0", field: "base" });
  assert.equal(review.resolvedCount, 1);
  assert.equal(review.remaining, 0);
  assert.equal(review.valueReview.applications[0].context.recipient, "self");
  const compatible: LegacyTalentLevel["valueReview"] = review.valueReview;
  assert.ok(compatible);
  assert.deepEqual(evidence, before);
  assert.ok(review.provenance[0].chain.some((s) => s.source.includes("GPFuncQueryDataTable")));
  assert.ok(review.provenance[0].chain.some((s) => s.source.includes("MGEDescriptionId") && s.value === 12));
  assert.equal(review.provenance[0].historicalEffectStatus, "unverified");
});

test("offline: missing exact config is unresolved, not a description or same-ID fallback", () => {
  const evidence = fixture();
  delete evidence.tables.params["1701000102"];
  const review = reviewS0Values(input, evidence);
  assert.equal(review.remaining, 1);
  assert.equal(review.resolvedCount, 0);
  assert.equal(review.indexedApplications.length, 0);
  assert.match(review.descriptionTemplate, /〔数值待核实〕/);
});

test("offline: absent or changed Passive identity cannot bypass the join", () => {
  const evidence = fixture();
  delete evidence.tables.passive["1701000102_1"];
  assert.throws(() => reviewS0Values(input, evidence), /missing exact Passive/);
  const changed = fixture();
  changed.tables.passive["1701000102_1"] = { PassiveSkillID: 1701000102, PassiveSkillLevel: "1", MGE: { Name: "MGE", Id: "2001004001" }, MGEConfig: { Name: "MGEConfig", Id: "1701000103" }, MGEDescriptionId: 12 };
  assert.throws(() => reviewS0Values(input, changed), /rule identity/);
});

test("offline: mismatched semantic shape and duplicated description identities fail closed", () => {
  const evidence = fixture();
  evidence.tables.mgeDescriptions["2001004001_12"] = { MGEId: 2001004001, TextID: 12, MGEDescription: { LocalizedString: "移动速度增幅提高15%。" } };
  assert.throws(() => reviewS0Values(input, evidence), /semantic shape/);
  const duplicate = fixture();
  duplicate.tables.mgeDescriptions.other = duplicate.tables.mgeDescriptions["2001004001_12"];
  assert.throws(() => reviewS0Values(input, duplicate), /exact MGE description/);
});

test("offline: wrong branch, excluded node, wrong skill or missing level never bind", () => {
  for (const invalid of [
    { ...input, nodeId: "1002202" }, { ...input, nodeId: "1011202" }, { ...input, nodeId: "1003606" },
    { ...input, level: 2 }, { ...input, skillIds: [1701000103] },
  ]) assert.throws(() => reviewS0Values(invalid, fixture()), /S0_REVIEW_DRIFT/);
  const absent = fixture();
  absent.tables.structure1 = {};
  assert.throws(() => reviewS0Values(input, absent), /Structure membership/);
});

test("offline: table selector or application class drift cannot produce providers", () => {
  const evidence = fixture();
  evidence.tables.query.MGEConfig = { Tables: [{ ObjectPath: "NZM/Content/DataTables/MGE/MGEConfig_Season.0" }] };
  assert.throws(() => reviewS0Values(input, evidence), /table selection/);
  const changed = fixture();
  changed.tables.mgeClasses["2001004001"] = { MGEId: 2001004001, MGEClass: { AssetPathName: "/Script/Unknown" } };
  assert.throws(() => reviewS0Values(input, changed));
});

test("offline: duplicate, nonnumeric and wrong Modifier parameters are rejected", () => {
  for (const value of ["NaN", "1701000102;1701000103", "1701000103", "Infinity"]) {
    const evidence = fixture();
    evidence.tables.params["1701000102"] = { ConfigId: 1701000102, Parameters: [{ Type: "EMGEParameterType::IDList", Name: "CharacterModifierList", Value: value }] };
    assert.throws(() => reviewS0Values(input, evidence), /S0_REVIEW_DRIFT/);
  }
});

function readCommittedEvidence(): S0ReviewEvidence {
  const audit: { valueEvidence?: { s0?: S0ReviewEvidence } } = JSON.parse(
    readFileSync(join(process.cwd(), "data/season-talents/s0/audit.json"), "utf8"),
  );
  assert.ok(audit.valueEvidence?.s0, "committed audit.json must contain valueEvidence.s0");
  return audit.valueEvidence.s0;
}

test("committed offline audit: all S0 selected nodes, exact levels, coverage and source hashes", () => {
  const evidence = readCommittedEvidence();
  const audit = auditS0ReviewedValues(evidence);
  const compact = compactS0ReviewEvidence(evidence);
  assert.deepEqual(auditS0ReviewedValues(compact), audit, "offline compact replay must match committed input");
  assert.equal(Object.keys(compact.tables.basic).length, 82);
  assert.ok(!Object.hasOwn(compact.tables.basic, "10036061"));
  assert.deepEqual(compact, evidence, "committed evidence must already be the compact row subset");
  assert.deepEqual(compact.sources, evidence.sources);
  const rangeCount = evidence.range ? 4 : 0;
  assert.deepEqual(audit.summary, { nodes: 52, levels: 82, resolvedCount: 59 + rangeCount, remaining: 89 - rangeCount,
    fullyBoundLevels: 23 + rangeCount, partiallyBoundLevels: 27 - rangeCount, unboundLevels: 24, noQuantitiesLevels: 8, indexedApplications: 8 });
  assert.equal(new Set(audit.reviews.filter((r) => r.resolvedCount).map((r) => r.nodeId)).size, 30);
  assert.equal(evidence.sources?.length, 12);
  assert.ok(evidence.sources?.every((s) => /^[a-f0-9]{64}$/.test(s.sha256) && s.path.startsWith("NZM/Content/")));
  for (const review of audit.reviews) {
    assert.doesNotMatch(render(review), /\{[^}]*\}|<[^>]*>/);
    assert.equal(review.provenance.filter((p) => p.status === "missing").length, review.remaining);
    for (const p of review.provenance) {
      assert.equal(p.originalText.slice(p.offset, p.offset + p.originalValue.length), p.originalValue);
      assert.equal(p.historicalEffectStatus, "unverified");
    }
  }
  const get = (nodeId: string, level: number) => {
    const review = audit.reviews.find((r) => r.nodeId === nodeId && r.level === level);
    assert.ok(review); return review;
  };
  assert.equal(render(get("1001308", 1)), "飞弹发射的间隔减少0.15秒。");
  assert.equal(render(get("1001308", 2)), "飞弹发射的间隔减少0.2秒。");
  assert.equal(render(get("1001308", 3)), "飞弹发射的间隔减少0.25秒。");
  assert.ok(get("1001308", 2).provenance[0].chain.some((s) => s.source.includes("MGEConfig.Id") && s.value === "1319013008"));
  assert.equal(render(get("1001404", 2)), "技能发动期间获得41%伤害减免。");
  assert.equal(get("1001404", 2).provenance[0].originalValue, "42%");
  assert.equal(render(get("1003206", 3)), "机械臂造成的伤害提高24%。");
  assert.deepEqual(Object.values(get("1003206", 3).descriptionBindings), [{ row: "lc:160101003_1_0", field: "base" }]);
  assert.equal(get("1003206", 3).valueReview.applications.length, 0, "ambiguous arm recipient must not be indexed");
  assert.equal(render(get("1003508", 2)), "获得“聚能”要求的武器命中次数降低4。");
  assert.equal(render(get("1003708", 2)), "使用武器技能后，增加5层聚能状态。");
  for (const level of [1, 2, 3]) {
    const healing = get("1003504", level);
    assert.equal(healing.resolvedCount, 0);
    assert.equal(healing.remaining, 3);
    assert.match(healing.issues.join(" "), /HealthThenShieldPercentRecover/);
    assert.ok(healing.provenance[0].chain.some((s) => s.source.includes("numerical_config_playerskill") && s.source.endsWith(".Settlements")));
  }
  assert.equal(get("1001704", 3).remaining, 1, "token-only display does not establish duration or Modifier expressions");
  assert.equal(get("1003308", 1).remaining, 1, "absolute interval does not establish rate increase");
  assert.equal(get("1003706", 1).remaining, 3, "MissileCount is not a reviewed rate threshold formula");
  assert.match(get("1003408", 2).issues.join(" "), /二级 Config 缺失/);
  assert.equal(get("1003506", 1).resolvedCount, 0, "repurposed MGE class prevents mixing historical AOE semantics");
  for (const nodeId of ["1001106", "1003106"]) {
    const root = get(nodeId, 1);
    assert.ok(root.provenance.some((p) => p.semantic === "CooldownDuration" && p.status === "resolved"));
    assert.ok(!root.provenance.some((p) => p.semantic === "Duration"));
  }
});

test("committed offline audit: malformed or retargeted skill tuple is rejected", () => {
  for (const value of ["((SkillID=6001301,Name=FireInternal,Value=0.2))trailing", "((SkillID=6001401,Name=FireInternal,Value=0.2))", "((SkillID=6001301,Name=SlowDownID,Value=160103003))"]) {
    const evidence = readCommittedEvidence();
    evidence.tables.params["1319013008"] = { ConfigId: 1319013008, Parameters: [{ Type: "EMGEParameterType::SkillModifierList", Name: "SkillParameterModifiers", Value: value }] };
    assert.throws(() => reviewS0Values({ nodeId: "1001308", level: 2, skillIds: [1319013005] }, evidence), /S0_REVIEW_DRIFT/);
  }
});

test("optional refs audit: current exports match the committed offline snapshot", {
  skip: process.env.S0_REVIEW_COMPARE_REFS !== "1",
}, () => {
  const full = readS0ReviewEvidence();
  const compact = compactS0ReviewEvidence(full);
  assert.ok(Object.keys(compact.tables.passive).length < Object.keys(full.tables.passive).length);
  const committed = readCommittedEvidence();
  const comparable = structuredClone(compact);
  if (!committed.range) delete comparable.range;
  assert.deepEqual(comparable, committed, "current refs rows and full-file hashes must match the committed snapshot");
  assert.deepEqual(auditS0ReviewedValues(compact), auditS0ReviewedValues(full));
});

test("offline: twelve exact frost tokens use structured ratios without Modifier providers", () => {
  const evidence = readCommittedEvidence();
  for (const [nodeId, skillId, damage, chance] of [
    ["1001206", 1319013012, [0.01, 0.02, 0.03], [0.2, 0.4, 0.6]],
    ["1001704", 1319013013, [0.03, 0.06, 0.09], [0.2, 0.3, 0.4]],
  ] as const) for (const level of [1, 2, 3]) {
    const review = reviewS0Values({ nodeId, skillIds: [skillId], level }, evidence);
    assert.equal(review.resolvedCount, 2);
    assert.equal(review.remaining, 1);
    assert.deepEqual(review.provenance.slice(1).map(p => p.structuredValue), [damage[level - 1], chance[level - 1]]);
    assert.deepEqual(review.descriptionBindings, {});
    assert.deepEqual(review.valueReview.applications, []);
    for (const p of review.provenance.slice(1)) {
      assert.equal(p.evidenceKind, "description-token-only");
      assert.equal(p.historicalEffectStatus, "unverified");
      assert.ok(p.chain.some(s => s.source.endsWith(".Settlements")));
      assert.ok(p.chain.some(s => s.source.endsWith(".ElementType")));
    }
    assert.match(review.valueReview.notes.join(" "), /token-only/);
  }
});

test("offline: frost token row, field, element and settlement drift fail closed", () => {
  const input = { nodeId: "1001206", level: 1, skillIds: [1319013012] };
  for (const patch of [
    { Level: 2 }, { id: 160103008 }, { ElementType: "EElementEffectType::EDamageType_Fire" },
    { Settlements: [] }, { HpCalScale: "0.01" }, { ElementAddRate: 2 }, { HpCalBase: 1 },
  ]) {
    const evidence = readCommittedEvidence();
    evidence.tables.numerical["160103007_1"] = { ...Object(evidence.tables.numerical["160103007_1"]), ...patch };
    assert.equal(reviewS0Values(input, evidence).resolvedCount, 0);
  }
  const duplicate = readCommittedEvidence();
  duplicate.tables.numerical.other = duplicate.tables.numerical["160103007_1"];
  assert.equal(reviewS0Values(input, duplicate).resolvedCount, 0);
  const missing = readCommittedEvidence();
  delete missing.tables.numerical["160103007_1"];
  assert.equal(reviewS0Values(input, missing).resolvedCount, 0);
  const changed = readCommittedEvidence();
  changed.tables.numerical["160103007_1"] = { ...Object(changed.tables.numerical["160103007_1"]), HpCalScale: 0.07, ElementAddRate: 0.8, Description: "999%" };
  assert.deepEqual(reviewS0Values(input, changed).provenance.slice(1).map(p => p.replacement), ["7%", "80%"]);
  for (const token of ["160103008:HpCalScale:13", "160103007:HpCalBase:13", "160103007:HpCalScale:12"]) {
    const evidence = readCommittedEvidence();
    const row = Object(evidence.tables.mgeDescriptions["1319013012_1"]);
    evidence.tables.mgeDescriptions["1319013012_1"] = { ...row, MGEDescription: { LocalizedString: row.MGEDescription.LocalizedString.replace("160103007:HpCalScale:13", token) } };
    assert.equal(reviewS0Values(input, evidence).provenance[1].status, "missing");
  }
});

test("offline: optional range preserves legacy missing, exact Modifier guard and compact replay", () => {
  const evidence = readCommittedEvidence();
  delete evidence.range;
  const input = { nodeId: "1001601", level: 1, skillIds: [1701000105] };
  assert.equal(reviewS0Values(input, evidence).provenance[0].status, "missing");
  evidence.range = {
    constants: Object.fromEntries([["CloseRangeDamageThreshold", 1000], ["LongRangeDamageThreshold", 2500]].map(([key, Constant]) => [key, { Constant, UsedSituation: 1, TableRowPlatformCookRule: "EUEDataTableRowCookRule::Default" }])),
    system: { Name: "Default__BP_NumericalConfigSystem_C", Type: "BP_NumericalConfigSystem_C", Properties: { SettlementConstantConfigTablePath: { AssetPathName: "/Game/DataTables/NumericalSettlementConstantConfig.NumericalSettlementConstantConfig" } } },
    preset: { SystemConfigPreset: [{ SystemClass: null, Flags: 3, SoftSystemClass: { AssetPathName: "/Game/Numerical/Systems/BP_NumericalConfigSystem.BP_NumericalConfigSystem_C" } }] },
    sources: [],
  };
  for (const [nodeId, skillId, meters] of [["1001601", 1701000105, 10], ["1003601", 1701000105, 10], ["1001402", 1701000106, 25], ["1003402", 1701000106, 25]] as const) {
    const review = reviewS0Values({ nodeId, skillIds: [skillId], level: 1 }, evidence);
    assert.equal(review.provenance[0].structuredValue, meters);
    assert.equal(review.remaining, 0);
    assert.equal(review.indexedApplications.length, 1);
    assert.ok(review.provenance[0].chain.some(s => s.source.endsWith(".raw.AttributeName")));
  }
  const compact = compactS0ReviewEvidence(evidence);
  assert.deepEqual(compact.range, evidence.range);
  assert.deepEqual(auditS0ReviewedValues(compact), auditS0ReviewedValues(evidence));
  evidence.tables.params["1701000105"] = { ConfigId: 1701000105, Parameters: [{ Type: "EMGEParameterType::IDList", Name: "CharacterModifierList", Value: "1701000106" }] };
  assert.throws(() => reviewS0Values(input, evidence), /range Modifier identity/);
});
