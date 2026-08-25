# 插件数据管线与维护约定

> 状态：active

本文记录武器插件的身份、描述、图标、适用范围和上线状态处理规则。目标是让后续版本更新只需要重新审计和人工确认，不再重复排查同一套数据关系。

## 核心结论

- `data/perks/slot-*/*.mdx` 拥有普通插件详情和结构化效果；`data/overlimit-cards.json` 拥有猎场超限卡片短摘要。两者通过 ItemID 合并，但互不覆盖描述。
- 插件身份只通过 ItemID 连接，不能根据相似编号、图标编号或相邻行猜测。
- 普通插件详情优先使用 `MGEDescription`；猎场 `OverrideDesc` 通常是玩法卡片简写，不能覆盖完整详情。
- 游戏内截图、`MGEDescription`、`OverrideDesc` 和各表 `Description` 都是自然语言展示证据，不是配置数值真值；它们只能确定玩家可见文案、触发条件和语义。
- 已有非空描述不批量覆盖。版本更新后重新审计，人工处理真正冲突即可。

## 数值证据规则

插件和超限卡片的数值先沿 `ItemID -> PassiveSkill_ID -> MGE -> ModifierID` 定位到 Num Modifier V2 Lock 的精确 `lc:<row_name>`。只要目标效果存在可对应的 Numerical 属性行，就必须以该行的 `BaseValue`、`CoefValue`、`GPModifierOp` 和 `Level` 为准，禁止从游戏内描述、截图文案、`MGEDescription`、`OverrideDesc` 或 Numerical 自身的 `Description` 抄取数值。

- `Description` 只解释属性语义，不校正同一行的结构化字段。例如 `GPModifierOp: B1`、`BaseValue: 3.0` 应记录为 `+300%`；描述即使写 `+400%` 也视为错误文案。
- 描述与 Numerical 冲突时，采用 Numerical，并在审计证据中记录冲突；不得以描述“看起来更新”或来自游戏内为由覆盖结构化值。
- 只有 Numerical 没有承载目标数值，或有可重复的实际伤害测试、运行时日志证明存在动态覆写时，才允许采用其他数值证据。此时必须记录证据来源、推导过程和 Numerical 链路为何不足，不能只设置 `description_override: true`。
- 概率、持续时间、范围、弹数、层数等若由其他结构化 Ability、Buff 或 DataTable 字段直接承载，同样优先结构化字段，描述仅作交叉检查。
- `refs/` 仍只用于维护期审计；最终发布值由 MDX 中的稳定表达式引用已提交的 `data/num-modifier-lock.json`，页面运行时不得读取 `refs/`。

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
| 1 | 当前版本游戏内详情截图 | 玩家可见文案和触发语义；数值仍受“数值证据规则”约束 |
| 2 | `DT_GPMGESkillDesConfig_BD.json` 的 `MGEDescription` | 普通插件完整详情正文；不作为结构化数值依据 |
| 3 | `DT_GPMGESkillDesConfigTable_Main.json` | 导入器使用的合并镜像，需与 BD 表核对 |
| 4 | `HuntingGroundRoguelikeWeaponModTable.OverrideDesc` | 猎场卡片简写，仅作差异对照，不作为结构化数值依据 |
| 5 | `WeaponModItemData.AttrList` | 没有 MGE 描述时的属性型回退；其中结构化字段按数值规则审计 |

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
| 致命爆炸 | `1316200001_1` | 超限短摘要采用当前审定值：`5%` 概率，冷却 `2` 秒；拒绝旧 MGE 文案的 `8%` |
| 武器穿透 | `1316201001_1` | 子弹穿透能力 `+2` |
| 导弹轰炸 | `1316210001_1` | 爆炸命中发射 `2` 枚；仅命中一个单位时发射 `5` 枚，冷却 `2` 秒；拒绝旧 MGE 文案的 `3` 枚 |
| 换弹冲击 | `1316211001_1` | 持续 `5` 秒，基础 `500%` 攻击力；每 `1%` 暴击率或换弹速度提高 `1%` 伤害 |
| 爆毒蚀域 | `1316213001_1` | 暴击生成减速毒域，冷却 `5` 秒 |
| 肾上腺素 | `1313031004_1` | 季中更新公告优先：每颗 `21%`，最高 `126%` |

MGE 中的“复用某武器资源”等开发备注不写入网站描述，只保留玩家可理解的机制和数值。

## 文案格式

普通插件详情与超限卡片短摘要是两个独立展示面：

