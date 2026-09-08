import assert from "node:assert/strict";
import test from "node:test";
import { planLegacyTalentRun } from "./cli";

test("offline project updates providers and both projections before checking consumers", () => {
  const plan = planLegacyTalentRun(["project"]);
  assert.equal(plan.project, true);
  assert.deepEqual(plan.steps.map(step => [step.script, ...step.args]), [
    ["scripts/s0s1-season-talents/providers.ts", "--write"],
    ["scripts/num-modifier/project-cli.ts", "write"],
    ["scripts/s0s1-season-talents/check.ts"],
    ["scripts/s0s1-season-talents/providers.ts"],
    ["scripts/num-modifier/project-cli.ts", "check"],
    ["scripts/check-multiplier-index.ts"],
  ]);
});

test("refresh requires fresh external evidence and forwards the same blueprint to source checking", () => {
  assert.throws(() => planLegacyTalentRun(["refresh"]), /S1_BLUEPRINT_REQUIRED/);
  assert.throws(() => planLegacyTalentRun(["refresh", "--s1-taboo-script=actor.json"]), /icon evidence/);
  const plan = planLegacyTalentRun(["refresh", "--s1-taboo-script=C:/exports with spaces/actor.json", "--prepare-assets"]);
  assert.equal(plan.project, false);
  assert.equal(plan.steps[0].script, "scripts/prepare-s0s1-talent-assets.ts");
  assert.deepEqual(plan.steps[1].args, ["--s1-taboo-script=C:/exports with spaces/actor.json", "--assets=MD/_local/s0s1Talent/asset-evidence.json"]);
  assert.deepEqual(plan.steps.find(step => step.script.endsWith("/check.ts"))?.args, ["--sources", "--s1-taboo-script=C:/exports with spaces/actor.json"]);
});

test("check is read only and rejects invalid option combinations before executing steps", () => {
  assert.ok(planLegacyTalentRun(["check"]).steps.every(step => !step.args.includes("write") && !step.args.includes("--write")));
  assert.throws(() => planLegacyTalentRun(["check", "--sources"]), /S1_BLUEPRINT_REQUIRED/);
  assert.throws(() => planLegacyTalentRun(["check", "--prepare-assets"]), /does not export/);
  assert.throws(() => planLegacyTalentRun(["project", "--sources"]), /offline/);
  assert.throws(() => planLegacyTalentRun(["refresh", "--s1-taboo-script=a", "--assets=b", "--prepare-assets"]), /not both/);
  assert.throws(() => planLegacyTalentRun(["project", "--asset=typo"]), /Unknown option/);
});
