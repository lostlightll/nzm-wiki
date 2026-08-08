import assert from "node:assert/strict";
import test from "node:test";
import {
  projectWeaponSourceV2,
  resolveDamageSourceReferences,
  validateWeaponSourceV2,
} from "./weapon-source-v2";

function weapon(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema_version: 2,
    title: "测试武器",
    game_modes: ["lc", "td"],
    prototype_id: "200",
    item_id: "100",
    use_type: "主武器",
    weapon_type: "突击步枪",
    element: "物理",
    rarity: "传说",
    damage_sources: [
      {
        id: "primary",
        name: "普通射击",
        section: "fire_mode",
        source: {
          prototype_mode: 0,
          numerical: { id: 1, level: 1 },
          asc_type_id: "10",
        },
      },
    ],
    ...extra,
  };
}

test("公共 source 分别投影为 LC/TD 引用", () => {
  const parsed = validateWeaponSourceV2(weapon());
  const lc = projectWeaponSourceV2(parsed, "lc");
  const td = projectWeaponSourceV2(parsed, "td");

  assert.deepEqual(lc.damage_sources[0].source?.numerical, {
    table: "lc",
    id: 1,
    level: 1,
  });
  assert.deepEqual(td.damage_sources[0].source?.numerical, {
    table: "td",
    id: 1,
    level: 1,
  });
});

test("sources 支持不同 Numerical ID 且不跨模式回退", () => {
  const parsed = validateWeaponSourceV2(
    weapon({
      damage_sources: [
        {
          id: "primary",
          name: "普通射击",
          section: "fire_mode",
          sources: {
            lc: { numerical: { id: 10, level: 1 } },
            td: { numerical: { id: 20, level: 2 } },
          },
        },
        {
          id: "healing",
          name: "恢复",
          section: "special",
          sources: { lc: { numerical: { id: 30, level: 1 } } },
        },
      ],
    }),
  );

  assert.equal(projectWeaponSourceV2(parsed, "lc").damage_sources.length, 2);
  const td = projectWeaponSourceV2(parsed, "td");
  assert.equal(td.damage_sources.length, 1);
  assert.equal(td.damage_sources[0].source?.numerical?.id, 20);
  assert.equal(resolveDamageSourceReferences(parsed, "td").has("healing"), false);
});

test("模式配置完整保存 override、攻击间隔和弹丸", () => {
  const parsed = validateWeaponSourceV2(
    weapon({
      damage_sources: [
        {
          id: "pulse",
          name: "脉冲",
          section: "skill",
          sources: {
            lc: {
              numerical: { id: 1, level: 1 },
              attack_interval: 0.25,
              attack_count: 4,
              attack_interval_source: "NZM/Content/Test/Ability#Interval",
              pellets: 3,
              overrides: { numerical: { damage: { base: 0 } } },
              override_reason: "实测确认",
            },
            td: { numerical: { id: 1, level: 1 }, pellets: 2 },
          },
        },
      ],
    }),
  );
  const source = projectWeaponSourceV2(parsed, "lc").damage_sources[0];
  assert.equal(source.attack_interval, 0.25);
  assert.equal(source.attack_count, 4);
  assert.equal(source.pellets, 3);
  assert.equal(source.overrides?.numerical?.damage?.base, 0);
});

test("继承按模式展开并保留覆盖顺序", () => {
  const parsed = validateWeaponSourceV2(
    weapon({
      damage_sources: [
        {
          id: "primary",
          name: "普通射击",
          section: "fire_mode",
          source: {
            numerical: { id: 1, level: 1 },
            asc_type_id: "10",
            overrides: { asc: { fire_interval: 0.2 } },
            override_reason: "父项修正",
          },
        },
        {
          id: "variant",
          name: "变体",
          section: "variant",
          inherits: "primary",
          source: {
            asc_type_id: "11",
            overrides: { asc: { attenuation: { status: "not_applicable" } } },
            override_reason: "子项修正",
          },
        },
      ],
    }),
  );
  const variant = resolveDamageSourceReferences(parsed, "td").get("variant");
  assert.equal(variant?.source?.numerical?.table, "td");
  assert.equal(variant?.source?.asc_type_id, "11");
  assert.equal(variant?.source?.feel_param_id, "11");
  assert.deepEqual(
    variant?.overrideChain.map((step) => step.reason),
    ["父项修正", "子项修正"],
  );
});

