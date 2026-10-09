# 当前平衡调整证据

状态：active。2026-10-09 按本机正式服补丁 `4792691`、`4810509` 更新。本文记录当前站点采用的配置及展示冲突，不把公告数值或静态执行链当作实测结果。

## 武器插件与天赋

以下路径相对于 `refs/Exports/NZM/Content/`。武器、插件继续使用现有 V2 引用；刷新 Lock 后自动解析，不在正文复制新的伤害数值。

| 项目 | 结构化来源 | 采用变化 |
| --- | --- | --- |
| 极寒领域 | `DataTables/numerical_config_composite.json#120300174_1.HpCalScale` | 0.5 → 0.6，即攻击力的50% → 60% |
| 极寒领域爆炸增伤 | `numerical_modifier_config#120300175_1_0.BaseValue` | 0.5 → 0.7；原有生效链缺口仍保留，不新增增伤索引 |
| 极寒之触 | `numerical_modifier_config#120300171_1_0.CoefValue` | 每层0.1 → 0.15，三层30% → 45% |
| 贯长虹剑气 | `DataTables/numerical_config_composite.json#120300245_1.HpCalScale` | 13 → 9；基础伤害6500 → 4500，仅此LC行变化，TD行保持原配置 |
| 静默过载 | `numerical_modifier_config#130040036_1_0.BaseValue` | 每层0.07 → 0.09，六层42% → 54% |
| 巨构投影 | `numerical_modifier_config#130040033_1_0.BaseValue` | 0.6 → 1.5 |
| 光能补弹 | `MGEPassiveMainTable#1379040240_1.MGEConfig.Id=1379040241` → `MGEConfig_Season#1379040241.Parameters[GetSpecialAmmoRatio].Value` | 0.4，即40%；不能采用该类旧CDO默认的0.2 |
| 暗能过充 | `DataTables/numerical_config_playerskill.json#160405003_1..5.HpCalScale` | 全部等级3.2 → 6，即攻击力的320% → 600% |

两张 MGE 描述表的相关行已交叉核对。S4天赋只更新这四项对应的展示描述，保留既有“技能萃光”和“灵光先兆”的隐藏冷却说明。刷新整个天赋生成器时须单独保护这些人工补充。

## 原点强化卡

`data/origin/rune-descriptions.json` 与生成的 `runes.json` 更新33项展示文案，涵盖公告中的原点调整，以及补丁中“弱点迅环”的错字修正与跑酷卡变化；以按ID的实际差异为准，不按公告条目推断资产数量。

数值索引来自已刷新 Num Modifier Lock：怒战嗜血、坚盾增伤、玻璃大炮、血转环伤、独爆增伤、超级环、超级导弹、狂弹爆炸及超级落雷均采用精确 Numerical 行。秘技返还新增 `130042640_1_0`（WeaponDamageRatio）与 `130042640_1_1`（SkillDamageRatio），两行均为B1、BaseValue=1；坚盾增爆与暴击护盾新增MaxHealth属性行。属性名、operation与方向仍由统一Resolver派生，不根据展示描述覆写。

其他参数沿结构化执行配置核验，例如 `Buff_Rogue_1378042210.Duration=10`、`Buff_Rogue_1378042690.Duration=15`、`Buff_Rogue_1378042680.StackLimitCount=10`；强化秘技CDO `CooldownDuration=20`，射击雷击与冲击导弹/雷击冲击/导弹雷击的CDO `Probability` 分别为0.05/0.2/0.3/0.2，不动明王CDO `Start Time=1`、`Loop Time=1`。

### 怒战濒死冲突

公告、原点表及Buff展示描述写攻击力+300%，但身份链仍为：`MGEPassiveMainTable#1378042250_1` → `MGE_1378042250` → `Buff_Rogue_130042250.GPModifyIDs=[130042250]` → `lc:130042250_1_0`。Numerical的BaseValue=2、CoefValue=0、GPModifierOp=B5，未更新为3。

从补丁 `4792691` 选定 `.uasset/.uexp` 原地转换得到的 `ExecuteUbergraph_MGE_1378042250`，StatementIndex409以等级1、1层添加上述Buff；652的Delay为4秒，Buff.Duration也为4。可见链没有支持300%的动态覆写；Native内部未展开。文案采用Num模板得到200%，不推导B5的最终伤害因子。`data/origin/rune-description-reviews.json` 固定审定源文案与表达式，源文案变化会阻止自动沿用修正。

