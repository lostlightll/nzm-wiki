# 武器数据引用链 V2：8 个主任务与 Task 2.5

> 状态：Task 1–3 已完成
> 更新日期：2026-08-05  
> 目标：让武器 MDX 只保存稳定引用、Wiki 语义和人工修正；Numerical、ASC、Feel、Item 与主动技能基础充能数据的完整原始行进入可提交 Lock，由统一 Resolver 生成页面数据。

## 0. 本轮边界

这 8 个任务解决的是武器自身的静态数据链：

```text
MDX 引用与人工语义
  + Numerical：伤害结算
  + ASC：射击、弹药、衰减、移动
  + Feel：换弹、开镜、后坐力、散布
  + Item：品质、分类、官方展示属性
  + Skill PVE / GP：主动技能基础充能时间
  → Lock
  → Resolver
  → 页面 / 搜索 / 计算器
```

以下内容不塞进本轮，避免范围失控：

- 全局增伤、Buff、插件、技能对伤害公式的影响。
- 武器技能的完整生命周期、效果持续时间、阻回、击杀充能和冷却缩减模型；本轮只接入基础充能时间。
- 爆炸范围与射击能量等尚未形成稳定通用链路的字段。
- 自动改写 Wiki 标签、模式中文名和正文描述。

这三类问题后续分别立项。当前 Schema 可以保留扩展能力，但不为未知系统预埋大量空字段。

## 1. 总体顺序

```text
Task 1  冻结 V2 协议与 Schema（已完成）
   ↓
Task 2  建立统一原表读取层
   ↓
Task 2.5  接入主动技能基础充能链
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

Task 1–5（包含 Task 2.5）构成最小验证闭环。Task 5 验收前不做全量迁移；Task 7 完成前不删除 V1 fallback。

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

## Task 2.5：接入主动技能基础充能链

> 状态：已完成。正式规则与实现接口见 [`MD/WEAPON-SKILL-COOLDOWN-CHAIN.md`](./WEAPON-SKILL-COOLDOWN-CHAIN.md)。

### 目标

在不返工 Task 2 的前提下，建立主动技能 ID 到猎场基础充能时间的稳定查询规则，并为 Task 3 收集技能 Lock 行提供明确入口。

详细调查依据见 [`MD/WEAPON-SKILL-COOLDOWN-CHAIN.md`](./WEAPON-SKILL-COOLDOWN-CHAIN.md)。

### 数据源

- `DataTables/SkillConfigTable_Weapon_PVE.json`
- `DataTables/GPActiveSkillDataTable.json`
- Task 2 已支持的 `WeaponPrototypeConfig.json`，只用于发现和校验 `ActiveSkillID`。
- `WeaponItemConfigTable.Active_Skill_Detail` 只作辅助校验，不能覆盖 Prototype 的战斗技能 ID。

### 查询规则

```text
MDX.active_skill_id + level（默认 1）
  ↓
SkillConfigTable_Weapon_PVE["{skillId}_{level}"].ChargeNeedTime
  ↓ PVE 表没有该行
GPActiveSkillDataTable[skillId].CooldownDuration
  ↓ 两边均缺失
Task 2.5 明确报错；未来 Resolver 才允许带原因的人工 override
```

固定优先级：

```text
PVE ChargeNeedTime
  > GP CooldownDuration（仅限 PVE 缺行）
  > 人工 override
