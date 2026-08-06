# 武器原表读取层

> 状态：active
> 日期：2026-08-05
> 实现：`scripts/weapon-data/source-reader.ts`

## 1. 职责边界

读取层是后续武器数据 Lock 和校验脚本访问游戏导出表的唯一入口。它只负责读取、保真索引、引用存在性和 Prototype 关系校验，不负责：

- 生成或读取页面运行时 Lock。
- 修改武器 MDX。
- 将 Unreal 字段转换成 Wiki 领域字段。
- 解释 Settlement、技能生命周期或增伤效果。
- 把模式级 ASC / Feel 属性压平为武器级属性。

模块位于 `scripts/`，页面、组件和生产构建不得导入它。普通构建不读取 `refs/`。

## 2. 数据源注册

读取器固定支持八个物理来源：

| 逻辑来源 | `NZM/Content` 相对路径 | 稳定索引 |
| :--- | :--- | :--- |
| `numerical-lc` | `DataTables/numerical_config_composite.json` | `lc:${rowName}` |
| `numerical-td` | `DataTables/TD_numerical_config_composite.json` | `td:${rowName}` |
| `asc` | `Attributes/AutoGenerate/attr_weapon_asc.json` | `ASCTypeID` |
| `feel` | `DataTables/WeaponFeelParamTable.json` | `WeaponFeelParamID` |
| `item` | `DataTables/LuaDataTable/WeaponItemConfigTable.json` | `ItemID` |
| `prototype` | `DataTables/WeaponPrototypeConfig.json` | `PrototypeID:Mode` 候选集 |
| `skill-pve` | `DataTables/SkillConfigTable_Weapon_PVE.json` | `${SkillID}_${Level}` |
| `gp-active-skill` | `DataTables/GPActiveSkillDataTable.json` | Unreal rowName |

Item 文件在当前导出中的真实位置包含 `DataTables/` 前缀。该路径只在集中注册表中维护，消费者不得自行拼接。

本任务不注册 `TD_attr_weapon_asc.json` 或 `TD_WeaponFeelParamTable.json`。这两张表是稀疏覆盖，必须等真实组合规则确定后再增加逻辑来源，不能按缺行机会主义回退基础表。

## 3. 公共接口

```ts
const reader = createWeaponDataSourceReader({
  // 默认：refs/Exports/NZM/Content
  contentRoot,
});

reader.getNumerical({ table: "lc", id: 120300110, level: 1 });
reader.getNumericalDiagnostics("lc");
reader.getAsc("143");
reader.getFeel("143");
reader.getItem("20103000010");
reader.findItemsByPrototypeId("20003000011");
reader.getPrototypeCandidates("20003000011", 0);
reader.getPrototype({ prototypeId: "20003000011", mode: 0, rowName });
reader.getWeaponPveSkill({ skillId: 5100101, level: 1 });
reader.getGpActiveSkill(5004901);
reader.getGpActiveSkillDiagnostics();
reader.validatePrototypeLink({
  prototypeId: "20003000011",
  mode: 0,
  rowName,
  numerical: { table: "lc", id: 120300110, level: 1 },
  ascTypeId: "143",
});
```

每个查询结果都包含：

- `kind`：逻辑来源类型。
- `sourcePath`：`NZM/Content` 相对路径。
- `rowName`：Unreal `Rows` 中的原始行名。
- `key`：读取层使用的规范索引键。
- `raw`：递归冻结的完整原始行。

`raw` 不使用字段白名单；未知字段、完整 `Settlements` 和嵌套对象原样保留。

## 4. 权威身份与异常处理

### Numerical

Numerical 使用 Unreal `Rows` 行名作为权威身份。调用方按 `table + id + level` 查询，读取器生成 `${id}_${level}` 行名：

- LC 和 TD 始终分别查找，不跨表回退。
- 目标表缺失、另一表存在同名行时抛出 `TABLE_MISMATCH`。
- 行内 `id / Level` 与行名不一致时仍按行名读取，并通过 `getNumericalDiagnostics()` 暴露 `NUMERICAL_IDENTITY_MISMATCH`；不自动修正原始值。

### ASC、Feel 与 Item

ASC、Feel、Item 的身份字段必须存在，并与 Unreal 行名一致。身份缺失、身份重复或行名不一致会拒绝加载对应来源。

Item 只通过显式 `item_id` 精确读取。`findItemsByPrototypeId()` 只按 `ModelID` 返回候选数组；即使只有一个候选，也不会替调用方选择并写回 `item_id`。

### Prototype

Prototype 的 `${PrototypeID}:${Mode}` 不是天然唯一键，因此索引保存候选数组：

- 无候选时返回引用缺失错误。
- 单候选可以直接取得。
- 多候选必须传入原始 `rowName` 消歧；不比较内容后静默合并，也不使用 first-wins。

`validatePrototypeLink()` 校验 ASC 与 `ASCTypeID` 一致，并确认 Numerical ID 命中 Prototype 的主伤害、爆炸、激光、轻重击、击飞或自身/队友爆炸字段之一。返回值保留具体命中的原字段名，不把它翻译成 Settlement 或页面 section。显式 ASC 存在时，同时检查 ASC 行和有效 Feel 行；Feel 未指定时使用 ASC ID。

### Skill PVE 与 GP Active Skill

PVE Skill 的规范键由行内 `SkillID + Level` 构成，并且必须与 Unreal rowName 一致。缺失身份、派生键重复或行名不一致会拒绝加载。

GP Active Skill 使用 Unreal rowName 作为权威技能 ID。当前原表存在 `5000501 → AbilityID 5004701` 和 `5102901 → AbilityID 5004101` 两条真实差异，因此读取器保留原始 `AbilityID` 并通过 `getGpActiveSkillDiagnostics()` 报告，不自动修复或让整表加载失败。

跨 PVE / GP 的优先级不属于物理读取职责，由 `scripts/weapon-data/skill-charge.ts` 实现：PVE 整行优先，仅在 PVE 行缺失时使用 GP 整行。非法 PVE 行、零值和 PVE/GP 数值不同都不能触发 fallback。

## 5. 错误契约

所有读取失败统一抛出 `WeaponDataSourceError`。错误包含固定 `code`、逻辑来源 `kind`、源文件相对路径和适用时的查询 `key`；Prototype 歧义还包含候选 rowName。

错误码覆盖文件缺失、非法 JSON、非法 Unreal 包装、非法 Row、重复身份、身份与行名冲突、引用缺失、LC/TD 串表、Prototype 歧义和 Prototype 关系不一致。

JSON 解析完成前文本中出现的重复对象属性会被标准解析器覆盖，读取层不声称检测这种词法级重复；`DUPLICATE_KEY` 指建立稳定身份索引时发现的派生键冲突。
