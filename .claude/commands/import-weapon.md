用户会提供一个或多个武器名称: $ARGUMENTS
目标：按当前高级武器 MDX 格式导入或标准化 `data/weapons/*.mdx`。

权威规范：`MD/MDX-SPEC.md`。不要直接照抄某个现有武器文件；先按结构类型判断，再必要时查相同类型的现有武器做校验。

当前高级格式按三类结构处理：
- **多火力模式型**：PrototypeConfig 中有多个实际火力模式，写入 `damage_modes`；重复 NumericalID 的射速变体写入 `extra_modes`。
- **技能/插件伤害型**：主动技能、分裂弹、插件弹、Dot、爆炸组件等非火力模式伤害写入 `extra_modes`。
- **动态射速型**：基础射击写 `damage_modes[0]`，被动/主动射速状态写 `extra_modes`。

## 核心原则

- **MDX 自包含**：`damage_modes` / `extra_modes` 必须内嵌完整 damage、element、weakness、critical、toughness 等字段，不写 `numerical_id` 外键。
- **全局伤害标签清空**：必须写 `damage_label: ''` 和 `damage_label_text: ''`，伤害标签改用每个 mode 的 `label`。
- **Mode 0 也写完整数据**：除非明确是近战旧格式，否则新武器按 `damage_modes[0]` 完整写。
- **extra_modes 只放非火力模式**：技能触发、插件效果、射速变体、爆炸组件放这里。
- **旧 flat 字段保留**：`damage`、`file_rate`、`magazine` 等 legacy 字段暂时保留，作为回退和旧 UI 兼容。
- **字段顺序照 MDX-SPEC**：`prototype_id` 紧跟 `title`，`weapon_type_id` / `active_skill_id` 放末尾。

## Step 1: 确认范围

用户给了武器名就直接用 `$ARGUMENTS`。

如果用户没给武器名，不要直接跑全量；先问清楚范围，或只检查用户指定文件。

## Step 2: 跑提取脚本

```bash
pnpm exec tsx scripts/extract-weapon-data.ts $ARGUMENTS
```

脚本默认向 stdout 输出 JSON；需要落盘时显式指定可纳入本次工作的临时路径：

```bash
pnpm exec tsx scripts/extract-weapon-data.ts $ARGUMENTS --out tmp/weapon-data.json
```

不要使用 ignored 的中间列表文件；流程输入必须来自用户参数或已纳入本次工作的文件。

重点看每把武器：
- `mdx.required_header`
- `mdx.damage_modes_yaml`
- `mdx.extra_modes_yaml`
- `skill_numerical`

`damage_modes_yaml` / `extra_modes_yaml` 是标准格式草稿，可以复制进 frontmatter 后再人工改名、归类、补技能。

## Step 3: 判断归属

| 数据 | 写入位置 |
|---|---|
| PrototypeConfig 的首次 NumericalID | `damage_modes` |
| PrototypeConfig 中重复 NumericalID 的 Mode | `extra_modes`，通常是主动/被动射速变体 |
| ExplosionNumericalID | `extra_modes`，通常命名为“榴弹爆炸 / 龙炎弹爆炸 / 导弹爆炸” |
| WeaponSkillDamage 技能伤害 | `extra_modes` |
| 插件/特性产生的独立伤害 | `extra_modes` |
| 被动/主动射速变化 | `extra_modes`，可与基础 mode 同 damage，仅改 `fire_interval` |

## Step 4: label 规则

| Settlement | label |
|---|---|
| WeaponDamage / MeleeWeaponDamage | 不写，默认“命中伤害” |
| WeaponExplosionDamage | `爆炸伤害` |
| WeaponSkillDamage（发射爆炸物） | `爆炸伤害` |
| WeaponSkillDamage（非爆炸） | `技能伤害` |
| DebuffDamage | `灼烧伤害` 或实际 Dot 名 |

有一说一，脚本只能根据 Settlement 给初步建议；最终 label 看技能语义。

## Step 5: 按结构类型处理

### 多火力模式型

- 霰弹主射击：`damage_modes`
- 榴弹命中、龙炎弹等切换火力模式：`damage_modes`
- 爆炸组件：`extra_modes`
- 四连发/快速连发：如果和基础模式 NumericalID 相同，放 `extra_modes`，保留完整 damage，`fire_interval` 改成技能状态下的单发耗时
- `pellets` 只在 SplinterNum > 1 时写

### 技能/插件伤害型

- 换弹切换/模式切换的主火力：`damage_modes`
- 主动技能发射物：`extra_modes`
- 分裂弹/插件弹：`extra_modes`
- 如果 WeaponSkillDamage 实际是爆炸物，`label` 写 `爆炸伤害`，不是机械套 `技能伤害`

### 动态射速型

- 单模式主射击：`damage_modes[0]`
- 被动满射速/主动增速：`extra_modes`
- 主动技能伤害体：`extra_modes`
- 动态射速的 `fire_interval = 基础 FireIntervalBase / 倍率`

## Step 6: 写入检查

写完后检查：
- `damage_label: ''` + `damage_label_text: ''`
- `damage_modes` 至少含 Mode 0 完整数据
- `extra_modes` 没有把首次出现的 PrototypeConfig 火力模式混进去；重复 NumericalID 的射速变体可以在 `extra_modes`
- `mode_names` 只覆盖非默认名字，不写冗余 `'0': 普通射击`
- 所有非持续射击/独立伤害的 `fire_interval: 0`
- `element_debuff_type_id` 保留
- 旧 flat 字段和正文不乱删

最后跑：

```bash
pnpm exec tsc --noEmit --pretty false
```
