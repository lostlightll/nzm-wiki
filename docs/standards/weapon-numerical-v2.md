# 武器 Numerical V2 数据协议

> 状态：active
> Schema：`2`
> 日期：2026-08-05
> 实现：`lib/weapon-source-v2.ts`

本文是武器 Numerical V2 frontmatter 的协议规范。它定义数据所有权、来源引用、继承、覆盖、待核验状态和运行时校验，不定义 Lock 文件内容和领域 Resolver 的具体输出。

## 1. 设计边界

一个伤害来源由多条游戏数据链共同描述：

- Numerical：伤害、元素、暴击、弱点、破韧和 Settlement。
- ASC：射击间隔、连发、弹丸、弹药、距离衰减和移动倍率。
- Feel：换弹、开退镜、操作时间、后坐力和散布。
- PrototypeConfig：发现和校验 Numerical、ASC 与 Prototype Mode 的关系。
- Item：物品展示身份、品质、类型、瞄具和官方属性。
- 技能链：技能持续、冷却、充能和生命周期。

最终数据边界：

- MDX 保存稳定引用、人工命名、分组、关系、人工字段和有依据的修正。
- Lock 保存项目引用到的完整原始行。
- Resolver 将原始行转换成站点领域模型，并保留来源和修正记录。
- UI 只消费 Resolver 输出。
- 普通构建不读取 `refs/`，PrototypeConfig 不进入页面运行时。

ASC、Feel、Item、主动技能和 Lock 的实现边界分别由 `docs/architecture/` 下的现行文档定义。

## 2. 顶层结构

```yaml
schema_version: 2
title: 飓风之龙
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
      numerical:
        table: lc
        id: 120300110
        level: 1
      asc_type_id: "143"
```

必需字段：

- `schema_version` 必须为整数 `2`。
- `title`、`prototype_id`、`use_type`、`element`、`rarity`。
- `damage_sources`，包括不可攻击武器的空数组。

身份引用：

- `prototype_id` 指向战斗配置，使用只包含数字的非零字符串。
- `item_id` 指向物品展示配置，使用只包含数字的非零字符串；可选且不得通过多候选匹配静默猜测。
- Prototype、ASC、Feel、Item ID 均保持字符串形式；Numerical ID 和 Level 使用正安全整数。

顶层 Schema 是严格的。未知字段、错误拼写、`null` 和空字符串占位均会被拒绝。

## 3. damage_sources

每个条目表示一个原子结算来源。多数来源产生伤害，但恢复等非伤害 Settlement 也使用同一引用、Lock 与 Resolver 链路：

```yaml
- id: dragon-flame-explosion
  name: 龙炎弹爆炸
  section: special
  source:
    prototype_mode: 1
    numerical:
      table: lc
      id: 120300112
      level: 1
  label: 爆炸伤害
```

### 3.1 身份与分组

| 字段 | 必需 | 规则 |
| :--- | :---: | :--- |
| `id` | 是 | 武器内部唯一，格式为 kebab-case：`^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$` |
| `name` | 是 | 非空人工名称 |
| `section` | 是 | `fire_mode` / `skill` / `special` / `variant` / `dot` / `melee` |
| `inherits` | 否 | 同一武器内的来源 ID |
| `label` | 否 | 人类展示标签，不改变 Settlement |

`id` 不使用数组下标、Numerical ID 或 Prototype Mode。LC 与 TD 中语义相同的来源应使用相同 ID。数组顺序会被保留，但不参与身份和继承解析。

`section` 是站点领域分组，与 Settlement 相互独立。例如 `dot` 通常对应 DebuffDamage，但 Schema 不建立强制对应关系。

### 3.2 source

```yaml
source:
  prototype_mode: 0
  numerical:
    table: lc
    id: 120300110
    level: 1
  asc_type_id: "143"
  feel_param_id: "143"
```

| 字段 | 说明 |
| :--- | :--- |
| `prototype_mode` | 非负整数，用于追踪和校验 Prototype Mode |
| `numerical` | Numerical 的逻辑表、ID 和 Level |
| `asc_type_id` | 该攻击行为的 ASC ID |
| `feel_param_id` | Feel ID；省略时默认使用有效 ASC ID |

正常根来源必须提供 `source.numerical`。Prototype 射击模式应同时记录 `prototype_mode` 和 `asc_type_id`。不在 PrototypeConfig 中的技能、插件和 Dot 可以只引用 Numerical。爆炸、激光、轻重击等附属 Numerical 可以记录发现它们的 Mode，但不强制拥有独立 ASC。

