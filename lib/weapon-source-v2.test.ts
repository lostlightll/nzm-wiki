import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveDamageSourceReferences,
  validateWeaponSourceV2,
} from "./weapon-source-v2";

function weapon(
  title: string,
  damageSources: unknown[],
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schema_version: 2,
    title,
    prototype_id: "20003000011",
    use_type: "主武器",
    element: "火焰",
    rarity: "传说",
    damage_sources: damageSources,
    ...extra,
  };
}

const numerical = (id: number, table: "lc" | "td" = "lc") => ({
  table,
  id,
  level: 1,
});

test("星海狂想可以表达普通射击、ASC 变体和 Numerical-only 技能", () => {
  const parsed = validateWeaponSourceV2(
    weapon(
      "星海狂想",
      [
        {
          id: "primary-fire",
          name: "普通射击",
          section: "fire_mode",
          source: {
            prototype_mode: 0,
            numerical: numerical(120100040),
            asc_type_id: "5",
          },
          fire_interval: 0.16,
        },
        {
          id: "passive-max-rate",
          name: "被动最大射速",
          section: "variant",
          inherits: "primary-fire",
          source: {
            prototype_mode: 1,
            asc_type_id: "364",
          },
          fire_interval: 0.0727,
        },
        {
          id: "large-ice-spike",
          name: "大型冰锥",
          section: "skill",
          source: { numerical: numerical(1410050101) },
          label: "技能伤害",
        },
        {
          id: "frost-ice-spike",
          name: "霜华冰锥",
          section: "skill",
          source: { numerical: numerical(120100041) },
          label: "技能伤害",
        },
      ],
      { element: "寒冷", prototype_id: "20001000004" },
    ),
    { expectedTable: "lc" },
  );

  const resolved = resolveDamageSourceReferences(parsed);
  assert.deepEqual(resolved.get("primary-fire")?.source, {
    prototype_mode: 0,
    numerical: numerical(120100040),
    asc_type_id: "5",
    feel_param_id: "5",
  });
  assert.deepEqual(resolved.get("passive-max-rate")?.source, {
    prototype_mode: 1,
    numerical: numerical(120100040),
    asc_type_id: "364",
    feel_param_id: "364",
  });
  assert.equal(resolved.get("passive-max-rate")?.fire_interval, 0.0727);
  assert.deepEqual(resolved.get("large-ice-spike")?.source, {
    numerical: numerical(1410050101),
  });
});

test("飓风之龙可以表达多模式、爆炸和四连发 ASC 变体", () => {
  const parsed = validateWeaponSourceV2(
    weapon("飓风之龙", [
      {
        id: "shotgun",
        name: "霰弹射击",
        section: "fire_mode",
        source: {
          prototype_mode: 0,
          numerical: numerical(120300110),
          asc_type_id: "143",
        },
        fire_interval: 0.33,
        pellets: 6,
      },
      {
        id: "dragon-flame-hit",
        name: "龙炎弹",
        section: "fire_mode",
        source: {
          prototype_mode: 1,
          numerical: numerical(120300111),
          asc_type_id: "184",
        },
        fire_interval: 0.75,
        pellets: 5,
      },
      {
        id: "dragon-flame-explosion",
        name: "龙炎弹爆炸",
        section: "special",
        source: {
          prototype_mode: 1,
          numerical: numerical(120300112),
        },
        label: "爆炸伤害",
      },
      {
        id: "shotgun-burst",
        name: "霰弹四连发",
        section: "variant",
        inherits: "shotgun",
        source: { prototype_mode: 2, asc_type_id: "196" },
        fire_interval: 0.33,
      },
      {
        id: "dragon-flame-burst",
        name: "龙炎弹四连发",
        section: "variant",
        inherits: "dragon-flame-hit",
        source: { prototype_mode: 3, asc_type_id: "197" },
        fire_interval: 0.5,
      },
    ]),
    { expectedTable: "lc" },
  );

  const resolved = resolveDamageSourceReferences(parsed);
  assert.equal(resolved.get("shotgun-burst")?.source?.numerical?.id, 120300110);
  assert.equal(resolved.get("shotgun-burst")?.source?.asc_type_id, "196");
  assert.equal(resolved.get("shotgun-burst")?.source?.feel_param_id, "196");
  assert.equal(resolved.get("shotgun-burst")?.pellets, 6);
  assert.equal(
    resolved.get("dragon-flame-burst")?.source?.numerical?.id,
    120300111,
  );
});

