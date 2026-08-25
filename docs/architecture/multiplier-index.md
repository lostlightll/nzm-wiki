# 增伤类型双向索引

> 状态：active  
> Schema：`data/guides/multiplier.json` V12，`data/modifier-providers.json` V1，`data/guides/multiplier-providers-runtime.json` V1

## 统一链路

站点用两条语义不同的链路生成双向查询：

```text
ItemID / CardID / 技能身份 -> 结构化证据 -> 增伤类型 -> 乘区 -> 页面落点
Settlement / 元素 / 许可标记 -> 伤害画像 -> 可用增伤类型 -> 乘区
武器 MDX 来源名 + Weapon Resolver 白值 -> 模式基础攻击力 -> 单次基础伤害
```

- `provider` 表示技能、插件、竞速卡片、超限卡片或羁绊提供某种增伤。
- `target` 表示原子伤害来源可以受到某种增伤影响。
- 插件以 ItemID 为稳定身份；同 ID 超限卡片由运行时自动展开第二个页面落点。
- 猎场竞速卡片以 CardID 为稳定身份，页面来源使用卡片 slug；只有 `CardID → Card_Function → MGE/Buff → GPModifier → Numerical AttributeName` 完整连通时才登记。
- 攻击等级覆写型卡片必须额外保存来源 MGE、覆写等级、攻击等级被动与下游 MGE；审计需确认该等级最终命中同等级 Numerical 行，不能把 `SetAttackLevelOverride` 当作证据链终点。
- `refs/` 只用于人工核验证据，构建和页面运行时不得读取。

## 数据所有权

`data/guides/multiplier.json` 保存乘区和通道定义：

- `factors`：对外显示的规范乘区名。
- `baseDamage`：基础伤害公式及 LC/TD 模式基础攻击力；不保存武器白值副本。
- `damageChannelMatrix.channels`：索引分面和伤害类型适用规则；运行时导出为 `MODIFIER_TYPES`。属性字段由 Num Modifier 语义投影补充，不在矩阵复制。
- `factorDetails`：只保存规则、案例和提示等编辑内容；属性字段与元素选择标签由 Num Modifier 语义投影生成，禁止手写 `attributeFields`。
- 原有公式、规则、矩阵和案例说明继续作为乘区页面的编辑内容。

`data/modifier-providers.json` 是通用 Modifier 来源的唯一服务端注册表：

- `providers`：来源身份、Num 表达式、接收者上下文和结构化证据；直接来源不复制增伤类型。
- `exclusions`：非增伤候选及明确排除理由。
- 旧乘区案例只用于说明，不会被隐式转换为来源关系。
- 直接证据保存精确 `{ row, field, scale }`，按 `ItemID → PassiveSkill_ID → MGE GPModifier → resolveEffect() → facet → factor` 派生。
- 没有直连 Num 表达式的效果才使用 `reviewed-override`，并保留人工分面和完整机制依据。
- 竞速卡片禁止使用 `reviewed-override`；无法解析出伤害分面的表达式不进入乘区投影。
- `data/modifier-index-runtime.json` 是通用轻量投影；`data/guides/multiplier-providers-runtime.json` 从其中筛选伤害分面生成。客户端不导入完整 Lock。

超限卡片的具体增伤值不写入来源注册表，而由同 ItemID 插件 MDX 的 `effect_values` 维护。两类数据职责如下：

- `modifier-providers.json` 决定“来源是谁、施加哪些表达式”，分类由语义 Resolver 派生。
- `effect_values` 决定“向玩家显示什么条件和数值”。条件语义可参考审定文案；凡能直连 Numerical 的值必须引用 Num Modifier V2 表达式，描述和人工文案覆盖不能覆盖结构化值。
- `lib/overlimit-cards.ts` 保留 `overlimit-cards.json` 的卡片短摘要，并用稳定 ItemID 合并 MDX 的 V2 `effect_values`；完整插件描述不覆盖卡片摘要。
- 校验要求每个超限增伤来源与派生伤害分面精确匹配；未知分面、空阶段、重复语义和孤立效果都会报错。

武器目标关系不写回 MDX。`lib/multiplier-data.ts` 直接消费 Weapon Resolver 已有的 `settlements`、`element`、`enableCritical` 和 `enableWeakness`，为每个 `damageSources[]` 条目建立伤害画像。

武器白值索引同样不维护静态副本。`lib/weapon-base-damage.ts` 接收 LC/TD 的 `ResolvedWeapon[]`，只收录非近战武器中 `damage.base` 已解析的 MDX `damage_sources[]`；刺隐、夜影之逝等其他武器上的 `MeleeWeaponDamage` 来源继续保留。名称固定使用 `weapon.title + source.name`，白值和结算身份来自对应模式的 Resolver 投影，不读取 Lock `Description`。