```

### 工作内容

- 沿用 Task 1 已存在的 `active_skill_id`，当前默认技能等级为 1，不重做 V2 Schema。
- 为 PVE 技能表建立 `${skillId}_${level}` 索引。
- 为 GP 主动技能表建立 `${skillId}` rowName 索引；行内 `AbilityID` 差异保留为诊断。
- 完整保留被查询的 PVE 与 GP 原始行。
- 查询结果携带：
  - `chargeTime`
  - `chargeCount`：PVE 取 `SkillCount`；GP fallback 取 `MaxChargeStackCount`。
  - 来源 key
  - `source: weapon_pve | gp_fallback`
- `ChargeNeedTime = 0` 与 `CooldownDuration = 0` 视为有效值，不能当成缺失。
- 校验 MDX `active_skill_id` 与 Prototype `ActiveSkillID`，发现差异时报告，不自动覆盖 MDX。
- Item 与 Prototype 技能 ID 不一致时只报告差异，不自动改用 Item ID。
- 用当前 59 把具有数字型 `skill_cooldown` 的 LC 武器验证规则：55 把 PVE 直读、4 把 GP fallback。

### 必须覆盖的测试样本

| 武器 | 技能 ID | 预期链路 | 预期 CD |
| :--- | :---: | :--- | :---: |
| 暗夜之殇 | `5100101` | PVE `ChargeNeedTime` | 45s |
| 钢铁轰鸣 | `5101601` | PVE `ChargeNeedTime` | 50s |
| 飓风之龙 | `5101501` | PVE 25，禁止被 GP 50 覆盖 | 25s |
| 振弦 | `5004901` | PVE 缺行，GP fallback | 30s |
| 春雷震 | `5003101` | PVE 缺行，GP fallback | 0s |
| 鬼铜蚀 | `5102501` | PVE 缺行，GP fallback | 0s |
| 火神炎帝 | `5103601` | PVE 缺行，GP fallback | 0s；当前 MDX 45s 作为差异报告 |

还需覆盖一个 PVE、GP 均不存在的虚构 ID，确认查询会明确失败。

### 不包含

- 不修改武器 MDX。
- 不生成 Lock；Task 3 负责正式 Lock 产物。
- 不修改页面或 `<ActiveSkill>`。
- 不迁移或删除 `skill_cooldown`。
- 不处理 `Duration`、`skill_blocking`、`bPauseChargeDuringActivation`、击杀/助攻充能和冷却缩减。
- 不把 GP `CooldownDuration` 提升为常规主来源。

### 验收标准

- [x] 当前 59 把样本中 55 把由 PVE `ChargeNeedTime` 命中。
- [x] 春雷震、鬼铜蚀、振弦、火神炎帝仅在 PVE 缺行时使用 GP fallback。
- [x] 暗夜之殇解析为 45s，钢铁轰鸣解析为 50s。
- [x] 飓风之龙不会被 GP 的 50s 覆盖。
- [x] 零值与缺失值可以明确区分。
- [x] 结果始终包含来源类型和来源 key。
- [x] 技能 ID 不一致只产生可审计报告，不被静默修正。

### 依赖

- Task 1 的 `active_skill_id` 协议。
- Task 2 的统一原表读取能力。

---

## Task 3：实现 Weapon Data Lock 生成与检查

> 状态：已完成。正式协议、命令与离线检查边界见 [`MD/WEAPON-DATA-LOCK.md`](./WEAPON-DATA-LOCK.md)。

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
skill-pve
gp-active-skill
```

### 工作内容

- 扫描所有 V2 武器引用，递归处理 `inherits` 后仍以显式源引用为收集依据。
- 保存每个被引用 key 的完整原始行。
- ASC 行必须原样保留 `DistanceBeginAttenuationBase`、`DistanceEndAttenuationBase` 和 `AttenuationMinScale`；Lock 只保存事实，不在这一层判断该来源是否实际使用距离衰减。
- `feel_param_id` 未填写时按 `asc_type_id` 取 Feel；显式覆盖优先。
- 按 `active_skill_id` 收集 PVE 技能行；PVE 缺行时额外收集对应 GP 行，并保留 fallback 来源。
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

- [x] 相同输入重复生成的 Lock 完全一致。
- [x] 删除 `refs/` 后仍能使用已提交 Lock 和离线检查；普通构建未接入原表读取器。
- [x] 缺失引用会明确失败，不会变成零值或空对象。
- [x] ASC 与 Feel 默认同 ID 的规则可检查，也允许显式例外。
- [x] ASC Lock 完整保留距离衰减三字段，即使字段为零或当前页面暂不使用。
- [x] Item 只允许显式 `item_id` 精确收集，多候选不会被静默选择。
- [x] 每个有效 `active_skill_id` 都有 PVE 行或 GP fallback；带原因 override 等正式 Schema 扩展后接入。
- [x] `skill-pve` 与 `gp-active-skill` 保存被引用的完整原始行。
- [x] 原始大表不会进入 `public/` 或客户端 bundle。

### 依赖

- Task 1 的 Schema。
- Task 2 的统一读取层。
- Task 2.5 的基础充能查询规则。

---

## Task 4：实现 V1/V2 Resolver 与武器领域模型

> 状态：已完成。领域模型、解析规则、错误与迁移 bridge 见 [`MD/WEAPON-RESOLVER.md`](./WEAPON-RESOLVER.md)。

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
- 从 Lock 解析五类职责：
  - Numerical：基础伤害、弱点、暴击、元素、Settlement、破韧等。
  - ASC：射击间隔、连发、弹丸、弹药、衰减、移动倍率等。
  - Feel：换弹、开镜、射击恢复、后坐力、散布等。
  - Item：稀有度、武器类型、瞄具、官方展示属性等。
  - Skill：基础充能时间、可积累次数和 PVE / GP 来源；不展开完整生命周期。