test("幽冥毒皇可以独立表达命中、爆炸和 Dot", () => {
  const parsed = validateWeaponSourceV2(
    weapon(
      "幽冥毒皇",
      [
        ["machine-gun", "机枪", "fire_mode", 120600060],
        ["grenade-hit", "榴弹命中", "fire_mode", 120600061],
        ["grenade-explosion", "榴弹爆炸", "special", 120600062],
        ["poison-pool-dot", "毒池 Dot", "dot", 120600063],
      ].map(([id, name, section, idValue]) => ({
        id,
        name,
        section,
        source: { numerical: numerical(idValue as number) },
      })),
      { element: "腐蚀", prototype_id: "20006000006" },
    ),
    { expectedTable: "lc" },
  );

  assert.equal(parsed.damage_sources[3].section, "dot");
});

test("军用手斧可以表达三个独立近战来源", () => {
  const parsed = validateWeaponSourceV2(
    weapon(
      "军用手斧",
      [
        ["heavy-hit", "重击", 121300090],
        ["light-hit-left", "轻击左", 121300091],
        ["light-hit-right", "轻击右", 121300092],
      ].map(([id, name, idValue]) => ({
        id,
        name,
        section: "melee",
        source: { numerical: numerical(idValue as number) },
      })),
      {
        prototype_id: "20013000009",
        use_type: "近战武器",
        element: "物理",
        rarity: "稀有",
      },
    ),
    { expectedTable: "lc" },
  );

  assert.deepEqual(
    parsed.damage_sources.map((source) => source.id),
    ["heavy-hit", "light-hit-left", "light-hit-right"],
  );
});

test("木葫芦 TD 使用空 damage_sources 表达没有可用结算来源", () => {
  const parsed = validateWeaponSourceV2(
    weapon("木葫芦", [], {
      prototype_id: "20013000079",
      use_type: "近战武器",
      element: "物理",
    }),
    { expectedTable: "td" },
  );

  assert.deepEqual(parsed.damage_sources, []);
});

test("显式 feel_param_id 覆盖默认值但不改变 ASC", () => {
  const parsed = validateWeaponSourceV2(
    weapon("Feel 例外", [
      {
        id: "primary",
        name: "普通射击",
        section: "fire_mode",
        source: {
          numerical: numerical(120300110),
          asc_type_id: "143",
          feel_param_id: "999",
        },
      },
    ]),
    { expectedTable: "lc" },
  );

  const source = resolveDamageSourceReferences(parsed).get("primary")?.source;
  assert.equal(source?.asc_type_id, "143");
  assert.equal(source?.feel_param_id, "999");
});

test("Item、Prototype、ASC 和 Feel ID 保持字符串边界", () => {
  assert.doesNotThrow(() =>
    validateWeaponSourceV2(
      weapon(
        "完整引用",
        [
          {
            id: "primary",
            name: "普通射击",
            section: "fire_mode",
            source: {
              numerical: numerical(120300110),
              asc_type_id: "143",
              feel_param_id: "999",
            },
          },
        ],
        { item_id: "20103000010" },
      ),
      { expectedTable: "lc" },
    ),
  );

  assert.throws(
    () =>
      validateWeaponSourceV2(
        weapon("数字 Item ID", [], { item_id: 20103000010 }),
        { expectedTable: "lc" },
      ),
    /expected string/,
  );

  assert.throws(
    () =>
      validateWeaponSourceV2(
        weapon("无 ASC 的 Feel", [
          {
            id: "primary",
            name: "普通射击",
            section: "fire_mode",
            source: {
              numerical: numerical(120300110),
              feel_param_id: "999",
            },
          },
        ]),
        { expectedTable: "lc" },
      ),
    /requires an effective asc_type_id/,
  );
});

