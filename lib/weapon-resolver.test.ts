import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import matter from "gray-matter";
import type { WeaponDataLock } from "./weapon-data-lock";
import { transformWeaponV1Legacy } from "./weapon-legacy";
import {
  createResolvedWeaponSnapshot,
  resolveWeapon,
  toLegacyWeapon,
  WeaponResolutionError,
} from "./weapon-resolver";

const hash = "0".repeat(64);
type LockRaw = WeaponDataLock["rows"]["asc"][string]["raw"];
const sourcePaths: Record<keyof WeaponDataLock["sources"], string> = {
  "numerical-lc": "DataTables/numerical_config_composite.json",
  "numerical-td": "DataTables/TD_numerical_config_composite.json",
  asc: "Attributes/AutoGenerate/attr_weapon_asc.json",
  feel: "DataTables/WeaponFeelParamTable.json",
  item: "DataTables/LuaDataTable/WeaponItemConfigTable.json",
  "skill-pve": "DataTables/SkillConfigTable_Weapon_PVE.json",
  "gp-active-skill": "DataTables/GPActiveSkillDataTable.json",
};

function numericalRaw(extra: LockRaw = {}): LockRaw {
  return {
    id: 1,
    Level: 1,
    Settlements: [
      { TagName: "Numerical.SettlementType.Health.WeaponDamage" },
      { TagName: "Numerical.SettlementType.Impulse.Base" },
      { TagName: "Numerical.SettlementType.Element.ElementPointAdd" },
    ],
    HpCalScale: 100,
    ImpulseBase: 2,
    ElementAddRate: 4,
    ElementType: "EElementEffectType::EDamageType_Cryo",
    WeaknessDamageAddScale: 0.5,
    EnableWeaknessDamage: true,
    bEnableCriticalDamage: true,
    ToughnessDamageType: "EHardStrightWeaknessType::Impulse",
    bDamageIgnoreShield: false,
    unknown: { nested: true },
    ...extra,
  };
}

function ascRaw(id: number, extra: LockRaw = {}): LockRaw {
  return {
    ASCTypeID: id,
    FireIntervalBase: 0.2,
    SubFireCountPerShot: 1,
    SubFireIntervalBase: 0,
    SplinterNum: 1,
    ClipAmmoCountBase: 30,
    MaxAmmoCount: 180,
    ChangeClipAmmoCount: 30,
    WeaponAmmoCost: 1,
    HaveInfinityAmmo: false,
    DistanceBeginAttenuationBase: 1000,
    DistanceEndAttenuationBase: 3000,
    AttenuationMinScale: 0.5,
    WeaponMovingScaleBase: 1,
    WeaponSprintMovingScaleBase: 1.2,
    WeaponFiringMovingScale: 0.9,
    WeaponAimingMovingScale: 0.7,
    WeaponReloadMovingScale: 0.8,
    WeaponChargeStrengthOrPreheatMovingScale: 0.6,
    WeaponCrouchingMovingScale: 0.5,
    WeaponZoomMovingScaleBase: 0.4,
    ...extra,
  };
}

function lock(): WeaponDataLock {
  return {
    schema_version: 1,
    sources: Object.fromEntries(
      Object.entries(sourcePaths).map(([kind, source_path]) => [
        kind,
        { source_path, sha256: hash },
      ]),
    ) as WeaponDataLock["sources"],
    rows: {
      "numerical-lc": {
        "lc:1_1": { row_name: "1_1", raw: numericalRaw() },
      },
      "numerical-td": {},
      asc: {
        "10": { row_name: "10", raw: ascRaw(10) },
        "11": {
          row_name: "11",
          raw: ascRaw(11, {
            FireIntervalBase: 0.1,
            DistanceBeginAttenuationBase: 0,
            DistanceEndAttenuationBase: 0,
            AttenuationMinScale: 1,
          }),
        },
      },
      feel: {
        "10": {
          row_name: "10",
          raw: {
            WeaponFeelParamID: 10,
            WeaponChangeClipTimeBase: 2,
            WeaponChangeClipEndToFireTime: 0.4,
            ZoomTimeBase: 0,
            AccuracyRatio_Stand: 0.8,
          },
        },
        "11": { row_name: "11", raw: { WeaponFeelParamID: 11 } },
      },
      item: {
        "100": {
          row_name: "100",
          raw: {
            ItemID: 100,
            AccuracyInt: 88,
            StabilityInt: 77,
            Weapon_Scope: { LocalizedString: "高倍镜" },
            Quality: 4,
            WeaponType: 1,
            Radar_Damage: 8,
            Radar_Range: 7,
            Radar_Reload: 6,
            Radar_Accuracy: 5,
            Radar_Handling: 4,
            Radar_Mobility: 3,
          },
        },
      },
      "skill-pve": {
        "500_1": {
          row_name: "500_1",
          raw: { SkillID: 500, Level: 1, ChargeNeedTime: 25, SkillCount: 2 },
        },
      },
      "gp-active-skill": {},
    },
    active_skills: {
      "500_1": { source: "weapon_pve", source_key: "500_1" },
    },
  };
}

