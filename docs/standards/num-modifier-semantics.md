# Num Modifier Operation 与临时语义规则

> 状态：active

本文规定当前正式服 Num Modifier 行在 operation 和玩家语义尚未完全解明时的使用边界。它约束现有 Resolver、插件数值、乘区来源和维护审计；未来属性语义目录落地后仍须兼容这些已确认事实。

## 通用规则

Num Modifier 的数值事实由精确 `lc:<row_name>` 行及以下字段共同组成：

- `AttributeName`
- `GPModifierOp`
- `BaseValue`
- `CoefValue`
- `Level`

`Description` 只作语义和冲突诊断，不能证明 operation 公式，也不能覆盖结构化数值。

当前只确认：

| `GPModifierOp` | 已知含义 | 当前允许的推导 |
| :---: | :--- | :--- |
| `B1` | 加法 | 可以结合属性正向轴和所选数值字段判断增减方向 |
| `B5` | 乘法 | 只确认属于乘法；乘数基线和完整公式未确认前，不统一换算最终因子 |
| `B2` / `B3` / `B4` / `F` / `O` | 未知 | 不建立全局公式，不自动推导方向 |

禁止根据单条 Numerical 描述、数值看起来像百分比或某个已知案例，把未知 operation 推广到其他行。

## 独弹强化 B2 临时规则

以下规则只适用于精确行 `lc:111031014_1_0`：

```yaml
row: "lc:111031014_1_0"
attribute_name: Numerical.ExecutionCtx.ExecutionRatio
operation: B2
field: base
base_value: 6
coefficient: 0
level: 1
```

根据当前游戏表现，独头弹对其单次伤害事件建立独立相乘因子：

```text
原始增量 = 6
显示增量 = +600%
实际因子 = 1 + 6 = 7
最终效果 = 该次独头弹伤害 × 7
```

术语和分类固定如下：

- 来源：`独弹强化`，ItemID `20703040254`；
- 属性通道：`Numerical.ExecutionCtx.ExecutionRatio`；
- 乘区索引：`correction`，显示为“单次修正”；
- 作用范围：当前独头弹的单次伤害事件；
- 页面数值：`+600%`；
- 公式因子：`×7`。

这里的“独立相乘”描述结算方式，不等于项目中名为 `independent-amplification` 的“独立增幅”。后者当前专指 `GPAttributeSetAttack.Attack`，两者不得合并。

## 消费规则

- 描述和 `effect_values` 必须继续引用 `lc:111031014_1_0.base`，禁止直接硬编码 `+600%`。
- 公式说明可以展示 `1 + 600% = 7`，但最终因子不能反写进 MDX 充当第二份数值来源。
- 乘区来源继续登记为 `correction`，不得因为“独立相乘”改成 `independent-amplification`。
- 插件详情、悬浮预览和其他插件描述消费者必须使用 `lib/perks.ts` 的已解析描述；超限卡只合并其中的 `effect_values`，不使用完整插件描述覆盖卡片短摘要。
- 该规则不能用于解释任何其他 B2 行。

## 失效条件

出现以下任一情况时必须停止套用临时规则并重新审计：

- 行身份、`AttributeName`、operation、Level、BaseValue 或 CoefValue 发生变化；
- 当前版本实测不再按 7 倍结算；
- 找到可复核的 B2 通用公式或运行时实现；
- 独弹强化改用其他 Modifier 行或额外动态覆写。

结构化语义目录必须把本规则表示为精确行级 `reviewed_semantics`，并在 B2 通用公式确认后报告该例外过期。

## 维护检查

修改独弹强化、Num Lock 或乘区来源后至少运行：

```bash
pnpm num-modifier:check
pnpm overlimit-effects:audit
pnpm multiplier-providers:audit
```

当前离线检查会验证行引用、展示值、来源关系和本节完整字段签名；任一字段漂移都会使精确例外失败。
