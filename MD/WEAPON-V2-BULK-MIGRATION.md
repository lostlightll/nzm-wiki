# Weapon Numerical V2 批量迁移

本文记录 Task 7 的批量迁移工具、决策产物、最终覆盖范围和剩余异常。协议、Resolver 与 Lock 规则仍分别以 `WEAPON-NUMERICAL-V2-PROTOCOL.md`、`WEAPON-RESOLVER.md` 和 `WEAPON-DATA-LOCK.md` 为准。

## 1. 结果

| 模式 | 武器总数 | Task 7 迁移 | Task 5 既有 V2 | 明确排除 |
| :--- | ---: | ---: | ---: | ---: |
| LC | 112 | 89 | 5 | 18 |
| TD | 112 | 91 | 5 | 16 |

Task 7 共新增 180 个 V2 MDX。最终仓库包含 190 个 V2 MDX 和 34 个保留 V1 的异常项。保留 V1 是显式决策，不代表迁移工具遗漏；Task 8 不得在异常归属解决前直接删除这些 fallback。

最终机器可读结果位于：

- `data/weapon-v2-migration-decisions.json`：冻结来源身份、LC/TD 引用、字段决策、技能修正和排除原因。
- `data/weapon-v2-migration-report.json`：原表与决策哈希、迁移计数、排除责任及来源候选明细、未选择的 Item 候选、LC/TD 差异和技能修正摘要。
- `data/weapon-v2-migration-snapshots.json`：迁移前基线、迁移后消费者快照和逐 Pointer 审核结果。
- `data/weapon-data-lock.json`：全部 V2 显式引用对应的完整原始行。

## 2. 命令

```text
pnpm test:weapon-v2-migration
pnpm weapon-data:migration:report
pnpm weapon-data:migration:check
pnpm weapon-data:lock
pnpm weapon-data:check
```

`weapon-data:migration:report` 需要本地 `refs/`，读取八类来源并重建最终报告。报告不包含时间戳，原表文件和决策清单都以 SHA-256 固定。

`weapon-data:migration:check` 完全离线。它检查：

- 每个剩余 V1 都有排除决策。
- 每个本批 V2 的稳定来源 ID、名称、分组、继承、显式引用、Item 和主动技能与决策清单一致。
- 当前详情、目录和 Resolver 快照与已审核 Pointer 一致。
- 最终报告的决策哈希、覆盖计数和排除集合与当前仓库一致，`source_mapping` 排除项保留可执行的 locator、问题与候选明细。
- 每个未填写 `item_id` 的 V2 都有扫描记录；确有 Item 候选的条目必须进入带 owner 和原因的人工核验清单，禁止自动选择。
- 未批准差异和已经失效的差异白名单都会失败。

候选发现、决策审计和应用仍由 `scripts/weapon-data/bulk-migration.ts` 提供。`capture-baseline` 只允许在任何 MDX 迁移前执行一次，已有基线时拒绝覆盖。`apply lc` 和 `apply td` 可重复执行；已迁移文件仍校验决策一致性，不制造重复 diff。

## 3. 迁移规则

- 旧 MDX 是名称、分组和页面语义基准；原表只提供候选来源。
- 来源身份以旧字段定位器冻结，同一武器的 LC/TD 共享稳定 ID。
- Numerical 的 LC/TD 引用严格隔离，ASC、Feel、Item 和技能按现有读取层精确查询。
- 多候选、零候选、Prototype 冲突、非法衰减和技能链冲突不会自动猜测。
- 字段差异必须逐来源选择 `accept_source` 或 `preserve_legacy`；保留旧值会生成对应 namespaced override 和原因。
- 消费者差异必须按 JSON Pointer 显式分类；V1 临时 ID 到 V2 稳定 ID 的变化只在比较阶段归一化，不算业务差异。
- MDX 正文不参与迁移。工具只替换 frontmatter，并由测试固定正文逐字节保持。

## 4. 已确认修正

- 振弦：主动技能 `5004501` 修正为 `5004901`。
- 炼狱蝎王：主动技能 `5102701` 修正为 `5104101`。
- 超级复合弓：显式选择 `item_id: "20112000001"`，不根据 Prototype 候选自动猜测。
- 冥河之矛、纯白至上：人工射速变体继承主来源，保留稳定的页面模式身份。

这些修正同时应用于 LC 和 TD，并保存在决策清单及最终报告中。

## 5. 排除项

LC 与 TD 共同排除 16 项：暗夜之殇、春雷震、杜瓦瓶、钢铁轰鸣、鬼铜蚀、哈士奇好友、葫芦、火神炎帝、密林杀机、能源之影、逆光之刃、沙丘之怒、生命线、收割者、元宵来袭、猪猪榴弹发射器。

LC 额外排除刺隐和夜影之逝；二者的 TD 来源已能唯一核验并完成迁移。

异常归属：

- `source_mapping`：Numerical / Prototype 候选无法唯一确定，共 22 个表级排除。
- `game_data`：杜瓦瓶、鬼铜蚀在 LC/TD 的旧 MDX 与 ASC 都是非法 `200 / 200 / 0` 衰减，共 4 个表级排除。
- `wiki_semantics`：葫芦攻击语义、火神炎帝技能充能冲突及两个行为变体问题，共 8 个表级排除。

逐项错误码、原因和 owner 以 `data/weapon-v2-migration-report.json` 为准。

## 6. LC / TD 差异

112 对同名武器中，107 对迁移结构一致。以下 5 对有显式差异：

- 冰川尼泊尔、渡鸦剑、死神镰刀：来源引用不同。
- 刺隐、夜影之逝：迁移状态、来源引用和主动技能 ID 不同；TD 已迁移，LC 保留 V1。

比较 Numerical 引用时仅忽略预期的 `table: lc/td` 标签，Numerical ID、ASC、Feel、Item、技能和迁移状态差异都保留在报告中。

## 7. Task 8 边界

Task 7 不删除 V1 Resolver、旧字段、正文 `<ActiveSkill>` 参数，也不把检查接入构建或 CI。34 个排除项的所有权问题解决、重新迁移并更新 Lock/快照后，Task 8 才能结束双格式阶段。