test("允许有原因的零值覆盖，拒绝无原因或未知覆盖字段", () => {
  assert.doesNotThrow(() =>
    validateWeaponSourceV2(
      weapon("零值覆盖", [
        {
          id: "primary",
          name: "普通射击",
          section: "fire_mode",
          source: { numerical: numerical(120300110) },
          overrides: { numerical: { damage: { toughness: 0 } } },
          override_reason: "实测确认该结算值为零",
        },
      ]),
      { expectedTable: "lc" },
    ),
  );

  assert.throws(
    () =>
      validateWeaponSourceV2(
        weapon("缺原因", [
          {
            id: "primary",
            name: "普通射击",
            section: "fire_mode",
            source: { numerical: numerical(120300110) },
            overrides: { numerical: { damage: { base: 1 } } },
          },
        ]),
        { expectedTable: "lc" },
      ),
    /override_reason is required/,
  );

  assert.throws(
    () =>
      validateWeaponSourceV2(
        weapon("孤立原因", [
          {
            id: "primary",
            name: "普通射击",
            section: "fire_mode",
            source: { numerical: numerical(120300110) },
            override_reason: "没有对应覆盖",
          },
        ]),
        { expectedTable: "lc" },
      ),
    /cannot be used without overrides/,
  );

  assert.throws(
    () =>
      validateWeaponSourceV2(
        weapon("非法 Settlement 覆盖", [
          {
            id: "primary",
            name: "普通射击",
            section: "fire_mode",
            source: { numerical: numerical(120300110) },
            overrides: {
              numerical: { settlements: ["WeaponDamage"] },
            },
            override_reason: "不允许这样做",
          },
        ]),
        { expectedTable: "lc" },
      ),
    /Unrecognized key/,
  );
});

test("pending 只能用于 draft，并允许暂时没有 Numerical", () => {
  const pending = weapon(
    "待核验武器",
    [
      {
        id: "unknown-skill",
        name: "待核验技能",
        section: "skill",
        verification: { status: "pending", reason: "Numerical ID 未确认" },
      },
    ],
    { draft: true },
  );

  assert.doesNotThrow(() =>
    validateWeaponSourceV2(pending, { expectedTable: "lc" }),
  );
  assert.throws(
    () =>
      validateWeaponSourceV2({ ...pending, draft: false }, { expectedTable: "lc" }),
    /must set draft: true/,
  );
});

test("拒绝重复 ID、缺失父项、循环继承和无 Numerical 来源", () => {
  const cases = [
    {
      sources: [
        {
          id: "same",
          name: "A",
          section: "skill",
          source: { numerical: numerical(1) },
        },
        {
          id: "same",
          name: "B",
          section: "skill",
          source: { numerical: numerical(2) },
        },
      ],
      message: /duplicate damage source id/,
    },
    {
      sources: [
        { id: "child", name: "Child", section: "variant", inherits: "missing" },
      ],
      message: /does not exist/,
    },
    {
      sources: [
        { id: "a", name: "A", section: "variant", inherits: "b" },
        { id: "b", name: "B", section: "variant", inherits: "a" },
      ],
      message: /inheritance cycle/,
    },
    {
      sources: [{ id: "empty", name: "Empty", section: "skill" }],
      message: /must contain a numerical reference/,
    },
  ];

  for (const fixture of cases) {
    assert.throws(
      () =>
        validateWeaponSourceV2(weapon("非法继承", fixture.sources), {
          expectedTable: "lc",
        }),
      fixture.message,
    );
  }
});