function weapon(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema_version: 2,
    title: "测试武器",
    prototype_id: "200",
    item_id: "100",
    use_type: "主武器",
    weapon_type: "突击步枪",
    element: "寒冷",
    rarity: "传说",
    active_skill_id: 500,
    damage_sources: [
      {
        id: "primary",
        name: "普通射击",
        section: "fire_mode",
        source: {
          prototype_mode: 0,
          numerical: { table: "lc", id: 1, level: 1 },
          asc_type_id: "10",
        },
      },
      {
        id: "fast-variant",
        name: "快速射击",
        section: "variant",
        inherits: "primary",
        source: { asc_type_id: "11" },
        overrides: { asc: { attenuation: { status: "not_applicable" } } },
        override_reason: "变体无距离衰减",
      },
    ],
    ...extra,
  };
}

function captureError(action: () => unknown): WeaponResolutionError {
  try {
    action();
  } catch (error) {
    assert.ok(error instanceof WeaponResolutionError);
    return error;
  }
  assert.fail("expected WeaponResolutionError");
}

test("V2 resolves Numerical, ASC, Feel, Item and Skill without flattening modes", () => {
  const resolved = resolveWeapon(weapon({ magazine: 31 }), {
    slug: "test",
    expectedTable: "lc",
    lock: lock(),
  });
  assert.equal(resolved.damageSources.length, 2);
  assert.equal(resolved.damageSources[0].damage.base.value, 100);
  assert.equal(resolved.damageSources[0].damage.toughness.state, "not_applicable");
  assert.equal(resolved.damageSources[0].element.value, "寒冷");
  assert.equal(resolved.damageSources[0].weaknessMultiplier.value, 1.5);
  assert.equal(resolved.damageSources[0].fire.rpm.value, 300);
  assert.equal(resolved.damageSources[0].attenuation.status, "applicable");
  assert.equal(resolved.damageSources[1].fire.interval.value, 0.1);
  assert.equal(resolved.damageSources[1].attenuation.status, "not_applicable");
  assert.equal(resolved.magazine.value, 30);
  assert.ok(
    resolved.diagnostics.some(
      (entry) => entry.code === "COMPAT_MISMATCH" && entry.path === "/magazine",
    ),
  );
  assert.equal(resolved.changeClip.timeBase.value, 2);
  assert.equal(resolved.accuracy.value, 88);
  assert.equal(resolved.weaponType.value, "突击步枪");
  assert.equal(resolved.officialRadar.mobility.value, 3);
  assert.equal(resolved.activeSkill?.chargeTime.value, 25);
  assert.equal(resolved.activeSkill?.source, "weapon_pve");

  const legacy = toLegacyWeapon(resolved);
  assert.equal(legacy.damageModes.length, 1);
  assert.equal(legacy.extraModes?.length, 1);
  assert.equal(legacy.skillCooldown, 25);
  assert.equal(legacy.range, undefined);
});

test("Numerical-only sources use compatibility fire behavior and pending stays unavailable", () => {
  const fixture = weapon({
    item_id: undefined,
    active_skill_id: 0,
    damage_sources: [
      {
        id: "skill-hit",
        name: "技能命中",
        section: "skill",
        source: { numerical: { table: "lc", id: 1, level: 1 } },
        fire_interval: 0,
        pellets: 2,
      },
      {
        id: "pending-hit",
        name: "待核验",
        section: "special",
        verification: { status: "pending", reason: "缺少 Numerical" },
      },
    ],
    draft: true,
  });
  const resolved = resolveWeapon(fixture, {
    slug: "pending",
    expectedTable: "lc",
    lock: lock(),
  });
  assert.equal(resolved.damageSources[0].fire.interval.state, "zero");
  assert.equal(resolved.damageSources[0].fire.rpm.state, "unavailable");
  assert.equal(resolved.damageSources[0].fire.pellets.value, 2);
  assert.equal(resolved.damageSources[1].damage.base.state, "unavailable");
});

