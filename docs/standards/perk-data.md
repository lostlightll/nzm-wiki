# 插件数据管线与维护约定

> 状态：active

本文记录武器插件的身份、描述、图标、适用范围和上线状态处理规则。目标是让后续版本更新只需要重新审计和人工确认，不再重复排查同一套数据关系。

## 核心结论

- `data/perks/slot-*/*.mdx` 是网站最终展示数据，解包文件只用于审计和补全，不在构建时自动注入。
- 插件身份只通过 ItemID 连接，不能根据相似编号、图标编号或相邻行猜测。
- 普通插件详情优先使用 `MGEDescription`；猎场 `OverrideDesc` 通常是玩法卡片简写，不能覆盖完整详情。
- 当前版本游戏截图是最高优先级证据。截图数值与解包表冲突时，按截图人工维护并设置 `description_override: true`。
- 已有非空描述不批量覆盖。版本更新后重新审计，人工处理真正冲突即可。

## 身份链路

```text
CommonItemDataTable[ItemID]
  ├─ Name.LocalizedString       正式名称
  └─ IconPath.NormalIcon        普通插件图标
            │
            │ 同一个 ItemID
            ▼
WeaponModItemData[MODItemID]
  ├─ MODSlotIndex               插槽
  ├─ PassiveSkill_ID            描述和效果入口
  ├─ SuitableWeaponType         标准武器类型
  ├─ SuittableWeaponItem        专属武器 ItemID
  ├─ CollectMODItem             是否进入收集/展示范围
  ├─ MakeMODItem                是否可制造
  └─ IsCooked                   是否参与客户端打包
            │
            │ PassiveSkill_ID: 技能ID:等级
            ▼
MGEPassive_BD[技能ID_等级]
            │
            ▼
DT_GPMGESkillDesConfig_BD[技能ID_等级].MGEDescription
```

禁止的关联方式：

- 用 `IconPath` 中的 MGE 编号反推 ItemID
- 因为编号接近就把 `20703040114` 当作 `20703040184`
- 用 `PassiveSkill_ID` 代替 ItemID 查 CommonItem
- 同名存在多个版本时静默选择最后一条

同名多版本应优先唯一的 `CollectMODItem=1` 条目；仍有多个可收集候选时必须改用 `--ids`。

## 描述来源

### 来源优先级

| 优先级 | 来源 | 用途 |
|:---|:---|:---|
| 1 | 当前版本游戏内详情截图 | 最终数值和触发语义 |
| 2 | `DT_GPMGESkillDesConfig_BD.json` 的 `MGEDescription` | 普通插件完整详情正文 |
| 3 | `DT_GPMGESkillDesConfigTable_Main.json` | 导入器使用的合并镜像，需与 BD 表核对 |
| 4 | `HuntingGroundRoguelikeWeaponModTable.OverrideDesc` | 猎场卡片简写，仅作差异对照 |
| 5 | `WeaponModItemData.AttrList` | 没有 MGE 描述时的属性型回退 |

`CommonItemDataTable.Description` 是通用插件背景介绍，不是插件效果描述。`PreviewDescription` 经常为空，也不能当主要来源。

### 用截图反查原始表

当用户给出若干游戏内插件详情截图时：

1. 从两个以上已确认插件中提取有辨识度的完整短句。
2. 用 `rg --fixed-strings` 在 `refs/Exports/NZM/Content/` 搜索。
3. 确认这些短句共同落在哪张原始表，不从单个目标的候选文案中猜。
4. 按目标 ItemID 找到 `PassiveSkill_ID`，转成 `技能ID_等级` 行键。
5. 在同一张表中读取目标的 `MGEDescription`。

2026-07-14 已用异态共鸣、相位强袭、冥河送葬、兽躯双衍、幸运龙炎和肾上腺素截图确认：武器插件详情正文来自 `DT_GPMGESkillDesConfig_BD.json`。

### 描述差异分类

| 分类 | 判断 | 处理 |
|:---|:---|:---|
| 内容一致，仅省略细节 | 机制和关键数值一致 | 不改 |
| 机制一致，但猎场描述严重残缺 | Override 省略重要触发、范围、层数或持续时间 | 使用完整 MGE 描述 |
| 描述严重残缺，且可能存在矛盾 | Override 与 MGE 机制相近但数值签名不同 | 结合截图、Buff、Ability 或运行时配置修正 |
| 真正冲突 | 触发方式或关键数值互相排斥 | 列清单，等待人工决策后修改 |

不能因为 MGE 更长就自动覆盖，也不能因为 Override 更像短卡片文案就认定它更新。

### 已确认案例

