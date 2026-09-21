# 武器技能持续时间证据

能源之影、天鹅之舞于2026-09-22重新核验为S4正式服来源（`live`）；原地挂载时排除已确认的旧赛季残留容器 `P_1.0.50.485.0_Patch_Season_4261608_P.pak`。本页记录静态配置、蓝图执行链与Native边界，不是新增游戏内实测。此次快照为 `kismet/live/20260921T220434Z-0d41954469724f20b2d4aa3e4e864659/manifest.json`，包含两项绑定涉及的3个资产及2个必要父类；时间只代表导出时间，不代表游戏构建号。心有凌兮仍保留2026-09-19的unknown来源历史证据，未作为此次runtime绑定重新发布。

## 能源之影

身份：Prototype20007000015 → Skill5102001 → DA_FloatingMode → SKT_FloatingMode_C。超频Item20703040185 → PassiveSkill1312049001:1 → MGE1312049001。

资产 `NZM/Content/Abilities/WeaponSkill/Gold/FloatingMode/SKT_FloatingMode.uasset`，导出JSON SHA-256 `9caedf56e3289c8366b436060fceeee4c97d44227fba9f6dbc4c1ecd69fb6d2e`。

- CDO `Default__SKT_FloatingMode_C.Properties.Duration=20`。
- `IsWeaponHasMGE`在43查询CurrentWeapon，89判断数量大于0。
- `GetDuration`在0检查1312049001；28无MGE跳162，直接返回Duration；有MGE时42计算Duration×0.5，84加回Duration，130输出，157跳189返回。
- `K2_ActivateAbility`调用主图2209；武器检查通过后2579设置0.9秒单次定时器调用ShowHangItem（准备时间不计入有效持续时间）。ShowHangItem进入2819，执行流栈2824安排3031：GetDuration →3054写入原生GPSkillAbilityBase.AbilityDuration →3081跳782。
- 主图782创建WaitDelay(AbilityDuration)，951调用DoDurationForEnd(true,false,true)。WaitDelay回调只跳781并PopExecutionFlow，不能误称它直接结束技能。
- K2_OnEndAbility进入3661；3715跳131清理计时与挂件，442调用EndFire。

55个蓝图函数均有字节码；没有写入自身Duration的指令，唯一AbilityDuration写入为3054，没有BuffDuration引用。父类BP_ChargeableSkillBase蓝图也未发现相关覆写，其42个函数字节码与旧证据完全相同（JSON SHA-256 `cc30d4add3d2ba6528a8cc628f292985c86cabcf7441ed97c0e46c88a7e83741`）。原生内部未展开，不排除未知版本或原生动态覆写。PVE的BuffDuration25不能替代已确认的蓝图输入20。

S4重核时，GetDuration与IsWeaponHasMGE完整函数未变化；主图316条指令的分支、执行流栈目标及事件包装入口逐一按目标指令身份对齐，持续时间的读取、赋值与结束调用保持相同数据流。其他差异包括DynamicDataObserver调用参数数量、属性变更通知结构及AbilityTags改为FloatingMode；这些差异使偏移变化，不能把旧957位置直接沿用，也不能据此宣称整项技能行为完全未变。

## 天鹅之舞

身份：Skill5001401 → DA_CriticalArray → SKT_CriticalArray_C。资产均位于 `NZM/Content/Abilities/WeaponSkill/` 下。

- `Purple/CriticalArray/SKT_CriticalArray.uasset`：CDO FieldDuration=12；主图2093生成BP_CriticalArray，2207设置OwningAbility=self，2671完成生成。
- `Purple/CriticalArray/BP_CriticalArray.uasset`：ReceiveBeginPlay进入276、286跳10；20把OwningAbility转为SKT_CriticalArray_C，85读取FieldDuration并写入原生GPSkillSpawnableActor.ProjectileLifeSpan；248把同值传给ActivateFX。
- `BaseBP/BP_MagicArrayBase.uasset`：ActivateFX仅证明视觉时间；另有实际生命周期回调K2_OnProjectileLifeTimeOut→747调用Native父函数，757清理MGE。

已核验到原生存活时间字段及超时清理回调，因此采用蓝图12秒修正面板15秒；未证明PVE参数动态装载，不引用PVE同名字段。Native计时内部仍是边界。

S4重核时，SKT主图89条指令的分支目标与事件入口保持对应；Montage调用新增一个0.0参数使后续偏移增加5，生成、OwningAbility赋值与完成生成链不变。BP_CriticalArray（2个函数）和BP_MagicArrayBase（6个函数）的完整JSON与旧证据相同，默认值12及超时清理链继续成立。

| 资产 | 导出JSON SHA-256 |
| --- | --- |
| SKT_CriticalArray | 48073bcb0e95ae496c11b6a5865081c70e4d95df15d1e15268ef8a078113b269 |
| BP_CriticalArray | 780418a17117c0e8e3316e52fcd1fc24c79a90ac311faa8ce6f881169296251c |
| BP_MagicArrayBase | 405a0217ab7c378f515cd5eee312fca2e055a7eebceda13ceb2fba3baf5fda0b |

## 心有凌兮

身份：Skill5103901 → DA_DanceTogether → SKT_DanceTogether_C；父类是Native NZDanceTogetherSkillBase。

`NZM/Content/Abilities/WeaponSkill/Gold/DanceTogether/SKT_DanceTogether.uasset`，导出JSON SHA-256 `39cc322accaa7269dc9a50aba9bef547fd0676330e19a5f172e200e0840df4b4`。

K2_OnEndAbility进入主图4045；4069压入4270，清理状态后4270清空AddbuffHandle；4311跳3364，进入Partner循环；570构造Buff/XYLX_PassiveBuff_1，703调用NZBuffManagerLibrary.AddBuffByRowName，参数3/6均为-1，没有传27。27个函数均有字节码，没有BuffDuration读取，不能据此排除Native父类的未知行为。

从同一份本地游戏合并视图重新读取 `NZM/Content/DataTables/Buff/BuffConfigDatatableNew.uasset`，JSON SHA-256 `01428c9025d51537cc70cd2cfbf4491b6cf8d80c531a69ce02d69026fd9984dd`：XYLX_PassiveBuff_1的BuffID120800121、Duration40、DurationStr40。40描述的是跳舞结束后的增益，不是舞蹈动作长度。Native函数内部和负值参数契约未展开，因此保留40的literal及限制；不把PVE BuffDuration27当作已证值。

## 复核方式

偏移均为解析器StatementIndex，不是JSON行号。原始字节码保存在忽略的kismet快照，数值绑定只保存选定事实和证据位置，不提交原始游戏导出。使用协议文档中的audit-runtime命令校验所提供manifest的哈希、默认值、指令位置与系数；随后按本页审查控制流和Native边界。表的显示描述不是数值证据。
