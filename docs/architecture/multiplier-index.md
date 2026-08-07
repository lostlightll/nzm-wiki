# 增伤类型双向索引

> 状态：active  
> Schema：`data/guides/multiplier.json` V11，`data/guides/multiplier-providers.json` V1

## 统一链路

站点用两条语义不同的链路生成双向查询：

```text
ItemID / 技能身份 -> 结构化证据 -> 增伤类型 -> 乘区 -> 页面落点
Settlement / 元素 / 许可标记 -> 伤害画像 -> 可用增伤类型 -> 乘区
```

- `provider` 表示技能、插件、超限卡片或羁绊提供某种增伤。
- `target` 表示原子伤害来源可以受到某种增伤影响。
- 插件以 ItemID 为稳定身份；同 ID 超限卡片由运行时自动展开第二个页面落点。
- `refs/` 只用于人工核验证据，构建和页面运行时不得读取。

## 数据所有权

`data/guides/multiplier.json` 保存乘区和通道定义：

- `factors`：对外显示的规范乘区名。
- `damageChannelMatrix.channels`：增伤类型、属性字段和伤害类型适用规则；运行时导出为 `MODIFIER_TYPES`。
- 原有公式、规则、矩阵和案例说明继续作为乘区页面的编辑内容。

`data/guides/multiplier-providers.json` 是来源关系的唯一注册表：

- `providers`：来源身份、增伤类型和结构化证据。
- `exclusions`：非增伤候选及明确排除理由。
- 旧乘区案例只用于说明，不会被隐式转换为来源关系。
- 直接证据按 `ItemID → PassiveSkill_ID → MGE GPModifier → Numerical AttributeName → modifier type → factor` 保存。
- 没有直接 GPModifier 的效果必须使用 `reviewed-override` 并保留描述、数值行或机制依据。

武器目标关系不写回 MDX。`lib/multiplier-data.ts` 直接消费 Weapon Resolver 已有的 `settlements`、`element`、`enableCritical` 和 `enableWeakness`，为每个 `damageSources[]` 条目建立伤害画像。

## 术语

徽标只显示规范乘区名，例如：

- 游戏模式乘区
- 大稀释乘区
- 元素乘区
- 易伤乘区

`WeaponDamageRatio`、`WeaponHitDamageRatio`、`CloseRangeDamageRatio` 等只是大稀释乘区内的增伤类型，不得展示成“武器乘区”“武器通道乘区”或“近距离乘区”。同一伤害来源命中多个同乘区通道时，界面合并为一个乘区徽标，通道名只放在提示和精确筛选中。

`DamageBearRatio` 的负值效果统一归入 `vulnerability`，显示名固定为“易伤乘区”；正值是伤害减免，不进入增伤来源索引。旧 `factor=damage-reduction` 查询会兼容读取为 `vulnerability`。

## 运行时接口

`lib/multiplier-data.ts` 导出：

- `buildDamageProfile()`
- `getApplicableModifierTypes()`
- `getProviderRelationsForSource()`
- `getSourcesForModifierType()`
- `getRelationsByFactor()`
- `resolveMultiplierSourceHref()`
- `resolveMultiplierFactorHref()`

指南链接以查询参数保存状态：

```text
/guides?factor=dilution&view=providers&modifier=all-damage#multiplier
```

`factor`、`view`、`modifier` 是可分享和可前进/后退恢复的权威状态；本地存储只作为没有查询参数时的乘区选择回退。

武器原子来源使用 `#damage-source-{sourceId}`。赛季节点和被动使用可分享 query 深链：

```text
/guides/season-talents/s3/grappling-hook?node=3003501#multiplier-provider-node-3003501
/guides/season-talents/s3/zero?passive=2030104#multiplier-provider-passive-2030104
```

通用节点只在 `zero` 注册一个规范来源；另外两棵树将页面节点 ID 归一为该来源后反查徽标。

## 校验

```text
pnpm test:multiplier-data
pnpm multiplier-index:check
pnpm multiplier-providers:audit
```

测试覆盖超限镜像、双乘区、Settlement 匹配和路由。`multiplier-index:check` 不依赖 `refs/`，验证所有发布插件、137 张卡片、武器技能和 S3 天赋均已映射或明确排除，并检查路由、镜像和双向一致性。`multiplier-providers:audit` 在存在 `refs/` 时继续核对 ItemID、MGE token、Numerical 行与 AttributeDescMapTable；构建前固定执行运行时检查。
