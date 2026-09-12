import assert from "node:assert/strict";
import { test } from "node:test";
import s0Audit from "../../data/season-talents/s0/audit.json";
import s1Audit from "../../data/season-talents/s1/audit.json";
import { NUM_MODIFIER_RESOLVER } from "../../lib/num-modifier-data";
import { mechanicalPowerApplications, s1ReviewedApplications, s1ResonanceApplications } from "./provider-supplements";

test("resonance acquisition sources share one coefficient without multiplying it by stacks", () => {
  for (const node of ["1013605", "1013705", "1013709"]) {
    const result = s1ResonanceApplications(node);
    assert.deepEqual(result?.applications, s1ReviewedApplications("1013407")?.applications);
    assert.equal(result?.applications[0].context.recipient, "unknown");
  }
  const tables = structuredClone(s1Audit.valueEvidence.s1.tables);
  tables.passive["1319022014_1"].MGEConfig.Id = "1319022014";
  assert.throws(() => s1ResonanceApplications("1013605", tables));
});

test("reviewed S1 supplements preserve coefficient fields and resolved damage facets", () => {
  for (const [node, field, facet] of [
    ["1012407", "base", "weapon-skill-damage"],
    ["1012709", "coefficient", "weapon-skill-damage"],
    ["1013407", "coefficient", "weakness"],
    ["1013707", "base", "correction"],
  ]) {
    const result = s1ReviewedApplications(node);
    assert.ok(result);
    const application = result.applications[0];
    assert.equal(application.expression.field, field);
    const effect = NUM_MODIFIER_RESOLVER.resolveEffect(application.expression, application.context);
    assert.ok(effect.facets.some(value => value.id === facet), node);
  }
  assert.equal(s1ReviewedApplications("1011507"), undefined);
});

test("mechanical power preserves separate configured Modifier IDs and an unknown recipient", () => {
  const result = mechanicalPowerApplications();
  assert.deepEqual(result.applications.map(application => application.expression.row), [
    "lc:160101001_1_0", "lc:160101002_1_0", "lc:160101003_1_0",
  ]);
  for (const application of result.applications) {
    assert.equal(application.context.recipient, "unknown");
    const effect = NUM_MODIFIER_RESOLVER.resolveEffect(application.expression, application.context);
    assert.ok(effect.facets.some(facet => facet.id === "all-damage"));
  }
});

test("mechanical power rejects a changed Passive/config chain instead of borrowing another level", () => {
  const evidence = structuredClone(s0Audit.valueEvidence.s0);
  evidence.tables.passive["1318103001_2"].MGEConfig.Id = "1318103001";
  assert.throws(() => mechanicalPowerApplications(evidence));
});

test("mechanical power rejects a changed Modifier identity even if the description remains intact", () => {
  const evidence = structuredClone(s0Audit.valueEvidence.s0);
  evidence.tables.params["1318103001"].Parameters[0].Value = "160101003";
  assert.throws(() => mechanicalPowerApplications(evidence));
});
