# Callout

提示框，会自动在中文和数字/英文之间添加空格。

## 属性

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `children` | ReactNode | - | 内容 |
| `color` | string | `"gray"` | 颜色 |

color 可选：`gray`, `blue`, `green`, `yellow`, `red`, `purple`

## 示例

```mdx
<Callout>默认灰色提示</Callout>
<Callout color="yellow">**注意** 文字中 **加粗** 会自动高亮</Callout>
<Callout color="red">**危险** 操作不可逆</Callout>
```
