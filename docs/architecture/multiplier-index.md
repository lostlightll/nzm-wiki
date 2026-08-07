# 增伤类型双向索引

> 状态：active  
> Schema：`data/guides/multiplier.json` V10

## 统一链路

站点用两条语义不同的链路生成双向查询：

```text
属性证据 -> 增伤类型 -> 乘区 -> 共享效果 -> 页面落点
Settlement / 元素 / 许可标记 -> 伤害画像 -> 可用增伤类型 -> 乘区
```

- `provider` 表示技能、插件、超限卡片或羁绊提供某种增伤。
- `target` 表示原子伤害来源可以受到某种增伤影响。
- 插件版和超限卡片版是两个页面落点，但可以引用同一个共享效果。
- `refs/` 只用于人工核验证据，构建和页面运行时不得读取。

## 数据所有权

`data/guides/multiplier.json` 保存：

- `factors`：对外显示的规范乘区名。
- `damageChannelMatrix.channels`：增伤类型、属性字段和伤害类型适用规则；运行时导出为 `MODIFIER_TYPES`。
- `providerEffects`：效果与增伤类型的唯一关系。
- `providerPlacements`：共享效果在武器、插件、超限卡片和羁绊页面的具体落点。
- 原有公式、规则、矩阵和案例说明继续作为乘区页面的编辑内容。

武器目标关系不写回 MDX。`lib/multiplier-data.ts` 直接消费 Weapon Resolver 已有的 `settlements`、`element`、`enableCritical` 和 `enableWeakness`，为每个 `damageSources[]` 条目建立伤害画像。

## 术语

徽标只显示规范乘区名，例如：

- 游戏模式乘区
- 大稀释乘区
- 元素乘区

`WeaponDamageRatio`、`WeaponHitDamageRatio`、`CloseRangeDamageRatio` 等只是大稀释乘区内的增伤类型，不得展示成“武器乘区”“武器通道乘区”或“近距离乘区”。同一伤害来源命中多个同乘区通道时，界面合并为一个乘区徽标，通道名只放在提示和精确筛选中。

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

武器原子来源使用 `#damage-source-{sourceId}`。提供增伤的页面效果和羁绊阶段使用 `providerPlacements.source.anchor` 中声明的稳定锚点。

## 校验

```text
pnpm test:multiplier-data
pnpm multiplier-index:check
```

前者覆盖共享效果、双乘区、Settlement 匹配和路由；后者验证显式页面落点对应的武器、插件、超限卡片与羁绊阶段真实存在。