CD120秒暂沿用展示记录；CDO中的CooldownDuration=60尚未证明为实际生效冷却，不能直接替换。该冲突可复核输入为 `MD/_local/balance-20261009/MGE_1378042250.json`，不是游戏内实测。

## 超限快照边界

本次对当前177张超限卡的所有已审定 `selected` Numerical行逐项比较，未发现行内容变化；保持其独立发布快照。超限原表哈希审计仍因共享表与本地图标文件字节变化失败，不能把离线投影检查通过称为原表审计通过，也不能仅重写来源哈希掩盖证据漂移。后续超限更新应按现有审定与激活流程单独完成。

### 致命爆炸独立伤害补充

2026-10-09单独复核Item20703040437→Passive1316200001_1→MGE1316200001。当前CDO为Probability=0.05、CooldownDuration=0.1、AOEInterval=0.2；MGEConfig_Common、MGEConfig_Season及DT_MGEParamConfig_Main未找到该ID的参数覆写行。原表与选定执行资产哈希、单次结算原始行保存在 `scripts/overlimit/fatal-explosion-evidence.json`，不重写其他卡片的来源哈希。

本地 `.uasset/.uexp` 转换得到的 `ExecuteUbergraph_MGE_1316200001`：OnMakeDamage事件进入1115检查冷却，1226读取Probability，概率通过后跳至15，93调用CommitModularGameplayEffectCooldown，560调用DoNZAOEAction并传入AOE1316200001、Numerical130103014。AOE完成回调进入1270，经1324 Delay(AOEInterval)与1100 RetriggerAOE回到按StackCount处理的循环。0.2秒是堆叠爆炸重触发延迟，不能替代0.1秒配置冷却，也不能据此推导总爆炸频率。Native冷却和AOE内部未展开，未进行游戏内实测。

`NZAOEGlobalConfigTable#1316200001.AOERadius=800`，按UE厘米单位为8米。`numerical_config_composite#130103014_1` 为SkillDamage、HpCalScale=10、HpCalBase=0、ToughnessBase=10、Kinetic、允许暴击、禁止弱点，基础攻击力500时单次伤害为5000。纠正普通插件与触发伤害文章中的2秒、10米旧记录，将生成的独立伤害加入当前超限投影；卡片既有摘要与其他卡片内容保持原样。此补充不代表整份超限来源审计已通过。

复核与候选生成：

```powershell
pwsh -NoProfile -File .agents/skills/nzm-uasset/scripts/Convert-LocalAsset.ps1 -AssetPath refs/Exports/NZM/Content/Abilities/Build/CBT3/Perk02/MGE_1316200001.uasset -OutputPath MD/_local/nzm-uasset/fatal-explosion-20261009/MGE_1316200001.json -ReadScriptData
pnpm exec tsx scripts/overlimit/project-fatal-explosion.ts --content-root refs/Exports/NZM/Content --bytecode MD/_local/nzm-uasset/fatal-explosion-20261009/MGE_1316200001.json --output-directory MD/_local/overlimit/candidates/fatal-explosion-20261009
```

转换拒绝覆盖已有证据，复核时可直接使用已保存的JSON。候选先按超限维护流程check，再把生成的独立审定证据写到上述 `scripts/overlimit/` 路径，并用候选的 `review.json` 激活；执行资产或解析快照哈希改变时，生成器要求重新审定。

本项补充验证：独立伤害测试16/16、超限卡测试25/25、改动代码ESLint、TypeScript、超限投影与Weapon/Num Modifier数据检查均通过。测试中极寒领域的正式服旧预期同步为60%/300，保留冻结快照与覆写隔离检查。两次生产构建均在临时重命名 `app/api` 时遇到Windows文件占用（EPERM），尚未进入Next.js编译；路由目录完整保留，本项完整生产构建未验证。

## 平衡补丁同步验证

生产构建通过，生成1357个静态页面，构建临时隐藏的路由均已恢复。25项定向测试、25项超限卡测试、改动代码的ESLint、TypeScript及Numerical/原点/乘区索引投影检查通过。

扩大到武器与技能测试时发现两项测试仍依赖已停用的 `s4-preview` 通道，随后按用户要求删除这两项过期测试，保留模拟数据的通道隔离检查。重新运行 `pnpm test:num-skills`，143项全部通过；改动测试文件的ESLint通过。通道配置未修改。`multiplier-providers:audit` 仍报告极寒领域已有的生效链缺口（`perk:20703040537` / `120300175`）；保持排除记录，未将该审计标记为通过。`overlimit-effects:audit` 的来源哈希失败见上文。
