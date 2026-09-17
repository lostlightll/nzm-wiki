# Num Modifier Operation 与临时语义规则

> 状态：active

本文规定当前正式服 Num Modifier 行在 operation 和玩家语义尚未完全解明时的使用边界。属性语义目录已经落地；本文记录其中无法由通用规则表达的 operation 边界和精确行例外，并约束 Resolver、插件数值、乘区来源和维护审计。

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

属性身份与公式审定分开：`Numerical.ExecutionCtx.ExecutionRatio` 在 `damage-event` 上下文可以生成 `correction-parameter` 的 `index` 分面，即“单次修正参数”，归入特殊修正，但 operation、方向和最终因子继续保持未知。仅供来源双向索引和原始参数展示，不能因此显示伤害增幅百分比，也不复用已审定 `correction` 伤害分面的身份。S4 预览“多弹强化”使用 `130000001_1_0.coefficient=1`（每额外弹道），通过蓝图确认施加链，未确认 Native B2 公式，继续保留参数展示。

“最后一枪”的 `lc:130008001_1_0` 在 2026-09-17 按用户指定单独登记人工语义：弹匣最后一发按独弹强化口径显示增伤 `+600%`，归入 `correction`，因子基线为 1。数值仍引用本行 `BaseValue=6`，并校验属性、B2、等级1和系数0。此约定不是新增实测证据，也不推广到其他 B2 行；源行变更时必须重新审定。

S4 预览补充的属性语义包括弹匣容量比例、单发弹片数、元素异常概率加成与准确度调整；依据 AttributeDescMapTable 的精确字段身份和已核验的 Modifier 调用。`WeaponChangeclip` 与 `WeaponChangeClip` 两种大小写均指向换弹速度分面。`SpreadAdjust` 只显示原始调整值，不换算最终散布百分比；元素异常概率加成不等于元素伤害。属性值不因可展示就进入增伤乘区。

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
