用户会提供一个或多个武器插件名称: $ARGUMENTS
如果没有参数则提示用户输入插件名称。

所有数据表路径相对于 `refs/Exports/NZM/Content/DataTables/`

## 执行策略

**尽量并行搜索**：对每个插件，一次性并行发起所有 Grep 搜索，不要串行等待。

## Step 1: 查基础数据

Grep 搜索 `LuaDataTable/WeaponModItemData.json` 中 `"插件名"` 获取：
- MODItemID → id
- MODSlotIndex.Values[0] → slot
- PassiveSkill_ID → 冒号前半部分作为 icon（如 `"1313128001:1"` → `"1313128001"`）
- SuitableWeaponType.Values → weaponType（空数组表示适用所有武器类型）
- TagList.Values → 标签 ID 列表

**重要**：搜索时用 `LocalizedString` 匹配插件名称，然后向上找到对应条目的完整数据。

## Step 2: 并行查插件描述和标签（一次性发起所有搜索）

同时搜索以下内容：

1. **插件描述** → Grep `MGE/DT_GPMGESkillDesConfig_BD.json` 搜索 PassiveSkill_ID 的冒号前半部分（如 `1313128001`）
   - 条目 key 格式为 `{icon}_1`（如 `"1313128001_1"`）
   - MGEDescription.LocalizedString → 描述文本（含模板变量和标签）

2. **标签名称** → Grep `LuaDataTable/WeaponModItemTagData.json` 搜索 TagList 中的每个 ID
   - TagName.LocalizedString → 标签名称
   - TagColor → 标签颜色（6位 hex）

## Step 3: 模板变量解析

描述中的模板变量格式及解析（与 weapon-skills 相同）：

| 模板格式 | 解析方式 |
|---|---|
| `{Passive:ID:1:ParamName:N}` | → `MGE/DT_MGEParamConfig_Main.json` 搜 ID，取 ParamName 的 Value |
| `{Buff:BuffName:FieldName:N}` | → `Buff/BuffConfigDatatableNew.json` 搜 BuffName，取对应字段 |
| `{GPModifier:ID:BaseValue:Index:N}` | → 先搜 `numerical_config_composite.json`，无结果则搜蓝图资源 |
| `{Ability:ID:Level:ParamName:N}` | → `SkillConfigTable_Weapon_PVE.json` 搜对应 SkillID |

末尾的 `:N` 是格式化标识（如 `:5` 秒，`:13` 百分比，`:1` 整数），不是值本身。

**重要：如果模板变量无法从数据表中解析出具体数值，用 `??` 占位，等用户手动填写。**

## Step 4: 描述文本转换规则

将数据表中的富文本标签转为纯文本（MDX description 是纯文本，不含 HTML/MDX 组件标签）：
- `<qiangdiao>值</>` → 直接取出 `值`（去掉标签）
- `<T002>关键词</>` → 直接取出 `关键词`
- 去掉末尾 `\n`
- 解析后的模板变量值直接替换为数字

示例：
```
数据表原文：<qiangdiao>换弹</>后<qiangdiao>6秒</>内，下一次<qiangdiao>换弹速度</>加快<qiangdiao>{GPModifier:111010068:BaseValue:0:2:1}</>
解析结果：换弹后6秒内，下一次换弹速度加快30%
无法解析：换弹后6秒内，下一次换弹速度加快??
```

## Step 5: 确定 rarity

游戏数据中**没有**直接对应 rarity 的字段。处理策略：

- 如果 MDX 文件已存在且已有 rarity 值 → **保留不动**
- 如果是新建的 MDX 文件 → **默认设为 3**（传说）
- rarity 对应关系：1 = 稀有，2 = 史诗，3 = 传说

## Step 6: 写入/更新 MDX

MDX 文件路径：`data/perks/slot-{slot}/{插件名}.mdx`

### frontmatter 格式

```yaml
---
title: "插件名称"
id: "20703040095"
slot: 1
rarity: 3
icon: "1313128001"
weaponType: [5, 1]
description: "换弹后6秒内，下一次换弹速度加快30%，可叠层5层。"
---
```

字段说明：
- `title`: 插件名称（string）
- `id`: WeaponModItemData 中的 MODItemID（string）
- `slot`: 槽位 1-4（number）
- `rarity`: CommonItemDataTable.Quality - 1（number）
- `icon`: CommonItemDataTable.IconPath.NormalIcon 的资源文件编号（string），不得用 PassiveSkill_ID 代替
- `weaponType`: SuitableWeaponType.Values 数组（number[]），空数组 `[]` 表示适用所有类型
- `description`: 解析后的纯文本描述（string）

### 更新规则

- 如果 MDX 文件已存在：更新 id、slot、icon、weaponType、description（如果数据表有值且当前为空或 "X" 或 "??"）
- **保留已有的 rarity**，不覆盖
- 如果 MDX 文件不存在：创建新文件，rarity 默认为 3

## 数据来源参考

| 字段 | 数据来源 | 路径 |
|------|---------|------|
| id | WeaponModItemData.json | MODItemID |
| title | CommonItemDataTable.json | Name.LocalizedString；MODName 仅作内部名回退 |
| slot | WeaponModItemData.json | MODSlotIndex.Values[0] |
| icon | CommonItemDataTable.json | IconPath.NormalIcon.AssetPathName 中的资源文件编号 |
| weaponType | WeaponModItemData.json | SuitableWeaponType.Values |
| description | DT_GPMGESkillDesConfig_BD.json | MGEDescription.LocalizedString（需解析模板变量）|
| rarity | CommonItemDataTable.json | Quality - 1 |
| tags | WeaponModItemTagData.json | TagList → TagName.LocalizedString |

身份判断必须先用 `CommonItemDataTable` 行键/`ItemID` 与 `WeaponModItemData.MODItemID` 做同 ID 连接。图标资源号和 `PassiveSkill_ID` 可能复用或错位，只分别用于图片和效果描述，禁止反推 ItemID。

## 插件蓝图参考

| **文件名前缀** | **含义**        |
| ---            | ---             |
| 1312XXXXXX     | 武器专属插件    |
| 1313XXXXXX     | Slot-1（槽位1） |
| 1314XXXXXX     | Slot-2（槽位2） |
| 1315XXXXXX     | Slot-3（槽位3） |
| 1316XXXXXX     | Slot-4（槽位4） |

蓝图目录：
```
NZM/Content/Abilities/Build/CBT3/
├── Perk01/MGE_1313XXXXXX.uasset   # 插件槽位1的效果蓝图
├── Perk02/MGE_1314XXXXXX.uasset   # 插件槽位2的效果蓝图
├── Perk03/MGE_1315XXXXXX.uasset   # 插件槽位3的效果蓝图
└── Perk04/MGE_1316XXXXXX.uasset   # 插件槽位4的效果蓝图
```
