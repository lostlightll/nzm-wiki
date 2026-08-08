# Weapon Resolver

> 状态：active
> 实现：`lib/weapon-resolver.ts`

`lib/weapon-resolver.ts` 是武器 frontmatter 到页面领域数据的唯一解析入口。它支持迁移期 V1 与正式 V2，并保证普通构建只读取已提交的 `data/weapon-data-lock.json`，不访问 `refs/`。

## 公共入口

```ts
parseWeaponSource(input, { slug, expectedTable })
resolveWeapon(input, { slug, expectedTable, lock })
resolveDamageSourceReferences(weapon, expectedTable)
resolveDamageSource(weapon, sourceId, { lock, expectedTable, weaponPath })
toLegacyWeapon(resolved)
createResolvedWeaponSnapshot(resolved, { sourceIdMap })
```

- 无 `schema_version` 的输入按 V1 解析。
- 只有数字 `schema_version: 2` 是 V2；其他显式版本全部拒绝。
- V2 必须提供 Weapon Data Lock；V1 不读取 Lock。
- `expectedTable` 是 LC/TD 权威上下文。它必须出现在 frontmatter 的 `game_modes` 中，并选择 `source` 或 `sources[expectedTable]`；缺少模式来源表示该来源在该模式不可用，禁止回退到另一模式。

## 领域模型

`ResolvedWeapon` 不继承旧 `Weapon`，也不提供含义模糊的 `range`。它保存：

- 有序的 `damageSources` 与明确的 `mainSourceId`。
- Numerical 伤害、元素、弱点、暴击、破韧和 Settlement。
- ASC 射击节奏、弹丸、弹药、移动倍率和来源级距离衰减。
- Feel 换弹、开镜、操作时间、后坐力和散布。
- Item 展示属性与六项官方雷达值。
- 主动技能的 `chargeTime`、`chargeCount` 和 PVE/GP 来源。
- 字段状态、diagnostics、provenance、override history 和完整原始行。

字段状态与值来源分开：

| 状态 | 含义 |
| :--- | :--- |
| `resolved` | 得到非零有效值 |
| `zero` | 确定为零 |
| `not_applicable` | Settlement 或机制明确不适用 |
| `missing` | 协议允许缺少该可选字段 |
| `unavailable` | 字段适用，但当前无法取得或派生 |
| `unrecognized` | 原始枚举或语义尚未登记 |

人工覆盖不占用状态枚举。每个被覆盖字段保留从父来源到子来源的完整 `overrideHistory`。

## Settlement

Resolver 对完整 `TagName` 做精确匹配，不做后缀猜测。Settlement 决定五类伤害值和元素积累是否适用；不适用字段即使原始行为零也不会被解释为“确定为零”。

以下情况直接失败：

- `Settlements` 缺失、非数组或条目没有非空 `TagName`。
- Settlement 适用但必要原始字段缺失或非法。
- override 试图给不适用的 Settlement 造值。

重复 Tag 保留原始顺序并产生 info；未知 Tag 保留并产生 warning。

## ASC 与 Feel

ASC 引用存在时，Lock 行是权威来源。required 字段缺失或非法时直接失败，不能使用 MDX compatibility 字段掩盖。没有 ASC 引用时，来源级 `fire_interval` 和 `pellets` 才作为迁移 fallback。`fire_interval` 始终表示射击节奏并派生 `fire.rpm`；有可定位证据的固定频率伤害使用独立的 `attack_interval`，映射为 `attack.interval` 并保留证据，不派生 RPM。可选的手工确认 `attack_count` 映射为 `attack.count`，只能随攻击间隔存在。Schema 禁止 `attack_interval` 与有效 ASC 同时出现。

经实测确认的射击间隔差异使用 `overrides.asc.fire_interval`。Resolver 按继承链顺序应用覆盖，保留 ASC 原始值及每一步 interval/RPM 历史，并在每一步后重新计算 RPM；最终间隔为零时 RPM 明确为 `unavailable`。兼容 `fire_interval` 与最终有效值比较，不与覆盖前 ASC 值比较。

距离衰减按伤害来源解析：

- `0 / 0` 为 `not_applicable`。
- `end > begin` 且 `end > 0` 为 `applicable`，厘米转换为米。
- 最低倍率必须在 `[0, 1]`。
- 其他组合为 `INVALID_ATTENUATION`。

合法 ASC 候选可以通过 `overrides.asc.attenuation` 改为适用或不适用。原始厘米值、有效值和覆盖原因同时保留。

Feel 固定字段与所有 `AccuracyRatio_*` 均为可选；存在时必须是有限非负数。`accuracyRatios` 保留完整原始键名。

## Item 与技能

Item 只读取显式 `item_id`。行缺失或身份不一致直接失败；取得合法行后，单个展示字段缺失、非法或枚举未知时才允许按协议回退 MDX，并保留被拒来源与 fallback provenance。

主动技能只使用 Lock 的 `active_skills["{id}_1"]` 选择：

