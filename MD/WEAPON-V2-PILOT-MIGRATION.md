# Weapon Numerical V2 代表武器试迁移

## 范围

Task 5 同时迁移 LC 与 TD 的五把代表武器，共 10 个 MDX：

| 武器 | 主要覆盖场景 |
| :--- | :--- |
| 星海狂想 | 普通射击、ASC 射速变体、Numerical-only 技能伤害 |
| 飓风之龙 | 双主模式、独立爆炸、共享 Numerical 的 ASC 连发变体 |
| 幽冥毒皇 | 机枪、榴弹命中、爆炸和 Dot |
| 军用手斧 | 重击与左右轻击的独立 Numerical 来源 |
| 木葫芦 | `damage_sources: []` 的不可攻击语义 |

补充样本只进入测试 fixtures，不扩大生产 MDX 迁移范围：能源之影、振弦、爆星和钢铁轰鸣用于衰减规则；纯白至上用于多 Item 候选；显式 Feel 例外使用合成 fixture；暗夜之殇与振弦分别固定 PVE 和 GP fallback 技能链。

## 来源映射

星海狂想使用 `120100040 + ASC 5` 作为普通射击。被动最大射速继承该 Numerical，替换为 Mode 1、ASC 364，并通过 `overrides.asc.fire_interval: 0.0727` 记录实测最大射速。大型冰锥 `1410050101` 和霜华冰锥 `120100041` 是独立 Numerical-only 来源。

飓风之龙的霰弹与龙炎弹分别使用 `120300110 + ASC 143`、`120300111 + ASC 184`。Mode 2/3 继承对应 Numerical 并替换为 ASC 196/197。爆炸 `120300112` 和索命龙炎 `120300113` 保持独立来源。自动龙炎组合插件 Numerical `120300114` 与 ASC/Feel `388`；Prototype Mode 4 用于确认 ASC 388，但该行仍引用 `120300111/112`，因此不伪写为 Numerical `120300114` 的 Prototype 直接关联。

幽冥毒皇使用 `120600060/061/062/063` 表达机枪、榴弹命中、爆炸和 Dot。军用手斧使用 `121300090/091/092` 表达重击、轻击左和轻击右。木葫芦不采纳 Prototype 中的错误攻击关联。

LC 与 TD 使用相同 ID，但每个 Numerical 引用分别显式写入 `table: lc` 或 `table: td`，Lock 中也保持独立 namespace。

## Lock 与快照

`pnpm weapon-data:lock` 从真实导出刷新 `data/weapon-data-lock.json`。当前试点锁定 28 个 Numerical 行、9 个 ASC 行、9 个 Feel 行、5 个 Item 行和 3 个 PVE 技能行。军用手斧与木葫芦没有主动技能配置，只产生信息级 `ITEM_SKILL_MISSING` 警告。

`data/weapon-v2-pilot-snapshots.json` 保存迁移前 V1 基线、迁移后 V2 快照，以及每个递归 JSON Pointer 的操作、分类和原因。`weapon-data:pilot-check` 同时重算 after 快照与差异集合；任一字段新增、删除、替换或分类变化都会失败。

差异分为：

- `structural`：V1/V2 结构、provenance、Settlement 和来源 ID 的可追溯变化。
- `source_difference`：MDX 旧副本与 Lock 权威来源不同，保留待核验语义。
- `accepted_correction`：已确认的来源修正，包括精确射击间隔、Feel 精度、Settlement 不适用状态、手斧来源拆分和木葫芦不可攻击语义。
- `consumer_pending`：保留给后续消费者切换；本轮没有用它掩盖未完成实现。

## 已冻结规则

- 变体继承 Numerical，只替换 ASC/Feel，不复制整套伤害与射击字段。
- `overrides.asc.fire_interval` 保留原始 ASC 值、覆盖链和派生 RPM 历史；兼容值与最终有效值比较。
- Numerical-only 来源不再用 `fire_interval: 0` 伪装缺失射击行为。
- 缺少 Settlement 的零值解析为 `not_applicable`，不解释为确定零。
- Item 只能由显式 `item_id` 精确选择；Prototype 候选不自动推断。
- 迁移期 Legacy bridge 在没有 `fire_mode` 时使用 Resolver 的 `mainSourceId`，但不会为 `damage_sources: []` 制造虚假攻击模式。
- 页面消费者全面切换、模式级交互和旧字段最终删除仍属于 Task 6–8。

## 验证命令

```text
pnpm test:weapon-source-v2
pnpm test:weapon-data-reader
pnpm test:weapon-skill-charge
pnpm test:weapon-data-lock
pnpm test:weapon-resolver
pnpm weapon-data:check
pnpm weapon-data:pilot-check
pnpm lint
pnpm build
```
