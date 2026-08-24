# Num Modifier V2 属性语义索引扩展规范

> 状态：proposed
> 协议：Num Modifier V2（保持不变）
> 目标 Lock Schema：`data/num-modifier-lock.json` V2
> 目标语义目录 Schema：`data/num-modifier-semantics.json` V1

## 目标

当前 Num Modifier V2 已经集中管理正式服 3,044 条 Modifier 行和值，但“这些行修改什么、向哪个方向修改、应进入哪个索引”仍分散在乘区 `attributeFields`、插件 `PerkStatId`、状态效果规则和各审计脚本中。

本扩展在现有行 Resolver 之上增加统一属性语义层，使同一条来源链可以确定性投影为：

- 伤害增幅和乘区来源；
- 破韧效率、暴击率、暴击伤害等输出属性；
- 移动速度、减速、换弹、射速、充能等操作属性；
- 易伤、元素易伤、伤害减免等承伤属性；
- 状态效果、插件、卡片、技能等来源的双向索引。

本轮只定义正式服 `lc`。`refs-test` 中的会心率及其他体验服字段不导入、不兼容，也不预留无证据映射。

## 已确认事实

正式服 `DataTables/AttributeDescMapTable.json` 当前包含 180 行，SHA256 为 `f4c7bae3871af545fdf4ecc4ceea2df7f498c5a5bfb24ec42a1e29c8703adc95`：

- 180 个 `attr_realname` 均唯一；
- 当前 Num Lock 有 154 种 `AttributeName`；
- 137 种可通过 `AttributeName = attr_realname` 精确连接；
- 16 种非空属性不在描述表中，另有 1 种空 `AttributeName` 源数据异常；
- 124/180 行的 `value_format` 为空且 `value_rate` 为 `0`；
- `NumericalID`、`attr_str` 和中文描述都不能代替 `attr_realname` 作为连接身份。

因此 `AttributeDescMapTable` 是属性实名、展示名和格式提示的原始证据，但不是单位、方向、operation 或玩法分类的唯一事实。它必须进入 Lock，语义分类仍由已提交的站点目录显式维护。

## 领域模型

### Num Modifier 行

仍以 `lc:<row_name>` 为唯一公开引用。行提供 `AttributeName`、`GPModifierOp`、`BaseValue`、`CoefValue`、`Level` 等原始事实，不直接等于玩家可查询的效果。

### 属性类型

属性类型回答“修改了什么”，使用稳定 kebab-case ID，例如：

- `critical-rate`
- `critical-damage`
- `toughness-damage`
- `movement-speed`
- `damage-resistance`

多个原始字段可以属于同一属性类型，但必须保留作用范围。例如 `GPAttributeSetToughness.ToughnessRatio` 与 `Numerical.ExecutionCtx.ExecutionToughnessRatio` 都属于破韧伤害，前者是持续属性，后者是单次结算修正，不能在技术详情中合并成同一字段。

### Modifier 效果

Modifier 效果由以下事实共同确定：

```text
Num Modifier 行
  + 取值字段（base / coefficient）
  + scale
  + operation 解释
  + 作用上下文
  = 已解析 Modifier 效果
```

作用上下文至少包含接收者 `self | ally | enemy | damage-event | unknown`。上下文必须来自 Buff、MGE、技能或已审定来源链，禁止从 Numerical `Description` 猜测。

### 效果方向与索引分面

效果方向相对属性类型的正向轴表示：

- `increase`
- `decrease`
- `neutral`
- `unknown`

索引分面由属性类型、方向和必要上下文派生，而不是直接复制到消费者：

| 属性类型 | 方向 | 典型索引分面 |
| :--- | :--- | :--- |
| `movement-speed` | `increase` | 移动速度 |
| `movement-speed` | `decrease` | 减速 |
| `damage-resistance` | `increase` | 伤害减免 |
| `damage-resistance` | `decrease` | 易伤 |
| `critical-rate` | `increase` | 暴击率 |
| `toughness-damage` | `increase` | 破韧效率 |

