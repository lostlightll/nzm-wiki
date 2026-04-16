# DataTable

通用数据表格，支持图标列、对齐方式和 **加粗** 高亮。

## 属性

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `headers` | string[] | - | 表头 |
| `align` | ("left"\|"center"\|"right")[] | - | 各列对齐方式 |
| `nowrap` | number[] | - | 不换行的列索引 |
| `iconSize` | number | 24 | 图标尺寸（px） |
| `data` | RowData[] | - | 行数据 |

### RowData 格式

- 简单行：`CellValue[]` — 直接是每列的值
- 带图标行：`{ icon: string, cells: CellValue[] }` — icon 在最左列显示

CellValue 为 `string | number | ReactNode`。字符串中 `**text**` 会自动高亮。

## 示例

```mdx
<DataTable
  headers={["元素类型", "最多层数", "效果", "持续时间"]}
  align={["left", "center", "left", "left"]}
  data={[
    { icon: "/icons/elements/fire.png", cells: ["火焰(灼烧)", 5, "每 **2** 秒承受 **10 × 层数** 的伤害", "每 **2** 秒衰减 **1** 层"] },
    { icon: "/icons/elements/cryo.png", cells: ["寒冷(冰缓)", 3, "移速逐级降低", "**10** 秒未刷新直接消失"] },
  ]}
/>
```