- 保留 `raw`、来源 key 和 provenance，方便调试；UI 只读取领域字段。
- RPM 等确定性值由 Resolver 派生，不写回 MDX。
- 将 ASC 距离衰减解析为伤害来源级 `attenuation`，不再生成含义模糊的武器级 `range`：
  - `DistanceBeginAttenuationBase` 与 `DistanceEndAttenuationBase` 从厘米换算为米。
  - `AttenuationMinScale` 保留为最低伤害倍率。
  - 默认仅在 `end > begin` 且 `end > 0` 时标记为 `applicable`；`begin = 0` 且 `end = 0` 表示 `not_applicable`，不是缺失数据。
  - ASC 中存在非零衰减值只代表候选配置，不足以证明当前伤害来源实际使用该机制。
- 在 Task 4 确认映射后扩展 Task 1 协议，加入来源级 `overrides.asc.attenuation`：
  - 可将 ASC 候选值明确覆盖为 `not_applicable`。
  - 也可提供经人工确认的 `begin_meters`、`end_meters` 与 `min_scale` 修正值。
  - 所有覆盖必须填写 `override_reason`，并同时保留 ASC 原值与覆盖后的有效值。
- 能源之影、暗器、弓箭、榴弹等只作为人工核验候选；禁止按武器名称或武器类型在 Resolver 中硬编码整类规则。
- 模式级属性不得被过早压成武器级单值；武器级摘要明确选择主来源。
- 展开 `inherits`，检测循环、重复 ID 和不存在的父来源。
- 应用人工 `overrides`，同时保留原始值、覆盖值和原因。
- 未识别 Settlement Tag 必须保留并报告。
- 迁移期继续支持 V1，并输出与 V2 同形的 `ResolvedWeapon`。
- 定义字段状态与错误级别：缺失、不可用、明确为零、未识别、人工覆盖。
- 将 `active_skill_id` 解析为标准化主动技能对象，基础充能字段命名为 `chargeTime`，避免与持续时间混淆。

### V1 兼容范围

至少覆盖当前仍被消费的：

- `damage`
- `damage_modes`
- `extra_modes`
- `file_rate`
- `weekness_multiplier`
- 当前弹药、衰减和换弹字段
- `skill_cooldown`

### 验收标准

- [x] 同一把武器的 V1 / V2 能得到可比较的标准化快照。
- [x] 页面层不出现 `HpCalScale`、`FireIntervalBase` 等 Unreal 字段。
- [x] 缺失 Lock、循环继承和无效引用会明确失败。
- [x] 原始值、派生值与人工覆盖可追溯。
- [x] 同一 Numerical 搭配不同 ASC 时，射击表现不会被错误合并。
- [x] 普通 ASC 衰减值能正确完成厘米到米的换算，并挂在对应伤害来源上。
- [x] ASC 为 `0 / 0` 时得到明确的 `not_applicable`，不会退化成缺失或错误零值。
- [x] ASC 非零但不适用的来源可通过 `overrides.asc.attenuation` 排除，并保留原因与原值。
- [x] 领域模型不再提供含义模糊的 `range` 派生字段。
- [x] PVE 技能配置存在时不会被 GP `CooldownDuration` 覆盖。
- [x] PVE 缺行的技能会携带 `gp_fallback` 来源标记。

### 依赖

- Task 1 的 Schema。
- Task 3 的 Lock。

---

## Task 5：迁移代表武器并校准规则

> 状态：已完成。代表武器映射、快照差异、补充 fixtures 与冻结规则见 [`MD/WEAPON-V2-PILOT-MIGRATION.md`](./WEAPON-V2-PILOT-MIGRATION.md)。

### 目标

用真实武器完成端到端试迁移，先暴露协议和 Resolver 问题，再冻结批量迁移规则。

### 代表武器

1. **星海狂想**：普通射击、动态射速变体、技能伤害。
2. **飓风之龙**：共享 Numerical、不同 ASC、命中与爆炸、多连发变体。
3. **幽冥毒皇**：普通命中、榴弹命中、爆炸和 Dot。
4. **军用手斧**：轻击、重击、击飞和近战 Settlement。
5. **木葫芦**：不可攻击武器。

