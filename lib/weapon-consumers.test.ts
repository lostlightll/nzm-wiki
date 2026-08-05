import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  getActiveSkillDisplay,
  getNonMainMeleeSources,
  getMainDamageSource,
  getResolvedFieldValue,
  toWeaponCatalogEntry,
  toWeaponDetailData,
  WeaponConsumerInvariantError,
} from "./weapon-consumers";
import type { ResolvedWeapon } from "./weapon-resolver";
import {
  getAllResolvedWeapons,
  getResolvedWeaponBySlug,
} from "./weapons";
import {
  getWeaponAttenuationChartInput,
} from "../components/WeaponAttenuationChart";
import {
  createWeaponSearchItem,
  createWeaponStat,
  scanDirectory,
} from "../scripts/generate-search-index";

const PILOTS = ["星海狂想", "飓风之龙", "幽冥毒皇", "军用手斧", "木葫芦"];

async function requireWeapon(
  slug: string,
  table: "lc" | "td",
): Promise<ResolvedWeapon> {
  const weapon = await getResolvedWeaponBySlug(slug, table);
  assert.ok(weapon, `${table}:${slug} must resolve`);
  return weapon;
}

test("consumer follows mainSourceId and permits non-attacking settlement sources", () => {
  const first = { id: "first", damage: { base: { state: "resolved" as const } } };
  const second = { id: "second", damage: { base: { state: "zero" as const } } };
  const recovery = { id: "recovery", damage: { base: { state: "not_applicable" as const } } };
  assert.equal(
    getMainDamageSource({
      mainSourceId: "second",
      damageSources: [first, second],
    }),
    second,
  );
  assert.equal(getMainDamageSource({ damageSources: [recovery] }), undefined);
  assert.throws(
    () => getMainDamageSource({ damageSources: [first] }),
    WeaponConsumerInvariantError,
  );
  assert.throws(
    () =>
      getMainDamageSource({
        mainSourceId: "missing",
        damageSources: [first],
      }),
    WeaponConsumerInvariantError,
  );
  assert.throws(
    () =>
      getMainDamageSource({
        mainSourceId: "recovery",
        damageSources: [recovery],
      }),
    /points to a non-attacking source/,
  );
  assert.equal(getMainDamageSource({ damageSources: [] }), undefined);
});

test("client projections preserve normalized domains without audit payload", async () => {
  const weapon = structuredClone(await requireWeapon("飓风之龙", "lc"));
  const sentinel = "LOCK_RAW_SENTINEL_TASK_6";
  const mutable = weapon as unknown as {
    raw: { mdx: Record<string, unknown> };
    diagnostics: Array<Record<string, unknown>>;
    provenance: Array<Record<string, unknown>>;
    damageSources: Array<{
      raw: { numerical?: Record<string, unknown> };
      provenance: Array<Record<string, unknown>>;
    }>;
  };
  mutable.raw.mdx.sentinel = sentinel;
  mutable.diagnostics.push({ message: sentinel });
  mutable.provenance.push({ rawField: sentinel, sourceKey: sentinel });
  const numericalRaw = mutable.damageSources[0]?.raw.numerical;
  if (numericalRaw) numericalRaw.sentinel = sentinel;
  mutable.damageSources[0]?.provenance.push({ rawField: sentinel });

  const detail = toWeaponDetailData(weapon);
  const catalog = toWeaponCatalogEntry(weapon);
  const serialized = JSON.stringify({ detail, catalog });
  assert.equal(serialized.includes(sentinel), false);

  const forbiddenKeys = new Set([
    "raw",
    "provenance",
    "diagnostics",
    "overrideHistory",
    "sourceKey",
    "rawField",
  ]);
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      assert.equal(forbiddenKeys.has(key), false, `forbidden DTO key: ${key}`);
      walk(child);
    }
  };
  walk(detail);
  walk(catalog);

  const burst = detail.damageSources.find(
    (source) => source.id === "shotgun-burst",
  );
  assert.ok(burst);
  assert.equal(getResolvedFieldValue(burst.feel.changeClipTime), 2.2);
  assert.equal(
    getResolvedFieldValue(burst.fire.rpm),
    181.8181818181818,
  );
  assert.ok(Object.keys(burst.feel.accuracyRatios).length > 0);
});

