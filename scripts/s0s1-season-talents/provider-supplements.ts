import assert from "node:assert/strict";
import s0Audit from "../../data/season-talents/s0/audit.json";
import s1Trees from "../../data/season-talents/s1/trees.json";
import s1Audit from "../../data/season-talents/s1/audit.json";
import { NUM_MODIFIER_RESOLVER } from "../../lib/num-modifier-data";
import type { ModifierProviderRegistry } from "../../lib/modifier-provider-registry";

/** Attribute identity can be indexed independently of an unconfirmed recipient. */
export function mechanicalPowerApplications(evidence = s0Audit.valueEvidence.s0) {
  const applications: ModifierProviderRegistry["providers"][number]["applications"] = [];
  const basis: string[] = [];
  const tables = evidence.tables;
  const expected = [
    { basic: "10032061", passive: "1318103001_1", config: "1318103001", modifier: 160101001 },
    { basic: "10032062", passive: "1318103001_2", config: "1318103002", modifier: 160101002 },
    { basic: "10032063", passive: "1318103001_3", config: "1318103003", modifier: 160101003 },
  ] as const;
  for (const [index, selected] of expected.entries()) {
    const basic = tables.basic[selected.basic];
    assert.equal(basic.TalentID, 1003206);
    assert.equal(basic.TalentILevel, index + 1);
    assert.equal(basic.SeasonID, 1);
    assert.equal(basic.SeasonPhaseID, 0);
    assert.equal(basic.TalentSkillsID, 1318103001);
    const passive = tables.passive[selected.passive];
    assert.equal(passive.PassiveSkillID, basic.TalentSkillsID);
    assert.equal(passive.PassiveSkillLevel, String(basic.TalentILevel));
    assert.equal(passive.MGE.Id, "1318103001");
    assert.equal(passive.MGEConfig.Id, selected.config);
    const config = tables.params[selected.config];
    assert.equal(config.ConfigId, Number(selected.config));
    const parameters = config.Parameters.filter(parameter => parameter.Name === "ModifierId");
    assert.equal(parameters.length, 1);
    assert.equal(parameters[0].Type, "EMGEParameterType::ID");
    assert.equal(parameters[0].Value, String(selected.modifier));
    assert.equal(tables.mgeClasses["1318103001"].MGEClass.AssetPathName,
      "/Game/Abilities/Build/CBT3/Season/HeavyMachineGun/MGE_1318103001.MGE_1318103001_C");
    const row = NUM_MODIFIER_RESOLVER.getRow(`lc:${selected.modifier}_1_0`);
    assert.equal(row.id, selected.modifier);
    assert.equal(row.level, 1);
    assert.equal(row.attributeName, "GPAttributeSetGiveDamageRatio.AllDamageRatio");
    applications.push({ expression: { row: row.key, field: "base" }, context: { recipient: "unknown" } });
    basis.push(`data/season-talents/s0/audit.json#valueEvidence.s0.tables.basic.${selected.basic} -> passive.${selected.passive} -> params.${selected.config}.Parameters.ModifierId=${selected.modifier} -> mgeClasses.1318103001 -> data/num-modifier-lock.json#${row.key}`);
  }
  basis.push("已确认机械威能的显式 Modifier 身份及属性；MGE Blueprint 已不在当前资源中，接收者和运行时应用范围未确认，使用 unknown，仅发布属性分面，不推定对其他伤害生效。");
  return { applications, basis };
}

/** Reviewed Buff identity; a baseline row indexes the attribute, not dynamic stacks. */
export function weaponSongApplications() {
  const tables = s0Audit.valueEvidence.s0.tables;
  assert.equal(tables.basic["10034081"].TalentSkillsID, 1318123001);
  assert.equal(tables.passive["1318123001_1"].MGE.Id, "1318123001");
  const row = NUM_MODIFIER_RESOLVER.getRow("lc:119124001_1_0");
  assert.equal(row.attributeName, "GPAttributeSetGiveDamageRatio.WeaponDamageRatio");
  const applications: ModifierProviderRegistry["providers"][number]["applications"] = [
    { expression: { row: row.key, field: "base" }, context: { recipient: "unknown" } },
  ];
  return { applications, basis: [
    "data/season-talents/s0/audit.json#valueEvidence.s0.tables.basic.10034081 -> passive.1318123001_1.MGE.Id=1318123001",
    "2026-09-12 人工核对武器之歌与 BD_Common_1318123001 Buff 的对应关系，维护者确认用于索引。",
    "refs/Exports/NZM/Content/DataTables/Buff/BuffConfigDatatableNew.json:BD_Common_1318123001.GPModifyIDs=[119124001]；_2 至 _5 行也引用同一 ModifierID。",
    "data/num-modifier-lock.json#rows.lc.119124001_1_0；仅以基准行识别武器增伤属性，不把119124002至119124005推定为天赋后续等级，不发布运行时叠层或接收者结论。",
  ] };
}

