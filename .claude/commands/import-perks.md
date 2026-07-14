用户可提供一个或多个插件名称或 ID：$ARGUMENTS

目标：使用 `scripts/import-perks.ts` 从最新 `refs/` 审计并导入插件数据，解析适用武器，维护 `data/perks/slot-*/*.mdx`、PNG 源图和网站实际使用的 WebP 图标。

## 基本原则

- 先审计，后写入。不要一上来运行全量 `--write`。
- 已有非空 frontmatter 和 MDX 正文属于人工维护内容，不覆盖。
- 新插件先创建为 `draft: true`，检查名称、描述、数值、图标和适用武器后再发布。
- 适用范围分为三种：全部武器、标准武器类型、专属武器。分别使用 `weaponType` 和 `weaponNames` 表达，不能把专属武器误判为全部武器。
- 网站通过 `getAssetPath()` 将插件 `.png` 请求改写到 `/webp/icons/perks/*.webp`。只复制 PNG 会导致图片损坏，导入后必须生成对应 WebP。
- refs 中混有测试项、占位符、旧版和隐藏插件。默认只处理 `CollectMODItem=1` 的可收集插件；除非用户明确要求，不使用 `--include-hidden`。
- 字段漂移不自动修正。先结合游戏语义和现有页面判断，尤其是改名、槽位、稀有度、图标和适用武器变化。
- 插件正式名称优先使用 `CommonItemDataTable[MODItemID].Name.LocalizedString`，`WeaponModItemData.MODName` 只作为回退。两者不一致时，不得仅凭 `MODName` 将本地页面判为 orphan。
- 描述来源按 `HuntingGroundRoguelikeWeaponModTable.OverrideDesc`、`PassiveSkill_ID` 对应 MGE 描述、`AttrList` 属性拼接的顺序处理。每条链路独立核验，不把空 `PassiveSkill_ID` 直接当作无效果。

## Step 1: 审计范围

用户给了名称时，只审计这些插件：

```bash
pnpm exec tsx scripts/import-perks.ts $ARGUMENTS --json
```

用户给的是 ID 时，改用 `--ids`，不要把数字当作名称位置参数：

```bash
pnpm exec tsx scripts/import-perks.ts --ids 20703040432 --json
```

用户没有给参数时，运行可收集插件全量审计：

```bash
pnpm exec tsx scripts/import-perks.ts
```

重点检查：

- `missing`：refs 中存在、本站尚未创建的插件
- `patchable`：已有页面中可以安全补齐的空字段
- `drifts`：必须人工判断的字段变化
- `unresolved`：描述中仍未解析的模板变量
- `local.orphan`：本站有页面，但最新 refs 无法按 ID 或名称匹配
- `local.hidden`：本站有页面，但最新 refs 未标记为可收集

### 异常分支 A：正式名称与 MODName 不一致

症状：按中文名运行导入器提示 `refs 中未找到`，或已有 MDX 被列为 `local.orphan`，但 `CommonItemDataTable` 中存在同名物品。

处理步骤：

1. 在 `DataTables/System/Items/CommonItemDataTable.json` 按用户提供的正式名称搜索，取得 `ItemID`。
2. 使用该 ID 查询 `DataTables/LuaDataTable/WeaponModItemData.json`，核对 `MODItemID`、槽位和 `PassiveSkill_ID`。
3. 正式标题采用 `CommonItemDataTable.Name.LocalizedString`；内部名、旧名或策划占位名只记录为诊断信息，不写入 `title`。
4. 改用 `--ids <ItemID>` 审计和写入，避免名称索引再次命中内部名。
5. 描述继续按正常的 `PassiveSkill_ID -> MGE` 链路解析，不因为名称冲突改写数值。

已知案例：

```text
技能增涌
ItemID: 20703040184
CommonItemDataTable.Name: 技能增涌
WeaponModItemData.MODName: 导弹流_3
PassiveSkill_ID: 1315153001:1
最终描述: 武器技能伤害提升60%。
```

### 异常分支 B：纯 AttrList 插件

症状：插件有明确属性效果，但 `PassiveSkill_ID` 为空，MGE 描述链路无法生成 description。

处理步骤：