test("pilot main source, LC/TD context, attenuation, and element agree", async () => {
  for (const slug of PILOTS) {
    const lc = await requireWeapon(slug, "lc");
    const td = await requireWeapon(slug, "td");
    assert.equal(lc.table, "lc");
    assert.equal(td.table, "td");
    assert.equal(toWeaponDetailData(lc).table, "lc");
    assert.equal(toWeaponDetailData(td).table, "td");
  }

  const hurricane = await requireWeapon("飓风之龙", "lc");
  assert.equal(hurricane.mainSourceId, "shotgun");
  const detail = toWeaponDetailData(hurricane);
  const shotgun = detail.damageSources.find((source) => source.id === "shotgun");
  const dragonFlame = detail.damageSources.find(
    (source) => source.id === "dragon-flame-hit",
  );
  assert.ok(shotgun);
  assert.ok(dragonFlame);
  assert.ok(getWeaponAttenuationChartInput(detail, shotgun));
  assert.equal(getWeaponAttenuationChartInput(detail, dragonFlame), null);

  const gourd = await requireWeapon("木葫芦", "lc");
  const catalog = toWeaponCatalogEntry(gourd);
  assert.equal(gourd.damageSources.length, 1);
  assert.equal(gourd.damageSources[0].damage.base.state, "not_applicable");
  assert.equal(catalog.isAttackCapable, false);
  assert.equal(catalog.mainSource, undefined);
  assert.deepEqual(toWeaponDetailData(gourd).damageSources, []);
  assert.equal(createWeaponStat(gourd), null);
  const element = getResolvedFieldValue(catalog.element);
  assert.ok(element);
  assert.ok(createWeaponSearchItem(gourd).keywords.includes(element));

  const axe = await requireWeapon("军用手斧", "lc");
  const axeCatalog = toWeaponCatalogEntry(axe);
  assert.equal(axeCatalog.meleeSources.length, 3);
  assert.deepEqual(
    getNonMainMeleeSources(axeCatalog).map((source) => source.id),
    ["light-hit-left", "light-hit-right"],
  );

  const night = await requireWeapon("夜影之逝", "lc");
  assert.equal(night.damageSources.at(-1)?.id, "jin-zhan-hui-xue");
  assert.equal(night.damageSources.at(-1)?.damage.base.state, "not_applicable");
  const nightDetail = toWeaponDetailData(night);
  assert.equal(
    nightDetail.damageSources.some((source) => source.id === "jin-zhan-hui-xue"),
    false,
  );
  assert.deepEqual(
    toWeaponCatalogEntry(night).meleeSources.map((source) => source.id),
    ["you-jian-jin-zhan", "qie-dao-jin-zhan"],
  );
});

test("search and weapon stats use the same normalized LC main source", async () => {
  const allLc = await getAllResolvedWeapons("lc");
  for (const slug of ["星海狂想", "飓风之龙", "幽冥毒皇"]) {
    const weapon = allLc.find((candidate) => candidate.slug === slug);
    assert.ok(weapon);
    const source = getMainDamageSource(weapon);
    assert.ok(source);
    const stat = createWeaponStat(weapon);
    assert.ok(stat);
    assert.equal(stat.damage_base, getResolvedFieldValue(source.damage.base));
    assert.equal(
      stat.weakness_multiplier,
      getResolvedFieldValue(source.weaknessMultiplier),
    );
    assert.equal(stat.rpm, getResolvedFieldValue(source.fire.rpm));
    assert.equal(stat.element, getResolvedFieldValue(weapon.element));
    assert.ok(createWeaponSearchItem(weapon).keywords.includes(weapon.title));
    assert.equal("weekness_multiplier" in stat, false);
    assert.equal("file_rate" in stat, false);
    assert.equal("attenuation_begin" in stat, false);
  }

  const melee = await requireWeapon("军用手斧", "lc");
  assert.equal(createWeaponStat(melee), null);
  const td = await requireWeapon("飓风之龙", "td");
  assert.throws(() => createWeaponStat(td), /only accepts LC/);
});

