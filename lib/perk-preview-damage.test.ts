import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { getPerkByName } from "./perks";
import { getIndependentDamageByPerkSlug, resolvePerkReferences } from "./independent-damage";
import { getPerkSourceEntries } from "./perk-source";
import { resolvePreviewDamageDescription } from "./perk-preview-damage";
import { parsePerkIndependentDamageSnapshot } from "./perk-preview-catalog";
import { getResolvedWeaponBySlug } from "./weapons";
import { getResolvedFieldValue } from "./weapon-consumers";
import review from "../scripts/s4-preview-perks-review.json";

test("released cryo perks share Numerical coefficients between descriptions and damage panels", async () => {
  for (const [name, id, percent, damage, type] of [
    ["极寒领域", "120300174", "50%", "250", "武器技能伤害"],
    ["极寒之触", "120300175", "20%", "100", "技能伤害"],
    ["极寒之痕", "120300176", "45%", "225", "技能伤害"],
  ]) {
    const perk = getPerkByName(name)!;
    assert.equal(getPerkByName(name, "preview"), null);
    assert.ok(!perk.slug.startsWith("preview/"));
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

test("formal damage requires exact reviewed references and inactive preview tokens fail", () => {
  const token = "{GPNumericalID:120300174:HpCalScale:13}";
  const references = getPerkByName("极寒领域")!.independentDamageSources;
  assert.equal(resolvePreviewDamageDescription(token, "20703040537", "s4", references), "50%");
  assert.equal(resolvePreviewDamageDescription(token, "20703040537", undefined, references), "50%");
  assert.throws(() => resolvePreviewDamageDescription(token, "20703040537", "s4-preview", references, null), /Unconfigured/);
  const unrelatedReferences = getPerkByName("极寒之触")!.independentDamageSources;
  assert.throws(() => resolvePreviewDamageDescription(token, "20703040538", "s4", unrelatedReferences));
  assert.throws(() => resolvePreviewDamageDescription(token, "20703040537", "s4"));
  assert.throws(() => resolvePreviewDamageDescription("{GPNumericalID:120300174:HpCalBase:13}", "20703040537", "s4", references));
});

test("future preview tokens use reviewed references without an ItemID or weapon allowlist", async () => {
  const references = [{ weaponSlug: "夜影之逝", damageSourceId: "guan-chang-hong-jian-qi", trigger: "审定触发", interval: "每次触发" }];
  const token = "{GPNumericalID:120300245:HpCalScale:13}";
  const preview = { season: "s5", version: "s5-preview", label: "S5 Preview" };
  const weapon = await getResolvedWeaponBySlug("夜影之逝", "lc");
  const source = weapon!.damageSources.find(entry => entry.id === "guan-chang-hong-jian-qi")!;
  const expected = `${Math.round(getResolvedFieldValue(source.damage.base)! * 100 * 10000) / 10000}%`;
  assert.equal(resolvePreviewDamageDescription(token, "future-item", "s5-preview", references, preview), expected);
  assert.throws(() => resolvePreviewDamageDescription(token, "future-item", "s4-preview", references, preview));
  assert.throws(() => resolvePreviewDamageDescription(token, "future-item", "s5-preview", references, null));
  assert.throws(() => resolvePreviewDamageDescription(token, "future-item", "s5-preview", [...references, ...references], preview), /ambiguous/);
});

test("formal publication retains the reviewed weapon references", () => {
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

test("explicit frozen snapshot remains stable while formal rebuild respects Numerical overrides", async (context) => {
  const perk = getPerkByName("极寒领域")!;
  const frozenDescription = perk.description;
  const frozenSnapshot = structuredClone(await getIndependentDamageByPerkSlug(perk.slug));
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

  assert.match(frozenDescription!, /50%攻击力/);
  const sources = parsePerkIndependentDamageSnapshot(frozenSnapshot);
  assert.equal(sources[0].damageValue, "250");
  const candidate = getPerkSourceEntries("current").find(entry => entry.perk.itemId === perk.itemId)!.perk;
  assert.match(candidate.description!, /75%攻击力/);
  assert.equal((await resolvePerkReferences(candidate))[0].damageValue, "375");
  const weapon = await getResolvedWeaponBySlug("极寒冰神", "lc");
  const source = weapon!.damageSources.find(entry => entry.id === "cold-field")!;
  assert.equal(source.raw.numerical?.HpCalScale, 0.5);
  assert.equal(getResolvedFieldValue(source.damage.base), 0.75);
});