test("invalid Settlement, missing Lock and invalid attenuation fail with stable codes", () => {
  const badSettlement = lock();
  badSettlement.rows["numerical-lc"]["lc:1_1"].raw.Settlements = null;
  assert.equal(
    captureError(() =>
      resolveWeapon(weapon(), { slug: "bad", expectedTable: "lc", lock: badSettlement }),
    ).code,
    "INVALID_SETTLEMENT",
  );

  const missing = lock();
  delete missing.rows.asc["10"];
  assert.equal(
    captureError(() =>
      resolveWeapon(weapon(), { slug: "missing", expectedTable: "lc", lock: missing }),
    ).code,
    "MISSING_LOCK",
  );

  const badAttenuation = lock();
  badAttenuation.rows.asc["10"].raw.DistanceEndAttenuationBase = 500;
  assert.equal(
    captureError(() =>
      resolveWeapon(weapon(), {
        slug: "attenuation",
        expectedTable: "lc",
        lock: badAttenuation,
      }),
    ).code,
    "INVALID_ATTENUATION",
  );

  const rescuedAttenuation = lock();
  rescuedAttenuation.rows.asc["10"].raw.DistanceBeginAttenuationBase = 500;
  rescuedAttenuation.rows.asc["10"].raw.DistanceEndAttenuationBase = 500;
  const rescued = resolveWeapon(
    weapon({
      damage_sources: [
        {
          id: "primary",
          name: "普通射击",
          section: "fire_mode",
          source: {
            numerical: { table: "lc", id: 1, level: 1 },
            asc_type_id: "10",
          },
          overrides: {
            asc: {
              attenuation: {
                status: "applicable",
                begin_meters: 10,
                end_meters: 20,
                min_scale: 0.5,
              },
            },
          },
          override_reason: "保留已发布衰减",
        },
      ],
    }),
    {
      slug: "rescued-attenuation",
      expectedTable: "lc",
      lock: rescuedAttenuation,
    },
  );
  assert.equal(rescued.damageSources[0].attenuation.status, "applicable");
  assert.deepEqual(rescued.damageSources[0].attenuation.raw, {
    beginCm: 500,
    endCm: 500,
    minScale: 0.5,
  });
  assert.equal(rescued.damageSources[0].attenuation.overrideHistory.length, 1);
});

test("Numerical overrides preserve zero and reject Settlement-inapplicable fields", () => {
  const zero = weapon({
    damage_sources: [
      {
        id: "primary",
        name: "普通射击",
        section: "fire_mode",
        source: {
          numerical: { table: "lc", id: 1, level: 1 },
          asc_type_id: "10",
        },
        overrides: { numerical: { damage: { base: 0 } } },
        override_reason: "实测为零",
      },
    ],
  });
  const resolved = resolveWeapon(zero, {
    slug: "zero",
    expectedTable: "lc",
    lock: lock(),
  });
  assert.equal(resolved.damageSources[0].damage.base.state, "zero");
  assert.equal(resolved.damageSources[0].damage.base.overrideHistory.length, 1);

  const notApplicable = weapon({
    damage_sources: [
      {
        id: "primary",
        name: "普通射击",
        section: "fire_mode",
        source: { numerical: { table: "lc", id: 1, level: 1 } },
        overrides: { numerical: { damage: { toughness: 1 } } },
        override_reason: "错误覆盖",
      },
    ],
  });
  assert.equal(
    captureError(() =>
      resolveWeapon(notApplicable, {
        slug: "not-applicable",
        expectedTable: "lc",
        lock: lock(),
      }),
    ).code,
    "OVERRIDE_NOT_APPLICABLE",
  );
});