“减速”不是 `SpeedScale` 的别名；它是移动速度降低这一 Modifier 效果的玩家语义。同理，“易伤”和“伤害减免”共享承伤字段，但方向相反。

## 数据所有权

```text
正式服 numerical_modifier_config ─┐
                                  ├─> Num Modifier Lock V2
正式服 AttributeDescMapTable ─────┘            │
                                               ├─> Num Modifier Resolver
已提交的属性语义目录 ──────────────────────────┘            │
                                                            ├─> 通用来源索引投影
                                                            ├─> 乘区投影
                                                            ├─> 状态效果 DTO
                                                            └─> 插件描述/effect_values
```

各层职责固定如下：

- Lock 保存原表事实和来源哈希，不保存人工玩法结论。
- 语义目录保存规范属性类型、字段成员、operation 解释、格式和索引分面规则。
- 来源注册表保存实体身份、精确行/表达式引用和作用上下文，不复制属性类型、方向或数值。
- 运行时投影保存客户端查询需要的已解析结果和输入哈希，不导入完整 Lock。
- 乘区矩阵只保存伤害公式与适用关系，不再拥有 `AttributeName -> 类型` 映射。

## Lock Schema V2

`AttributeDescMapTable` 与 Modifier 原表一起进入同一份 Lock：

```text
schema_version = 2
sources.lc.modifiers = { source_path, sha256, row_count }
sources.lc.attribute_descriptions = { source_path, sha256, row_count }
rows.lc[row_name] = { row_name, raw }
attribute_descriptions.lc[row_name] = { row_name, raw }
```

约束：

- Modifier 对外引用继续使用 `lc:<row_name>`，迁移不改变现有 3,044 行身份。
- 属性描述行只在 Resolver 内通过 `raw.attr_realname` 连接，不新增供业务手写的描述行引用。
- `attr_realname` 必须唯一；重复或空值直接导致 Lock 刷新失败。
- `attr_name`、`description`、`value_format`、`value_rate`、`NumericalID` 和 `attr_str` 原样锁定，仅作为显示、审计和候选提示。
- Modifier 中找不到描述行的 `AttributeName` 不伪造描述；语义目录必须将其标记为已人工命名或明确未映射。
- 递归排序与数组顺序规则沿用 V1；两张源表分别记录哈希和逐字段差异。

## 属性语义目录

新增 `data/num-modifier-semantics.json`，它是所有属性分类的唯一人工事实：

```json
{
  "schema_version": 1,
  "attribute_types": {
    "movement-speed": {
      "label": "移动速度",
      "family": "mobility",
      "quantity": "ratio",
      "default_format": "signed-percent",
      "facets": {
        "increase": { "id": "movement-speed", "label": "移动速度" },
        "decrease": { "id": "slow", "label": "减速" }
      }
    }
  },
  "attributes": {
    "GPAttributeSetSpeed.SpeedScale": {
      "status": "indexed",
      "attribute_type": "movement-speed",
      "scope": "persistent-stat",
      "operations": {
        "B1": { "model": "delta", "direction": "same-sign" },
        "B4": { "model": "unknown" }
      }
    }
  }
}
```

### 目录字段

`family` 只用于导航分组，首批允许：

- `offense`
- `defense`
- `toughness`
- `mobility`
- `weapon-handling`
- `resource`
- `control`
- `survivability`
- `other`

`quantity` 描述值的物理量，首批允许 `ratio | points | seconds | count | distance | rate | boolean | opaque`。页面格式以语义目录为准；AttributeDesc 的 `value_rate/value_format` 只做审计对照。

每个非空 Lock `AttributeName` 必须有且只有一个 disposition：

- `indexed`：进入规范属性类型和来源索引；
- `known-unindexed`：已识别但当前不发布索引，必须有 `reason`；
- `unmapped`：描述表缺失或语义尚未审定，必须有 issue/reason，构建允许但审计报告；
- `invalid`：源数据异常，只允许精确 allowlist。