test("子来源存在而父来源在该模式缺失时失败", () => {
  assert.throws(
    () =>
      validateWeaponSourceV2(
        weapon({
          damage_sources: [
            {
              id: "parent",
              name: "父项",
              section: "fire_mode",
              sources: { lc: { numerical: { id: 1, level: 1 } } },
            },
            {
              id: "child",
              name: "子项",
              section: "variant",
              inherits: "parent",
              source: { numerical: { id: 2, level: 1 } },
            },
          ],
        }),
      ),
    /inherited damage source.*unavailable in td/,
  );
});

test("拒绝 source/sources 双声明、空声明和未声明模式键", () => {
  const common = { numerical: { id: 1, level: 1 } };
  for (const damageSource of [
    {
      id: "bad",
      name: "错误",
      section: "fire_mode",
      source: common,
      sources: { lc: common },
    },
    { id: "bad", name: "错误", section: "fire_mode" },
  ]) {
    assert.throws(
      () => validateWeaponSourceV2(weapon({ damage_sources: [damageSource] })),
      /exactly one of source or sources/,
    );
  }

  assert.throws(
    () =>
      validateWeaponSourceV2(
        weapon({
          game_modes: ["lc"],
          damage_sources: [
            {
              id: "bad",
              name: "错误",
              section: "fire_mode",
              sources: { td: common },
            },
          ],
        }),
      ),
    /not declared by game_modes/,
  );
});

test("item_id 和 explosion_range 支持公共值与局部模式映射", () => {
  const parsed = validateWeaponSourceV2(
    weapon({ item_id: { lc: "100" }, explosion_range: { td: 1 } }),
  );
  assert.equal(projectWeaponSourceV2(parsed, "lc").item_id, "100");
  assert.equal(projectWeaponSourceV2(parsed, "lc").explosion_range, undefined);
  assert.equal(projectWeaponSourceV2(parsed, "td").item_id, undefined);
  assert.equal(projectWeaponSourceV2(parsed, "td").explosion_range, 1);

  assert.throws(
    () => validateWeaponSourceV2(weapon({ game_modes: ["lc"], item_id: { td: "100" } })),
    /not declared by game_modes/,
  );
});

test("未声明模式不能投影", () => {
  const parsed = validateWeaponSourceV2(weapon({ game_modes: ["lc"] }));
  assert.throws(() => projectWeaponSourceV2(parsed, "td"), /does not declare game mode/);
});

test("pending 只允许 draft，且允许暂缺 Numerical", () => {
  const pendingSource = [
    {
      id: "pending",
      name: "待核验",
      section: "skill",
      source: { verification: { status: "pending", reason: "等待数据" } },
    },
  ];
  assert.throws(
    () => validateWeaponSourceV2(weapon({ damage_sources: pendingSource })),
    /must set draft: true/,
  );
  assert.doesNotThrow(() =>
    validateWeaponSourceV2(weapon({ draft: true, damage_sources: pendingSource })),
  );
});

test("拒绝重复模式、Numerical table、无原因 override 和无证据攻击间隔", () => {
  assert.throws(
    () => validateWeaponSourceV2(weapon({ game_modes: ["lc", "lc"] })),
    /must not contain duplicates/,
  );
  assert.throws(
    () =>
      validateWeaponSourceV2(
        weapon({
          damage_sources: [
            {
              id: "bad",
              name: "错误",
              section: "fire_mode",
              source: { numerical: { table: "lc", id: 1, level: 1 } },
            },
          ],
        }),
      ),
    /Unrecognized key.*table|table.*Unrecognized key/,
  );
  assert.throws(
    () =>
      validateWeaponSourceV2(
        weapon({
          damage_sources: [
            {
              id: "bad",
              name: "错误",
              section: "fire_mode",
              source: {
                numerical: { id: 1, level: 1 },
                overrides: { asc: { fire_interval: 0 } },
              },
            },
          ],
        }),
      ),
    /override_reason is required/,
  );
  assert.throws(
    () =>
      validateWeaponSourceV2(
        weapon({
          damage_sources: [
            {
              id: "bad",
              name: "错误",
              section: "fire_mode",
              source: { numerical: { id: 1, level: 1 }, attack_interval: 0.2 },
            },
          ],
        }),
      ),
    /attack_interval_source is required/,
  );
});