test("ASC fire interval overrides preserve ordered interval and RPM history", () => {
  const damageSources = [
    {
      id: "primary",
      name: "普通射击",
      section: "fire_mode",
      source: {
        numerical: { table: "lc", id: 1, level: 1 },
        asc_type_id: "10",
      },
      overrides: { asc: { fire_interval: 0.15 } },
      override_reason: "实测基础射击间隔",
    },
    {
      id: "variant",
      name: "射速变体",
      section: "variant",
      inherits: "primary",
      source: { asc_type_id: "11" },
      fire_interval: 0.12,
      overrides: { asc: { fire_interval: 0.12 } },
      override_reason: "实测变体射击间隔",
    },
  ];
  const fixture = weapon({
    item_id: undefined,
    active_skill_id: 0,
    damage_sources: damageSources,
  });
  const resolved = resolveWeapon(fixture, {
    slug: "fire-interval-overrides",
    expectedTable: "lc",
    lock: lock(),
  });
  const variant = resolved.damageSources[1];

  assert.equal(variant.fire.interval.value, 0.12);
  assert.deepEqual(variant.fire.interval.overrideHistory, [
    {
      sourceId: "primary",
      reason: "实测基础射击间隔",
      before: 0.1,
      after: 0.15,
    },
    {
      sourceId: "variant",
      reason: "实测变体射击间隔",
      before: 0.15,
      after: 0.12,
    },
  ]);
  assert.equal(variant.fire.rpm.value, 500);
  assert.deepEqual(variant.fire.rpm.overrideHistory, [
    {
      sourceId: "primary",
      reason: "实测基础射击间隔",
      before: 600,
      after: 400,
    },
    {
      sourceId: "variant",
      reason: "实测变体射击间隔",
      before: 400,
      after: 500,
    },
  ]);
  assert.ok(
    variant.fire.interval.provenance.some(
      (entry) => entry.kind === "lock-asc" && entry.sourceKey === "11",
    ),
  );
  assert.ok(
    variant.fire.rpm.provenance.some(
      (entry) => entry.kind === "derived" && entry.rawField === "60 / interval",
    ),
  );
  assert.ok(
    !resolved.diagnostics.some(
      (entry) =>
        entry.code === "COMPAT_MISMATCH" &&
        entry.path === "/damageSources/variant/fire/interval",
    ),
  );

  const mismatch = resolveWeapon(
    {
      ...fixture,
      damage_sources: [
        damageSources[0],
        { ...damageSources[1], fire_interval: 0.11 },
      ],
    },
    { slug: "fire-interval-mismatch", expectedTable: "lc", lock: lock() },
  );
  assert.ok(
    mismatch.diagnostics.some(
      (entry) =>
        entry.code === "COMPAT_MISMATCH" &&
        entry.path === "/damageSources/variant/fire/interval",
    ),
  );
});

test("zero ASC interval makes RPM unavailable and ASC-less overrides fail", () => {
  const zero = resolveWeapon(
    weapon({
      item_id: undefined,
      active_skill_id: 0,
      damage_sources: [
        {
          id: "primary",
          name: "零间隔来源",
          section: "fire_mode",
          source: {
            numerical: { table: "lc", id: 1, level: 1 },
            asc_type_id: "10",
          },
          overrides: { asc: { fire_interval: 0 } },
          override_reason: "该阶段不按射速循环",
        },
      ],
    }),
    { slug: "zero-fire-interval", expectedTable: "lc", lock: lock() },
  );
  assert.equal(zero.damageSources[0].fire.interval.state, "zero");
  assert.equal(zero.damageSources[0].fire.rpm.state, "unavailable");
  assert.deepEqual(zero.damageSources[0].fire.rpm.overrideHistory, [
    {
      sourceId: "primary",
      reason: "该阶段不按射速循环",
      before: 300,
      after: undefined,
    },
  ]);

  const noAsc = weapon({
    item_id: undefined,
    active_skill_id: 0,
    damage_sources: [
      {
        id: "skill-hit",
        name: "技能命中",
        section: "skill",
        source: { numerical: { table: "lc", id: 1, level: 1 } },
        overrides: { asc: { fire_interval: 0.2 } },
        override_reason: "无 ASC 的非法覆盖",
      },
    ],
  });
  const error = captureError(() =>
    resolveWeapon(noAsc, {
      slug: "asc-less-override",
      expectedTable: "lc",
      lock: lock(),
    }),
  );
  assert.equal(error.code, "OVERRIDE_SOURCE_MISSING");
  assert.equal(error.path, "/damageSources/skill-hit/overrides/asc");
});