test("Task 7.7 representative mappings remain fixed across Resolver and consumers", async () => {
  const energy = await requireWeapon("能源之影", "lc");
  const floating = energy.damageSources.find((source) => source.id === "fu-you-mo-shi");
  const assault = energy.damageSources.find((source) => source.id === "qiang-xi-ji-guang");
  assert.ok(floating);
  assert.ok(assault);
  assert.equal(floating.raw.asc, undefined);
  assert.equal(getResolvedFieldValue(floating.fire.interval), 0.65);
  assert.equal(assault.raw.asc, undefined);
  assert.equal(assault.fire.interval.state, "missing");

  const festival = await requireWeapon("元宵来袭", "lc");
  assert.deepEqual(
    ["pu-tong-she-ji", "pao-ti-mo-shi"].map(
      (id) => festival.damageSources.find((source) => source.id === id)?.raw.asc?.ASCTypeID,
    ),
    ["264", "337"],
  );

  const darkNight = await requireWeapon("暗夜之殇", "lc");
  assert.equal(darkNight.activeSkill?.id, 5100101);
  assert.equal(getResolvedFieldValue(darkNight.activeSkill!.chargeTime), 45);

  const fireGod = await requireWeapon("火神炎帝", "lc");
  assert.equal(fireGod.activeSkill?.id, 5103601);
  assert.equal(fireGod.activeSkill?.source, "gp_fallback");
  assert.equal(getResolvedFieldValue(fireGod.activeSkill!.chargeTime), 0);

  const hidden = await requireWeapon("刺隐", "lc");
  assert.equal(hidden.damageSources[1].section, "melee");
  assert.equal(hidden.damageSources[0].attenuation.status, "applicable");
  const hiddenTd = await requireWeapon("刺隐", "td");
  assert.equal(hiddenTd.damageSources[0].attenuation.status, "not_applicable");

  const steel = await requireWeapon("钢铁轰鸣", "lc");
  assert.deepEqual(
    steel.damageSources.map((source) => [source.id, source.section]),
    [
      ["liu-dan-ming-zhong", "fire_mode"],
      ["liu-dan-bao-zha", "special"],
      ["liu-dan-chuan-tou", "special"],
    ],
  );

  const copper = await requireWeapon("鬼铜蚀", "lc");
  const recovery = copper.damageSources.find((source) => source.id === "hui-xue-hui-fu");
  assert.ok(recovery);
  assert.equal(recovery.name, "回血恢复");
  assert.equal(recovery.damage.base.state, "not_applicable");
  assert.equal(
    toWeaponDetailData(copper).damageSources.some((source) => source.id === recovery.id),
    false,
  );
  assert.equal(
    copper.damageSources.find((source) => source.id === "d-o-t-chi-shang-hai-jian-su-cha-jian")
      ?.section,
    "dot",
  );

  const husky = await requireWeapon("哈士奇好友", "lc");
  assert.equal(
    husky.damageSources.find((source) => source.raw.numerical?.id === 121600112)?.name,
    "丢枪爆炸",
  );
});

test("generic scanner skips weapon directories before reading MDX", () => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "weapon-search-task6-"));
  try {
    fs.mkdirSync(path.join(fixtureRoot, "posts"), { recursive: true });
    fs.mkdirSync(path.join(fixtureRoot, "weapons"), { recursive: true });
    fs.mkdirSync(path.join(fixtureRoot, "weapons_td"), { recursive: true });
    fs.writeFileSync(
      path.join(fixtureRoot, "posts", "ok.mdx"),
      "---\ntitle: 可读取\n---\n",
      "utf8",
    );
    const invalidMdx = "---\ninvalid: [\n---\nSHOULD_NOT_BE_READ";
    fs.writeFileSync(
      path.join(fixtureRoot, "weapons", "bad.mdx"),
      invalidMdx,
      "utf8",
    );
    fs.writeFileSync(
      path.join(fixtureRoot, "weapons_td", "bad.mdx"),
      invalidMdx,
      "utf8",
    );
    const results = scanDirectory(fixtureRoot);
    assert.deepEqual(results.map((item) => item.title), ["可读取"]);
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("active skill display never falls back to content cooldown", () => {
  assert.deepEqual(
    getActiveSkillDisplay(
      {
        id: 1,
        level: 1,
        source: "mdx_v1",
        chargeTime: { state: "missing" },
        chargeCount: { state: "missing" },
      },
      3,
    ),
    { cooldown: undefined, count: 3 },
  );
  assert.deepEqual(
    getActiveSkillDisplay(
      {
        id: 1,
        level: 1,
        source: "weapon_pve",
        chargeTime: { state: "zero", value: 0 },
        chargeCount: { state: "resolved", value: 2 },
      },
      9,
    ),
    { cooldown: 0, count: 2 },
  );
});

test("Task 6 consumer boundary contains no legacy or raw-data imports", () => {
  const root = process.cwd();
  const files = [
    "app/(pages)/weapons/[slug]/page.tsx",
    "app/(pages)/weapons/td/[slug]/page.tsx",
    "app/(pages)/weapons/client.tsx",
    "app/(pages)/weapons/page.tsx",
    "components/WeaponCard.tsx",
    "components/WeaponMasonry.tsx",
    "components/WeaponAttenuationChart.tsx",
    "components/WeaponDetailContext.tsx",
    "components/DamageCalculator.tsx",
  ];
  const forbidden = [
    "gray-matter",
    "weapon-data-lock",
    "weapon-legacy",
    "getMDXDetail",
    "getMDXList",
    ".damageModes",
    ".extraModes",
    ".skillCooldown",
    ".attenuation_begin",
    ".attenuation_end",
    ".attenuation_scale",
    "weekness_multiplier",
    "file_rate",
  ];
  for (const relativePath of files) {
    const source = fs.readFileSync(path.join(root, relativePath), "utf8");
    for (const token of forbidden) {
      assert.equal(
        source.includes(token),
        false,
        `${relativePath} contains forbidden token ${token}`,
      );
    }
  }
});
