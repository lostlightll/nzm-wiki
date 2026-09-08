import assert from "node:assert/strict";
import { test } from "node:test";
import { auditSwarmRegistrations, type SwarmTables } from "./swarm-evidence";

function fixture(): SwarmTables {
  const passive = { PassiveSkillID: 1319024003, PassiveSkillLevel: "1", MGE: { Id: "1319024003" }, MGEConfig: { Id: "1319022030" } };
  return {
    basic: [{ TalentID: 1011402, TalentSkillsID: 1319024003, TalentILevel: 1 }],
    passive: [passive], seasonPassive: [structuredClone(passive)],
    params: [{ ConfigId: 1319022030, Parameters: [{ Name: "ModifyID", Value: "160202005" }] }],
    mge: [{ MGEId: 1398001250 }],
    modifiers: [{ ID: 160202005, AttributeName: "GPAttributeSetHumanSkill.SeasonSkillChargeSpeed" }],
  };
}

test("swarm follows selected config and reports charge conflict rather than same-ID guesses", () => {
  const tables = fixture();
  tables.params.push({ ConfigId: 1319024003, Parameters: [{ Name: "ModifyID", Value: "111010161" }] });
  const [result] = auditSwarmRegistrations(tables);
  assert.equal(result.status, "unrelated-charge-config");
  assert.equal(result.mgeRegistered, false);
  assert.equal(result.seasonAgrees, true);
  assert.deepEqual(result.modifierIds, [160202005]);
  assert.deepEqual(result.publishableApplications, []);
});

test("candidate registration does not repair missing talent edge or ambiguous passive", () => {
  const tables = fixture();
  tables.passive.push(structuredClone(tables.passive[0]));
  const [result] = auditSwarmRegistrations(tables);
  assert.equal(result.configId, null);
  assert.equal(result.mainPassiveCount, 2);
  assert.equal(result.status, "missing-mge-registration");
  assert.deepEqual(result.publishableApplications, []);
});