test("legacy bridge uses the resolved main source when V2 has no fire mode", () => {
  const melee = resolveWeapon(
    weapon({
      item_id: undefined,
      active_skill_id: 0,
      use_type: "近战武器",
      weapon_type: "近战武器",
      damage_sources: [
        {
          id: "heavy-hit",
          name: "重击",
          section: "melee",
          source: { numerical: { table: "lc", id: 1, level: 1 } },
        },
        {
          id: "light-hit",
          name: "轻击",
          section: "melee",
          source: { numerical: { table: "lc", id: 1, level: 1 } },
        },
      ],
    }),
    { slug: "melee-bridge", expectedTable: "lc", lock: lock() },
  );
  const projectedMelee = toLegacyWeapon(melee);
  assert.deepEqual(
    projectedMelee.damageModes.map((mode) => mode.name),
    ["重击"],
  );
  assert.deepEqual(
    projectedMelee.extraModes?.map((mode) => mode.name),
    ["轻击"],
  );

  const nonAttacking = resolveWeapon(
    weapon({
      item_id: undefined,
      active_skill_id: 0,
      damage_sources: [],
    }),
    { slug: "non-attacking-bridge", expectedTable: "lc", lock: lock() },
  );
  const projectedNonAttacking = toLegacyWeapon(nonAttacking);
  assert.deepEqual(projectedNonAttacking.damageModes, []);
  assert.equal(projectedNonAttacking.extraModes, undefined);
});

test("supplemental attenuation samples use source overrides without weapon-name branches", () => {
  const sampleLock = lock();
  const samples = [
    { id: "236", begin: 1800, end: 4000, scale: 0.4 },
    { id: "159", begin: 2600, end: 5000, scale: 0.5 },
    { id: "357", begin: 8000, end: 12000, scale: 0.8 },
    { id: "117", begin: 0, end: 0, scale: 1 },
  ] as const;
  for (const sample of samples) {
    sampleLock.rows.asc[sample.id] = {
      row_name: sample.id,
      raw: ascRaw(Number(sample.id), {
        DistanceBeginAttenuationBase: sample.begin,
        DistanceEndAttenuationBase: sample.end,
        AttenuationMinScale: sample.scale,
      }),
    };
    sampleLock.rows.feel[sample.id] = {
      row_name: sample.id,
      raw: { WeaponFeelParamID: Number(sample.id) },
    };
  }
  const overridden = (id: string, name: string) => ({
    id,
    name,
    section: "special",
    source: {
      numerical: { table: "lc", id: 1, level: 1 },
      asc_type_id: id === "energy-shadow" ? "236" : id === "vibration" ? "159" : "357",
    },
    overrides: { asc: { attenuation: { status: "not_applicable" } } },
    override_reason: "实测确认该来源不使用距离衰减",
  });
  const resolved = resolveWeapon(
    weapon({
      item_id: undefined,
      active_skill_id: 0,
      damage_sources: [
        overridden("energy-shadow", "能源之影"),
        overridden("vibration", "振弦"),
        overridden("burst-star", "爆星"),
        {
          id: "steel-roar",
          name: "钢铁轰鸣",
          section: "special",
          source: {
            numerical: { table: "lc", id: 1, level: 1 },
            asc_type_id: "117",
          },
        },
      ],
    }),
    { slug: "attenuation-samples", expectedTable: "lc", lock: sampleLock },
  );

  assert.deepEqual(
    resolved.damageSources.map((source) => source.attenuation.status),
    ["not_applicable", "not_applicable", "not_applicable", "not_applicable"],
  );
  const energyAttenuation = resolved.damageSources[0].attenuation;
  assert.ok("raw" in energyAttenuation);
  assert.deepEqual(energyAttenuation.raw, {
    beginCm: 1800,
    endCm: 4000,
    minScale: 0.4,
  });
  assert.equal(resolved.damageSources[0].attenuation.overrideHistory.length, 1);
  assert.equal(resolved.damageSources[3].attenuation.overrideHistory.length, 0);
});