/** Explicitly reviewed token identities publish attributes without inferring runtime stacks. */
export function s1ReviewedApplications(nodeId: string): { applications: ModifierProviderRegistry["providers"][number]["applications"]; basis: string[] } | undefined {
  const resonance = s1ResonanceApplications(nodeId);
  if (resonance) return resonance;
  const selections = {
    "1012407": { skill: 1319021008, row: "lc:160201005_1_0", field: "base", attribute: "GPAttributeSetGiveDamageRatio.WeaponSkillDamageRatio" },
    "1012709": { skill: 1319021015, row: "lc:160201007_1_0", field: "coefficient", attribute: "GPAttributeSetGiveDamageRatio.WeaponSkillDamageRatio" },
    "1013407": { skill: 1319022008, row: "lc:160202007_1_0", field: "coefficient", attribute: "GPAttributeSetGiveDamageRatio.WeaknessDamageRatio" },
    "1013707": { skill: 1319022003, row: "lc:160202009_1_0", field: "base", attribute: "Numerical.ExecutionCtx.ExecutionRatio" },
  } as const;
  const selected = selections[nodeId as keyof typeof selections];
  if (!selected) return undefined;
  const nodes = s1Trees.flatMap<{
    id: string;
    skillIds: number[];
    levels: { descriptionBindings?: Record<string, { row: string; field: string } | undefined> }[];
  }>(tree => tree.nodes);
  const node = nodes.find(node => node.id === nodeId);
  assert.ok(node);
  assert.ok(node.skillIds.includes(selected.skill));
  assert.ok(Object.values(node.levels[0].descriptionBindings ?? {}).some(binding => binding?.row === selected.row && binding.field === selected.field));
  assert.equal(NUM_MODIFIER_RESOLVER.getRow(selected.row).attributeName, selected.attribute);
  const applications: ModifierProviderRegistry["providers"][number]["applications"] = [{
    expression: { row: selected.row, field: selected.field },
    context: { recipient: selected.attribute === "Numerical.ExecutionCtx.ExecutionRatio" ? "damage-event" : "unknown" },
  }];
  return { applications, basis: [
    `data/season-talents/s1/trees.json#${nodeId}: skill=${selected.skill}; level=1.descriptionBindings -> ${selected.row}.${selected.field}`,
    "2026-09-12 人工复核精确技能 Token 与 Numerical 属性对应关系，按维护者要求补入属性索引；不从描述百分比、天赋等级或叠层文案推算数值。",
    "该映射仅发布属性分面，不证明历史运行时施加链、接收者或动态叠层；ExecutionCtx 仅标记伤害事件上下文。",
  ] };
}

/** Maintainer-reviewed identities are independent of the quarantined legacy charge chain. */
export function s1MaintainerApplications(nodeId: string) {
  if (nodeId === "1011509") {
    const row = NUM_MODIFIER_RESOLVER.getRow("lc:111010170_1_0");
    assert.equal(row.attributeName, "GPAttributeSetGiveDamageRatio.AllDamageRatio");
    const applications: ModifierProviderRegistry["providers"][number]["applications"] = [
      { expression: { row: row.key, field: "base" }, context: { recipient: "unknown" } },
    ];
    return { applications, basis: [
      "2026-09-12 维护者确认线路强化使用已找到的111010170，仅补充乘区属性索引。",
      "data/num-modifier-lock.json#lc:111010170_1_0：AllDamageRatio；使用基准行识别全伤害分面，不推导治疗效果或运行时应用范围。",
    ] };
  }
  if (nodeId === "1013107") {
    const row = NUM_MODIFIER_RESOLVER.getRow("lc:160202003_1_0");
    assert.equal(row.attributeName, "GPAttributeSetGiveDamageRatio.WeaknessDamageRatio");
    const applications: ModifierProviderRegistry["providers"][number]["applications"] = [
      { expression: { row: row.key, field: "coefficient" }, context: { recipient: "unknown" } },
    ];
    return { applications, basis: [
      "人工核对禁忌之瞳赤瞳属性：data/num-modifier-lock.json#lc:160202003_1_0.coefficient。",
      "NZM/Content/Abilities/Skills/Season/S2/TabooEyes/MGE/MGE_1319022001.uasset: ExecuteUbergraph offset810 SelectInt 默认选择160202003，offset883传入CreateAsyncAddScopedModifier，并使用GetCareerEnergyFromTarget返回值。",
      "2026-09-12 使用 scripts/inspect-nzm-bytecode.ps1 重新核验。仅发布基础赤瞳弱点分面，不将可选ModifyID_XTHX覆盖、能量公式或缺失DA入口视为已核实。",
    ] };
  }
  const isPropagation = ["1011602", "1012602", "1013602"].includes(nodeId);
  const isSwarm = isPropagation || ["1011402", "1012402", "1013402"].includes(nodeId);
  if (!isSwarm && nodeId !== "1011507") return undefined;
  const tables: Record<string, { TalentSkillsID: number }> = s1Audit.valueEvidence.s1.tables.basic;
  assert.equal(tables[`${nodeId}1`].TalentSkillsID, isPropagation ? 1319024005 : isSwarm ? 1319024003 : 1319023010);
  const row = NUM_MODIFIER_RESOLVER.getRow(isSwarm ? "lc:111010161_1_0" : "lc:111010122_1_0");
  assert.equal(row.attributeName, isSwarm ? "GPAttributeSetBearDamageRatio.DamageBearRatio" : "GPAttributeSetGiveDamageRatio.AllDamageRatio");
  const applications: ModifierProviderRegistry["providers"][number]["applications"] = [{
    expression: { row: row.key, field: "base" }, context: { recipient: isSwarm ? "enemy" : "unknown" },
  }];
  return { applications, basis: [
    `data/season-talents/s1/audit.json#valueEvidence.s1.tables.basic.${nodeId}1.TalentSkillsID=${tables[`${nodeId}1`].TalentSkillsID}`,
    `2026-09-12 维护者提供并确认天赋到 Modifier 的映射：${isSwarm ? "裂解易伤（虫群易伤）=111010161" : "增幅协议=111010122"}；数值及属性读取 data/num-modifier-lock.json#${row.key}。`,
    isPropagation ? "蚀甲追猎作为虫群易伤的传播来源，人工语义关联到裂解易伤的同一111010161；未确认完整运行时施加链，不将传播概率或冲击数量计为额外易伤。" : "直接来源的维护者审定映射。",
    isSwarm ? "此人工映射独立于已隔离的 unrelated-charge-config 充能链；不使用160202005，不推广至未审定的其他虫群节点。" : "昆仑神木 Buff SeasonTalent_S2_KLSM_002 至007及其_1变体引用111010122；仅登记基准属性，等级数值仍由Numerical读取。",
  ] };
}

