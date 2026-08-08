# GameMode / WeaponModeDiff

这两个组件只在武器详情 MDX 中可用，由当前 LC/TD 路由绑定数据。

## GameMode

`GameMode` 只在指定模式渲染正文，不生成额外容器。

| 属性 | 类型 | 说明 |
|---|---|---|
| `only` | `"lc" \| "td"` | 允许显示正文的模式 |
| `children` | `ReactNode` | 模式专属正文 |

```mdx
<GameMode only="td">
  塔防模式下该技能使用独立机制说明。
</GameMode>
```

## WeaponModeDiff

`WeaponModeDiff` 无属性。它比较当前武器的 LC/TD Resolver 输出，在两个模式页面中显示同一份紧凑差异表；没有用户可见差异时不渲染。

```mdx
<WeaponModeDiff />
```

基础伤害按页面口径显示：LC 乘 500，TD 乘 400。其他字段显示标准化值及 `不适用`、`缺失`、`不可用` 等状态。不得在正文中重复手写可由该组件得到的差异表。

基础伤害的字段名按来源语义显示为 `射击伤害`、`命中伤害`、`爆炸伤害`、`技能伤害`、`近战伤害` 或 `持续伤害`，不使用泛化的 `单发伤害`。
