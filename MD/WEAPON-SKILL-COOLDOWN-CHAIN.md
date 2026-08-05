# 武器技能冷却数据链路

> 状态：Task 2.5 已实现
> 日期：2026-08-05
> 范围：猎场武器主动技能的基础充能时间，不包含技能持续时间、阻回、击杀充能和全局冷却缩减。

## 1. 结论

武器技能 CD 没有多套并列的常规链路。当前可用规则是：

```text
MDX.prototype_id
  ↓
WeaponPrototypeConfig.ActiveSkillID
  ↓
SkillConfigTable_Weapon_PVE["{ActiveSkillID}_1"].ChargeNeedTime
  ↓ PVE 表没有该行
GPActiveSkillDataTable[ActiveSkillID].CooldownDuration
  ↓ 两张表都缺失
Task 2.5 明确报错；未来 Resolver 才允许带原因的人工 override
```

字段优先级：

```text
PVE ChargeNeedTime
  > GP CooldownDuration（仅限 PVE 缺行）
  > 人工 override
```

`GPActiveSkillDataTable.CooldownDuration` 不能作为常规首选。大量武器的 GP 值是通用值、旧值或其他模式值，与猎场实际充能时间不同。

## 2. 技能 ID 的确定

### 2.1 主来源

通过武器的 `prototype_id` 查询：

```text
DataTables/WeaponPrototypeConfig.json
```

取主模式记录：

```text
Mode = 0
ActiveSkillID
```

该 ID 是 CD 查询的默认技能 ID。

### 2.2 辅助校验

可以使用以下字段交叉检查：

```text
LuaDataTable/WeaponItemConfigTable.json
  Active_Skill_Detail

Ability/SkillDesConfig_Skill.json
  SkillName
  SkillDescription

GPSkillIconResourceDataTable.json
  ActiveIcon
```

`WeaponItemConfigTable.Active_Skill_Detail` 偏向物品展示和技能描述索引，不能覆盖 Prototype 的战斗技能 ID。

钢铁轰鸣就是反例：

```text
Prototype ActiveSkillID = 5101601
PVE ChargeNeedTime = 50

Item Active_Skill_Detail = 5101901
PVE ChargeNeedTime = 25
```

游戏内确认钢铁轰鸣为 `50s`，因此应使用 Prototype 的 `5101601`。Item 的 `5101901` 不能用于 CD。

## 3. 冷却字段的含义

### 3.1 ChargeNeedTime

来源：

```text
DataTables/SkillConfigTable_Weapon_PVE.json
```

查询 key：

```text
{ActiveSkillID}_{Level}
```

当前武器一般使用 Level 1：

```text
5100101_1
```

`ChargeNeedTime` 表示猎场模式下充满一层技能所需的基础时间，是 Wiki 应显示的“技能冷却”主值。

### 3.2 CooldownDuration

来源：

```text
DataTables/GPActiveSkillDataTable.json
```

它提供 Ability 的通用冷却配置，但不保证等于猎场实际充能时间。只有 PVE SkillConfig 缺少对应行时，才将其作为 fallback。

### 3.3 不能混入 CD 的字段

以下字段应独立保存和解释：

- `SkillCount`：技能可积累层数。
- `Duration`：技能持续时间。
- `Parameters` 中带 `EffectDuration` 等 Tag 的参数：具体效果持续时间。
- `bPauseChargeDuringActivation`：技能生效期间是否暂停充能。
- `KillChargeValue`、`AssistChargeValue`：击杀和助攻充能。
- `MaxChargeStackCount`：GP 层面的最大层数。

页面显示的基础 CD 不应直接加上 `Duration`。如果需要计算“释放后最早再次可用时间”，应由独立的技能生命周期模型处理。

## 4. 当前样本验证

使用当前 59 把具有数字型 `skill_cooldown` 的 LC 武器进行交叉验证：

- 55 把可由 `WeaponPrototypeConfig.ActiveSkillID → SkillConfigTable_Weapon_PVE.ChargeNeedTime` 直接得到。
- 4 把在 PVE 表缺少对应行，使用 GP fallback。
- 现有 MDX 有 3 处技能 ID 差异和 2 处手填 CD 差异，均由审计测试固定报告，本任务不自动修改。

### PVE 缺行的四把武器

| 武器 | ActiveSkillID | PVE 行 | GP CooldownDuration | 结论 |
| :--- | :---: | :---: | :---: | :--- |
| 春雷震 | `5003101` | 缺失 | `0` | 立即引爆类技能，无常规 CD |
| 鬼铜蚀 | `5102501` | 缺失 | `0` | 武器控制/形态类技能，无常规 CD |
| 振弦 | `5004901` | 缺失 | `30` | 使用 GP fallback，CD 为 30s |
| 火神炎帝 | `5103601` | 缺失 | `0` | 来源值为 0；当前 MDX 手填 45，保留为待核验差异 |

## 5. 已知 Wiki 数据问题

### 5.1 暗夜之殇

正确链路：

```text
prototype_id = 20007000004
ActiveSkillID = 5100101
SkillConfigTable_Weapon_PVE["5100101_1"].ChargeNeedTime = 45
```

当前 MDX 存在三处不一致：

```text
active_skill_id: 0
skill_cooldown: 30
<ActiveSkill cooldown={-1}>
```

正确值应为：

```text
active_skill_id = 5100101
skill cooldown = 45s
```

GP 中同技能的 `CooldownDuration = 35`，不应采用。

### 5.2 振弦

