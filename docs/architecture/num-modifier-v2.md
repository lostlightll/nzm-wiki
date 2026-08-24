# Num Modifier V2

> 状态：active
> Lock Schema：`data/num-modifier-lock.json` V1
> 引用协议：Num Modifier V2

## 目标

Num Modifier V2 把正式服 `numerical_modifier_config` 收进一个深模块。消费者只声明稳定行引用和派生方式，不复制属性名、operation 或数值；构建和页面运行时不读取 `refs/`。

```text
refs 正式服原表
  -> pnpm num-modifier:lock
  -> data/num-modifier-lock.json
  -> lib/num-modifier.ts
  -> 插件描述 / effect_values / 状态效果 / 乘区投影 / 维护审计
```

## Lock 与身份

Lock 保存正式服 LC 全表：

```text
schema_version
sources.lc = { source_path, sha256, row_count }
rows.lc[row_name] = { row_name, raw }
```

- 对外引用固定为 `lc:<row_name>`。
- `row_name` 是权威身份，不按 `raw.ID` 重写键。
- `raw.Description` 完整保留，只用于诊断和语义辅助。
- 数值读取 `BaseValue`、`CoefValue`、`GPModifierOp` 和 `Level`。
- 对象键递归排序，数组顺序保持原样；刷新输出来源 SHA 和逐字段差异。

当前正式服 Lock 为 3,044 行，并保留三个源数据诊断：

- `lc:111970001` 使用非标准 row name。
- `lc:111010094_1_1` 的 row name 身份与 `raw.ID` 不一致。
- `lc:191201003_1_0` 的 `AttributeName` 为空。

这些诊断不能通过改名、补值或删除行来“修复”。

## Resolver 接口

`lib/num-modifier.ts` 负责行解析、按 Modifier ID 查询、格式化、模板替换和游戏 Token 解析。`lib/num-modifier-data.ts` 是完整 Lock 的唯一导入适配器。

格式只允许：

- `number`
- `percent`
- `signed-number`
- `signed-percent`

项目表达式只允许 `field: base | coefficient`，`scale` 默认 `1`。缺行、非法字段、非法倍数、未知模板别名和未解析模板直接报错，并携带消费者路径。

原始 `{GPModifier:...}` Token 仍按游戏现有格式读取 Level 1 精确行。`num-modifier:audit` 全量检查插件导入器使用的两张描述表；当前 265 个唯一 Token 中 264 个可解析。`111041026` 的游戏 Token 写 index 0，而 Lock 只有 index 1，作为已知源数据错误保留并报告。

## 插件表达式

插件 frontmatter 先声明别名：

```yaml
num_modifier_values:
  damage-per-stack:
    row: "lc:111010062_1_0"
    field: coefficient
    scale: 1
```

描述通过模板消费：

```yaml
description: "每发提升<strong>{{num:damage-per-stack|percent}}</strong>。"
```

`effect_values[].stages[].value` 必须使用引用或带原因的字面量：

```yaml
value:
  ref: damage-per-stack
  format: signed-percent
```

```yaml
value:
  literal: "+10%"
  reason: "该条件值来自已审定的非 Numerical 配置"
```

旧字符串 `value: "+10%"` 不再接受。层数、距离步进等派生通过不同别名的 `scale` 明确表达。

## 消费层次

- `data/guides/multiplier-providers.json` V2 保存来源身份和精确 `numModifierRows`。直接来源的类型由 `AttributeName -> modifier type -> factor` 派生；`reviewed-override` 才保存人工类型与依据。
- `data/guides/multiplier-providers-runtime.json` 是确定性客户端投影，只包含页面查询需要的来源与 `modifierTypeIds`，并记录注册表 SHA、Num 来源 SHA 和乘区 Schema。
- `data/status-effects.json` V2 只保留 Buff 自身的 `modifierIds`，不复制 Modifier 原表行。服务端通过 Resolver 生成页面 DTO；正式服 Lock 中缺失的历史 ID 保留为未解析。
- `lib/perks.ts` 统一解析插件描述和 `effect_values`。详情、悬浮预览、超限卡、召唤物摘要和攻略编辑器只消费解析结果。
- `scripts/import-perks.ts`、乘区审计和超限审计通过 Resolver 读取 Num，不再各自加载原表。

## 命令

```bash
pnpm num-modifier:lock     # 从 refs 刷新 Lock，并重建乘区运行时投影
pnpm num-modifier:project  # 只重建乘区运行时投影
pnpm num-modifier:check    # 离线检查 Lock、引用、模板、投影与静态边界
pnpm num-modifier:audit    # 联机核对 refs 原表、哈希、内容和游戏 Token
```

`dev` 和 `build` 都固定执行离线 `num-modifier:check`。该检查禁止业务模块引用原表路径或直接导入 Lock JSON；只有 Lock 刷新器、文档、Lock 自身元数据和 `lib/num-modifier-data.ts` 适配器可以出现这些细节。

属性语义、方向性效果和通用来源索引的下一阶段设计见 [`../plans/num-modifier-v2-semantic-index.md`](../plans/num-modifier-v2-semantic-index.md)。该文档仍为 proposed，当前运行时不得假定其 Schema 或接口已经实现。
