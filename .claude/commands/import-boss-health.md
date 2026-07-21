从游戏导出数据计算并导入猎场 Boss 血量。目标地图：`$ARGUMENTS`，未提供时按 `all` 处理。

## 数据边界

- 只使用 `refs/Exports/NZM/Content/DataTables/` 下的 JSON 导出表。
- 不读取、不校验也不依赖任何 XLSX 文件。
- 来源映射以 `data/enemies/lc/boss/health-sources.json` 为准。

## 执行流程

1. 运行 dry-run：

   ```text
   pnpm exec tsx scripts/import-boss-health.ts --map <地图名|all> --difficulty all
   ```

2. 审阅输出，确认没有 `Blockers`，并检查每阶段的来源 ID、基础 Health、计划 Health、难度 MaxHealth 和最终值。
3. 只有 dry-run 无阻塞时才执行写入：

   ```text
   pnpm exec tsx scripts/import-boss-health.ts --map <地图名|all> --difficulty all --write
   ```

4. 再运行一次 dry-run，并执行 `pnpm exec tsc --noEmit`。报告更新文件数、超限不适用数量和被忽略的额外怪物。

不要在命令中写死入口 ID、难度倍率、怪物等级或 `MonsterType`。