`source` 是数据链的扩展边界。新增伤害来源引用应进入这个对象，不继续增加无归属的顶层扁平字段。

### 3.3 Numerical-only 兼容字段

```yaml
fire_interval: 0.33
pellets: 6
```

- `fire_interval` 单位为秒，存在时必须为非负有限数；`0` 表示确定的零间隔，不能用作缺失占位。
- `pellets` 必须为正整数。
- 这两个字段只为无法建立 ASC 引用的已确认来源保留；常规来源必须由 Resolver 从 ASC 原始行解析。
- 人工差异进入带原因的 ASC override，不能继续维护无来源副本。

## 4. LC、TD 与未来模式

Numerical 引用必须显式选择逻辑表：

```yaml
numerical:
  table: td
  id: 120300112
  level: 1
```

规则：

1. `data/weapons` 的调用上下文为 `lc`，`data/weapons_td` 为 `td`。
2. LC、TD 中相同 ID 是两个不同来源；Numerical 缺失时禁止跨表回退。
3. 同一武器全部有效 Numerical 必须使用同一逻辑表。
4. `game_mode` 仅为迁移期兼容信息，不能覆盖调用方的 `expectedTable`。
5. ASC 和 Feel 使用有效 Numerical 的逻辑模式，不重复填写 table。
6. TD ASC/Feel 文件是稀疏覆盖表。后续读取器应按确认后的游戏组合规则物化逻辑 TD 行，不能把稀疏覆盖误写成机会主义 LC fallback。
7. 新模式通过集中注册表增加表标识、读取适配器和 Lock 命名空间。

`validateWeaponSourceV2(input, { expectedTable })` 会拒绝文档内混表、有效引用与调用上下文不一致，以及 `game_mode` 与上下文冲突。

## 5. 继承

继承用于表达共享 Numerical、但 ASC 或兼容行为不同的变体：

```yaml
- id: shotgun-burst
  name: 霰弹四连发
  section: variant
  inherits: shotgun
  source:
    prototype_mode: 2
    asc_type_id: "196"
  fire_interval: 0.33
```

解析顺序：

1. 递归解析父项。
2. 子项 `source` 对父项按字段覆盖。
3. `numerical` 是完整引用，替换时不深层拼接 `table/id/level`。
4. 子项更换 `asc_type_id` 且未显式填写 `feel_param_id` 时，默认 Feel 重置为新的 ASC ID。
5. 子项只填写 `feel_param_id` 时，只替换 Feel，不改变 ASC。
6. `fire_interval`、`pellets`、`label` 缺失时继承，存在时替换。
7. 父项 overrides 先应用，子项 overrides 后应用。
8. `id`、`name`、`section` 始终属于子项，不继承。

继承项可以只替换 ASC，也可以替换完整 Numerical。最终有效来源必须具有 Numerical；仅明确 pending 的草稿来源可以暂时没有。

重复 ID、缺失父项、自继承、任意长度循环和跨武器继承均非法。仅当 Numerical 解析后的 `damage.base.state` 为 `resolved` 或 `zero` 时，该来源才具备攻击能力；恢复等非伤害 Settlement 不得成为 `mainSourceId`，也不得被消费者投影为伤害模式。允许 `damage_sources` 非空但整把武器没有主攻击来源。

## 6. Overrides

当前协议开放 Numerical override、`asc.attenuation` 和 `asc.fire_interval`：

```yaml
overrides:
  numerical:
    damage:
      toughness: 0
override_reason: 实测确认该结算的破韧值为零
```

```yaml
overrides:
  asc:
    attenuation:
      status: not_applicable
override_reason: 实测确认该来源不使用 ASC 中的衰减候选
```

```yaml
overrides:
  asc:
    fire_interval: 0.0727
override_reason: 实测确认持续开火的最大射速间隔
```

需要修正衰减数值时使用：

```yaml
overrides:
  asc:
    attenuation:
      status: applicable
      begin_meters: 10
      end_meters: 30
      min_scale: 0.5
override_reason: 实测确认衰减区间与最低倍率
```

允许字段：

- `damage.base`
- `damage.impulse`
- `damage.toughness`
- `damage.flesh`
- `damage.hurtable`
- `element`
- `element_add_rate`
- `weakness_multiplier`
- `enable_critical`
- `enable_weakness`
- `toughness_type`
- `ignore_shield`

