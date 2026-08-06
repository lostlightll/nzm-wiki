# 武器主动技能基础充能链路

> 状态：active
> 实现：`scripts/weapon-data/skill-charge.ts`、`lib/weapon-resolver.ts`

本文只定义猎场武器主动技能的基础充能时间和层数，不包含技能持续时间、阻回、击杀充能或全局冷却缩减。

## 来源优先级

```text
MDX.active_skill_id
  ↓ 与 WeaponPrototypeConfig.ActiveSkillID 审计
SkillConfigTable_Weapon_PVE["{ActiveSkillID}_1"]
  ↓ PVE 缺行时
GPActiveSkillDataTable[ActiveSkillID]
  ↓ 两处都缺失
报错
```

- PVE 行存在时使用 `ChargeNeedTime` 和 `SkillCount`。
- 只有 PVE 缺行时才使用 GP 的 `CooldownDuration` 和 `MaxChargeStackCount`。
- PVE 与 GP 数值不同不是 fallback 条件；PVE 仍然优先。
- 当前只支持 Level 1，`skillId` 必须是正安全整数。
- 当前 Schema 没有技能充能人工 override；两处来源都缺失时必须失败。

## 字段语义

- `ChargeNeedTime` / `CooldownDuration`：充满一层技能所需的基础时间。
- `SkillCount` / `MaxChargeStackCount`：可积累层数。
- `Duration`、`EffectDuration`：效果持续时间，不能加到基础充能时间。
- `bPauseChargeDuringActivation`：技能生效期间是否暂停充能。
- `KillChargeValue`、`AssistChargeValue`：额外充能机制。

后四类数据不属于本链路，不得压缩进 `chargeTime`。

## 技能身份审计

`WeaponPrototypeConfig.ActiveSkillID` 是战斗技能身份的主来源。`WeaponItemConfigTable.Active_Skill_Detail` 只作辅助校验，不能覆盖 Prototype：

- MDX 与 Prototype 不一致：`MDX_PROTOTYPE_SKILL_MISMATCH`，error。
- Item 缺失或非法：记录 info/warning，不自动补值。
- Item 与 Prototype 不一致：`ITEM_PROTOTYPE_SKILL_MISMATCH`，warning。
- 没有显式 `item_id` 时可以按 `ModelID` 返回候选；多候选必须报告歧义，不能任选。

## 公共接口

```ts
resolveActiveSkillCharge(reader, { skillId, level: 1 });

auditActiveSkillReference(reader, {
  prototypeId,
  mdxActiveSkillId,
  prototypeRowName,
  itemId,
});
```

`resolveActiveSkillCharge()` 返回：

- `skillId`、`level`
- `chargeTime`、`chargeCount`
- `source`：`weapon_pve` 或 `gp_fallback`
- `sourceKey`
- 完整原始 `row`

错误契约包括非法技能引用、不支持的等级、缺失来源和非法时间/层数值；不得静默使用默认值。

## Lock 与 Resolver

- Weapon Data Lock 保存已选择的 PVE/GP 来源及完整原始行。
- Resolver 从 Lock 解析 `ResolvedActiveSkill.chargeTime` 和 `chargeCount`，普通构建不读取 `refs/`。
- 页面与正文 `<ActiveSkill>` 统一消费 Resolver 结果；迁移期正文属性只作为展示兼容，不能覆盖标准化结果。
- 顶层 `skill_cooldown` 和正文重复 CD 的物理删除属于 [`../plans/weapon-v2-cleanup.md`](../plans/weapon-v2-cleanup.md)。

## 验证

```text
pnpm test:weapon-data-reader
pnpm test:weapon-skill-charge
pnpm test:weapon-data-lock
pnpm test:weapon-resolver
pnpm weapon-data:check
```
