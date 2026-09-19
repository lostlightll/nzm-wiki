# 插件主动技能变体证据

状态：active。数值入口为 `data/num-skill-variants.json`，详情仅消费 Num 技能协议解析结果。2026-09-19 按已有本地资产核验，来源构建号未知；这是静态配置及蓝图调用链审计，不是游戏内计时实测。正式与 S4 预览分别登记，不在运行时跨通道回退。狂热龙炎按本次范围明确排除。

| 插件 | 身份关系 | CD | 持续时间 | 阻回 |
| --- | --- | --- | --- | --- |
| 雷霆增幅 | 5000901 → 5104901 | 40 | 10 | 否 |
| 极寒领域 | 5103401 → 5104301 | 30 | 12 | 是 |
| 火神爆发 | 5103601 → 5104401 | 30 | 基础7，随层数延长 | 是 |
| 寒霜之怒 | 5104201 + MGE1312079001 | 30 | 12 | 否 |
| 寒霜协同 | 5104201 + MGE1312079002 | 30 | 6 | 否 |
| 闪身 | 当前武器主动 → 5000801 | 15（插件覆写） | 无持续状态 | 否 |
| 出其不意 | 当前武器主动 → 5101901 | 25 | 无持续状态 | 否 |

除闪身明确覆写外，CD 引用选定 `SkillConfigTable_Weapon_PVE[技能ID_1].ChargeNeedTime`。阻回引用同身份 `GPActiveSkillDataTable.bPauseChargeDuringActivation`。闪身和出其不意的 GP Duration=0 仅表示无持续状态，详情显示“瞬时”，不表示冲刺、投掷动画耗时为0。普通增伤、充能和技能范围强化不自动登记为技能替换。

## 身份与生效链

身份入口均为 `DataTables/LuaDataTable/WeaponModItemData.json` 的 ItemID → PassiveSkill_ID。以下路径相对于 `refs/Exports/NZM/Content/`；蓝图函数由配套本地 `.uasset/.uexp` 使用 `Convert-LocalAsset.ps1 -ReadScriptData` 原地解析到 `MD/_local/perk-skill-variants/`，不使用当前挂载中缺失的资产替代旧证据。

- **极寒领域**：20703040537 → 1312078003；`Weapon/Data/AutoGLauncher/AutoGLauncher_20003000017_null_JHBS/MGE/MGE_1312078003_JHBS` 的 ActiveSkill=5104301。`Abilities/WeaponSkill/Gold/ColdField/SKT_Coldfield` CDO AbilityDuration=12；ExecuteUbergraph StatementIndex839 调用 DoDurationForEnd，1144 将12写入 EffectZoneInitParam.Duration，1579调用 GenerateEffectZoneV2，结束路径1953销毁光环。故 GP Duration12 有独立效果执行依据。
- **火神爆发**：20703040549 → 1312074004；技能5104401。`SK_HSYDActiveSkill_2.GetSkillDuration` 的197读取 `Weapon_20106000030_6` 层数，287除以50、329向下取整、366加7。激活服务端路径180 SetBuffDurationByHandle，329 IncreaseDuration(计算值−剩余时长)，348发送激活事件。GP Duration6被动态覆写，不采用。`MGE_1312074004_HSYD.GetSkillDuration` 另用向上取整后加7，供过载Buff、RapidFever与HUD使用。Buff表 StackLimitCount=300，两条链端点为7–13秒，但中间非整50层可能相差1秒，不合并成单一公式；只展示“7S起”并保留正文条件。协议使用带依据的 literal7及 `duration_is_base: true`。
- **寒霜之怒**：20703040535 → 1312079001，仍使用5104201。`Abilities/WeaponSkill/Gold/ColdFury/SK_ColdFury` CDO BuffDuration=12，父类 `SK_StateSkillTemplate.ExecuteUbergraph` 的54写 AbilityDuration=BuffDuration，15调用 DoDurationForEnd。`MGE_510410101` 的4155添加 `Weapon_20107000038_7`（Buff表Duration12），4249添加1312079003。这是同技能效果修改，使用 modify。
- **寒霜协同**：20703040536 → 1312079002。`SK_ColdFury.K2_EventSkillUpdateData` 进入323，经延迟后90检查1312079002，158添加1312079004。`MGE_1312079004_JDYQ.SkillParameterModifiers[0]` 为 SkillID5104201、BuffDuration、Override6。`MGE_510410101` 的4595检查协同，4648给队友效果；319、3621为自身和队友添加Timer，对应 `Weapon_20107000038_5`（Duration6）。4878监听Timer消失，回调1151移除效果并清理队友效果。
- **闪身**：20703040015 → 1314102001。`Abilities/Build/CBT3/Perk02/MGE_1314102001` CDO ActiveSkill=5000801。RegiveAbility进入1771，386检查武器原技能，595取武器技能槽，1063 GiveAbilityOnSkillComponent，1122调用 ModifyChargeDurationBySlot(character,AbilitySlot,15,0)，1178保存修改句柄。卸载与武器复用通过1676 RemoveActiveGameplayEffect清除该句柄。PVE8秒不是插件装备后的CD，采用有独立执行证据的literal15。Native方法内部和两个浮点参数正式名称未展开，不冒充Native源码证明。
- **出其不意**：20703040086 → 1316132001。`Abilities/Build/CBT3/Perk04/MGE_1316132001` CDO SkillID=5101901，父类 `Abilities/Build/Common/MGE/MGE_SwitchWeaponAbility` 经对应武器槽授予该技能（ExecuteUbergraph1167）。该可见链未修改CD，采用PVE25。

Buff行位于 `DataTables/Buff/BuffConfigDatatableNew.json`。技能结束、Buff计时、技能槽充能最终交由Native执行；本次未新增运行时计时验证。

## 本地解析快照SHA-256

文件均位于 `MD/_local/perk-skill-variants/`，不随站点提交；保留哈希用于复核。

| 文件 | SHA-256 |
| --- | --- |
| SKT_Coldfield.json | e002cedec75f1995f3b19af0a890736038c771056f68297c195bbf1350eaef47 |
| MGE_1312078003_JHBS.json | 552155f451d71e28b08f64bd45cbe280127e6dd1adace9e864dc7dbc2bfc5704 |
| SK_HSYDActiveSkill_2.json | 4f018b251adf2e30b333e1ce66d08e2fea8a0df7fb36bdbcd853d8cd7b682685 |
| MGE_1312074004_HSYD.json | 685383fce9e307820cd187ceb154fdba7bc76369cb4e2460a4bfef764889eada |
| SK_ColdFury.json | 7313daa4b0dd84cd3f5f515341d1b8101cf235d109d6acac90532bba58c44014 |
| SK_StateSkillTemplate.json | 5c64191653ecd44daaea9ef7d0006d04f896313e26ce6327e51dced06afba7b0 |
| MGE_510410101.json | 14612b85f3ce9aa65ea560e9174fa717f625ee70002652bea9661545a47995b0 |
| MGE_1312079004_JDYQ.json | a3c3bd8fa17cf9534e9563b7b4fed983c375236f23bb92de7f797e1f1fcc69f0 |
| MGE_1314102001.json | 1a409a2591a5b03bd5222750b16c06449e2694f6598494b80ccf38154400cbe9 |
| MGE_1316132001.json | 2da2017172247d45795027453dc840e88a1e81350dd44ba3d39e1007df397490 |
| MGE_SwitchWeaponAbility.json | bec760903bd4aa913306cdc2fa5a0b18fda510c19b0d9a019567c23d776a4f4d |
