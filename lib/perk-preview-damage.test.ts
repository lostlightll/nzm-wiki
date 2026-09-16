import assert from "node:assert/strict";
import test from "node:test";
import { getPerkByName } from "./perks";
import { getIndependentDamageByPerkSlug } from "./independent-damage";
import { getPreviewPerkDamage, resolvePreviewDamageDescription } from "./perk-preview-damage";

test("preview cryo perks share Numerical coefficients between descriptions and damage panels", async () => {
  for (const [name, id, percent, damage, type] of [
    ["极寒领域", "120300174", "50%", "250", "武器技能伤害"],
    ["极寒之触", "120300175", "20%", "100", "技能伤害"],
    ["极寒之痕", "120300176", "45%", "225", "技能伤害"],
  ]) {
    const perk = getPerkByName(name)!;
    assert.ok(perk.description?.includes(`${percent}攻击力`), name);
    assert.doesNotMatch(perk.description!, /\{GPNumericalID:/);
    const sources = await getIndependentDamageByPerkSlug(perk.slug);
    assert.equal(sources.length, 1);
    assert.equal(sources[0].numericalId, id);
    assert.equal(sources[0].damageValue, damage);
    assert.equal(sources[0].damageType, type);
    assert.equal(sources[0].element, "寒冷");
    assert.equal(sources[0].critical, false);
    assert.equal(sources[0].weakpoint, false);
  }
});

test("preview damage cannot leak into official perks or resolve unrelated tokens", () => {
  const token = "{GPNumericalID:120300174:HpCalScale:13}";
  assert.equal(getPreviewPerkDamage("20703040537", "s3"), undefined);
  assert.throws(() => resolvePreviewDamageDescription(token, "20703040537", "s3"));
  assert.throws(() => resolvePreviewDamageDescription(token, "20703040538", "s4-preview"));
  assert.throws(() => resolvePreviewDamageDescription("{GPNumericalID:120300174:HpCalBase:13}", "20703040537", "s4-preview"));
});