- 普通插件详情的数值强调使用 `<strong>...</strong>`，例如 `<strong>20%</strong>`；冷却统一写为 `，冷却时间<strong>20</strong>秒。`，不使用 `CD20秒` 缩写。
- 超限卡片短摘要保持紧凑纯文本，可以使用 `（CD2秒）`；不得把该格式批量改写成普通插件详情句式，也不得反向用短摘要覆盖详情。
- 游戏标签 `<qiangdiao>...</>` 转换为 `<strong>...</strong>`。
- 清理 `U+200B`、`U+FEFF` 等零宽字符。
- 不保留 `{GPModifier:...}`、`??`、独立占位符 `X` 或测试文案。
- 触发语义以游戏原文为准，例如“切出该武器后”不能擅自改成“切换到该武器后”。

需要人工维护玩家可见文案时，在 MDX 中添加：

```yaml
description_override: true
```

## 超限短摘要维护

`data/overlimit-cards.json` 是提交并供运行时读取的导入产物。默认短摘要来自 `HuntingGroundRoguelikeWeaponModTable.OverrideDesc`；当该文案会恢复已确认的旧数值或错误机制时，在 `scripts/import-overlimit-cards.ts` 的 `REVIEWED_DESCRIPTION_OVERRIDES` 中保存审定短摘要。该映射只用于重新导入防回退，结构化数值真值仍来自 Num Modifier V2、Ability、Buff、DataTable 或可复核的运行时证据。

新增或修改审定短摘要时按以下顺序维护：

1. 先记录身份链、结构化数值或运行时证据，并确认原 `OverrideDesc` 的具体问题。
2. 能进入 `effect_values` 的 Numerical 数值先维护 MDX V2 引用；概率、冷却、范围和弹数等使用对应结构化执行配置。
3. 更新 `REVIEWED_DESCRIPTION_OVERRIDES`，再运行 `pnpm exec tsx scripts/import-overlimit-cards.ts` 重建 `data/overlimit-cards.json`，禁止只手改生成结果。
4. 检查卡片短摘要与插件详情各自保持合适粒度，随后运行 `pnpm test:overlimit-cards`、`pnpm overlimit-effects:audit` 和 `pnpm num-modifier:check`。

## 结构化效果数值

超限卡片需要展示玩家可读的具体数值时，在同 ItemID 插件 MDX 的 frontmatter 中维护 `effect_values`。`data/overlimit-cards.json` 保存猎场短摘要；页面运行时通过 ItemID 只合并 MDX 数值，不得用普通插件的完整 `description` 覆盖短摘要。超限卡片导入器不得生成或覆盖 `effect_values`。

```yaml
num_modifier_values:
  damage-per-stack:
    row: "lc:111010061_1_0"
    field: base
    scale: 1
  damage-at-six-stacks:
    row: "lc:111010061_1_0"
    field: base
    scale: 6

effect_values:
  - label: "弱点伤害"
    stages:
      - condition: "每层"
        value:
          ref: damage-per-stack
          format: signed-percent
      - condition: "叠满六层"
        value:
          ref: damage-at-six-stacks
          format: signed-percent
```

- 禁止手写 `kind`、`statId` 或 `modifierTypeId`。Num stages 的属性类型、方向、增伤/属性分组和索引分面统一由 `resolveEffect()` 派生。
- `num_modifier_values` 的别名使用 kebab-case；`row` 必须是 `lc:` 引用，`field` 只允许 `base` 或 `coefficient`，`scale` 默认 `1`。
- 描述中的 Num 数值使用 `{{num:<alias>|<format>}}`，格式只允许 `number`、`percent`、`signed-number`、`signed-percent`。插件详情、插件悬浮预览、召唤物摘要和攻略编辑器消费 `lib/perks.ts` 的已解析描述；超限卡只消费其中的 `effect_values`，描述固定使用卡片短摘要。
- `value` 和每个阶段均不能为空；`condition` 可省略，`label` 可用于覆盖上下文展示名。Num 派生值使用 `{ ref, format }`；无法直连 Num 的值使用 `{ literal, reason }`，并在 effect 上声明 `semantic.facetId`。旧字符串 `value` 禁止使用。
- 数值必须遵守“数值证据规则”。可定位 Numerical 行时必须引用 Num Modifier V2 表达式；MDX `description` 与 `description_override: true` 均不能覆盖结构化数值。属性通道和索引分面同样不得由描述覆盖。
- 同一插件不能重复解析为同一个分面。没有登记为 Modifier 来源的超限卡片不得孤立添加增伤数值。
- 属性效果由语义目录扩展，不维护第二份允许列表。命中后直接回复技能能量等即时充能不属于充能效率，基础射击间隔变化也不能仅凭文案归为射速。
- 页面只渲染非空分类，不显示空入口。列表与增伤共用关键数值区域，详情页按“增伤”和“属性”分组展示。

维护时先确认 ItemID 和结构化数值链，再录入阶段数值；描述只用于补充条件语义。随后运行 `pnpm num-modifier:check`、`pnpm test:overlimit-cards`、`pnpm overlimit-effects:audit` 与 `pnpm multiplier-index:check`。超限卡片导入后重复执行校验，确认 Numerical 审定值没有被描述覆盖。

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