- `weapon_pve` 读取 `ChargeNeedTime` 与 `SkillCount`。
- `gp_fallback` 读取 `CooldownDuration` 与 `MaxChargeStackCount`。
- PVE 行存在时禁止 GP fallback。
- PVE 行非法时禁止改走 GP。

## V1 与消费者边界

`lib/weapon-legacy.ts` 保存迁移前转换语义。V1 先转成旧 `Weapon`，再归一化为同形 `ResolvedWeapon`；`toLegacyWeapon()` 对 V1 返回保存的精确 bridge。

`lib/weapons.ts` 是唯一读取武器 frontmatter 的服务端边界。LC 与 TD 都读取 `data/weapons` 中的同一份 MDX；所有入口必须显式传入 `lc` 或 `td`，并直接返回对应投影的 `ResolvedWeapon`：

```text
frontmatter + committed Lock -> resolveWeapon() -> server consumers
                                          \-> client-safe consumer views
```

Resolver 独占主来源决策：先排除 `damage.base` 不适用的恢复等非攻击结算来源，再选择首个 `fire_mode`，否则选择首个攻击来源。空来源或仅含非攻击结算来源时没有 `mainSourceId`。消费者只能按 `mainSourceId` 精确查找；存在攻击来源却缺失 ID，或 ID 悬空，均是领域不变量错误，禁止再次按 section 或数组位置 fallback。武器级元素优先使用有效主来源元素；不可攻击武器仍保留协议顶层元素，供目录筛选和搜索使用。

`lib/weapon-consumers.ts` 只接受 `ResolvedWeapon`，不得读取 frontmatter、Lock 或 `refs/`。目录视图携带主来源摘要，并为近战额外保留按 MDX 顺序排列的全部 `meleeSources` 摘要；详情视图保留全部标准化 Damage、ASC、Feel、衰减和技能字段。消费者不再暴露旧 `melee.light/heavy` 武器级字段，也不得由 `mainSourceId` 猜出其余近战段。两种客户端视图都删除 `raw`、provenance、diagnostics、override history、原表字段名和来源 key，避免把审计数据序列化到 RSC/client payload。完整审计信息仍保留在服务端 `ResolvedWeapon`。

近战展示保持来源顺序并逐段读取基础伤害、元素异常概率、破韧、弱点和暴击。目录卡只消费基础形态的 `section: melee` 来源，使用紧凑的“招式 / 伤害 / 元素异常 / 破韧”四列，统一弱点与暴击只作为表外摘要；详情页同时纳入近战武器的 `section: variant` 来源，并按连续的 `label` 分组展示全部形态。移动端改用每段分组布局，避免六列表压缩或横向溢出。无攻击来源的特殊近战继续显示“不可攻击”，不能伪造空连段。

详情页保留既有的“普通射击 / 技能与特殊攻击 / 武器属性”呈现结构，不因 V2 数据链新增模式选择器。模式面板按 `section` 展示全部标准化来源；武器级元素、衰减摘要和曲线严格使用 Resolver 给出的 `mainSourceId`。只有主来源的 `attenuation.status === "applicable"` 才显示衰减，消费者不读取旧 `range` 或顶层衰减字段。目录卡、搜索与 `weapon-stats.json` 同样使用该 `mainSourceId` 摘要。

正文 `<ActiveSkill>` 的 `cooldown` 始终由标准化 `chargeTime` 覆盖；字段不可用时明确不显示，不能退回正文手填 CD。标准化 `chargeCount` 有值时覆盖正文 count，否则正文 count 只作为通用展示兼容值。重复属性的物理删除见 [`../plans/weapon-v2-cleanup.md`](../plans/weapon-v2-cleanup.md)。

V2 到旧模型的 `toLegacyWeapon()` 仍是迁移期有损适配，只供 Resolver 回归和迁移工具使用；业务消费者不再调用。Settlement 不适用或缺失的旧必填数字使用 `0`，旧模型无法表达的 toughness `none` 使用旧默认“冲击”，并产生 `LOSSY_LEGACY_PROJECTION`。V2 不恢复旧 `range` 或顶层衰减字段。

## Snapshot

`createResolvedWeaponSnapshot()` 返回 `snapshot_version: 1`：

- 递归删除所有 `raw` 和 `undefined` 对象属性。
- 对象键稳定排序，数组保持领域顺序。
- override history 保持父到子顺序。
- diagnostics 精确去重并稳定排序。
- `sourceIdMap` 支持迁移前后稳定 ID 对齐；未知 ID、非法目标和最终冲突全部拒绝。

## 命令

```text
pnpm test:weapon-source-v2
pnpm test:weapon-resolver
pnpm test:weapon-consumers
pnpm test:weapon-data-reader
pnpm test:weapon-skill-charge
pnpm test:weapon-data-lock
pnpm weapon-data:check
```

Resolver 测试包含 LC/TD 全部 224 个 V1 文件的旧 bridge 深比较。消费者测试固定主来源、LC/TD 隔离、客户端审计边界、搜索/统计、衰减三态和技能充能一致性。生产构建不需要 `refs/`。
