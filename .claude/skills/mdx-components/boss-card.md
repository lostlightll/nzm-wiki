# BossCard / BossCardGrid

Boss 卡片组件。`BossCard` 通过 `title` 属性匹配 boss 数据自动渲染卡片。`BossCardGrid` 是网格容器。

## BossCard 属性

| 属性 | 类型 | 说明 |
|---|---|---|
| `title` | string | Boss 名称（匹配数据源） |

## 示例

```mdx
<BossCardGrid>
  <BossCard title="金牌打手" />
  <BossCard title="Z博士" />
  <BossCard title="变异Z博士" />
</BossCardGrid>
```
