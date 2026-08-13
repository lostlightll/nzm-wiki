import assert from "node:assert/strict";
import test from "node:test";
import { getAllResolvedWeapons } from "./weapons";
import { getResolvedFieldValue } from "./weapon-consumers";
import { buildWeaponBaseDamageIndex } from "./weapon-base-damage";
import { filterWeaponBaseDamageEntries } from "./weapon-base-damage";

function attackSourceCount(
  weapons: Awaited<ReturnType<typeof getAllResolvedWeapons>>,
): number {
  return weapons.reduce(
    (count, weapon) =>
      count +
      weapon.damageSources.filter(
        (source) => getResolvedFieldValue(source.damage.base) !== undefined,
      ).length,
    0,
  );
}

function meleeWeaponAttackSourceCount(
  weapons: Awaited<ReturnType<typeof getAllResolvedWeapons>>,
): number {
  return weapons.reduce(
    (count, weapon) =>
      count +
      (weapon.useType === "近战武器"
        ? weapon.damageSources.filter(
            (source) => getResolvedFieldValue(source.damage.base) !== undefined,
          ).length
        : 0),
    0,
  );
}

test("weapon base damage index includes every non-melee-weapon source", async () => {
  const [lcWeapons, tdWeapons] = await Promise.all([
    getAllResolvedWeapons("lc"),
    getAllResolvedWeapons("td"),
  ]);
  const entries = buildWeaponBaseDamageIndex({ lc: lcWeapons, td: tdWeapons });

  assert.equal(attackSourceCount(lcWeapons), 287);
  assert.equal(attackSourceCount(tdWeapons), 287);
  assert.equal(meleeWeaponAttackSourceCount(lcWeapons), 158);
  assert.equal(meleeWeaponAttackSourceCount(tdWeapons), 158);
  assert.equal(entries.filter((entry) => entry.modes.lc).length, 129);
  assert.equal(entries.filter((entry) => entry.modes.td).length, 129);
  assert.equal(new Set(entries.map((entry) => entry.id)).size, entries.length);
  assert.deepEqual(
    new Set(
      entries.flatMap((entry) =>
        Object.values(entry.modes).map((mode) => mode!.settlementType),
      ),
    ),
    new Set([
      "WeaponDamage",
      "MeleeWeaponDamage",
      "WeaponExplosionDamage",
      "WeaponSkillDamage",
      "SkillDamage",
      "DebuffDamage",
      "IndirectDamage",
    ]),
  );
  assert.deepEqual(
    new Set(entries.flatMap((entry) => Object.values(entry.modes).map((mode) => mode!.channel))),
    new Set(["hit", "explosion", "weapon-skill", "other"]),
  );
  assert.deepEqual(
    new Set(
      entries.flatMap((entry) =>
        Object.values(entry.modes).map((mode) => mode!.sourceTypeLabel),
      ),
    ),
    new Set(["命中", "爆炸", "武器技能", "非武器技能", "持续伤害", "间接伤害"]),
  );
  assert.deepEqual(
    new Set(entries.flatMap((entry) => Object.values(entry.modes).map((mode) => mode!.element))),
    new Set(["物理", "火焰", "寒冷", "电弧", "腐蚀"]),
  );
  assert.deepEqual(
    new Set(
      entries.flatMap((entry) =>
        Object.values(entry.modes).map((mode) => mode!.enableCritical),
      ),
    ),
    new Set([true, false]),
  );

  const meleeWeaponSlugs = new Set(
    lcWeapons
      .filter((weapon) => weapon.useType === "近战武器")
      .map((weapon) => weapon.slug),
  );
  assert.ok(
    entries.every(
      (entry) => !meleeWeaponSlugs.has(entry.id.slice(0, entry.id.indexOf(":"))),
    ),
  );
  assert.ok(
    entries.some(
      (entry) =>
        entry.weaponTitle === "刺隐" &&
        entry.modes.lc?.settlementType === "MeleeWeaponDamage",
    ),
  );
  assert.ok(
    entries.some(
      (entry) =>
        entry.weaponTitle === "夜影之逝" &&
        entry.modes.lc?.settlementType === "MeleeWeaponDamage",
    ),
  );
  assert.deepEqual(
    new Set(
      entries.flatMap((entry) =>
        Object.values(entry.modes).map((mode) => mode!.enableWeakness),
      ),
    ),
    new Set([true, false]),
  );
});

test("weapon base damage index uses MDX names and mode-specific values", async () => {
  const [lcWeapons, tdWeapons] = await Promise.all([
    getAllResolvedWeapons("lc"),
    getAllResolvedWeapons("td"),
  ]);
  const entries = buildWeaponBaseDamageIndex({ lc: lcWeapons, td: tdWeapons });

  const beastGrenade = entries.find(
    (entry) => entry.id === "精绝兽神:mi-fa-liu-dan",
  );
  assert.ok(beastGrenade);
  assert.equal(beastGrenade.displayName, "精绝兽神 秘法榴弹");
  assert.equal(beastGrenade.modes.lc?.channel, "weapon-skill");
  assert.equal(beastGrenade.modes.lc?.coefficient, 1.5);
  assert.equal(beastGrenade.modes.lc?.baseDamage, 750);
  assert.equal(beastGrenade.modes.td?.coefficient, 1.05);
  assert.equal(beastGrenade.modes.td?.baseDamage, 420);

  const floatingMode = entries.find(
    (entry) => entry.id === "能源之影:fu-you-mo-shi",
  );
  assert.ok(floatingMode);
  assert.equal(floatingMode.displayName, "能源之影 浮游模式");
  assert.equal(floatingMode.modes.lc?.coefficient, 0.7);
  assert.equal(floatingMode.modes.lc?.baseDamage, 350);
  assert.ok(entries.every((entry) => !entry.displayName.includes("主动技后台")));
});

test("weapon base damage index keeps sources that exist in only one mode", async () => {
  const lcWeapons = await getAllResolvedWeapons("lc");
  const entries = buildWeaponBaseDamageIndex({ lc: lcWeapons.slice(0, 1), td: [] });

  assert.ok(entries.length > 0);
  assert.ok(entries.every((entry) => entry.modes.lc !== undefined));
  assert.ok(entries.every((entry) => entry.modes.td === undefined));
  assert.equal(
    filterWeaponBaseDamageEntries(entries, "td", {
      query: "",
      channel: "all",
      element: "all",
    }).length,
    0,
  );
});

test("weapon base damage filters combine name, channel, and element", async () => {
  const [lcWeapons, tdWeapons] = await Promise.all([
    getAllResolvedWeapons("lc"),
    getAllResolvedWeapons("td"),
  ]);
  const entries = buildWeaponBaseDamageIndex({ lc: lcWeapons, td: tdWeapons });

  const results = filterWeaponBaseDamageEntries(entries, "lc", {
    query: "精绝兽神",
    channel: "weapon-skill",
    element: "火焰",
  });

  assert.ok(results.some(({ entry }) => entry.displayName === "精绝兽神 秘法榴弹"));
  assert.ok(results.every(({ entry }) => entry.displayName.includes("精绝兽神")));
  assert.ok(results.every(({ mode }) => mode.channel === "weapon-skill"));
  assert.ok(results.every(({ mode }) => mode.element === "火焰"));
  assert.deepEqual(
    results.map(({ mode }) => mode.order),
    results.map(({ mode }) => mode.order).toSorted((left, right) => left - right),
  );
});
