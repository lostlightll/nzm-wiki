# 猎场 Buff 数据维护

状态效果页面使用一份已提交的数据锁和确定性生成的 WebP 图标。构建与页面运行时只读取仓库文件，不读取 `refs/`。

## 数据链路

```text
猎场导出表
  → scripts/status-effects/extract.ts
  → scripts/status-effects/cli.ts
  → data/status-effects.json
  → components/StatusEffectCatalog*.tsx
  → data/posts/enemy-buffs.mdx / player-buffs.mdx
```

Required 源表：

- `refs/Exports/NZM/Content/DataTables/Buff/BuffConfigDatatableNew.json`
- `refs/Exports/NZM/Content/DataTables/GameFeatureConfig/ElementConfigDataTable.json`
- `refs/Exports/NZM/Content/Attributes/AutoGenerate/numerical_modifier_config.json`
- `refs/Exports/NZM/Content/DataTables/numerical_config_others.json`

不要替换为 TDM/PVP 专用 Buff 表。`refs/` 只作为本地抽取证据，不能成为站点运行时依赖。

## 收录规则

- 极性只接受 `Positive` 与 `Negative`，`Normal` 不收录。
- 敌方：`DisplayPlaceEnumBitmask` 为 `2` 或 `3`，且极性为 `Negative`。
- 玩家：显示位为 `1`、`3` 或 `4`，收录 `Positive` 与 `Negative`。
- 显示位 `3` 可以同时进入两页。
- 显示位 `4` 作为玩家特殊状态处理。
- 同一 `BuffID` 合并为一项，但 `variants` 必须完整保留每条内部行、名称、描述、持续时间、周期、叠层、图标与数值引用。
- `ElementConfigDataTable` 只补充四元素摘要和敌方/玩家 Buff 名称对应关系，不覆盖 Buff 主表。

当前基线为敌方 110 行合并成 91 项，玩家 1017 行合并成 705 项。源表升级后数量可以变化，但应先确认变化原因。

## 刷新与校验

```bash
pnpm status-effects:refresh
pnpm status-effects:check
pnpm test:status-effects
```

`status-effects:refresh` 会重新抽取 `data/status-effects.json`，并把被引用且存在源 PNG 的图标转换到 `public/webp/icons/status-effects/`。文件名由原始资产路径的哈希和名称生成，相同输入会得到相同路径。

`status-effects:check` 会重新抽取并比较已提交数据，同时检查：

- 数据锁是否过期；
- 生成图标是否缺失或存在过期文件；
- 图标豁免是否有原因；
- 指向替代公开图标的豁免路径是否真实存在。

源导出缺失 PNG 时，必须在 `data/status-effect-icon-exemptions.json` 中显式登记。可指定现有公开图标：

```json
{
  "/Game/Path/Icon.Icon": {
    "publicPath": "/webp/icons/elements/fire.webp",
    "reason": "复用已提交的元素图标"
  }
}
```

如果没有可靠替代图标，将 `publicPath` 设为 `null` 并写明原因。页面会显示统一的缺图占位，不能删除豁免后静默忽略。

## 数值引用

`GPModifyIDs` 联查 `numerical_modifier_config`，`NumericalID` 联查 `numerical_config_others`。可解析内容写入 `references`，图鉴技术详情按 ID 展开。源表中找不到的引用继续保留原始 ID，并明确显示为“未解析”，不能猜测或删除。

## 发布检查

数据刷新后至少运行：

```bash
pnpm status-effects:check
pnpm lint
pnpm index
pnpm build
```

两篇 MDX 位于 `data/posts/`，会自动进入文章归档、指南归档、搜索索引和站点地图。旧 `/posts/element` 当前保留；未来删除时需要单独处理重定向、站内链接和 canonical 迁移。

