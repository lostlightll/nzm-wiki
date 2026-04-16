# BuffCard / BuffCardGrid / CardRef / BuffDetail

Buff/Debuff 卡片系统，数据来自 `data/cards-data.json`。

## CardRef

通过 slug 引用卡片数据，在 `BuffCardGrid` 内使用。

| 属性 | 类型 | 说明 |
|---|---|---|
| `slug` | string | 卡片的 slug（对应 cards-data.json） |

## BuffCardGrid

卡片网格容器。

| 属性 | 类型 | 说明 |
|---|---|---|
| `defaultSize` | number | 卡片默认尺寸（px） |
| `children` | ReactNode | CardRef 列表 |

## BuffDetail

展示单个 buff/debuff 详情。

| 属性 | 类型 | 说明 |
|---|---|---|
| `name` | string | 名称 |
| `icon` | string | 图标路径 |
| `type` | "buff"\|"debuff" | 类型 |
| `effect` | string | 效果描述 |
| `children` | ReactNode | 详细说明 |

## 示例

```mdx
<BuffCardGrid defaultSize={140}>
  <CardRef slug="element-invasion" />
  <CardRef slug="weak-point-boost" />
  <CardRef slug="easy-toughness" />
</BuffCardGrid>
```
