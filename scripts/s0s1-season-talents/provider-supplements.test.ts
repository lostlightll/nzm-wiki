import assert from "node:assert/strict";
import { test } from "node:test";
import s0Audit from "../../data/season-talents/s0/audit.json";
import { NUM_MODIFIER_RESOLVER } from "../../lib/num-modifier-data";
import { mechanicalPowerApplications } from "./provider-supplements";

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