约束：

- `overrides` 和非空 `override_reason` 必须同时出现。
- overrides、命名空间及其嵌套对象均不能为空。
- Settlement Tags、Numerical 引用和原始 Lock 行不能被覆盖。
- Resolver 后续必须保留原始值、有效值和覆盖原因。
- `asc.attenuation` 要求有效 ASC。合法原始衰减可以按核验结果覆盖；原始区间非法时，仅允许以有证据和非空原因的 `status: not_applicable` 明确关闭，Lock raw 保持不变。缺少 ASC 或结构字段缺失时不能用 override 掩盖。
- `asc.fire_interval` 必须是非负有限数，只能覆盖有效 ASC 的 `FireIntervalBase`；缺少 ASC 时拒绝解析。
- 射击间隔 override 按父项到子项依次应用，每一步同时记录 interval 与派生 RPM 的前后值；最终间隔为 `0` 时 RPM 为 `unavailable`。
- 来源级兼容字段 `fire_interval` 只用于差异诊断，必须与全部 overrides 应用后的最终间隔比较。
- Feel、Item overrides 等相应 Lock 和领域映射确定后再增加命名空间。

## 7. 不适用、确定为零与待核验

三种状态不得混用：

| 状态 | 表达 |
| :--- | :--- |
| 不适用 | 省略字段 |
| 没有任何结算来源 | `damage_sources: []` |
| 仅有非攻击结算 | 保留来源；其 `damage.base` 为 `not_applicable`，且不生成 `mainSourceId` |
| 确定为零 | 对适用 Settlement 使用数字 `0` |
| 待核验 | `verification.status: pending` 和非空原因 |

```yaml
draft: true
damage_sources:
  - id: unknown-skill
    name: 待核验技能
    section: skill
    verification:
      status: pending
      reason: 尚未确认 Numerical ID
```

- pending 可以携带候选来源，也可以暂时没有 Numerical。
- 任何显式 pending 都要求武器 `draft: true`。
- `verification` 属于当前来源，不沿继承传播；继承得到的有效引用仍按普通来源校验。
- Numerical 原始字段为 `0`、但缺少对应 Settlement 时，应解析为“不适用”，不能解释为“确定为零”。
- Settlement 存在但必需值缺失时属于错误或 pending，不能补零。

## 8. MDX 数据所有权

### 8.1 V2 立即禁止

V2 不再接受以下 Numerical 副本或旧容器：

```text
damage
damage_modes
extra_modes
melee_damage
mode_names
damage_label
damage_label_text
file_rate
weekness_multiplier
weakness_multiplier（顶层）
toughness_type（顶层）
enable_critical（顶层）
ignore_shield（顶层）
element_add_rate（顶层）
pellets（顶层）
```

严格 Schema 会把这些字段作为未知键拒绝。

### 8.2 迁移期兼容字段

以下字段在对应数据链上线前仍可由 MDX 保存：

- 来源级：`fire_interval`、`pellets`。
- ASC：弹匣、总弹量、衰减起止和倍率。
- Feel：`changeClip`。
- Item：精准度、稳定度、瞄具、稀有度和武器类型。
- 技能链：当前技能冷却、持续、阻回和射击能量。
- 暂无通用来源：`range`、`explosion_range` 等人工属性。

数据链上线后，来源值优先；差异必须输出报告，并使用有原因的命名空间 overrides 处理。

### 8.3 长期人工维护

- Wiki `tags`
- `use_type`
- 来源 `name`、`section` 和必要的 `label`
- MDX 正文和机制说明
- 未形成稳定链路的爆炸范围、技能阻回和射击能量

## 9. 代表性示例

以下示例只展示 `damage_sources`；完整 frontmatter 仍需满足顶层 Schema。

### 9.1 星海狂想

```yaml
damage_sources:
  - id: primary-fire
    name: 普通射击
    section: fire_mode
    source:
      prototype_mode: 0
      numerical: { table: lc, id: 120100040, level: 1 }
      asc_type_id: "5"
    fire_interval: 0.16

  - id: passive-max-rate
    name: 被动最大射速
    section: variant
    inherits: primary-fire
    source:
      prototype_mode: 1
      asc_type_id: "364"
    fire_interval: 0.0727

  - id: large-ice-spike
    name: 大型冰锥
    section: skill
    source:
      numerical: { table: lc, id: 1410050101, level: 1 }
    label: 技能伤害

  - id: frost-ice-spike
    name: 霜华冰锥
    section: skill
    source:
      numerical: { table: lc, id: 120100041, level: 1 }
    label: 技能伤害
```

