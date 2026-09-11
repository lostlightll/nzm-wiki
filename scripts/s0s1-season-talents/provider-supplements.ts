import assert from "node:assert/strict";
import s0Audit from "../../data/season-talents/s0/audit.json";
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

/** Review gaps are evidence diagnostics, never classifications inferred from prose. */
export const LEGACY_PROVIDER_GAPS: Record<string, string> = {
  "1318123001": "武器之歌：精确 Passive 指向 1318123001，但 Main Config.Parameters 为空，注册的 MGE Blueprint 在当前资源中缺失，尚未找到其施加的 Modifier。",
  "1319023010": "增幅协议：精确 Passive 指向 Config 1319023010/1319023110/1319023210，但 Main 缺少对应配置；描述 Token 不能建立增伤执行链。",
  "1319021008": "技能连击：精确 Passive 指向 Config 1319021019，参数为空；GeneralMGE_SkillParametersModify 未提供下游 Modifier 身份，不能用描述百分比补链。",
  "1319021015": "侵蚀加深：精确 Passive 指向 Config 1319021029/1319021030，参数为空；160201007 只有描述 Token 连接，未确认执行链。",
  "1319022008": "无我之境I：已确认 S2_TE_Resonance 经基础 MGE 施加 160202007，但该天赋自身的 MGE Blueprint 缺失，尚未连通天赋到共振 Buff 的施加链。",
  "1319022014": "无我之境II：配置仅有 StackCount，尚未连通该天赋到 S2_TE_Resonance Buff 的施加链，不能因描述提及共振继承 160202007。",
  "1319022012": "无我之境III：配置仅有 StackCount，尚未连通该天赋到 S2_TE_Resonance Buff 的施加链，不能因描述提及共振继承 160202007。",
  "1319022016": "无我之境IV：配置仅有 Possibility，尚未连通该天赋到 S2_TE_Resonance Buff 的施加链，不能因描述提及共振继承 160202007。",
  "6002201": "禁忌之瞳：基础 Blueprint 的 scoped Modifier 调用已识别 160202003，但 GPActiveSkillDataTable 指向的 DA_S2_TabooEyes2 当前缺失，尚不能闭合主动技能资产到该 Blueprint 的身份链。",
};