test("explicit Feel exception is resolved from its own Lock row with provenance", () => {
  const sampleLock = lock();
  sampleLock.rows.feel["99"] = {
    row_name: "99",
    raw: {
      WeaponFeelParamID: 99,
      WeaponChangeClipTimeBase: 3.5,
      WeaponChangeClipEndToFireTime: 0.25,
    },
  };
  const resolved = resolveWeapon(
    weapon({
      item_id: undefined,
      active_skill_id: 0,
      damage_sources: [
        {
          id: "explicit-feel",
          name: "显式 Feel 例外",
          section: "fire_mode",
          source: {
            numerical: { table: "lc", id: 1, level: 1 },
            asc_type_id: "10",
            feel_param_id: "99",
          },
        },
      ],
    }),
    { slug: "explicit-feel", expectedTable: "lc", lock: sampleLock },
  );
  const source = resolved.damageSources[0];
  assert.equal(source.feel.changeClipTime.value, 3.5);
  assert.equal(source.feel.changeClipEndToFire.value, 0.25);
  assert.ok(
    source.feel.changeClipTime.provenance.some(
      (entry) => entry.kind === "lock-feel" && entry.sourceKey === "99",
    ),
  );
  assert.ok(
    source.provenance.some(
      (entry) => entry.kind === "lock-feel" && entry.sourceKey === "99",
    ),
  );
});

test("Item identity is strict while invalid fields can use documented MDX fallback", () => {
  const missingItem = lock();
  delete missingItem.rows.item["100"];
  assert.equal(
    captureError(() =>
      resolveWeapon(weapon(), {
        slug: "missing-item",
        expectedTable: "lc",
        lock: missingItem,
      }),
    ).code,
    "MISSING_LOCK",
  );

  const invalidField = lock();
  invalidField.rows.item["100"].raw.AccuracyInt = 101;
  const resolved = resolveWeapon(weapon({ accuracy: 66 }), {
    slug: "item-fallback",
    expectedTable: "lc",
    lock: invalidField,
  });
  assert.equal(resolved.accuracy.value, 66);
  assert.deepEqual(
    resolved.accuracy.provenance.map((entry) => entry.note),
    ["rejected:invalid", "invalid-preferred"],
  );
  assert.ok(
    resolved.diagnostics.some(
      (entry) => entry.code === "INVALID_PREFERRED_FALLBACK",
    ),
  );
});

test("GP active skill selection is explicit and invalid PVE never falls back", () => {
  const gpLock = lock();
  delete gpLock.rows["skill-pve"]["500_1"];
  gpLock.rows["gp-active-skill"]["500"] = {
    row_name: "500",
    raw: { AbilityID: 999, CooldownDuration: 0, MaxChargeStackCount: 1 },
  };
  gpLock.active_skills["500_1"] = {
    source: "gp_fallback",
    source_key: "500",
  };
  const resolved = resolveWeapon(weapon(), {
    slug: "gp",
    expectedTable: "lc",
    lock: gpLock,
  });
  assert.equal(resolved.activeSkill?.source, "gp_fallback");
  assert.equal(resolved.activeSkill?.chargeTime.state, "zero");
  assert.ok(
    resolved.diagnostics.some(
      (entry) =>
        entry.code === "SOURCE_IDENTITY_DIFFERENCE" && entry.sourceKey === "500",
    ),
  );

  const invalidPve = lock();
  invalidPve.rows["skill-pve"]["500_1"].raw.ChargeNeedTime = "bad";
  invalidPve.rows["gp-active-skill"]["500"] = {
    row_name: "500",
    raw: { AbilityID: 500, CooldownDuration: 30, MaxChargeStackCount: 1 },
  };
  assert.equal(
    captureError(() =>
      resolveWeapon(weapon(), {
        slug: "bad-pve",
        expectedTable: "lc",
        lock: invalidPve,
      }),
    ).code,
    "INVALID_FIELD",
  );
});

test("invalid Feel values and invalid active skill references are rejected", () => {
  const invalidFeel = lock();
  invalidFeel.rows.feel["10"].raw.ZoomTimeBase = -1;
  assert.equal(
    captureError(() =>
      resolveWeapon(weapon(), {
        slug: "bad-feel",
        expectedTable: "lc",
        lock: invalidFeel,
      }),
    ).code,
    "INVALID_FIELD",
  );
  assert.equal(
    captureError(() =>
      resolveWeapon(weapon({ active_skill_id: -1 }), {
        slug: "bad-skill-id",
        expectedTable: "lc",
        lock: lock(),
      }),
    ).code,
    "INVALID_SOURCE",
  );
});