## 术语

徽标只显示规范乘区名，例如：

- 游戏模式乘区
- 独立增幅
- 大稀释乘区
- 元素乘区
- 易伤乘区
- 元素易伤乘区

`WeaponDamageRatio`、`WeaponHitDamageRatio`、`CloseRangeDamageRatio` 等只是大稀释乘区内的增伤类型，不得展示成“武器乘区”“武器通道乘区”或“近距离乘区”。同一伤害来源命中多个同乘区通道时，界面合并为一个乘区徽标，通道名只放在提示和精确筛选中。

`GPAttributeSetAttack.Attack` 归入“独立增幅”，只用于来源索引和来源徽标，不进入 Part 1 公式或伤害来源适用矩阵。

`独弹强化` 当前使用精确行 `lc:111031014_1_0` 的临时实测语义：`BaseValue=6` 表示该次独头弹伤害按 `1 + 6 = 7` 倍独立结算，页面显示增量 `+600%`。它继续归入 `correction`“单次修正”，不归入上述 `independent-amplification`“独立增幅”；该结论不得推广到其他 `GPModifierOp=B2` 行。临时规则和失效条件见 [`../standards/num-modifier-semantics.md`](../standards/num-modifier-semantics.md#独弹强化-b2-临时规则)。

`DamageBearRatio` 的负值效果统一归入 `vulnerability`，显示名固定为“易伤乘区”；各单元素 `*DamageBearRatio` 与 `ElementDamageBearRatio` 的负值效果归入 `element-vulnerability`，显示名固定为“元素易伤乘区”。对应字段的正值是伤害减免，不进入增伤来源索引。旧 `factor=damage-reduction` 查询会兼容读取为 `vulnerability`。

## 运行时接口

`lib/multiplier-data.ts` 导出：

- `buildDamageProfile()`
- `getApplicableModifierTypes()`
- `getProviderRelationsForSource()`
- `getSourcesForModifierType()`
- `getRelationsByFactor()`
- `resolveMultiplierSourceHref()`
- `resolveMultiplierFactorHref()`
- `BASE_DAMAGE_DATA`

通用 Modifier 查询由 `lib/modifier-index.ts` 提供，可按来源、属性类型、方向、分面和接收者检索。

`lib/weapon-base-damage.ts` 导出：

- `buildWeaponBaseDamageIndex()`
- `WeaponBaseDamageEntry`

指南链接以查询参数保存状态：

```text
/guides?factor=dilution&view=providers&modifier=all-damage#multiplier
/guides?part=damage-sources#multiplier
```

`part`、`factor`、`view`、`modifier` 是可分享和可前进/后退恢复的权威状态；`factor` 表示当前 Part 的乘区状态。乘区公式和增伤索引分别保存自己的乘区选择，切换 Part 时恢复各自状态，不互相同步；元素易伤乘区只出现在增伤索引。`part=damage-sources` 打开同页 Part 2，不创建独立子路由。基础伤害索引额外使用 `mode=td` 表示塔防，缺少或非法 `mode` 时默认猎场。本地存储只作为没有查询参数时的乘区选择回退。

武器原子来源使用 `#damage-source-{sourceId}`。赛季节点和被动使用可分享 query 深链：

```text
/guides/season-talents/s3/grappling-hook?node=3003501#multiplier-provider-node-3003501
/guides/season-talents/s3/zero?passive=2030104#multiplier-provider-passive-2030104
```

通用节点只在 `zero` 注册一个规范来源；另外两棵树将页面节点 ID 归一为该来源后反查徽标。

## 校验

```text
pnpm test:multiplier-data
pnpm test:overlimit-cards
pnpm overlimit-effects:audit
pnpm test:weapon-base-damage
pnpm multiplier-index:check
pnpm multiplier-providers:audit
pnpm num-modifier:check
```

测试覆盖基础伤害模式配置、全量白值索引、超限镜像、双乘区、Settlement 匹配和路由。`multiplier-index:check` 不依赖 `refs/`，验证所有发布插件、147 张卡片、武器技能和 S3 天赋均已映射或明确排除，并检查路由、镜像和双向一致性。`overlimit-effects:audit` 在存在 `refs/` 时重建身份链，但 Numerical 数值统一读取 Num Modifier Lock；`multiplier-providers:audit` 通过 Resolver 核对 ItemID、MGE token、表达式和已锁定属性描述。`num-modifier:check` 离线检查语义覆盖、来源引用和投影新鲜度，构建前固定执行。
