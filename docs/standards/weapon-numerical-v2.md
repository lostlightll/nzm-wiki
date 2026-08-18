# 武器 Numerical V2 数据协议

> 状态：active
> Schema：`2`
> 日期：2026-08-08
> 实现：`lib/weapon-source-v2.ts`

本文定义单份武器 MDX 同时描述 LC/TD 的正式协议。MDX 保存稳定引用、Wiki 语义和人工修正；Lock 保存被引用的完整原始行；Resolver 按页面模式生成领域模型。普通构建不读取 `refs/`。

## 1. 顶层结构

```yaml
schema_version: 2
title: 飓风之龙
game_modes: [lc, td]
prototype_id: "20003000011"
item_id: "20103000010"
use_type: 主武器
weapon_type: 霰弹枪
element: 火焰
rarity: 传说

damage_sources:
  - id: shotgun
    name: 霰弹射击
    section: fire_mode
    source:
      prototype_mode: 0
      numerical: { id: 120300110, level: 1 }
      asc_type_id: "143"
```

必需字段：

- `schema_version` 固定为整数 `2`。
- `title`、`game_modes`、`prototype_id`、`use_type`、`element`、`rarity`。
- `damage_sources`，包括不可攻击武器的空数组。
- `game_modes` 是去重、非空的 `lc` / `td` 数组；当前发布武器统一为 `[lc, td]`。

顶层 Schema 严格拒绝未知字段、错误拼写、`null` 和空字符串占位。`prototype_id`、ASC、Feel、Item ID 使用数字字符串；Numerical ID 与 Level 使用正安全整数。

## 2. 共享身份与模式字段

标题、Prototype、用途、武器类型、元素、稀有度、标签和正文属于武器共享身份，不按模式复制。

`item_id` 与 `explosion_range` 允许公共标量或模式映射：

```yaml
item_id:
  lc: "20103000030"

explosion_range:
  td: 1
```

标量应用于全部 `game_modes`；映射键必须属于 `game_modes`，缺少键表示该字段在该模式不可用。其他顶层字段不接受模式映射。

## 3. damage_sources

每项表示一个稳定的原子结算来源。跨模式共享的语义字段位于外层：

| 字段 | 规则 |
|---|---|
| `id` | 武器内唯一 kebab-case 稳定 ID |
| `name` | 人工确认的非空名称 |
| `section` | `fire_mode` / `skill` / `special` / `variant` / `dot` / `melee` |
| `inherits` | 可选，同一武器内父来源 ID |
| `label` | 可选形态分组标签，不改变 Settlement，禁止用作伤害或恢复类型名称 |
| `burst_limit` | 可选，弹匣或技能状态限制的连发上限；连发间隔仍由 ASC 提供 |

每项必须且只能使用 `source` 或 `sources`。

### 3.1 公共 source

`source` 应用于武器声明的全部模式。Numerical 不写 table，Resolver 用当前模式选择 `numerical-lc` 或 `numerical-td`：

```yaml
- id: normal-shot
  name: 普通射击
  section: fire_mode
  source:
    prototype_mode: 0
    numerical: { id: 120100240, level: 1 }
    asc_type_id: "200"
```

相同逻辑 ID 在 LC 与 TD 中仍是两条独立原始行；任一模式缺行都直接失败，禁止跨表回退。

### 3.2 模式 sources

真实存在引用、人工修正或可用性差异时，使用 `sources` 并列完整机械配置：

```yaml
- id: special-hit
  name: 特殊攻击
  section: special
  sources:
    lc:
      numerical: { id: 120500342, level: 1 }
    td:
      numerical: { id: 11010053, level: 1 }
```

缺少模式键表示该来源在该模式不存在：

```yaml
- id: healing
  name: 喝水回血
  section: special
  sources:
    lc:
      numerical: { id: 121300790, level: 1 }
```

`sources` 必须非空，键必须属于顶层 `game_modes`。Resolver 只选择当前模式键，不继承另一模式配置。

### 3.3 机械配置

`source` 与 `sources.<mode>` 使用同一结构：