如 Item 多候选、TD 差异或特殊 Feel 没有被这五把覆盖，再补一把最小样本，不为了凑数扩大到全库。

距离衰减另做一组最小补充样本：普通枪械使用星海狂想或飓风之龙；异常候选覆盖能源之影、一把弓箭（振弦或超级复合弓）、一把暗器（爆星或玄凌飞刃）和一把榴弹武器（钢铁轰鸣或春雷震）。补充样本只验证 ASC 映射与 override，不要求同步完成整把武器的伤害迁移。

### 工作内容

- 写入 V2 引用并生成对应 Lock。
- 为每个来源明确 Numerical、ASC、Feel 和 Prototype Mode 的关系。
- 迁移高确定性字段：
  - 伤害与完整 Settlement。
  - 射击间隔、连发、弹丸。
  - 弹匣、总弹量、耗弹。
  - 距离衰减。
  - 换弹与操作时间。
- 对比现有 MDX 与 ASC 衰减候选值；不适用或需要修正的情况写入对应伤害来源的 `overrides.asc.attenuation`，不得改成武器名特判。
- Item 字段只在显式 `item_id` 后接入，差异不自动覆盖。
- 为无法通过链路表达的内容保留人工字段或 `overrides`。
- 额外验证主动技能充能链：暗夜之殇走 PVE 45s，振弦走 GP fallback 30s；这两把不要求同时迁移全部伤害字段。
- 生成迁移前后快照，逐字段区分：
  - 结构迁移，无数值变化。
  - 原数据与导出表差异，待人工核验。
  - 明确接受的数值修正。
- 检查页面最终显示、搜索索引候选数据和计算器输入。

### 验收标准

- [x] 五把武器可完整解析和生成页面。
- [x] 非预期数值变化为零。
- [x] 每个显示值都能追溯到 MDX、Lock、派生公式或 override。
- [x] 四连发等变体不再复制整套伤害与射击参数。
- [x] 未知 Tag 和 Item 差异有报告，不被静默吞掉。
- [x] 不需要增加武器名特判。
- [x] 普通枪械可直接使用 ASC 衰减；能源之影、弓箭、暗器和榴弹样本可通过来源级 override 得到正确的适用状态与显示值。
- [x] 距离衰减的异常处理不依赖武器名称或武器类型分支。
- [x] PVE 与 GP 两种技能充能来源都完成端到端验证。

### 依赖

- Task 4 的 Resolver。

---

## Task 6：切换全部武器数据消费者

> 状态：已完成。统一主来源、服务端/客户端边界、模式级衰减与技能充能规则见 [`MD/WEAPON-RESOLVER.md`](./WEAPON-RESOLVER.md)。

### 目标

让所有消费者只读取 `ResolvedWeapon`，彻底切断业务代码对 MDX 旧字段和 Lock 原始字段的直接依赖。

### 工作内容

- 切换武器详情、卡片、列表、筛选和衰减图表。
- 详情与衰减图表读取当前 `damageSource.attenuation`；仅在状态为 `applicable` 时展示数值和曲线，多模式武器随所选伤害来源切换。
- 搜索索引生成器改为读取标准化结果。
- `weapon-stats.json` 从 `ResolvedWeapon` 生成。
- 伤害计算器读取统一的标准化数据，不再依赖拼错的 `weekness_multiplier`。
- 明确 LC / TD 的解析入口和 Numerical 表来源。
- 对武器级摘要值建立一致规则，例如默认主模式、默认伤害来源。
- 页面暂未展示的 ASC / Feel 原始能力不要求一次性做 UI，但领域模型不得丢失。
- `WeaponCard` 与正文 `<ActiveSkill>` 改为消费同一个标准化 `chargeTime`，不再分别手填或解析 CD。
- 为关键消费者添加针对性测试或快照。

### 验收标准

- [x] 业务消费者不直接解析武器 frontmatter。
- [x] 消费者不直接读取 Lock 或 Unreal 字段。
- [x] V1 / V2 差异只存在于 Resolver 内部。
- [x] LC / TD 不会跨表串用。
- [x] 试点武器的详情页、搜索、筛选、图表和计算器结果一致。
- [x] `not_applicable` 的伤害来源不显示距离衰减数值或曲线，消费者不再读取旧 `range` 或顶层衰减字段。
- [x] 武器卡片与正文技能卡片显示相同的基础充能时间。

### 依赖

- Task 5 试迁移通过并冻结规则。

---

## Task 7：批量迁移 LC / TD 武器

### 目标

把剩余武器迁移到 V2，并形成可复核的完整 Lock 和异常清单。