test("拒绝 LC/TD 混用和 game_mode 覆盖调用上下文", () => {
  assert.throws(
    () =>
      validateWeaponSourceV2(
        weapon("混表", [
          {
            id: "lc-source",
            name: "LC",
            section: "skill",
            source: { numerical: numerical(1, "lc") },
          },
          {
            id: "td-source",
            name: "TD",
            section: "skill",
            source: { numerical: numerical(2, "td") },
          },
        ]),
        { expectedTable: "lc" },
      ),
    /must use the same table/,
  );

  assert.throws(
    () =>
      validateWeaponSourceV2(
        weapon(
          "错误模式",
          [
            {
              id: "primary",
              name: "Primary",
              section: "fire_mode",
              source: { numerical: numerical(1, "td") },
            },
          ],
          { game_mode: "td" },
        ),
        { expectedTable: "lc" },
      ),
    /does not match expected table/,
  );
});

test("拒绝旧伤害字段、null、空字符串和错误 ID 类型", () => {
  const validSource = {
    id: "primary",
    name: "Primary",
    section: "fire_mode",
    source: { numerical: numerical(1) },
  };

  assert.throws(
    () =>
      validateWeaponSourceV2(
        { ...weapon("旧字段", [validSource]), damage: { base: 1 } },
        { expectedTable: "lc" },
      ),
    /Unrecognized key/,
  );
  assert.throws(
    () =>
      validateWeaponSourceV2(
        { ...weapon("Null", [validSource]), scope: null },
        { expectedTable: "lc" },
      ),
    /expected string/,
  );
  assert.throws(
    () =>
      validateWeaponSourceV2(
        { ...weapon("空字符串", [validSource]), scope: "" },
        { expectedTable: "lc" },
      ),
    /Too small/,
  );
  assert.throws(
    () =>
      validateWeaponSourceV2(
        { ...weapon("错误 ID", [validSource]), prototype_id: 20003000011 },
        { expectedTable: "lc" },
      ),
    /expected string/,
  );
  assert.doesNotThrow(() =>
    validateWeaponSourceV2(
      weapon("零间隔", [{ ...validSource, fire_interval: 0 }]),
      { expectedTable: "lc" },
    ),
  );
});

test("固定频率攻击间隔要求证据、支持继承并拒绝 ASC", () => {
  const fixedSource = {
    id: "fixed-hit",
    name: "固定命中",
    section: "skill",
    source: { numerical: numerical(1) },
    attack_interval: 0.65,
    attack_count: 10,
    attack_interval_source: "NZM/Content/Abilities/Test/BP_Test#TriggerInterval",
  };
  const parsed = validateWeaponSourceV2(
    weapon("固定频率", [
      fixedSource,
      {
        id: "fixed-variant",
        name: "固定变体",
        section: "variant",
        inherits: "fixed-hit",
      },
    ]),
    { expectedTable: "lc" },
  );
  const inherited = resolveDamageSourceReferences(parsed).get("fixed-variant")!;
  assert.equal(inherited.attack_interval, 0.65);
  assert.equal(inherited.attack_count, 10);
  assert.equal(
    inherited.attack_interval_source,
    "NZM/Content/Abilities/Test/BP_Test#TriggerInterval",
  );
  assert.equal(inherited.origins.attack_interval, "fixed-hit");
  assert.equal(inherited.origins.attack_count, "fixed-hit");
  assert.equal(inherited.origins.attack_interval_source, "fixed-hit");

  for (const [title, source, message] of [
    ["缺少证据", { ...fixedSource, attack_interval_source: undefined }, /required when attack_interval/],
    ["孤立证据", { ...fixedSource, attack_interval: undefined }, /cannot be used without attack_interval/],
    [
      "无间隔计数",
      {
        ...fixedSource,
        attack_interval: undefined,
        attack_interval_source: undefined,
      },
      /attack_count requires an effective attack_interval/,
    ],
    ["证据格式错误", { ...fixedSource, attack_interval_source: "Assets/Test#Interval" }, /NZM\/Content/],
    ["负间隔", { ...fixedSource, attack_interval: -0.1 }, />=0/],
    ["非有限间隔", { ...fixedSource, attack_interval: Number.NaN }, /expected number/],
    [
      "本地 ASC",
      { ...fixedSource, source: { numerical: numerical(1), asc_type_id: "10" } },
      /cannot be used with an effective asc_type_id/,
    ],
    [
      "继承 ASC",
      {
        id: "fixed-child",
        name: "固定子项",
        section: "variant",
        inherits: "asc-parent",
        attack_interval: 1,
        attack_interval_source: "NZM/Content/Abilities/Test/BP_Test#TriggerInterval",
      },
      /cannot be used with an effective asc_type_id/,
    ],
  ] as const) {
    const sources =
      title === "继承 ASC"
        ? [
            {
              id: "asc-parent",
              name: "ASC 父项",
              section: "fire_mode",
              source: { numerical: numerical(1), asc_type_id: "10" },
            },
            source,
          ]
        : [source];
    assert.throws(
      () => validateWeaponSourceV2(weapon(title, sources), { expectedTable: "lc" }),
      message,
    );
  }
});