| 插件 | MGE 行键 | 采用结果 |
|:---|:---|:---|
| 致命爆炸 | `1316200001_1` | `8%` 概率，半径 `5` 米，`130%` 攻击力，冷却 `2` 秒 |
| 武器穿透 | `1316201001_1` | 子弹穿透能力 `+2` |
| 导弹轰炸 | `1316210001_1` | 暴击生成 `3` 发跟踪导弹，冷却 `2` 秒 |
| 换弹冲击 | `1316211001_1` | 持续 `5` 秒，基础 `500%` 攻击力；每 `1%` 暴击率或换弹速度提高 `1%` 伤害 |
| 爆毒蚀域 | `1316213001_1` | 暴击生成减速毒域，冷却 `5` 秒 |
| 肾上腺素 | `1313031004_1` | 季中更新公告优先：每颗 `21%`，最高 `126%` |

MGE 中的“复用某武器资源”等开发备注不写入网站描述，只保留玩家可理解的机制和数值。

## 文案格式

- 数值强调使用 `<strong>...</strong>`，例如 `<strong>20%</strong>`。
- 不使用 `（CD20秒）`、`(CD20)` 或 `CD20秒`。
- 冷却统一写为 `，冷却时间<strong>20</strong>秒。`
- 游戏标签 `<qiangdiao>...</>` 转换为 `<strong>...</strong>`。
- 清理 `U+200B`、`U+FEFF` 等零宽字符。
- 不保留 `{GPModifier:...}`、`??`、独立占位符 `X` 或测试文案。
- 触发语义以游戏原文为准，例如“切出该武器后”不能擅自改成“切换到该武器后”。

截图明确覆盖解包旧值时，在 MDX 中添加：

```yaml
description_override: true
```

## 结构化效果数值

超限卡片需要展示玩家可读的具体数值时，在同 ItemID 插件 MDX 的 frontmatter 中维护 `effect_values`。`data/overlimit-cards.json` 继续保存猎场简述；页面运行时通过 ItemID 合并 MDX 数值，超限卡片导入器不得生成或覆盖 `effect_values`。

```yaml
effect_values:
  - kind: damage
    modifierTypeId: weapon-hit-damage
    label: "射击伤害"
    stages:
      - condition: "命中首个敌人"
        value: "+100%"
      - condition: "主动技能期间"
        value: "+200%"
```

- `kind: damage` 表示增伤，`modifierTypeId` 必须与乘区来源注册表中的增伤类型一致。
- `label`、`value` 和每个阶段均不能为空；`condition` 可省略。叠层、条件翻倍和动态换算同时记录基础阶段与最终阶段。
- 数值以审定后的 MDX `description` 为准；`description_override: true` 时人工覆盖优先。乘区证据用于交叉核对类型，不得从底层 `baseValue` 自动推导玩家文案。
- 同一插件不能重复声明同一个 `modifierTypeId`。没有登记为增伤来源的超限卡片不得孤立添加增伤数值。
- `kind: stat` 用于 `toughness-efficiency`、`critical-rate`、`charge-efficiency` 和 `fire-rate`。分别记录破韧效率、暴击率、充能速度/效率及枪械射速加成；命中后直接回复技能能量等即时充能不属于 `charge-efficiency`，基础射击间隔变化不属于 `fire-rate`。
- 页面只渲染非空分类，不显示空入口。列表与增伤共用关键数值区域，详情页按“增伤”和“属性”分组展示。

维护时先确认 ItemID 和最终描述，再录入阶段数值，随后运行 `pnpm test:overlimit-cards` 与 `pnpm multiplier-index:check`。超限卡片导入后重复执行校验，确认人工字段仍通过同 ItemID 合并。

## 独立伤害来源

插件额外创建或替换为独立 Numerical 结算时，在插件 MDX 中使用 `independent_damage_sources` 引用已经审定的武器 `damage_sources`：

```yaml
independent_damage_sources:
  - weapon_slug: "夜影之逝"
    damage_source_id: "guan-chang-hong-jian-qi"
    trigger: "切出本武器时向前发射剑气"
    interval: "10秒"
```

- `weapon_slug` 使用 `data/weapons/` 下不含扩展名的文件名；`damage_source_id` 使用该武器内稳定的伤害来源 ID。
- 插件和同 ItemID 超限卡详情页共同使用该引用。NumericalID、伤害类型、伤害数值、破韧、元素、暴击和弱点均由猎场武器 Resolver 生成，不在插件或超限数据中复制。
- `trigger` 与 `interval` 是插件自身的触发语义，必须依据最终描述或执行配置人工维护；没有独立冷却时明确写触发方式，不猜测冷却值。
- 只有插件新增或切换到独立 Numerical 伤害时才登记。修改原武器伤害倍率、弹丸数量、范围、射速，或让原有武器伤害来源覆盖更多攻击，不属于独立伤害来源。
- `effect_values` 仍只记录增伤和属性提升，不能用它承载新伤害实例。