1. 读取 `WeaponModItemData.AttrList`，格式通常为 `属性ID:数值;属性ID:数值`。
2. 按属性 ID 查询 `DataTables/AttributeChannelDescriptionTable.json`，读取属性名和展示模板。
3. 比例值按百分比格式化；正值使用“提升”，负值取绝对值并使用“降低”。
4. 多个属性按原顺序合并为一句自然中文描述，不保留内部属性名。
5. `AttrList` 只作为 `OverrideDesc` 和已成功解析的 MGE 描述之后的回退，避免重复描述同一效果。
6. 属性表无法确认单位或正负语义时保留 draft 并报告，不猜数值。

已知案例：

```text
超载弹匣
ItemID: 20703040089
PassiveSkill_ID: 空
AttrList: 104509:0.55;104507:-0.03
104509: ClipAmmoAddRatio -> 弹匣容量提升55%
104507: WeaponChangeClipSpeedRatio -> 换弹速度降低3%
最终描述: 弹匣容量提升55%，换弹速度降低3%。
```

## Step 2: 确认写入

有 `$ARGUMENTS` 时，可以直接处理用户指定范围。若没有参数且审计结果包含多项，不要擅自全量写入；先向用户说明数量和主要风险，确认导入范围。

明确范围和赛季后运行：

```bash
pnpm exec tsx scripts/import-perks.ts $ARGUMENTS --write --season s2
```

按 ID 导入时：

```bash
pnpm exec tsx scripts/import-perks.ts --ids 20703040432 --write --season s2
```

未确定赛季时可以省略 `--season`，脚本会写为 `pending`，但发布前必须改成正确赛季。

写入行为仅包括：

- 创建缺失的 draft MDX
- 补齐已有 MDX 中为空的 `id`、`icon`、`weaponType`、`description`
- 从 refs 复制缺失图标到 `public/icons/perks/`

插件投放状态使用以下三个 frontmatter 字段。字段名保持与 refs 一致；后续新增或批量回填 MDX 时必须从同一条 `WeaponModItemData` 记录读取，不能手填猜测：

```yaml
CollectMODItem: 1
MakeMODItem: 1
IsCooked: true
```

| 字段 | 含义 | 页面用途 |
|---|---|---|
| `CollectMODItem` | `1` 表示进入插件展示、收集范围；`0` 表示投放关闭或隐藏 | 只有严格等于 `1` 才归入“已上线”，其余值或缺失字段归入“未上线” |
| `MakeMODItem` | `1` 表示允许进入插件制造范围；`0` 表示不可制造 | 不能单独作为是否上线的判断 |
| `IsCooked` | `true` 表示资源已参与客户端打包 | 只说明资源存在，不代表已经投放或可获得 |

`CollectMODItem=1` 只代表主插件展示/收集开关开启。若插件还需要进入特定玩法掉落池，继续检查对应玩法表；例如猎场肉鸽需要存在于 `HuntingGroundRoguelikeWeaponModTable` 且 `IsShow=true`，不能把两层开关混为一谈。

注意：导入脚本只能直接取得 `SuitableWeaponType` 数字 ID，不能可靠地把 `SuittableWeaponItem` 转成武器中文名。写入后必须继续执行 Step 3，补齐 `weaponNames`。

写入完成后立即转换插件图标：

```bash
pnpm exec tsx scripts/optimize-images.ts public/icons/perks
```

转换结果必须位于 `public/webp/icons/perks/{icon}.webp`。不要把 PNG 路径直接写进 frontmatter；`icon` 仍只写不带扩展名的图标 ID。

## Step 3: 解析适用武器

适用范围只从 refs 解析。

先在 `DataTables/LuaDataTable/WeaponModItemData.json` 中按插件 ID 找到完整行，读取：

- `SuitableWeaponType.Values`：标准武器类型 ID
- `SuitableWeaponTypeList.Values`：标准武器类型的备用字段
- `ExcludeWeaponType.Values`：排除的武器类型
- `SuittableWeaponItem.Values`：专属武器 ItemID（字段名在游戏表中就是这个拼写）

写入规则如下。

### 全部武器

以上限制字段均为空时：

```yaml
weaponType: []
weaponNames: []
```

通常省略空的 `weaponNames`，保留 `weaponType: []` 即可。

### 标准武器类型

标准类型写入 `weaponType: number[]`：

