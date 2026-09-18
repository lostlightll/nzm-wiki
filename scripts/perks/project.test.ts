import assert from "node:assert/strict";
import test from "node:test";
import type { Perk } from "../../types";
import { getTriggerDamageByPerkSlug } from "../../lib/trigger-damage";
import { projectPerkIndependentDamage } from "./project";

const perk: Perk = {
  id: "烈焰冲击", itemId: "20703040000", slug: "preview/slot-4/烈焰冲击",
  name: "烈焰冲击", season: "s4-preview", previewChange: "existing",
  slot: 4, rarity: "传说", category: "其他", effects: [],
};

test("explicit preview damage snapshot remains independent of current trigger values", async () => {
  const current = getTriggerDamageByPerkSlug("slot-4/烈焰冲击")!;
  assert.ok(current);
  const snapshot = { ...current, damageValue: "321" };
  const published = await projectPerkIndependentDamage(perk, { independent_damage_snapshot: [snapshot] });
  assert.equal(published[0].damageValue, "321");
  assert.notEqual(published[0].damageValue, current.damageValue);
  snapshot.damageValue = "999";
  assert.equal(published[0].damageValue, "321", "published values must not alias editable metadata");
  assert.deepEqual(await projectPerkIndependentDamage(perk, {}), [], "missing snapshot must not fill from the same-name current trigger");
});

test("preview damage snapshot rejects incomplete values and unresolved references", async () => {
  await assert.rejects(projectPerkIndependentDamage(perk, { independent_damage_snapshot: [{ numericalId: "11010041" }] }));
  await assert.rejects(projectPerkIndependentDamage(perk, { independent_damage_snapshot: [{ ref: "slot-4/烈焰冲击" }] }));
});