新版本出现未登记 `AttributeName` 时，`num-modifier:check` 直接失败，禁止静默掉出索引。

### Operation 规则

当前只确认两个 operation 家族：

| `GPModifierOp` | 当前已知含义 | 自动化边界 |
| :---: | :--- | :--- |
| `B1` | 加法 | 可以结合属性正向轴和表达式值判断方向 |
| `B5` | 乘法 | 只确认是乘法；乘数基线和数值换算未审定时不得自动判断方向或展示增量 |
| `B2` / `B3` / `B4` / `F` / `O` | 未知 | 只能识别属性类型，方向固定为 `unknown` |

全局 operation 家族与逐属性解释是两层事实。全局层不能因某条 Description 看起来合理就扩充；逐属性层也不能把未知 operation 伪装成已知加法或乘法：

- `delta` 表示相对正向轴的增量，可按规则解析方向；
- `multiply` 表示乘法运算，只有乘数基线和变换已被结构化证据确认时才能解析方向；
- `override` 表示绝对覆写，仅在未来确认对应 operation 后使用；
- `execution` 表示依赖单次结算上下文，保留 scope，不冒充持续属性；
- `unknown` 只确认属性类型，不输出方向性分面。

例如 `DamageBearRatio + B1 -0.1` 可以在已审定规则下归为伤害抗性降低，即易伤；`DamageBearRatio + O + 1.5` 在覆写基线未确认前只能归入 `damage-resistance + unknown`。Numerical `Description` 可以触发人工审计，但不能把未知方向自动改成易伤。

当前插件 MDX 引用 88 个唯一 Num 行，其中 87 个为 `B1`，只有 `独弹强化` 的 `lc:111031014_1_0` 为 `B2`。该行 `BaseValue=6` 仍可作为数值引用，但在 B2 语义确认前，通用索引必须将其分类记为人工审定例外，不能把“描述写伤害乘 7”当作 operation 公式。

`scale` 只表达层数、距离步进等正向倍数，不允许通过负 `scale` 翻转效果方向。需要反向变换时必须在属性 operation 规则中表达。

## Resolver 扩展接口

现有 `getRow`、`getRowsById`、`resolveValue`、`resolveTemplate` 和游戏 Token 接口保持兼容。深模块新增两个入口：

```ts
describeAttribute(attributeName, referencePath?): ResolvedAttribute

resolveEffect(
  expression,
  context?,
  referencePath?,
): ResolvedModifierEffect
```

`ResolvedAttribute` 至少包含：

```ts
type ResolvedAttribute = {
  attributeName: string;
  typeId?: string;
  label: string;
  family?: string;
  quantity?: string;
  scope?: string;
  disposition: "indexed" | "known-unindexed" | "unmapped" | "invalid";
  descriptor?: Readonly<Record<string, unknown>>;
};
```

`ResolvedModifierEffect` 至少包含行、表达式解析值、属性类型、operation 模型、方向、作用上下文和零到多个索引分面。调用者不得自行按字段后缀、描述关键词或正负号重新分类。`B5` 在公式未审定时可以返回 `model=multiply`，但方向仍为 `unknown`。

错误规则：

- 缺行、非法字段、非法 scale：失败；
- 未登记 `AttributeName`：离线检查失败；
- operation 未登记：效果方向为 `unknown`，审计报告，不生成方向性索引；
- operation 家族已知但数值公式未登记：保留家族，方向为 `unknown`，不得由调用者补猜；
- 必需上下文缺失：保留属性类型，不生成依赖上下文的分面；
- 同一表达式解析出多个互斥分面：失败并报告来源路径。

## 通用 Modifier 来源索引

最终以 `data/modifier-providers.json` 取代“乘区专属来源注册表”作为服务端唯一来源事实。直接 Num 来源只保存：

