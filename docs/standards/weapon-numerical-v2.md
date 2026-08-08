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
| `label` | 可选展示标签，不改变 Settlement |

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

开放的修正范围为 Numerical 伤害/元素/弱点/暴击/破韧、ASC 距离衰减与射击间隔。存在 `overrides` 必须提供非空 `override_reason`，反之亦然。修正不得给 Settlement 不适用字段造值。

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

## 7. 错误与维护

- 数据缺失、引用悬空、模式未声明、非法继承、Settlement 不完整和必需字段非法均直接失败。
- 未知枚举与未知 Settlement 保留原值并产生诊断，不静默猜测。
- MDX 不得从 Prototype 自动生成来源，也不得根据名称或 ID 规律猜测 LC/TD 关系。
- 修改引用后运行 `pnpm weapon-data:lock`，再运行 `pnpm weapon-data:check` 与武器相关测试。
- 正文模式专属说明使用 `<GameMode only="lc|td">`；可由 Resolver 得到的 LC/TD 数值差异使用 `<WeaponModeDiff />`，禁止维护静态副本。
