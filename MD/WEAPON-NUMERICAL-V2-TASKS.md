# 武器数据引用链 V2：8 个实施任务

> 状态：Task 1–2 已完成
> 更新日期：2026-08-05  
> 目标：让武器 MDX 只保存稳定引用、Wiki 语义和人工修正；Numerical、ASC、Feel、Item 的完整原始行进入可提交 Lock，由统一 Resolver 生成页面数据。

## 0. 本轮边界

这 8 个任务解决的是武器自身的静态数据链：

```text
MDX 引用与人工语义
  + Numerical：伤害结算
  + ASC：射击、弹药、衰减、移动
  + Feel：换弹、开镜、后坐力、散布
  + Item：品质、分类、官方展示属性
  → Lock
  → Resolver
  → 页面 / 搜索 / 计算器
```

以下内容不塞进本轮，避免范围失控：

- 全局增伤、Buff、插件、技能对伤害公式的影响。
- 武器技能的完整生命周期、充能、阻回和冷却模型。
- 爆炸范围与射击能量等尚未形成稳定通用链路的字段。
- 自动改写 Wiki 标签、模式中文名和正文描述。

这三类问题后续分别立项。当前 Schema 可以保留扩展能力，但不为未知系统预埋大量空字段。

## 1. 总体顺序

```text
Task 1  冻结 V2 协议与 Schema（已完成）
   ↓
Task 2  建立统一原表读取层
   ↓
Task 3  生成多来源 Weapon Data Lock
   ↓
Task 4  实现 V1/V2 Resolver 与领域模型
   ↓
Task 5  迁移代表武器并校准规则
   ↓
Task 6  切换全部数据消费者
   ↓
Task 7  批量迁移 LC / TD 武器
   ↓
Task 8  删除 V1、接入检查并收尾
```

Task 1–5 构成最小验证闭环。Task 5 验收前不做全量迁移；Task 7 完成前不删除 V1 fallback。

---

## Task 1：冻结 V2 协议与 Schema

> 状态：已完成。正式协议见 [`MD/WEAPON-NUMERICAL-V2-PROTOCOL.md`](./WEAPON-NUMERICAL-V2-PROTOCOL.md)；后续任务不得另造一套字段。

### 目标

定义 MDX 保存什么、引用什么，以及人工修正如何覆盖链路数据。

### 必须产出

- `schema_version: 2` 的运行时 Schema 与 TypeScript 源类型。
- 武器级稳定身份：
  - `prototype_id`
  - `item_id`，用于消除同一 Prototype 对应多个物品时的歧义。
- `damage_sources` 及稳定的来源 `id`。
- 每个来源可独立引用：
  - `prototype_mode`
  - `numerical.table / id / level`
  - `asc_type_id`
  - 可选 `feel_param_id`，未填写时默认等于 `asc_type_id`。
- `section` 只表达 Wiki 页面分组，不假装等同于 Settlement Tag。
- `inherits`、`overrides`、`override_reason` 的明确规则。
- “不适用”“确定为零”“缺失待核验”三种状态的不同表达。
- 普通枪、多模式、爆炸、Dot、近战、技能伤害、不可攻击武器示例。

### 关键约束

- 同一个 Numerical 可以配多个 ASC，不得把二者合并成一个模糊 ID。
- 射速、弹丸数、弹匣、衰减、换弹等可查询字段不再作为 V2 的常规手填副本。
- Prototype Mode 用于追踪和校验，不是页面显示序号。
- V2 Schema 不依赖当前卡片布局，也不为单把武器加特判字段。

### 验收标准

- [x] 飓风之龙可以表达共享 Numerical、但 ASC 不同的普通与四连发模式。
- [x] 幽冥毒皇可以表达命中、爆炸和 Dot。
- [x] 军用手斧可以表达轻击、重击和击飞等近战来源。
- [x] 木葫芦不需要大量 `null`。
- [x] `item_id` 可以处理同 Prototype 多物品的歧义。
- [x] 类型、运行时 Schema、示例和协议文档一致。

### 依赖

无。

---

## Task 2：建立统一原表读取层

> 状态：已完成。正式接口与异常规则见 [`MD/WEAPON-DATA-SOURCE-READER.md`](./WEAPON-DATA-SOURCE-READER.md)。

### 目标

为所有受支持的游戏导出表建立唯一、只读、可测试的读取入口。读取器只忠实读取和索引，不承担页面语义转换。

### 数据源

首轮必须支持：

- `DataTables/numerical_config_composite.json`
- `DataTables/TD_numerical_config_composite.json`
- `Attributes/AutoGenerate/attr_weapon_asc.json`
- `DataTables/WeaponFeelParamTable.json`
- `DataTables/LuaDataTable/WeaponItemConfigTable.json`
- `DataTables/WeaponPrototypeConfig.json`