```yaml
id: perk:20703040440
source:
  type: perk
  itemId: 20703040440
applications:
  - expression:
      row: "lc:111010083_1_0"
      field: base
    context:
      recipient: self
evidence:
  kind: gp-modifier
  # 身份链证据
```

禁止直接保存 `attributeName`、`statId`、`modifierTypeId`、方向、operation、数值或分面 ID。只有两类人工例外：

- `reviewed-override`：没有可直连 Num 行，显式保存分面和完整依据；
- `reviewed-semantics`：保留精确 Num 表达式，但 operation 尚未解明，显式保存暂用分面、理由和外部结构化/实测证据。

Numerical `Description` 单独不能满足 `reviewed-semantics`。operation 规则补全后，已有例外必须能被审计识别为过期并删除。

生成两个轻量投影：

- `data/modifier-index-runtime.json`：通用属性/效果双向索引；
- `data/guides/multiplier-providers-runtime.json`：从通用索引和乘区矩阵派生的兼容投影。

通用投影按来源、属性类型、方向、分面和接收者查询。乘区投影只收录被定义为伤害通道的分面，继续保留现有客户端查询接口和 URL 兼容别名。

## 消费者迁移

### 乘区

- 将 `data/guides/multiplier.json.damageChannelMatrix.channels[].attributeFields` 迁入语义目录。
- 乘区矩阵只保留 `facet -> factor -> damage type applicability`。
- 现有 `modifierTypeId=critical` 作为 URL/数据兼容别名映射到 `critical-damage:increase`，不再代表通用属性类型。
- 易伤和元素易伤由承伤类属性的已解析方向派生；未知方向不进入乘区。

### 插件与超限卡

Num-backed `effect_values` 最终不再手写 `kind`、`statId` 或 `modifierTypeId`。分类和默认 label 从所有 stage 引用的 `ResolvedModifierEffect` 派生；同一 effect 的 stages 必须属于同一属性类型和兼容方向。

上下文 label 可以显式覆盖，例如“小型榴弹爆炸伤害”，但不能覆盖机械分类。字面量 stage 继续要求 `{ literal, reason }`，并额外显式声明人工语义，因为它无法从 Num 解析。

`PerkStatId` 和 `lib/perks.ts` 内的 `STAT_IDS` 删除；需要运行时联合类型时由语义目录投影生成或从常量推导，不能维护第二份列表。

### 状态效果

- `modifierIds` 继续是状态效果数据锁中的稳定引用。
- Buff 的敌方/玩家归属提供 `recipient` 上下文。
- 技术详情使用 `ResolvedAttribute` 的规范名称、单位和方向，不直接展示原始字段作为主标签。
- 语义分组优先使用已解析分面；描述关键词只允许作为没有 Modifier 证据时的回退，并明确标记为文本推断。
- “减速”“易伤”“伤害减免”“暴击率”等关系从同一通用索引生成，不再分别维护规则。

### 描述模板

`{{num:alias|format}}` 保持兼容。新增校验保证 alias 的格式与属性 `quantity/default_format` 相容，例如 `ratio` 可用百分比格式，`count` 默认不得用百分比格式。

描述中的 Numerical 数值仍必须使用模板；条件、持续时间、层数上限等不属于 Num 的字段继续引用各自结构化来源或使用有依据字面量。

## 首批语义覆盖

首批实现必须覆盖当前乘区全部伤害通道、当前 11 个 `PerkStatId`，并至少审定以下核心属性：

| 规范属性类型 | 原始字段 | 关键分面/范围 |
| :--- | :--- | :--- |
| `toughness-damage` | `GPAttributeSetToughness.ToughnessRatio` | 破韧效率、持续属性 |
| `toughness-damage` | `Numerical.ExecutionCtx.ExecutionToughnessRatio` | 破韧效率、单次结算 |
| `critical-rate` | `GPAttributeSetCritical.CriticalRatio` | 暴击率 |
| `critical-damage` | `GPAttributeSetCritical.CriticalDamageRatio` | 暴击伤害、暴伤乘区投影 |
| `movement-speed` | `GPAttributeSetSpeed.SpeedScale` | 移动速度 / 减速 |
| `damage-resistance` | `GPAttributeSetBearDamageRatio.DamageBearRatio` | 伤害减免 / 易伤 |

