import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { NUM_MODIFIER_RESOLVER } from "../../lib/num-modifier-data";

type Row = Record<string, unknown>;
export type SwarmTables = {
  basic: Row[];
  passive: Row[];
  seasonPassive: Row[];
  params: Row[];
  mge: Row[];
  modifiers: Row[];
};
export const SWARM_SKILL_IDS = Array.from({ length: 9 }, (_, i) => 1319024001 + i);
const isSwarm = (id: unknown) => SWARM_SKILL_IDS.includes(Number(id));
const refId = (value: unknown) => Number((value as { Id?: string } | undefined)?.Id);

/** Trace registered identities only. Descriptions and similarly named assets cannot repair a missing edge. */
export function auditSwarmRegistrations(tables: SwarmTables) {
  return tables.basic.filter(row => isSwarm(row.TalentSkillsID)).map(node => {
    const skill = Number(node.TalentSkillsID);
    const level = Number(node.TalentILevel);
    const passives = tables.passive.filter(row => row.PassiveSkillID === skill && Number(row.PassiveSkillLevel) === level);
    const seasonPassives = tables.seasonPassive.filter(row => row.PassiveSkillID === skill && Number(row.PassiveSkillLevel) === level);
    const selected = passives.length === 1 ? passives[0] : undefined;
    const mgeId = refId(selected?.MGE);
    const configId = refId(selected?.MGEConfig);
    const configs = tables.params.filter(row => row.ConfigId === configId);
    const parameters = configs.flatMap(row => (row.Parameters ?? []) as Array<{ Name: string; Value: string }>);
    const modifierIds = parameters.filter(row => row.Name === "ModifyID").map(row => Number(row.Value));
    const modifiers = tables.modifiers.filter(row => modifierIds.includes(Number(row.ID)));
    const mgeRegistered = tables.mge.some(row => row.MGEId === mgeId);
    const misdirectedCharge = modifiers.length > 0 && modifiers.every(row => row.AttributeName === "GPAttributeSetHumanSkill.SeasonSkillChargeSpeed");
    return {
      nodeId: Number(node.TalentID), skill, level, configId: Number.isFinite(configId) ? configId : null,
      mgeId: Number.isFinite(mgeId) ? mgeId : null, mgeRegistered,
      mainPassiveCount: passives.length, seasonPassiveCount: seasonPassives.length,
      seasonAgrees: selected !== undefined && seasonPassives.length === 1 && refId(seasonPassives[0].MGEConfig) === configId && refId(seasonPassives[0].MGE) === mgeId,
      modifierIds, attributes: [...new Set(modifiers.map(row => row.AttributeName))],
      status: misdirectedCharge ? "unrelated-charge-config" : !mgeRegistered ? "missing-mge-registration" : "requires-execution-review",
      // Registration alone is never enough to promote an unrelated candidate.
      publishableApplications: [],
    };
  });
}

const tablePaths = {
  basic: "DataTables/SeasonTalent/SeasonTalentBasicTable.json",
  passive: "DataTables/MGE/MGEPassiveMainTable.json",
  seasonPassive: "DataTables/MGE/MGEPassive_Season.json",
  params: "DataTables/MGE/DT_MGEParamConfig_Main.json",
  mge: "DataTables/MGE/GPModularGameplayEffectTable.json",
} as const;

/** Offline investigation command; never used by site rendering/building. */
export function readSwarmInvestigation(root = process.cwd()) {
  const sources: Array<{ path: string; sha256: string }> = [];
  const read = (snapshot: string, path: string): Row[] => {
    const relative = `NZM/${snapshot}/${path}`;
    const bytes = readFileSync(join(root, "refs/Exports", relative));
    sources.push({ path: relative, sha256: createHash("sha256").update(bytes).digest("hex") });
    return JSON.parse(bytes.toString("utf8")) as Row[];
  };
  const table = (snapshot: string, path: string) => {
    const exports = read(snapshot, path).filter(row => row.Rows);
    assert.equal(exports.length, 1, `ambiguous table: ${snapshot}/${path}`);
    return Object.values(exports[0].Rows as Record<string, Row>);
  };
  const snapshots = Object.fromEntries(["Content", "Content_S2"].map(snapshot => {
    const tables = Object.fromEntries(Object.entries(tablePaths).map(([name, path]) => [name, table(snapshot, path)])) as SwarmTables;
    const configs = new Set(tables.passive.filter(row => isSwarm(row.PassiveSkillID)).map(row => refId(row.MGEConfig)));
    const modifierIds = tables.params.filter(row => configs.has(Number(row.ConfigId))).flatMap(row => ((row.Parameters ?? []) as Array<{ Name: string; Value: string }>).filter(parameter => parameter.Name === "ModifyID").map(parameter => Number(parameter.Value)));
    tables.modifiers = [...new Set(modifierIds)].flatMap(id => NUM_MODIFIER_RESOLVER.getRowsById("lc", id).map(row => ({ ID: row.id, AttributeName: row.attributeName })));
    return [snapshot, auditSwarmRegistrations(tables)];
  }));
  const base = "Abilities/Build/DungeonPerk/S1/";
  const defaults = (file: string) => {
    const matches = read("Content", `${base}${file}.json`).filter(row => row.Name === `Default__${file}_C`);
    assert.equal(matches.length, 1, `missing/ambiguous default: ${file}`);
    return matches[0].Properties as Row;
  };
  const caster = defaults("MGE_1398001250");
  const numerical = table("Content", "DataTables/numerical_config_playerskill.json");
  const projectiles = ["Enemy", "Teammate"].map(target => {
    const name = `BP_Projectile_1398001250_${target}`;
    const properties = defaults(name);
    const settlement = (properties.NamedThrowableSettlementConfig as Array<{ Key: string; Value: Row }>).filter(row => row.Key === "Damage");
    assert.equal(settlement.length, 1);
    const id = settlement[0].Value.NumericalID;
    const rows = numerical.filter(row => row.id === id && row.Level === 1);
    assert.equal(rows.length, 1);
    const reference = caster[`Projectile_To${target}`] as { ObjectPath: string };
    assert.ok(reference.ObjectPath.startsWith(`NZM/Content/${base}${name}.`));
    return { target, reference, settlement: settlement[0].Value, numerical: rows[0] };
  });
  return {
    snapshots, modifierAttributeSource: "Current committed Num Modifier Lock via the shared Resolver; historical registration comparison does not assert historical attribute values.", candidate: {
      mgeId: 1398001250, asset: `${base}MGE_1398001250.json`, projectiles,
      status: "projectile-chain-confirmed-talent-entry-unlinked",
      limitation: "搬山填海的敌友飞虫具有精确结算链，但未找到季节天赋 1319024001..9 到此 MGE 的注册或调用边；不得把该候选数值、计数阈值或触发机制移植给天赋。",
    }, sources,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(readSwarmInvestigation(), null, 2));