| 字段 | 说明 |
|---|---|
| `prototype_mode` | Prototype Mode，用于刷新期交叉校验 |
| `numerical` | `{ id, level }`，正常根来源必需 |
| `asc_type_id` | ASC 引用 |
| `feel_param_id` | Feel 引用；省略时跟随有效 ASC |
| `fire_interval` / `pellets` | 无法建立 ASC 时的已确认兼容值 |
| `attack_interval` / `attack_count` / `attack_interval_source` | 有定位证据的固定频率结算 |
| `overrides` / `override_reason` | Numerical 或 ASC 人工修正及原因 |
| `verification` | 草稿 pending 核验状态 |

`attack_interval_source` 使用 `NZM/Content/...#字段`，必须与 `attack_interval` 成对；`attack_count` 只能随攻击间隔存在。有效 ASC 与 `attack_interval` 互斥。

### 3.4 近战连段

普通近战按单次结算建模，不使用武器级轻击/重击汇总：

1. 每段轻击和重击各自拥有稳定来源 ID 与完整 Numerical 引用。
2. `damage_sources` 的顺序是权威连段顺序；Resolver 与消费者必须保持，不按 ID 或名称重新排序。
3. 每段独立解析基础伤害、元素积累、破韧、弱点和暴击。当前多数普通近战的弱点倍率同为 `1.2` 只是原始数据事实，不是合并来源的依据。
4. 同一 Numerical ID 在 LC/TD 均存在时可以使用公共 `source`，但 Lock 与 Resolver 仍分别读取两个 namespace；存在真实模式差异时改用 `sources`，禁止跨模式 fallback。
5. Prototype 没有枚举出的后续轻击必须使用已经核验的 Numerical 精确引用，禁止根据 ID 尾号或相邻行猜测。

恢复、形态切换、蓄力或其他特殊近战机制不强行套入轻击/重击序列，应使用 `special` / `variant` 来源单独建模。

### 3.5 Health Settlement

每条 Numerical 最多只能有一个 `Numerical.SettlementType.Health.*`。Resolver 精确匹配完整 Tag，并将 `HpCalScale` 与 `HpCalBase` 解析为统一生命结算值；未知 Tag 保留诊断，禁止根据 `name`、`section` 或 `label` 猜测。

| Settlement 尾缀 | 页面名称 | 类别 | 数值展示 |
|---|---|---|---|
| `WeaponDamage` | 命中伤害 | 伤害 | `HpCalScale × 模式基础攻击力` |
| `MeleeWeaponDamage` | 近战伤害 | 伤害 | `HpCalScale × 模式基础攻击力` |
| `WeaponExplosionDamage` | 爆炸伤害 | 伤害 | `HpCalScale × 模式基础攻击力` |
| `WeaponSkillDamage` | 武器技能伤害 | 伤害 | `HpCalScale × 模式基础攻击力` |
| `SkillDamage` | 技能伤害 | 伤害 | `HpCalScale × 模式基础攻击力` |
| `DebuffDamage` | 持续伤害 | 伤害 | `HpCalScale × 模式基础攻击力` |
| `IndirectDamage` | 间接伤害 | 伤害 | `HpCalScale × 模式基础攻击力` |
| `EnvironmentDamage` | 环境伤害 | 伤害 | `HpCalScale × 模式基础攻击力` |
| `CustomDamage` | 自定义伤害 | 伤害 | `HpCalScale × 模式基础攻击力` |
| `DeathExecute` | 斩杀伤害 | 伤害 | `HpCalScale × 模式基础攻击力` |
| `DropEnvironmentDamage` | 坠落伤害 | 伤害 | `HpCalScale × 模式基础攻击力` |
| `HealthThenShieldPercentRecover` | 生命/护盾恢复 | 恢复 | `HpCalScale` 显示百分比，非零 `HpCalBase` 显示固定值 |
| `CharStandardHealing` | 生命恢复 | 恢复 | `HpCalScale` 显示百分比，非零 `HpCalBase` 显示固定值 |
| `CharExtraShieldRecovery` | 临时护盾 | 恢复 | `HpCalScale` 显示百分比，非零 `HpCalBase` 显示固定值 |
| `CharStandardShieldRecovery` | 护盾恢复 | 恢复 | `HpCalScale` 显示百分比，非零 `HpCalBase` 显示固定值 |
| `CustomHealing` | 自定义治疗 | 恢复 | 显示原始系数与固定值，不推断为百分比 |
| `CustomExtraShield` | 自定义临时护盾 | 恢复 | 显示原始系数与固定值，不推断为百分比 |