正确链路：

```text
prototype_id = 20012000002
ActiveSkillID = 5004901
PVE 行缺失
GP CooldownDuration = 30
```

当前 MDX 的 `active_skill_id: 5004501` 是错误 ID。`5004501` 实际属于爆星，在 PVE 表中的 `ChargeNeedTime` 为 50s。

Git 历史显示：

- 2026-02-02：振弦只有手填 `skill_cooldown: 40`，没有技能 ID。
- 2026-02-18：提交 `ec73e64f` 手工加入错误的 `active_skill_id: 5004501`。
- 2026-05-30：提交 `9e8ed698` 将 CD 从 40 修正为 30，但没有同步修正技能 ID。

因此振弦属于“CD 数值正确、来源 ID 错误”，不是另一套 CD 链路。

### 5.3 炼狱蝎王

当前 MDX：

```text
active_skill_id = 5102701
skill_cooldown = 30
```

当前 Prototype 和 Item 均指向：

```text
active_skill_id = 5104101
PVE ChargeNeedTime = 30
```

CD 数值正确，但技能 ID 已过期。

### 5.4 钢铁轰鸣

最终确认：

```text
ActiveSkillID = 5101601
PVE ChargeNeedTime = 50
```

Wiki 当前的 50s 正确。不要使用 Item 表的 `5101901 → 25s`。

### 5.5 火神炎帝

当前链路为：

```text
ActiveSkillID = 5103601
PVE 行缺失
GP CooldownDuration = 0
```

当前 MDX 手填 `skill_cooldown: 45`。Task 2.5 只将其固定为来源差异，不修改页面数据；后续迁移必须先确认 GP 的 0 是否能代表该技能的真实猎场充能语义。

## 6. Wiki 当前的重复存储

当前 Wiki 没有在构建时自动查询上述链路，而是保存了两份互相独立的 CD：

```text
frontmatter.skill_cooldown
  → lib/weapons.ts
  → WeaponCard

<ActiveSkill cooldown={...}>
  → components/WeaponSkill.tsx
  → 正文技能卡片
```

这两份数据不会自动同步。暗夜之殇已经出现 frontmatter 为 30、正文为 -1 的情况。

短期至少需要一致性检查；长期应由 Resolver 只解析一次 CD，页面和技能组件共同消费标准化结果。

## 7. 推荐的 V2 数据结构

MDX 只保存稳定技能引用：

```yaml
active_skill:
  id: 5100101
  level: 1
```

正常武器不再手填 `skill_cooldown`。Resolver 根据 `id + level` 查询 PVE Lock：

```yaml
resolved_active_skill:
  id: 5100101
  level: 1
  charge_time: 45
  charge_count: 1
  source:
    table: weapon_pve
    key: 5100101_1
```

只有原表无法表达且已经实测确认时才允许覆盖：

```yaml
active_skill:
  id: 1234567
  level: 1
  overrides:
    charge_time: 30
  override_reason: 游戏内实测；PVE 与 GP 均缺少有效配置
```

## 8. Resolver 规则

伪代码：

```ts
function resolveSkillChargeTime(skillId: number, level = 1) {
  const pve = weaponPveSkillLock[`${skillId}_${level}`];
  if (pve) {
    return {
      value: pve.ChargeNeedTime,
      source: "weapon_pve",
    };
  }

  const gp = gpActiveSkillLock[String(skillId)];
  if (gp) {
    return {
      value: gp.CooldownDuration,
      source: "gp_fallback",
    };
  }

  throw new Error(`Missing cooldown data for active skill ${skillId}_${level}`);
}
```

校验器还应报告：

- MDX `active_skill.id` 与 Prototype `ActiveSkillID` 不一致。
- Item `Active_Skill_Detail` 与 Prototype 不一致，但不自动覆盖。
- PVE 行缺失并使用 GP fallback。
- PVE 与 GP 都缺失。
- PVE 与 GP 数值不同，供调查但不视为错误。
- frontmatter 与 `<ActiveSkill cooldown>` 在迁移阶段不一致。
- `ChargeNeedTime = 0`，要求确认它是无 CD 技能而非缺省值。

### 8.1 Task 2.5 已实现接口

`scripts/weapon-data/skill-charge.ts` 提供：

```ts
resolveActiveSkillCharge(reader, { skillId, level: 1 });
auditActiveSkillReference(reader, {
  prototypeId,
  mdxActiveSkillId,
  prototypeRowName,
  itemId,
});
```

解析结果使用 `chargeTime`、`chargeCount`、`source`、`sourceKey` 和完整原始 `row`。Task 2.5 只支持 Level 1；`skillId: 0` 只能参与迁移审计，不能作为可解析引用。

审计固定报告当前三处技能 ID 差异：振弦、暗夜之殇、炼狱蝎王。Item 没有显式 `item_id` 时只按 `ModelID` 返回辅助候选；多候选不得任选。

## 9. 后续实施建议

1. Task 3 将被引用的 PVE / GP 完整行纳入 Weapon Data Lock。
2. Task 4 从 Lock 接入已固定的 PVE 优先、GP fallback 规则。
3. 核验并修正暗夜之殇、振弦、炼狱蝎王和火神炎帝的差异。
4. 迁移页面消费者后删除手填 `skill_cooldown`。
5. 让 `<ActiveSkill>` 从统一数据源取得冷却，删除正文里的重复数值。
6. 另立任务研究技能持续时间、阻回、层数和击杀充能，不与基础 CD 迁移混做。
