# Boss 血量计算链路

> 状态：active

首领图鉴支持“英雄”、“炼狱”、“折磨”和“超限”四套血量。四者使用相同计算公式，但入口、任务计划和难度倍率必须按地图与难度分别发现，不能跨模式复用。

```text
最终血量 = Math.round(
  HunterBaseMonsterTable.Health
  × HunterIntraMonsterTable.Health
  × MonsterAttrTypeConfig.MaxHealth
)
```

## 自动导入

导入器已实现英雄、炼狱、折磨和超限。四种难度均按入口、任务计划和倍率动态查询，并分别写入对应的 `health` 字段。

默认命令只输出 dry-run，不修改 MDX：

```text
pnpm exec tsx scripts/import-boss-health.ts
pnpm exec tsx scripts/import-boss-health.ts --map 昆仑神宫
pnpm exec tsx scripts/import-boss-health.ts --map 昆仑神宫 --difficulty heroic
pnpm exec tsx scripts/import-boss-health.ts --map all --difficulty all --write
```

参数：

| 参数 | 可选值 | 默认值 |
| --- | --- | --- |
| `--map` | 九张经典地图正式名称或 `all` | `all` |
| `--difficulty` | `heroic`、`inferno`、`torment`、`overlimit`、`all` | `all` |
| `--write` | 执行结构化 frontmatter 写入 | 不写入 |

Agent Command 为 `/import-boss-health [地图名|all]`，定义同步保存在 `.claude/commands/` 与 `.codex/commands/`。命令必须先审阅 dry-run，无阻塞后才能写入。

本链路只读取 `refs/Exports/NZM/Content/DataTables/` 下的 JSON 数据表，不读取或依赖本地 XLSX。

## 入口发现

导入器按下列关系动态查询，不固化入口 ID、任务 ID、怪物等级或难度倍率：

```text
HunterModeinfoTable
  -> 按 map_name 找地图的 dungeonid_list
NewEntranceInfoTable
  -> 按 dungeon_difficulty_des 找“英雄”、“炼狱”、“折磨”或“超限”入口
  -> 读取 quest_id、attribute_type、dungeon_monster_level
HunterIntraquestTable
  -> DungeonID = quest_id
  -> 收集 MonsterPlanID
HunterIntraMonsterTable
  -> MonsterPlanID + 来源 ID
  -> 读取计划 Health
MonsterUniqueIDTable
  -> 来源 ID
  -> 读取怪物真实 MonsterType
HunterBaseMonsterTable
  -> 来源 ID
  -> 读取基础 Health
MonsterAttrTypeConfig
  -> AttributeType + MonsterType + MonsterLevel
  -> 读取 MaxHealth
```

经典九图的英雄、炼狱和折磨入口关系如下：

| 难度 | `attribute_type` | `dungeon_monster_level` | `quest_id` 关系 | `MaxHealth` 查询结果 |
| --- | --- | --- | --- | --- |
| 英雄 | `250` | `3` | 独立任务计划 | 所有 Boss 类型的 `MaxHealth` 均为 `750` |
| 炼狱 | `250` | `4` | 独立于英雄；与折磨共用任务计划 | `MonsterType=3` 为 `860`，其余 Boss 类型为 `1190` |
| 折磨 | `250` | `5` 或 `6` | 与炼狱共用任务计划 | `MonsterType=3` 为 `1031`，其余 Boss 类型为 `1500` |

英雄不能复用炼狱或折磨的 `quest_id`：例如大都会英雄入口的 `quest_id=4013`，炼狱和折磨均为 `4014`。三种难度的阶段来源 ID 可以共用，但必须从各自任务计划中读取 `HunterIntraMonsterTable.Health`；该值会随计划变化。超限入口的 `dungeon_monster_level` 为 `4`，任务计划也独立。

Boss 的 `MonsterType` 不全是 `7`，例如大都会金牌打手为 `6`。因此查询必须使用入口和怪物行的真实字段，不能用统一常量代替。

## 阶段来源

`data/enemies/lc/boss/health-sources.json` 是图鉴 slug 到游戏来源的唯一映射：

```json
{
  "幽魂骑士": {
    "map": "黑暗复活节",
    "stages": [18404071, 18404072]
  },
  "终蔫之樱": {
    "map": "樱之渊",
    "stages": [14304071, 14304071]
  }
}
```

数组顺序就是页面阶段顺序。同一个来源 ID 可以在同一 Boss 中重复，终焉之樱的两个阶段即共用同一计算值。稳定 slug 负责区分同名条目和标题别名，包括两个金牌打手、`兰斯D博士` / `兰斯·D博士`、`终蔫之樱` / `终焉之樱`。

昆仑神宫第三形态“真蛇神”的资源目录编号与实际属性 ID 不同，清单使用可贯通基础表和计划表的属性 ID `14020071`。

## 写入规则

- `health.heroic`、`health.inferno`、`health.torment` 和 `health.overlimit` 使用有序整数数组。
- 地图不存在超限入口，或 Boss 不在对应超限计划中时，写入 `unsupported`。
- 写入新的 `health` 后删除旧 `hp`、`hp2`，正文和其他 frontmatter 字段顺序保持不变。
- 重复执行相同范围必须不再产生文件变化。
- 超限任务中的额外怪物没有图鉴 slug 时只报告，不自动创建图鉴条目。

## 阻塞策略

以下任一情况都会阻止本次调用的全部写入：

- 来源清单缺失 slug、引用不存在的 slug，或阶段数不符；
- 英雄、炼狱或折磨入口缺失，或同一地图难度命中多个入口；
- 来源 ID 在任务计划中缺失或命中多行；
- 基础 Health、计划 Health、MonsterType 或 MaxHealth 缺失；
- `AttributeType + MonsterType + MonsterLevel` 无法唯一命中倍率。

超限没有入口或 Boss 不在超限计划属于明确的“不适用”状态，不作为阻塞错误。

## 样例

英雄大都会金牌打手：

```text
基础 Health：720
英雄计划 Health：6.5
入口查询得到 MaxHealth：750
Math.round(720 × 6.5 × 750) = 3,510,000
```

同一 Boss 的炼狱计划 Health 为 `5`，倍率为 `1190`；不能仅替换英雄倍率而沿用英雄计划 Health。

折磨昆仑神宫“？？？”：

```text
基础 Health：312
计划 Health：8
入口查询得到 MaxHealth：1500
Math.round(312 × 8 × 1500) = 3,744,000
```

超限大都会金牌打手使用实际 `MonsterType=6` 查询倍率：

```text
基础 Health：720
计划 Health：1.333
入口与类型查询得到 MaxHealth：1190
Math.round(720 × 1.333 × 1190) = 1,142,114
```
