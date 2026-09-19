# 武器技能持续时间证据

核验于2026-09-19。本页记录静态配置、蓝图执行链与Native边界，不是新增游戏内实测。新导出来自本地游戏合并视图，具体环境与构建号未独立确认，来源登记为unknown；不得把导出日期当游戏版本。

## 能源之影

身份：Prototype20007000015 → Skill5102001 → DA_FloatingMode → SKT_FloatingMode_C。超频Item20703040185 → PassiveSkill1312049001:1 → MGE1312049001。

资产 `NZM/Content/Abilities/WeaponSkill/Gold/FloatingMode/SKT_FloatingMode.uasset`，导出JSON SHA-256 `57c1059049bfb9d547a1d68ac5d616ce157952fe74e10de92709d70fcd05f3bb`。

- CDO `Default__SKT_FloatingMode_C.Properties.Duration=20`。
- `IsWeaponHasMGE`在43查询CurrentWeapon，89判断数量大于0。
- `GetDuration`在0检查1312049001；28无MGE跳162，直接返回Duration；有MGE时42计算Duration×0.5，84加回Duration，130输出，157跳189返回。
- `K2_ActivateAbility`调用主图2215；武器检查通过后2585设置0.9秒单次定时器调用ShowHangItem（准备时间不计入有效持续时间）。ShowHangItem进入2825，执行流栈2830安排3037：GetDuration →3060写入原生GPSkillAbilityBase.AbilityDuration →3087跳788。
- 主图788创建WaitDelay(AbilityDuration)，957调用DoDurationForEnd(true,false,true)。WaitDelay回调只跳787并PopExecutionFlow，不能误称它直接结束技能。
- K2_OnEndAbility进入3671；3725跳133清理计时与挂件，444调用EndFire。

55个蓝图函数均有字节码；没有写入自身Duration的指令，唯一AbilityDuration写入为3060，没有BuffDuration引用。父类BP_ChargeableSkillBase蓝图也未发现相关覆写；原生内部未展开，不排除未知版本或原生动态覆写。PVE的BuffDuration25不能替代已确认的蓝图输入20。

## 天鹅之舞

身份：Skill5001401 → DA_CriticalArray → SKT_CriticalArray_C。资产均位于 `NZM/Content/Abilities/WeaponSkill/` 下。

- `Purple/CriticalArray/SKT_CriticalArray.uasset`：CDO FieldDuration=12；主图2088生成BP_CriticalArray，2202设置OwningAbility=self，2666完成生成。
- `Purple/CriticalArray/BP_CriticalArray.uasset`：ReceiveBeginPlay进入276、286跳10；20把OwningAbility转为SKT_CriticalArray_C，85读取FieldDuration并写入原生GPSkillSpawnableActor.ProjectileLifeSpan；248把同值传给ActivateFX。
- `BaseBP/BP_MagicArrayBase.uasset`：ActivateFX仅证明视觉时间；另有实际生命周期回调K2_OnProjectileLifeTimeOut→747调用Native父函数，757清理MGE。

已核验到原生存活时间字段及超时清理回调，因此采用蓝图12秒修正面板15秒；未证明PVE参数动态装载，不引用PVE同名字段。Native计时内部仍是边界。

| 资产 | 导出JSON SHA-256 |
| --- | --- |
| SKT_CriticalArray | e758f7888bbce0e13a625e3badfe698e9fa8549dc2ab7f09fe16d71e4846d84f |
| BP_CriticalArray | 780418a17117c0e8e3316e52fcd1fc24c79a90ac311faa8ce6f881169296251c |
| BP_MagicArrayBase | 405a0217ab7c378f515cd5eee312fca2e055a7eebceda13ceb2fba3baf5fda0b |

## 心有凌兮

身份：Skill5103901 → DA_DanceTogether → SKT_DanceTogether_C；父类是Native NZDanceTogetherSkillBase。

`NZM/Content/Abilities/WeaponSkill/Gold/DanceTogether/SKT_DanceTogether.uasset`，导出JSON SHA-256 `39cc322accaa7269dc9a50aba9bef547fd0676330e19a5f172e200e0840df4b4`。

K2_OnEndAbility进入主图4045；4069压入4270，清理状态后4270清空AddbuffHandle；4311跳3364，进入Partner循环；570构造Buff/XYLX_PassiveBuff_1，703调用NZBuffManagerLibrary.AddBuffByRowName，参数3/6均为-1，没有传27。27个函数均有字节码，没有BuffDuration读取，不能据此排除Native父类的未知行为。

从同一份本地游戏合并视图重新读取 `NZM/Content/DataTables/Buff/BuffConfigDatatableNew.uasset`，JSON SHA-256 `01428c9025d51537cc70cd2cfbf4491b6cf8d80c531a69ce02d69026fd9984dd`：XYLX_PassiveBuff_1的BuffID120800121、Duration40、DurationStr40。40描述的是跳舞结束后的增益，不是舞蹈动作长度。Native函数内部和负值参数契约未展开，因此保留40的literal及限制；不把PVE BuffDuration27当作已证值。

## 复核方式

偏移均为解析器StatementIndex，不是JSON行号。原始字节码保存在忽略的kismet快照，数值绑定只保存选定事实和证据位置，不提交原始游戏导出。使用协议文档中的audit-runtime命令校验所提供manifest的哈希、默认值、指令位置与系数；随后按本页审查控制流和Native边界。表的显示描述不是数值证据。
