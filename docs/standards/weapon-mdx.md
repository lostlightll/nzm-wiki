# 武器 MDX 编写规范

> 状态：active
> 可执行约束：`lib/weapon-source-v2.ts`

本文规定武器 MDX 的通用边界和编写流程。数值引用、继承、覆盖和错误语义由 [`weapon-numerical-v2.md`](weapon-numerical-v2.md) 定义；本文不重复定义该协议。

## 数据所有权

- `data/weapons/*.mdx` 是站点武器内容的唯一人工维护来源；一份文档同时声明其支持的 LC/TD 模式。
- `schema_version: 2` 的结构以 `weaponSourceV2Schema` 为可执行约束。
- MDX 保存稳定引用、Wiki 语义和有证据的人工修正，不内嵌从原表稳定解析出的完整数值副本。
- `data/weapon-data-lock.json` 是被引用原始行的构建快照，不是另一套人工数据库。
- `refs/` 只用于显式提取、刷新和核验；普通构建不得读取。

## 通用 frontmatter

V2 武器必须包含：

```yaml
schema_version: 2
title: 武器名称
game_modes: [lc, td]
prototype_id: "20000000000"
use_type: 远程
element: 物理
rarity: 稀有
damage_sources: []
```

可选页面字段包括 `nickname`、`keywords`、`tag`、`toc`、`page-width` 和 `draft`。可选身份与展示字段以 `weaponSourceV2Schema` 当前声明为准，不得绕过 strict schema 添加未知字段。

字段顺序统一为：页面元数据、武器身份、`damage_sources`、仍在迁移期保留的人工字段。不要为了排序重写正文或无关字段。

## damage_sources

- 武器自身的明确火力模式、技能伤害、插件伤害、爆炸、Dot 和恢复等来源都使用 `damage_sources` 表达。
- `source` 表示全部 `game_modes` 共用同一逻辑引用；`sources` 表示模式专属完整机械配置，两者必须且只能出现一个。
- `source.numerical` 不填写 table。Resolver 按当前页面模式选择 LC/TD Lock namespace；禁止跨模式回退。
- 每个来源必须有稳定 `id` 和人工确认的 `name`；`group`、`label` 和 override 只能根据实际语义与证据填写。
- 不得恢复 V1 的 `damage`、`damage_modes`、`extra_modes`、`mode_names` 或拼写错误字段。
- 不得根据武器名称、Numerical 描述或编号规律猜测来源关系。

完整结构、LC/TD 隔离、继承和 override 规则见 [`weapon-numerical-v2.md`](weapon-numerical-v2.md)。

## 正文与组件

- 正文用于技能说明、机制解释、演示和来源署名，不重复维护能够从 Resolver 获取的基础数值。
- 模式专属正文使用 `<GameMode only="lc|td">`；可从 Resolver 比较得到的模式数值差异使用 `<WeaponModeDiff />`，不得手写重复差异表。
- 优先复用 `lib/mdx-components.tsx` 已注册组件。
- 图片和视频使用站点资源路径；组件内部或 React 代码中的资源必须经过 `getAssetPath()`。
- `<ActiveSkill>` 等正文组件不得重新写入已经由统一武器数据提供的数值。

## 录入与验证

1. 从结构化原表和现有 MDX 确认 `prototype_id`、模式和来源候选。
2. 人工确定来源名称、分组、继承和必要 override。
3. 写入 V2 frontmatter 后刷新 Lock：`pnpm weapon-data:lock`。
4. 运行 `pnpm weapon-data:check`、`pnpm test:weapon-source-v2`、`pnpm test:weapon-resolver` 和相关消费者检查。
5. 审查迁移造成的结构变化与真实数值修正，二者必须可以分别说明。