| ID | 武器类型 | ID | 武器类型 |
|---:|---|---:|---|
| 1 | 突击步枪 | 2 | 狙击步枪 |
| 3 | 霰弹枪 | 4 | 火箭发射器 |
| 5 | 冲锋枪 | 6 | 机枪 |
| 7 | 手枪 | 8 | 单发榴弹 |
| 9 | 激光武器 | 12 | 弓箭 |
| 13 | 近战武器 | 14 | 射手步枪 |
| 15 | 喷射器 | 16 | 连发榴弹 |
| 19 | 暗器 | | |

示例：`射手步枪/狙击步枪/霰弹枪/手枪`：

```yaml
weaponType: [14, 2, 3, 7]
```

### 专属武器

当 `SuittableWeaponItem.Values` 非空时，对每个 ItemID 查询：

```text
DataTables/System/Items/CommonItemDataTable.json
```

取对应行的 `Name.LocalizedString` 作为专属武器中文名，并写入 `weaponNames: string[]`：

```yaml
weaponType: []
weaponNames: ["飓风之龙"]
```

示例链路：

```text
WeaponModItemData[20703040429].SuittableWeaponItem = [20103000010]
CommonItemDataTable[20103000010].Name.LocalizedString = 飓风之龙
```

必要时再到 `DataTables/LuaDataTable/WeaponItemConfigTable.json` 检查该 ItemID 的 `WeaponType`，并结合插件描述、对应武器 MDX 确认语义。

如果 `SuitableWeaponType.Values` 为空但 `SuitableWeaponTypeList.Values` 非空，使用后者。如果只有 `ExcludeWeaponType.Values`，根据项目支持的完整武器类型 ID 集合计算排除后的允许列表；不能可靠计算时不要猜，保留 draft 并报告。

refs 与本地非空值冲突时，先检查是否为版本变化；无法确认时不覆盖。ItemID 在 CommonItemDataTable 中没有名称、名称为空或无法对应现有武器时，保留 draft 并报告。

## Step 4: 人工复核

逐个检查新建和修改文件：

- `title`、`id`、`slot` 是否对应同一插件
- `rarity` 是否等于 CommonItemDataTable 的 `Quality - 1`
- `icon` 是否来自 CommonItemDataTable 的实际图标资源，而不是机械套用 PassiveSkill ID
- `public/webp/icons/perks/{icon}.webp` 是否存在且可正常读取
- `description` 中是否还有 `{...}`、`??`、测试文案或不符合当前版本的数值
- `CollectMODItem`、`MakeMODItem`、`IsCooked` 是否来自同一个 `WeaponModItemData` 条目，且没有把“已打包”误判为“已上线”
- 页面“已上线”状态是否严格满足 `CollectMODItem === 1`
- `weaponType` 是否只包含标准武器类型 ID
- `weaponNames` 是否只包含具体武器名称
- 只有 `weaponType` 和 `weaponNames` 都为空时，页面才会显示“全部武器类型”
- 专属插件是否已通过 `SuittableWeaponItem → CommonItemDataTable.Name` 链路解析，并结合对应武器页面确认
- `draft: true` 是否应继续保留

脚本无法解析的模板变量，按以下顺序查 refs：

1. `DataTables/MGE/DT_MGEParamConfig_Main.json`
2. `DataTables/MGE/MGEPassiveMainTable.json` 及其实际分表
3. `DataTables/Buff/BuffConfigDatatableNew.json`
4. 对应 Ability、MGE 蓝图 JSON 或生成的 C++

不知道就是不知道。无法确认的值保留 draft 并明确说明，不要猜。

## Step 5: 验证

再次对处理范围运行审计，确认不再出现在 `missing` 或 `patchable`：

```bash
pnpm exec tsx scripts/import-perks.ts $ARGUMENTS
```

确认对应 WebP 已生成：

```bash
Test-Path public/webp/icons/perks/{icon}.webp
```

检查适用武器字段：

```bash
rg -n "^weapon(Type|Names):" data/perks -g "*.mdx"
```

在插件详情页确认三种状态均能正确显示：

- 空限制 → `全部武器类型`
- `weaponType` → 中文类型和武器类型精灵图
- `weaponNames` → `专属武器`名称标签

最后运行：

```bash
pnpm exec eslint scripts/import-perks.ts
pnpm build
```