/** Shared-state acquisition sources reuse the reviewed resonance facet, not a new bonus. */
export function s1ResonanceApplications(nodeId: string, tables = s1Audit.valueEvidence.s1.tables) {
  const selections = {
    "1013605": { skill: 1319022014, configs: [1319022023, 1319022024, 1319022025], parameter: "StackCount", values: ["1", "2", "3"] },
    "1013705": { skill: 1319022012, configs: [1319022019, 1319022020, 1319022021], parameter: "StackCount", values: ["1", "2", "3"] },
    "1013709": { skill: 1319022016, configs: [1319022027], parameter: "Possibility", values: ["0.25"] },
  } as const;
  const selected = selections[nodeId as keyof typeof selections];
  if (!selected) return undefined;
  // JSON imports have heterogeneous row shapes; this view uses only identity fields.
  const basic: Record<string, { TalentSkillsID: number }> = tables.basic;
  const passive: Record<string, { MGE: { Id: string }; MGEConfig: { Id: string } }> = tables.passive;
  const params: Record<string, { Parameters: { Name: string; Value: string }[] }> = tables.params;
  const basis: string[] = [];
  selected.configs.forEach((config, index) => {
    const level = index + 1;
    assert.equal(basic[`${nodeId}${level}`].TalentSkillsID, selected.skill);
    const entry = passive[`${selected.skill}_${level}`];
    assert.equal(entry.MGE.Id, String(selected.skill));
    assert.equal(entry.MGEConfig.Id, String(config));
    assert.equal(params[String(config)].Parameters.find(value => value.Name === selected.parameter)?.Value, selected.values[index]);
    basis.push(`data/season-talents/s1/audit.json#valueEvidence.s1.tables: basic.${nodeId}${level} -> passive.${selected.skill}_${level} -> params.${config}.${selected.parameter}=${selected.values[index]}`);
  });
  const shared = s1ReviewedApplications("1013407");
  assert.ok(shared);
  return { applications: shared.applications, basis: [
    ...basis, ...shared.basis,
    "人工语义关联：无我之境II/III/IV 为共振获取来源，共用无我之境I已审定的弱点增伤属性；不是三份额外独立增伤，也不将层数/概率解释成增伤数值。",
    "refs/Exports/NZM/Content/DataTables/Buff/BuffConfigDatatableNew.json#S2_TE_Resonance：ChineseName=禁忌之瞳-共振；Desc=提升弱点伤害。Buff 自身 GPModifyIDs 为空，不将该表记为直接引用160202007的证据。",
    "本地资源未找到三个天赋的MGE Blueprint，完整运行时施加链未确认；仅登记共享状态的获取来源，recipient保留unknown。",
  ] };
}

/** Review gaps are evidence diagnostics, never classifications inferred from prose. */
export const LEGACY_PROVIDER_GAPS: Record<string, string> = {
};
