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

test("consumer follows mainSourceId exactly and rejects broken invariants", () => {
  const first = { id: "first" };
  const second = { id: "second" };
  assert.equal(
    getMainDamageSource({
      mainSourceId: "second",
      damageSources: [first, second],
    }),
    second,
  );
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
  assert.equal(catalog.isAttackCapable, false);
  assert.equal(catalog.mainSource, undefined);
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