其中 PrototypeConfig 只用于发现引用和交叉校验，不要求进入页面运行时 Lock。

### 工作内容

- 隔离 Unreal 导出 JSON 的外层包装和字段差异。
- 建立分类型索引：
  - Numerical：`${table}:${id}_${level}`
  - ASC：`ASCTypeID`
  - Feel：`WeaponFeelParamID`
  - Item：显式 `item_id`
  - Prototype：`prototype_id + mode`
- 完整保留原始行，尤其是 Numerical 的全部 `Settlements` 与 `TagName`。
- 不认识的新字段仍进入原始对象，不因当前 UI 未使用而丢失。
- 提供文件缺失、结构错误、重复 key、跨表串用和引用不存在的明确错误。
- 为飓风之龙的 `120300110_1 / 120300111_1` 与相关 ASC / Feel / Prototype Mode 建立联动测试。

### 不包含

- 不生成 Lock。
- 不修改 MDX。
- 不把 Unreal 字段翻译成页面中文。
- 不解析技能 CD 与增伤效果。

### 验收标准

- [x] 每种来源均可按稳定 key 精确取行。
- [x] LC / TD 同 ID 不会串表。
- [x] 原始行没有被字段白名单裁剪。
- [x] 错误包含来源文件、数据类型和引用 key。
- [x] Prototype 能校验 Mode、Numerical 与 ASC 的对应关系。

### 依赖

- Task 1 的引用结构。

---

## Task 3：实现 Weapon Data Lock 生成与检查

### 目标

根据 V2 MDX 中的显式引用，生成可提交、可复现、仅包含项目实际使用行的多来源 Lock。

### 推荐产物

可以按来源拆文件，也可以使用一个带命名空间的 Lock；无论采用哪种形式，都必须清晰区分：

```text
numerical-lc
numerical-td
asc
feel
item
```

### 工作内容

- 扫描所有 V2 武器引用，递归处理 `inherits` 后仍以显式源引用为收集依据。
- 保存每个被引用 key 的完整原始行。
- `feel_param_id` 未填写时按 `asc_type_id` 取 Feel；显式覆盖优先。
- Lock 元数据记录：
  - Lock Schema 版本。
  - 来源文件路径或逻辑表名。
  - 来源文件哈希。
  - 可取得时记录游戏内容版本。
- 所有 key 稳定排序，保证相同输入得到逐字节相同结果。
- 提供两个独立命令：
  - `weapon-data:lock`：显式刷新 Lock。
  - `weapon-data:check`：只读检查 MDX、Lock 与引用一致性。
- 刷新时报告：新增、删除、字段变化、Settlement Tag 变化、缺失引用、未使用 Lock 行。
- PrototypeConfig 参与校验报告，但普通构建不需要它。
- 普通 `build` 只能读已提交 Lock，不能读取 `refs/` 或改写工作区。

### 验收标准

- [ ] 相同输入重复生成的 Lock 完全一致。
- [ ] 删除 `refs/` 后仍能使用 Lock 构建。
- [ ] 缺失引用会明确失败，不会变成零值或空对象。
- [ ] ASC 与 Feel 默认同 ID 的规则可检查，也允许显式例外。
- [ ] Item 多候选时必须由 MDX 的 `item_id` 消除歧义。
- [ ] 原始大表不会进入 `public/` 或客户端 bundle。

### 依赖

- Task 1 的 Schema。
- Task 2 的统一读取层。

---

## Task 4：实现 V1/V2 Resolver 与武器领域模型

### 目标

把 V1 frontmatter 或 V2 引用统一解析为页面可用的 `ResolvedWeapon`。页面、索引和计算器不理解原始 JSON，也不自行拼链路。

### 工作内容

- 建立唯一入口，例如：

  ```text
  parseWeaponSource()
  resolveWeapon()
  resolveDamageSource()
  ```

- 按 Task 1 Schema 验证 V2。
- 从 Lock 解析四类职责：
  - Numerical：基础伤害、弱点、暴击、元素、Settlement、破韧等。
  - ASC：射击间隔、连发、弹丸、弹药、衰减、移动倍率等。
  - Feel：换弹、开镜、射击恢复、后坐力、散布等。
  - Item：稀有度、武器类型、瞄具、官方展示属性等。
