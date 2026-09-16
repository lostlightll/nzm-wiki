import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { getPerkByName } from "./perks";
import { getIndependentDamageByPerkSlug } from "./independent-damage";
import { resolvePreviewDamageDescription } from "./perk-preview-damage";
import { getResolvedWeaponBySlug } from "./weapons";
import { getResolvedFieldValue } from "./weapon-consumers";
import review from "../scripts/s4-preview-perks-review.json";

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
    const reference = perk.independentDamageSources?.[0];
    assert.ok(reference);
    assert.equal(reference.weaponSlug, "极寒冰神");
    const weapon = await getResolvedWeaponBySlug(reference.weaponSlug, "lc");
    const source = weapon?.damageSources.find(source => source.id === reference.damageSourceId);
    assert.ok(source);
    assert.equal(source.raw.numerical?.id, Number(id));
    assert.equal(Number(damage), getResolvedFieldValue(source.damage.base)! * 500);
  }
});

test("preview damage cannot leak into official perks or resolve unrelated tokens", () => {
  const token = "{GPNumericalID:120300174:HpCalScale:13}";
  const references = getPerkByName("极寒领域")!.independentDamageSources;
  assert.equal(resolvePreviewDamageDescription(token, "20703040537", "s4-preview", references), "50%");
  assert.throws(() => resolvePreviewDamageDescription(token, "20703040537", "s3", references));
  assert.throws(() => resolvePreviewDamageDescription(token, "20703040538", "s4-preview", references));
  assert.throws(() => resolvePreviewDamageDescription(token, "20703040537", "s4-preview"));
  assert.throws(() => resolvePreviewDamageDescription("{GPNumericalID:120300174:HpCalBase:13}", "20703040537", "s4-preview", references));
});

test("preview regeneration retains the reviewed weapon references", () => {
  for (const [id, name] of [
    ["20703040537", "极寒领域"],
    ["20703040538", "极寒之触"],
    ["20703040539", "极寒之痕"],
  ] as const) {
    const references = review[id].independent_damage_sources.map(reference => ({
      weaponSlug: reference.weapon_slug,
      damageSourceId: reference.damage_source_id,
      trigger: reference.trigger,
      interval: reference.interval,
    }));
    assert.deepEqual(getPerkByName(name)!.independentDamageSources, references);
  }
});

test("preview descriptions and damage panels both respect weapon Numerical overrides", async (context) => {
  const weaponPath = path.join(process.cwd(), "data/weapons/极寒冰神.mdx");
  const originalRead = fs.readFileSync;
  const document = matter(originalRead(weaponPath, "utf8"));
  document.data.damage_sources = document.data.damage_sources.map(
    (source: { id: string; source?: object }) => source.id === "cold-field"
      ? {
          ...source,
          source: {
            ...source.source,
            overrides: { numerical: { damage: { base: 0.75 } } },
            override_reason: "Test reviewed override",
          },
        }
      : source,
  );
  const overridden = matter.stringify(document.content, document.data);
  context.mock.method(fs, "readFileSync", (...args: Parameters<typeof fs.readFileSync>) =>
    String(args[0]) === weaponPath ? overridden : originalRead(...args),
  );

  const perk = getPerkByName("极寒领域")!;
  assert.match(perk.description!, /75%攻击力/);
  const sources = await getIndependentDamageByPerkSlug(perk.slug);
  assert.equal(sources[0].damageValue, "375");
  const weapon = await getResolvedWeaponBySlug("极寒冰神", "lc");
  const source = weapon!.damageSources.find(entry => entry.id === "cold-field")!;
  assert.equal(source.raw.numerical?.HpCalScale, 0.5);
  assert.equal(getResolvedFieldValue(source.damage.base), 0.75);
});