test("snapshot strips all raw values and supports simultaneous source ID swaps", () => {
  const resolved = resolveWeapon(weapon(), {
    slug: "snapshot",
    expectedTable: "lc",
    lock: lock(),
  });
  const snapshot = createResolvedWeaponSnapshot(resolved, {
    sourceIdMap: { primary: "fast-variant", "fast-variant": "primary" },
  });
  const serialized = JSON.stringify(snapshot);
  assert.doesNotMatch(serialized, /"raw":/);
  const snapshotWeapon = snapshot.weapon as {
    damageSources: { id: string }[];
    mainSourceId: string;
    diagnostics: { path: string }[];
  };
  assert.deepEqual(
    snapshotWeapon.damageSources.map((source) => source.id),
    ["fast-variant", "primary"],
  );
  assert.equal(snapshotWeapon.mainSourceId, "fast-variant");
  assert.ok(
    snapshotWeapon.diagnostics.some((entry) =>
      entry.path.startsWith("/damageSources/fast-variant/"),
    ),
  );

  assert.equal(
    captureError(() =>
      createResolvedWeaponSnapshot(resolved, {
        sourceIdMap: { primary: "fast-variant" },
      }),
    ).code,
    "INVALID_SNAPSHOT_MAPPING",
  );
});

test("V1 provenance keeps original damage and extra mode indices", () => {
  const resolved = resolveWeapon(
    {
      title: "V1 provenance",
      damage: { base: 1 },
      damage_modes: [
        { mode: -1, name: "ignored" },
        { mode: 0, name: "primary", fire_interval: 0.25, damage: { base: 2 } },
        { mode: 2, name: "" },
        { mode: 3, name: "third", damage: { base: 3 } },
      ],
      extra_modes: [
        { name: "" },
        { name: "extra", damage: { base: 4 } },
      ],
    },
    { slug: "v1-provenance", expectedTable: "lc" },
  );
  assert.deepEqual(
    resolved.damageSources.map((source) => ({
      id: source.id,
      rawField: source.damage.base.provenance[0]?.rawField,
    })),
    [
      { id: "v1-mode-0", rawField: "damage_modes[1].damage.base" },
      { id: "v1-mode-3", rawField: "damage_modes[3].damage.base" },
      { id: "v1-extra-1", rawField: "extra_modes[1].damage.base" },
    ],
  );
  assert.equal(
    resolved.damageSources[0].fire.interval.provenance[0]?.rawField,
    "damage_modes[1].fire_interval",
  );
  assert.deepEqual(
    resolved.damageSources[1].fire.interval.provenance.map((entry) => ({
      rawField: entry.rawField,
      note: entry.note,
    })),
    [
      { rawField: "damage_modes[1].fire_interval", note: undefined },
      { rawField: undefined, note: "inherited-primary-fire-interval" },
    ],
  );
  assert.equal(
    resolved.damageSources[2].fire.interval.provenance[0]?.rawField,
    "damage_modes[1].fire_interval",
  );

  const fallback = resolveWeapon(
    {
      title: "V1 fallback provenance",
      damage: { base: 5 },
      file_rate: 600,
      element: "火焰",
      weekness_multiplier: 1.25,
      damage_modes: [{ mode: 0, name: "" }],
    },
    { slug: "v1-fallback-provenance", expectedTable: "lc" },
  );
  assert.equal(fallback.damageSources[0].id, "v1-primary");
  assert.equal(fallback.damageSources[0].damage.base.provenance[0]?.rawField, "damage.base");
  assert.equal(fallback.damageSources[0].fire.interval.provenance[0]?.rawField, "file_rate");
  assert.equal(fallback.damageSources[0].element.provenance[0]?.rawField, "element");
  assert.equal(
    fallback.damageSources[0].weaknessMultiplier.provenance[0]?.rawField,
    "weekness_multiplier",
  );
});

test("all remaining LC and TD V1 files retain byte-shape legacy behavior", () => {
  let v1Count = 0;
  let v2Count = 0;
  for (const [directory, table] of [
    ["data/weapons", "lc"],
    ["data/weapons_td", "td"],
  ] as const) {
    for (const file of fs.readdirSync(directory).filter((name) => name.endsWith(".mdx"))) {
      const raw = matter(fs.readFileSync(path.join(directory, file), "utf8")).data;
      if (raw.schema_version === 2) {
        v2Count += 1;
        continue;
      }
      const slug = file.replace(/\.mdx$/, "");
      const expected = transformWeaponV1Legacy(raw, slug);
      const actual = toLegacyWeapon(
        resolveWeapon(raw, { slug, expectedTable: table }),
      );
      assert.deepStrictEqual(actual, expected, `${directory}/${file}`);
      v1Count += 1;
    }
  }
  assert.equal(v1Count, 34);
  assert.equal(v2Count, 190);
});