- 保留 `raw`、来源 key 和 provenance，方便调试；UI 只读取领域字段。
- RPM 等确定性值由 Resolver 派生，不写回 MDX。
- 模式级属性不得被过早压成武器级单值；武器级摘要明确选择主来源。
- 展开 `inherits`，检测循环、重复 ID 和不存在的父来源。
- 应用人工 `overrides`，同时保留原始值、覆盖值和原因。
- 未识别 Settlement Tag 必须保留并报告。
- 迁移期继续支持 V1，并输出与 V2 同形的 `ResolvedWeapon`。
- 定义字段状态与错误级别：缺失、不可用、明确为零、未识别、人工覆盖。

### V1 兼容范围

至少覆盖当前仍被消费的：

- `damage`
- `damage_modes`
- `extra_modes`
- `file_rate`
- `weekness_multiplier`
- 当前弹药、衰减和换弹字段

### 验收标准

- [ ] 同一把武器的 V1 / V2 能得到可比较的标准化快照。
- [ ] 页面层不出现 `HpCalScale`、`FireIntervalBase` 等 Unreal 字段。
- [ ] 缺失 Lock、循环继承和无效引用会明确失败。
- [ ] 原始值、派生值与人工覆盖可追溯。
- [ ] 同一 Numerical 搭配不同 ASC 时，射击表现不会被错误合并。

### 依赖

- Task 1 的 Schema。
- Task 3 的 Lock。

---

## Task 5：迁移代表武器并校准规则

### 目标

用真实武器完成端到端试迁移，先暴露协议和 Resolver 问题，再冻结批量迁移规则。

### 代表武器

1. **星海狂想**：普通射击、动态射速变体、技能伤害。
2. **飓风之龙**：共享 Numerical、不同 ASC、命中与爆炸、多连发变体。
3. **幽冥毒皇**：普通命中、榴弹命中、爆炸和 Dot。
4. **军用手斧**：轻击、重击、击飞和近战 Settlement。
5. **木葫芦**：不可攻击武器。

如 Item 多候选、TD 差异或特殊 Feel 没有被这五把覆盖，再补一把最小样本，不为了凑数扩大到全库。

### 工作内容

- 写入 V2 引用并生成对应 Lock。
- 为每个来源明确 Numerical、ASC、Feel 和 Prototype Mode 的关系。
- 迁移高确定性字段：
  - 伤害与完整 Settlement。
  - 射击间隔、连发、弹丸。
  - 弹匣、总弹量、耗弹。
  - 距离衰减。
  - 换弹与操作时间。
- Item 字段只在显式 `item_id` 后接入，差异不自动覆盖。
- 为无法通过链路表达的内容保留人工字段或 `overrides`。
- 生成迁移前后快照，逐字段区分：
  - 结构迁移，无数值变化。
  - 原数据与导出表差异，待人工核验。
  - 明确接受的数值修正。
- 检查页面最终显示、搜索索引候选数据和计算器输入。

### 验收标准

- [ ] 五把武器可完整解析和生成页面。
- [ ] 非预期数值变化为零。
- [ ] 每个显示值都能追溯到 MDX、Lock、派生公式或 override。
- [ ] 四连发等变体不再复制整套伤害与射击参数。
- [ ] 未知 Tag 和 Item 差异有报告，不被静默吞掉。
- [ ] 不需要增加武器名特判。

### 依赖

- Task 4 的 Resolver。

---

## Task 6：切换全部武器数据消费者

### 目标

让所有消费者只读取 `ResolvedWeapon`，彻底切断业务代码对 MDX 旧字段和 Lock 原始字段的直接依赖。

### 工作内容

- 切换武器详情、卡片、列表、筛选和衰减图表。
- 搜索索引生成器改为读取标准化结果。
- `weapon-stats.json` 从 `ResolvedWeapon` 生成。
- 伤害计算器读取统一的标准化数据，不再依赖拼错的 `weekness_multiplier`。
- 明确 LC / TD 的解析入口和 Numerical 表来源。
- 对武器级摘要值建立一致规则，例如默认主模式、默认伤害来源。
- 页面暂未展示的 ASC / Feel 原始能力不要求一次性做 UI，但领域模型不得丢失。
- 为关键消费者添加针对性测试或快照。

### 验收标准

- [ ] 业务消费者不直接解析武器 frontmatter。
- [ ] 消费者不直接读取 Lock 或 Unreal 字段。
- [ ] V1 / V2 差异只存在于 Resolver 内部。
- [ ] LC / TD 不会跨表串用。
- [ ] 试点武器的详情页、搜索、筛选、图表和计算器结果一致。

### 依赖

- Task 5 试迁移通过并冻结规则。

---

## Task 7：批量迁移 LC / TD 武器

### 目标

把剩余武器迁移到 V2，并形成可复核的完整 Lock 和异常清单。

### 工作内容