其他换弹、射速、充能、近战攻速、爆炸范围、技能范围和有效射程字段按现有 `effect_values` 实际引用逐项登记。名称相近但作用层次不同的字段不得仅因中文 label 相同而合并。

## 命令与检查

沿用现有命令，不增加并行维护入口：

- `pnpm num-modifier:lock`：刷新两张正式服原表并重建所有投影；
- `pnpm num-modifier:project`：从 Lock、语义目录和来源注册表重建通用/乘区投影；
- `pnpm num-modifier:check`：离线检查 Lock、语义覆盖、表达式、上下文、投影新鲜度和静态边界；
- `pnpm num-modifier:audit`：要求 `refs`，核对两张源表哈希、内容、描述表连接率和 operation 未决项。

静态边界新增 `DataTables/AttributeDescMapTable.json`：除 Lock 刷新器、审计器、边界检查和文档外，业务代码不得引用该路径；仍只有 `lib/num-modifier-data.ts` 可以直接导入完整 Lock。

## 验收

### 原始事实

- 锁定 3,044 条 Modifier 行和 180 条 AttributeDesc 行；
- 两张表刷新确定性，分别记录 SHA 和行数；
- 当前 137/154 个精确连接保持一致，16 个非空缺失和 1 个空属性均有明确 disposition；
- `attr_realname` 重复、语义目录遗漏新属性、投影哈希过期均失败。

### 语义样本

- `lc:111010083_1_0.base = 0.12` 解析为破韧效率提高 `12%`；
- `lc:111010076_1_0.coefficient = 0.02` 解析为暴击率提高 `2%`；
- `lc:100200001_1_0.base = -0.15` 在敌方接收上下文中解析为减速 `15%`；
- `lc:100300001_1_0.base = -0.05` 解析为易伤 `5%`；
- `lc:110003101_1_1.base = 0.03` 解析为伤害减免 `3%`；
- `lc:100000002_1_0` 的 `O + 1.5` 在覆写规则未审定前保持方向未知，不因 Description 写“易伤”而自动入易伤索引。
- `lc:111031014_1_0` 的 `B2 + 6` 保持 operation 未知；`独弹强化` 只能通过有依据的 `reviewed-semantics` 保留现有单次修正关系。

### 消费者

- 现有 197 个乘区来源、334 个排除项和 277 条双向关系保持；
- 当前 34 个 stat `effect_values` 全部由语义目录验证，不再依赖手写 `PerkStatId` 列表；
- 当前 MDX 的 87 个 `B1` 引用可进入自动语义路径，唯一 `B2` 引用作为可追踪例外；
- 状态效果的减速、易伤、减伤和输出属性可从结构化 Modifier 效果生成；
- 客户端不导入完整 Lock，开发和生产构建不读取 `refs`；
- 体验服会心率不进入正式服目录或投影。

## 实施顺序

1. 将 AttributeDescMapTable 纳入 Lock V2，冻结解析、哈希、连接诊断和回归测试。
2. 建立语义目录，先迁移乘区 `attributeFields` 与 11 个 `PerkStatId`，为其余属性登记 disposition。
3. 扩展 Resolver 的属性和效果接口，覆盖 operation、方向、上下文与格式检查。
4. 建立通用 Modifier 来源注册表及运行时投影，再从中生成现有乘区投影。
5. 迁移插件、超限卡和状态效果，删除消费者本地分类表与描述关键词主路径。
6. 全量运行消费者搜索、数据审计、相关测试、类型检查、ESLint 和生产构建后，将本文状态改为 active 并合并进架构文档。