伤害来源继续通过 `damage.base` 投影参与主来源选择和伤害消费者；恢复来源只通过生命结算字段展示，不得成为 `mainSourceId`，也不得伪造破韧、弱点、暴击等伤害属性。只有恢复来源的武器仍保留“不可攻击”语义，但详情页必须展示其恢复结算。

## 4. 继承

继承按模式分别展开：先选择当前来源的 `source` 或 `sources[mode]`，再解析同模式父来源。子配置按字段覆盖父配置；Numerical 是完整引用，不深层拼接。

```yaml
- id: shotgun-burst
  name: 霰弹四连发
  section: variant
  inherits: shotgun
  source:
    prototype_mode: 2
    asc_type_id: "196"
```

规则：

1. `id/name/section/label` 属于当前来源，不继承。
2. 子项更换 ASC 且未显式填写 Feel 时，Feel 跟随新 ASC。
3. overrides 按父到子顺序应用并保留历史。
4. 子来源在某模式存在而父来源在该模式缺失时失败。
5. 重复 ID、缺失父项、自继承、循环与跨武器继承均非法。
6. 最终有效来源必须具有 Numerical；仅 draft 中显式 pending 的模式配置可以暂缺。

## 5. Overrides 与 pending

```yaml
sources:
  lc:
    numerical: { id: 120300100, level: 1 }
    overrides:
      asc:
        attenuation:
          status: applicable
          begin_meters: 10
          end_meters: 20
          min_scale: 0.3
    override_reason: 实测确认猎场距离衰减
  td:
    numerical: { id: 120300100, level: 1 }
    overrides:
      asc:
        attenuation: { status: not_applicable }
    override_reason: 实测确认塔防无距离衰减
```

开放的修正范围为 Numerical 伤害、生命结算 `health.scale/base`、元素、弱点、暴击、破韧，以及 ASC 距离衰减与射击间隔。恢复值修正使用 `overrides.numerical.health`；`health.scale` 与旧的 `damage.base` 都对应 `HpCalScale`，禁止在同一 override 中同时声明。存在 `overrides` 必须提供非空 `override_reason`，反之亦然。修正不得给 Settlement 不适用字段造值。

pending 只允许发布前草稿：

```yaml
verification:
  status: pending
  reason: 等待核验 Numerical
```

任一模式配置 pending 时，整份文档必须 `draft: true`。已填写候选引用仍必须存在，不能用 pending 隐藏悬空 ID。

## 6. 模式投影与主来源

`validateWeaponSourceV2(input)` 一次验证整份文档。`resolveDamageSourceReferences(weapon, mode)` 按模式生成带内部 table 的有效引用：

1. 拒绝未列入 `game_modes` 的模式。
2. 选择公共 `source` 或 `sources[mode]`；缺失模式来源从该投影中省略。
3. 在同模式内展开继承并校验最终 Numerical。
4. Resolver 使用 `mode:id_level` 精确读取 Lock，禁止跨模式 fallback。

仅当 Numerical 解析后的 `damage.base.state` 为 `resolved` 或 `zero` 时，该来源具备攻击能力。恢复等非攻击 Settlement 不得成为 `mainSourceId`。Resolver 先选择首个 `fire_mode` 攻击来源，否则选择首个攻击来源；消费者不得按数组位置再次 fallback。

近战目录与详情不能只使用 `mainSourceId` 代表整套连段。它们必须消费保持原顺序的全部 `section: melee` 攻击来源；`mainSourceId` 仍只承担武器级元素和其他单一主来源语义。

## 7. 错误与维护

- 数据缺失、引用悬空、模式未声明、非法继承、Settlement 不完整和必需字段非法均直接失败。
- 未知枚举与未知 Settlement 保留原值并产生诊断，不静默猜测。
- MDX 不得从 Prototype 自动生成来源，也不得根据名称或 ID 规律猜测 LC/TD 关系。
- 修改引用后运行 `pnpm weapon-data:lock`，再运行 `pnpm weapon-data:check` 与武器相关测试。
- 正文模式专属说明使用 `<GameMode only="lc|td">`；可由 Resolver 得到的 LC/TD 数值差异使用 `<WeaponModeDiff />`，禁止维护静态副本。