- 编写可重复执行的迁移工具，禁止一次性手搓全库替换。
- 以现有 MDX 为语义基准，以 Prototype、Numerical、ASC、Feel、Item 为候选来源。
- 先迁移 LC，再迁移 TD；二者独立生成报告并建议分开提交。
- 自动填充只限高置信度映射；以下情况进入人工核验：
  - Numerical / ASC / Feel / Item 引用缺失。
  - 一个来源存在多个候选。
  - Prototype Mode 与显式引用不一致。
  - 现有 MDX 与原表值不同。
  - Settlement 语义未识别。
  - 技能伤害不在 Prototype 链路。
  - LC / TD 同名武器结构不同。
- 对差异分类输出，不把“表更新”和“迁移错误”混在一起。
- 每批迁移后生成快照、运行 Lock 检查和消费者回归。
- 结构迁移与确认后的真实数值修正分开提交。

### 验收标准

- [ ] 所有可迁移武器均使用 V2。
- [ ] 每个引用都存在于对应 Lock。
- [ ] 所有未迁移项都有明确原因和责任分类。
- [ ] 没有静默零值、空引用、错误 Item 或跨表引用。
- [ ] 全量页面、搜索、图表和计算器通过回归。
- [ ] 迁移工具可重复运行且不会制造无意义 diff。

### 依赖

- Task 6 完成消费者切换。

---

## Task 8：删除 V1、接入检查并完成收尾

### 目标

结束双格式阶段，让 V2、Lock 和 Resolver 成为唯一正式武器数据管线。

### 工作内容

- 确认全量迁移后删除 V1 字段与 fallback，包括：
  - `damage`
  - `damage_modes`
  - `extra_modes`
  - `damage_label`
  - `damage_label_text`
  - `mode_names`
  - `file_rate`
  - `weekness_multiplier`
  - 已被 ASC / Feel 稳定替代的弹药、衰减和换弹副本
- 删除旧转换函数和重复的数据提取路径。
- 更新正式规范、录入流程和维护文档。
- 把 `weapon-data:check` 接入 CI 或生产构建前置检查；检查必须只读。
- 增加旧字段扫描，防止新 MDX 重新写回 V1。
- 检查客户端和 `public/` 不包含完整原表或无关 Lock 行。
- 将技能生命周期、全局增伤系统、未解字段分别整理为后续项目，不留在本任务的“顺便做”列表里。
- 完成全量 lint、测试和生产构建。

### 验收标准

- [ ] 所有发布武器只使用 V2。
- [ ] 仓库不存在 V1 字段消费者。
- [ ] MDX、Lock、Schema、Resolver 和文档一致。
- [ ] 没有 `refs/` 的环境可以完成生产构建。
- [ ] 原始大表不会进入客户端资源。
- [ ] Lock 检查能阻止缺失、陈旧和未使用引用。
- [ ] `pnpm lint`、相关测试和 `pnpm build` 通过。

### 依赖

- Task 7 全量迁移完成。

---

## 2. 任务状态

| 任务 | 状态 | 依赖 | 主要产物 |
| :--- | :--- | :--- | :--- |
| Task 1：冻结 V2 协议与 Schema | 已完成 | 无 | 协议、类型、运行时 Schema、示例 |
| Task 2：建立统一原表读取层 | 已完成 | Task 1 | Numerical / ASC / Feel / Item / Prototype 读取器 |
| Task 3：实现 Weapon Data Lock | 待开始 | Task 1、2 | 多来源 Lock、刷新与只读检查命令 |
| Task 4：实现 V1/V2 Resolver | 待开始 | Task 1、3 | `ResolvedWeapon`、来源追踪、override 机制 |
| Task 5：迁移代表武器 | 待开始 | Task 4 | 试点 MDX、Lock、迁移前后快照 |
| Task 6：切换全部消费者 | 待开始 | Task 5 | 页面、索引、图表、计算器统一入口 |
| Task 7：批量迁移 LC / TD | 待开始 | Task 6 | 全量 V2、完整 Lock、人工核验清单 |
| Task 8：删除 V1 并收尾 | 待开始 | Task 7 | 单一正式管线、CI 检查、正式文档 |

## 3. 跨任务硬性规则

- MDX 是“选择哪些原始数据、赋予什么 Wiki 语义、是否人工覆盖”的唯一来源。
- Lock 是构建时的原始数据快照，不是另一套人工编辑数据库。
- `refs/` 只服务于显式刷新和校验，普通构建不得读取。
- PrototypeConfig 负责发现和核验关系，不替代 MDX 的显式选择。
- 自动化遇到歧义必须报错或进入核验清单，不能猜一个写进去。
- 迁移造成的结构变化与真实数值修正必须可分开审查。
- 任何字段只有在来源稳定、Resolver 已接入、全量迁移完成后，才允许从 MDX 删除。