test("ASC attenuation override 使用严格 union 并保留继承顺序", () => {
  const parsed = validateWeaponSourceV2(
    weapon("衰减覆盖", [
      {
        id: "primary",
        name: "普通射击",
        section: "fire_mode",
        source: {
          numerical: numerical(1),
          asc_type_id: "10",
        },
        overrides: { asc: { attenuation: { status: "not_applicable" } } },
        override_reason: "实测不使用距离衰减",
      },
      {
        id: "variant",
        name: "变体",
        section: "variant",
        inherits: "primary",
        source: { asc_type_id: "11" },
        overrides: {
          asc: {
            attenuation: {
              status: "applicable",
              begin_meters: 5,
              end_meters: 20,
              min_scale: 0.5,
            },
          },
        },
        override_reason: "变体使用独立实测衰减",
      },
    ]),
    { expectedTable: "lc" },
  );

  const resolved = resolveDamageSourceReferences(parsed).get("variant")!;
  assert.equal(resolved.origins.numerical, "primary");
  assert.equal(resolved.origins.asc_type_id, "variant");
  assert.equal(resolved.origins.feel_param_id, "variant");
  assert.deepEqual(
    resolved.overrideChain.map((step) => step.sourceId),
    ["primary", "variant"],
  );
});

test("ASC fire interval override 支持零值、继承链并拒绝空 namespace", () => {
  const parsed = validateWeaponSourceV2(
    weapon("射速覆盖", [
      {
        id: "primary",
        name: "普通射击",
        section: "fire_mode",
        source: { numerical: numerical(1), asc_type_id: "10" },
        overrides: { asc: { fire_interval: 0.1 } },
        override_reason: "实测普通射击间隔",
      },
      {
        id: "variant",
        name: "零间隔变体",
        section: "variant",
        inherits: "primary",
        overrides: { asc: { fire_interval: 0 } },
        override_reason: "该阶段不按射速循环",
      },
    ]),
    { expectedTable: "lc" },
  );
  assert.deepEqual(
    resolveDamageSourceReferences(parsed)
      .get("variant")!
      .overrideChain.map((step) => step.overrides.asc?.fire_interval),
    [0.1, 0],
  );

  assert.throws(
    () =>
      validateWeaponSourceV2(
        weapon("空 ASC 覆盖", [
          {
            id: "primary",
            name: "普通射击",
            section: "fire_mode",
            source: { numerical: numerical(1), asc_type_id: "10" },
            overrides: { asc: {} },
            override_reason: "无效空覆盖",
          },
        ]),
        { expectedTable: "lc" },
      ),
    /asc override must contain at least one field/,
  );
});