### 9.2 飓风之龙

```yaml
damage_sources:
  - id: shotgun
    name: 霰弹射击
    section: fire_mode
    source:
      prototype_mode: 0
      numerical: { table: lc, id: 120300110, level: 1 }
      asc_type_id: "143"
    pellets: 6

  - id: dragon-flame-hit
    name: 龙炎弹
    section: fire_mode
    source:
      prototype_mode: 1
      numerical: { table: lc, id: 120300111, level: 1 }
      asc_type_id: "184"
    pellets: 5

  - id: dragon-flame-explosion
    name: 龙炎弹爆炸
    section: special
    source:
      prototype_mode: 1
      numerical: { table: lc, id: 120300112, level: 1 }
    label: 爆炸伤害

  - id: shotgun-burst
    name: 霰弹四连发
    section: variant
    inherits: shotgun
    source: { prototype_mode: 2, asc_type_id: "196" }
    fire_interval: 0.33

  - id: dragon-flame-burst
    name: 龙炎弹四连发
    section: variant
    inherits: dragon-flame-hit
    source: { prototype_mode: 3, asc_type_id: "197" }
    fire_interval: 0.5
```

### 9.3 幽冥毒皇

```yaml
damage_sources:
  - id: machine-gun
    name: 机枪
    section: fire_mode
    source: { numerical: { table: lc, id: 120600060, level: 1 } }
  - id: grenade-hit
    name: 榴弹命中
    section: fire_mode
    source: { numerical: { table: lc, id: 120600061, level: 1 } }
  - id: grenade-explosion
    name: 榴弹爆炸
    section: special
    source: { numerical: { table: lc, id: 120600062, level: 1 } }
  - id: poison-pool-dot
    name: 毒池 Dot
    section: dot
    source: { numerical: { table: lc, id: 120600063, level: 1 } }
```

### 9.4 军用手斧

```yaml
damage_sources:
  - id: heavy-hit
    name: 重击
    section: melee
    source: { numerical: { table: lc, id: 121300090, level: 1 } }
  - id: light-hit-left
    name: 轻击左
    section: melee
    source: { numerical: { table: lc, id: 121300091, level: 1 } }
  - id: light-hit-right
    name: 轻击右
    section: melee
    source: { numerical: { table: lc, id: 121300092, level: 1 } }
```

### 9.5 木葫芦

```yaml
schema_version: 2
title: 木葫芦
prototype_id: "20013000079"
use_type: 近战武器
element: 物理
rarity: 传说
damage_sources: []
```

以上是 TD：原表缺少经核验的恢复行，因此保持空结算来源。LC 显式引用 `lc:121300790_1` 作为恢复来源；它不具备 `damage.base` Settlement，不会成为主攻击来源。即使 Prototype 中存在错误关联的攻击 Numerical，也不得据此自动生成攻击来源或执行跨表回退。

## 10. 运行时接口

`lib/weapon-source-v2.ts` 导出：

- `weaponSourceV2Schema`
- `damageSourceV2Schema`
- `weaponDataSourceRefSchema`
- `numericalReferenceSchema`
- `numericalOverridesSchema`
- `validateWeaponSourceV2(input, { expectedTable })`
- `resolveDamageSourceReferences(weapon)`
- 对应的 TypeScript 类型，并由 `types/index.ts` 统一 re-export

`resolveDamageSourceReferences()` 只执行协议级引用继承，便于 Lock 扫描器和后续 Resolver 复用；它不读取原表、不查询 Lock、不映射 Settlement，也不生成站点 `Weapon`。

## 11. 错误策略

以下情况必须以带字段路径的运行时校验错误拒绝：

- 缺少必需字段或存在未知字段。
- ID 类型、格式或数值范围错误。
- 重复来源 ID、缺失父项、自继承或循环继承。
- 非 pending 来源最终没有 Numerical。
- `feel_param_id` 最终没有对应 ASC。
- 同一武器混用 LC/TD，或与调用方 `expectedTable` 不一致。
- pending 武器未设置 `draft: true`。
- overrides 为空、缺少原因、原因孤立或试图覆盖未知字段。
- 使用 `null`、空字符串或非法数值作为占位。

协议校验不验证 Numerical、ASC、Feel 或 Item 行是否真实存在；这些检查分别属于原表读取器、Lock 检查器和 Resolver。
