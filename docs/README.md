# 项目文档索引

本目录只保存需要随仓库共享的现行规范、架构说明、维护流程和待实施计划。`MD/` 是被 Git 忽略的个人工作区，不是项目规范来源；除非用户明确指定，否则不要读取其中内容。

## 使用规则

1. 处理仓库代码、数据或内容前，先查看本索引。
2. 按任务范围读取 `Required` 文档；`Optional` 只在需要对应背景时读取。
3. `active` 表示当前有效，`proposed` 表示尚未完成实施，不能当作现有行为。
4. 文档与代码不一致时，以可执行 Schema、类型和测试为准，并同步修正文档。

## 任务路由

| 任务范围 | Required | Optional | 状态 |
| :--- | :--- | :--- | :---: |
| 猎场 Buff 数据导入、图标或图鉴维护 | [`workflows/status-effect-import.md`](workflows/status-effect-import.md) | [`standards/weapon-numerical-v2.md`](standards/weapon-numerical-v2.md) | active |
| 召唤物篇章、伤害、射速或关联索引维护 | [`workflows/summon-compendium.md`](workflows/summon-compendium.md) | [`architecture/multiplier-index.md`](architecture/multiplier-index.md)、[`workflows/status-effect-import.md`](workflows/status-effect-import.md) | active |
| 武器 MDX 新增、修改或审计 | [`standards/weapon-mdx.md`](standards/weapon-mdx.md)、[`standards/weapon-numerical-v2.md`](standards/weapon-numerical-v2.md) | [`architecture/weapon-resolver.md`](architecture/weapon-resolver.md) | active |
| 武器原表读取 | [`architecture/weapon-source-reader.md`](architecture/weapon-source-reader.md) | [`architecture/weapon-skill-charge.md`](architecture/weapon-skill-charge.md) | active |
| Weapon Data Lock | [`architecture/weapon-data-lock.md`](architecture/weapon-data-lock.md) | [`architecture/weapon-source-reader.md`](architecture/weapon-source-reader.md) | active |
| Weapon Resolver 或消费者 | [`architecture/weapon-resolver.md`](architecture/weapon-resolver.md)、[`standards/weapon-numerical-v2.md`](standards/weapon-numerical-v2.md) | [`architecture/weapon-data-lock.md`](architecture/weapon-data-lock.md) | active |
| 主动技能基础充能 | [`architecture/weapon-skill-charge.md`](architecture/weapon-skill-charge.md) | [`architecture/weapon-source-reader.md`](architecture/weapon-source-reader.md) | active |
| 插件数据导入或维护 | [`standards/perk-data.md`](standards/perk-data.md) | [`.claude/commands/import-perks.md`](../.claude/commands/import-perks.md) | active |
| Boss 血量导入 | [`workflows/boss-health-import.md`](workflows/boss-health-import.md) | [`.claude/commands/import-boss-health.md`](../.claude/commands/import-boss-health.md) | active |
| change-log TODO | [`standards/todo-workflow.md`](standards/todo-workflow.md) | 无 | active |
| 武器 V2 收尾 | [`plans/weapon-v2-cleanup.md`](plans/weapon-v2-cleanup.md) | 上述武器规范与架构文档 | proposed |
| 乘区双向索引 | [`architecture/multiplier-index.md`](architecture/multiplier-index.md) | 无 | active |

## 文档归属

- `standards/`：必须遵守的项目规则。
- `architecture/`：当前实现、接口与职责边界。
- `workflows/`：可重复执行的维护流程。
- `plans/`：尚未全部落地的设计或任务。

完成的计划和已经被替代的调查不迁入本目录。Git 历史负责保留共享历史，本地研究和临时产物继续放在 `MD/`。
