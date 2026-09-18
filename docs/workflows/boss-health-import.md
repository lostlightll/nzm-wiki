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
| `--map` | `LC_MAPS` 中的地图正式名称或 `all` | `all` |
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

### 禁魔岛与朔望计划

两图使用正式服 `refs/Exports/NZM/Content/DataTables/` 的相同计算链。禁魔岛的英雄、炼狱/折磨、超限任务分别为 `4133`、`4134`、`4137`；朔望计划分别为 `4123`、`4124`、`4127`。这些 ID 仅作此次核对记录，导入器仍动态查询入口。

| 地图 | Boss | 来源 ID |
| --- | --- | --- |
| 禁魔岛 | 破邪金 | `18419171` |
| 禁魔岛 | 磁电双娇 | `18421171` |
| 禁魔岛 | 典狱长杰斯 | `18422171`、`18422172`，按形态顺序 |
| 朔望计划 | 宙之虹 | `14502071` |
| 朔望计划 | 衣之枢 | `14503071` |
| 朔望计划 | 引渡者 | `10405071` |

磁电双娇的 `18421171_RMBossTwinsBlackDP` 与 `18421172_RMBossTwinsWhiteDP` 角色蓝图均装配 `NZBossSharedHealthComponent`（`NZBossSharedHealth_GEN_VARIABLE`，`bShareDebuff: true`）。`System/Dungeon/DungeonMonsterTipsTable.json` 的 `2004133/2004134.boss_ids` 也仅列 `18421171`。因此图鉴保留单条配置血量，不将另一角色拆成第二阶段或相加。此处不推定原生共享组件的其他运行时倍率。

杰斯两形态由 `AIBehavior/DungeonAI/EnemyData/Common-RM/RMBossJessDPP1.json`、`RMBossJessDPP2.json` 的 `AISpawnProperty.AICharacterClass` 分别指向 `18422171`、`18422172` 角色；保留两项血量。骇影沿用特殊首领排除规则，不因出现在计划中而自动加入图鉴。衣之枢 `14503072` 只出现在普通难度计划，不加入英雄及以上难度的阶段清单。

新 Boss 图标取身份表 `MonsterIcon` 的真实引用。缺 PNG 但已有原始纹理时，使用 `scripts/export-boss-icons.ps1 -Slug <slug列表> -OutputRoot MD/_local/boss-icons/<批次>` 原地读取选定资产，再用 `python scripts/overlimit/decode-preview-icons.py <OutputRoot>` 解码。将审核后的 PNG 和 WebP 分别放入既有 `public/icons/enemies/lc/boss/`、`public/webp/icons/enemies/lc/boss/` 目录，不修改参考库。

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

## 猎场普通怪物导入

`scripts/import-hunter-monsters.ts` 使用同一乘算链路，按怪物身份、地图、区域与难度写入 `data/enemies/lc/monsters/`。范围为 `LC_MAPS` 中的九张经典猎场地图，覆盖英雄、炼狱、折磨及有入口的超限。`import-sources.json` 保留人工标题、稳定 slug、排除原因与大都会特殊脚本补充；其他身份从各地图专属计划和入口提示表联合发现。`evidence.json` 保存地图、入口、区域证据、每个数值的来源因子及排除项。

同一个怪物 ID 跨地图只维护一个 MDX。不同 ID 即使同名也不合并，新档案使用“名称-ID”slug，标题保持配置名称，不凭描述猜测变体机制。缺少身份、未启用烹饪、空名称或类型不属于 3/4/5 的记录不发布；配置类型中包含可破坏对象，不等同于实际波次敌人清单。

只有入口提示而没有区域计划的地图归属写为“区域待核实”，不把其他地图的血量或区域复制过来。区域名前后空格会被去除，不同难度的区域拆分仍按配置保留。没有超限入口的地图不生成超限血量。

头像沿身份表的 `MonsterIcon` 真实引用查找正式服 PNG，转换为站点 WebP；不能根据 ID 相近借图。缺图使用页面占位符，并记录到证据的 `gaps`。导入器在全部解析、校验及序列化通过后才写入文件。

`map-layout.json` 由同一导入器生成，保存各地图与难度的区域名称及任务 `OrderID`。列表按“地图 → 关卡 → 怪物血量”展示，关卡顺序不从怪物名称或血量反推。缺少该难度入口的地图显示暂无该难度，不能将全部怪物误标为血量待核实。

```text
pnpm exec tsx scripts/import-hunter-monsters.ts
pnpm exec tsx scripts/import-hunter-monsters.ts --write
pnpm exec tsx scripts/import-hunter-monsters.ts --check
pnpm exec tsx scripts/import-hunter-monsters.ts --audit
```

先审阅默认 dry-run，再执行写入；`--check` 只验证已提交文件与导入器输出是否一致，不能证明血量完整。`--audit` 在文件不一致或仍有未解析血量时失败。两者均重新读取正式服参考表。站点运行时只读取已提交的 MDX，不读取参考表。

所有已有地图与区域记录在可用难度下的血量缺失，必须写入 `evidence.json.gaps`，使用 `kind: "missing-health"`，记录怪物 ID、地图、区域、难度、任务 ID、已查询计划 ID 及未解析原因。不存在入口或该难度没有对应区域时，不计作血量缺失。导入摘要分别报告已算出的血量数、缺失数和完全无血量的怪物数，不能以文件零差异宣称导入完整。

已审核的出生链可通过 `import-sources.json` 各怪物的 `appearances: [{ map, area, source }]` 补充区域。它只补分布证据，不自动产生血量。例如护士 `18107041` 的黑暗复活节巴黎2区已由 `BP_DarkEaster_Paris_2.SurvivalMissionArray` → 各难度坚守任务的 `FlexibleWaveConfig[].SpawnTaskSettings[].AIProperties` → `RMNurse` → 角色蓝图 `NPCAttributeID` 确认。主任务引用路径中的 `Hard` 不代表最终难度；子任务还会调用 `GetDungeonDifficultyLevel` 选择出生波次。

普通怪物缺少专属计划行时不能套用 Boss 的“不适用”策略，也不能假定倍率为 1 或借用父蓝图的怪物 ID：保留该难度血量为空，页面显示“待核实”。已覆盖全部审核范围内的计划行，不等于已证明实际波次的完整出怪名单。骇影等特殊首领的排除原因单独记录。

当前尚未闭合的链路是原生 `ANZHuntingGroundDifficultySystem::RegisterQuestDifficulty` 对专属计划缺行的处理。基础表存在有效 `Health` 并不能独自证明最终血量；客户端中的相关日志只证明此系统处理基础表与计划表，不证明缺行时的运算。补全这类血量需取得可解释的执行逻辑或运行态证据，不能把日志或表名当成默认倍率的依据。

数值沿用现有 `Math.round(base * plan * maxHealth)` 的 JavaScript 计算口径，并非实测值。半整数边界可能受浮点误差影响，例如 `0.7 * 0.75 * 860` 得到 `451.49999999999994`，当前展示为 `451`；实际游戏取整行为仍需实测确认。

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