### 工作内容

- 编写可重复执行的迁移工具，禁止一次性手搓全库替换。
- 以现有 MDX 为语义基准，以 Prototype、Numerical、ASC、Feel、Item、Skill PVE 和 GP 为候选来源。
- 先迁移 LC，再迁移 TD；二者独立生成报告并建议分开提交。
- 自动填充只限高置信度映射；以下情况进入人工核验：
  - Numerical / ASC / Feel / Item 引用缺失。
  - 一个来源存在多个候选。
  - Prototype Mode 与显式引用不一致。
  - 现有 MDX 与原表值不同。
  - Settlement 语义未识别。
  - 技能伤害不在 Prototype 链路。
  - `active_skill_id` 与 Prototype `ActiveSkillID` 不一致。
  - PVE 技能行缺失并使用 GP fallback。
  - LC / TD 同名武器结构不同。
  - ASC 衰减值非零，但该伤害来源被人工标记为不适用。
  - ASC 衰减为 `0 / 0`，但旧 MDX 存在非零衰减值。
  - 衰减起止距离或最低倍率不满足领域约束。
- 武器类型只用于生成衰减核验候选清单，不得据此自动把某一整类标记为适用或不适用。
- 对差异分类输出，不把“表更新”和“迁移错误”混在一起。
- 每批迁移后生成快照、运行 Lock 检查和消费者回归。
- 结构迁移与确认后的真实数值修正分开提交。

### 验收标准

- [ ] 所有可迁移武器均使用 V2。
- [ ] 每个引用都存在于对应 Lock。
- [ ] 所有未迁移项都有明确原因和责任分类。
- [ ] 没有静默零值、空引用、错误 Item 或跨表引用。
- [ ] 所有“ASC 非零但不适用”的来源都有可追溯 override 与原因，不存在按类型批量硬编码的例外。
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
  - `skill_cooldown`
  - `range`
  - `attenuation_begin`
  - `attenuation_end`
  - `attenuation_scale`
  - 其他已被 ASC / Feel 稳定替代的弹药、衰减和换弹副本
- 删除旧 `weapon.range` 领域字段及其消费者；距离衰减只保留来源引用、标准化结果和必要 override。
- 删除正文 `<ActiveSkill cooldown={...}>` 的重复 CD，改由统一标准化数据提供。
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
- [ ] 仓库不存在旧 `range`、顶层衰减字段或对应领域模型 fallback。
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
| Task 2.5：接入主动技能基础充能链 | 已完成 | Task 1、2 | PVE / GP 技能读取规则、fallback 与校验测试 |
| Task 3：实现 Weapon Data Lock | 已完成 | Task 1、2、2.5 | 多来源 Lock、刷新与只读检查命令 |
| Task 4：实现 V1/V2 Resolver | 已完成 | Task 1、3 | `ResolvedWeapon`、来源追踪、override 机制 |
| Task 5：迁移代表武器 | 待开始 | Task 4 | 试点 MDX、Lock、迁移前后快照 |
| Task 6：切换全部消费者 | 待开始 | Task 5 | 页面、索引、图表、计算器统一入口 |
| Task 7：批量迁移 LC / TD | 待开始 | Task 6 | 全量 V2、完整 Lock、人工核验清单 |
| Task 8：删除 V1 并收尾 | 待开始 | Task 7 | 单一正式管线、CI 检查、正式文档 |

## 3. 跨任务硬性规则

- MDX 是“选择哪些原始数据、赋予什么 Wiki 语义、是否人工覆盖”的唯一来源。
- Lock 是构建时的原始数据快照，不是另一套人工编辑数据库。
- `refs/` 只服务于显式刷新和校验，普通构建不得读取。
- PrototypeConfig 负责发现和核验关系，不替代 MDX 的显式选择。
- 距离衰减按伤害来源从 ASC 解析；不适用或需修正时使用来源级 override，禁止按武器名称或类型硬编码。
- 主动技能 CD 默认取 PVE `ChargeNeedTime`；只有 PVE 缺行时才允许使用 GP `CooldownDuration`。
- 技能持续时间、阻回、击杀充能和基础充能时间是不同概念，不得压成单个 `skill_cooldown`。
- 自动化遇到歧义必须报错或进入核验清单，不能猜一个写进去。
- 迁移造成的结构变化与真实数值修正必须可分开审查。
- 任何字段只有在来源稳定、Resolver 已接入、全量迁移完成后，才允许从 MDX 删除。
