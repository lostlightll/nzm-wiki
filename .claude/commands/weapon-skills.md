用户会提供一个或多个武器名称: $ARGUMENTS
如果没有参数则检查所有武器。武器 MDX 在 data/weapons/，跳过近战武器（只有被动无主动）。

所有数据表路径相对于 `refs/Exports/NZM/Content/DataTables/`

## 执行策略

**尽量并行搜索**：对每把武器，一次性并行发起所有 Grep 搜索，不要串行等待。

## Step 1: 查基础数据

Grep 搜索 `WeaponPrototypeConfig.json` 中 `武器名":` 获取：
- PrototypeID, ActiveSkillID

## Step 2: 并行查技能信息（一次性发起所有搜索）

同时搜索以下内容：

1. **主动技能参数** → Grep `SkillConfigTable_Weapon_PVE.json` 搜 ActiveSkillID
   - cooldown = ChargeNeedTime
   - count = SkillCount
   - duration = Parameters 中 Tags 含 `SkillParamConfig.EffectDuration` 或 `SkillParamConfig.SummonerDuration` 的字段值（字段名可能是 BuffDuration、FieldDuration、LifeTime 等，都表示持续时间）。都没有则写 -1
   - 额外 Parameters 中的距离/范围等写入描述（100 units = 1米）

2. **主动技能描述+图标** → Grep `MGE/DT_GPMGESkillDesConfigTable_Main.json` 搜 ActiveSkillID
   - MGEName.LocalizedString → name
   - MGEDescription.LocalizedString → 描述文本
   - MGEIcon.AssetPathName → icon texture 名（**以此为准**）

3. **被动技能描述+图标** → Grep `MGE/DT_GPMGESkillDesConfigTable_Main.json` 搜 `T_Weapon_Skill_{PrototypeID}_1`
   - 如果没结果，再按被动技能名称搜索
   - MGEName.LocalizedString → name
   - MGEDescription.LocalizedString → 描述文本
   - MGEIcon.AssetPathName → icon texture 名（**以此为准**）

## Step 3: 模板变量解析

描述中的模板变量格式及解析：

| 模板格式 | 解析方式 |
|---|---|
| `{Passive:ID:1:ParamName:N}` | → `MGE/DT_MGEParamConfig_Main.json` 搜 ID，取 ParamName 的 Value |
| `{Buff:BuffName:FieldName:N}` | → `Buff/BuffConfigDatatableNew.json` 搜 BuffName，取对应字段 |
| `{GPModifier:ID:BaseValue:Index:N}` | → 先搜 `numerical_config_composite.json`，无结果则搜蓝图资源 |
| `{Ability:ID:Level:ParamName:N}` | → `SkillConfigTable_Weapon_PVE.json` 搜对应 SkillID |

末尾的 `:N` 是格式化标识（如 `:5` 秒，`:13` 百分比，`:1` 整数），不是值本身。

**重要：如果模板变量无法从数据表中解析出具体数值，用 `??` 占位，等用户手动填写。**
**注意：MDX 中 `{}` 是 JSX 表达式语法，绝对不能在描述文本中直接写花括号，否则会导致编译错误。**

```mdx
<!-- 正确 -->
击杀敌人可获得<Yellow>??</Yellow>武器伤害加成

<!-- 错误 - 会导致 MDX 编译失败 -->
击杀敌人可获得<Yellow>{GPModifier:120500060:BaseValue:1}</Yellow>武器伤害加成
```

## Step 4: 写入 MDX

### front-matter（scope 后、damage 前）

确认已有以下字段，缺失则添加：
- weapon_type_id / prototype_id / active_skill_id

### WeaponSkill 组件（紧接 front-matter 后）

```mdx
<WeaponSkill>
  <ActiveSkill
    name="技能名"
    icon="/icons/weapons/skills/TEXTURE_NAME.png"
    duration={15}
    cooldown={30}
    count={1}
  >
    技能描述，数值用 <Yellow>值</Yellow> 包裹。
  </ActiveSkill>

  <PassiveSkill
    name="被动名"
    icon="/icons/weapons/skills/TEXTURE_NAME.png"
  >
    被动描述，数值用 <Yellow>值</Yellow> 包裹，关键词用 <Blue>词</Blue> 包裹。
  </PassiveSkill>
</WeaponSkill>
```

描述文本转换规则：
- `<qiangdiao>值</>` → `<Yellow>值</Yellow>`
- `<T002>关键词</>` → `<Blue>关键词</Blue>`
- 去掉末尾 `\n`