新增或修改引用后运行 `pnpm test:independent-damage` 与 `pnpm weapon-data:check`。

## 适用武器

适用范围分为三类：

| 类型 | MDX 表达 |
|:---|:---|
| 全部武器 | `weaponType: []`，且没有 `weaponNames` |
| 标准武器类型 | `weaponType: [类型ID...]` |
| 武器专属插件 | `weaponType: []` 加 `weaponNames: ["武器名"]` |

`weaponType: []` 不一定代表全部武器。只要 `SuittableWeaponItem` 非空，就必须解析对应 CommonItem 正式名称并写入 `weaponNames`。例如剑摧魂属于夜影之逝专属，不能显示为全部武器类型。

## 图标

- 普通页面图标以同一 ItemID 的 `CommonItemDataTable.IconPath.NormalIcon` 为准。
- 猎场表可能使用另一张 Rogue 图标，只在复刻猎场界面时采用。
- 图标编号和 `PassiveSkill_ID` 不一致是正常告警，不能互相替代。
- 必须同时维护 `public/icons/perks/*.png` 和网站实际请求的 `public/webp/icons/perks/*.webp`。
- 同名目标文件已存在时先比较内容；内容不同就使用带 ItemID 的稳定文件名，不能覆盖合并。

## 上线状态

| 字段 | 含义 |
|:---|:---|
| `CollectMODItem=1` | 进入插件收集和展示范围，网站归入“已上线” |
| `MakeMODItem=1` | 可进入插件制造范围，不能单独判断上线 |
| `IsCooked=true` | 资源已打包，不代表已投放 |

猎场还有第二层开关：条目需要存在于 `HuntingGroundRoguelikeWeaponModTable` 且 `IsShow=true`。这不能反向证明普通插件详情应使用 `OverrideDesc`。

核对游戏内已上线截图时，以截图中的插件名称为观察事实，先与现有 MDX 对照；refs 只用于在身份确定后补字段，不能直接用 refs 全量列表代替截图清单。

### release_date 与近期上新

正式上线的插件可以在 MDX 中记录最近一次游戏内上线日期：

```yaml
CollectMODItem: 1
release_date: "2026-07-24"
```

- `release_date` 使用北京时间下的 `YYYY-MM-DD` 自然日，不使用文件修改时间、Git 提交时间或 refs 更新时间推断。
- 插件图鉴将上线当天至第 7 个自然日视为“近期上新”，即日期差为 `0` 至 `6` 天；第 8 天自动失效。
- 字段缺失的旧插件不进入近期筛选；`CollectMODItem` 不是 `1` 时，即使保留日期也不会进入近期筛选。
- 插件下线后可以保留该字段作为历史信息；以后重新上线时，将其更新为最近一次正式上线日期。
- 批量同步上线状态时使用 `--release-date`，导入器只会在状态从未上线变为已上线时写入日期，不会覆盖已经上线插件的既有日期。

## 导入与审计

主要入口：

```bash
pnpm exec tsx scripts/import-perks.ts 插件名 --json
pnpm exec tsx scripts/import-perks.ts --ids 20703040432 --json
pnpm exec tsx scripts/import-perks.ts --all --sync-descriptions --json
pnpm exec tsx scripts/import-perks.ts --all --sync-status --release-date 2026-07-24 --json
pnpm exec tsx scripts/import-perks.ts --all-with-icons --json
```

写入前检查：

- `identityWarnings.idConflicts`
- `identityWarnings.nameConflicts`
- `descriptionAudit.mge`、`override`、`sourceNumbers`
- `drifts.icon`
- `drifts.weaponType` 和 `drifts.weaponNames`
- `local.hidden` 与 `CollectMODItem`

普通 `--write` 不覆盖已有非空描述。只有空描述或明确占位符才允许 `--sync-descriptions --write` 保守修复。

## 版本更新流程

1. 更新 `refs/` 后先运行全量审计，不直接写入。
2. 身份、图标、适用武器和上线状态分别检查；确认真实上线日期后，在状态同步时显式传入 `--release-date`，避免一次批量同步混合多个风险面。
3. 描述差异按四类规则分类。
4. 小幅省略不改；严重残缺补全；真正冲突输出清单等待决策。
5. 用户确认或新截图证实后修改 MDX，必要时设置 `description_override: true`。
6. 运行 `git diff --check` 和 `pnpm build`。

详细命令和导入器字段说明见 [`.claude/commands/import-perks.md`](../../.claude/commands/import-perks.md)。
