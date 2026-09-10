# 塔防陷阱详情维护

适用于 `data/traps/*.mdx`，包括等级数值、机制、攻击周期及实测对照。正文由 MDX 维护，页面运行时不读取游戏导出。

## 数据口径

- 正式服来源为 `refs/Exports/NZM/Content/`，只读。欢乐防线的 `JoyTowerDefense`、`JTD` 技能不能混入普通塔防。
- 本次发布基准为《未来测评.xlsx》的 **陷阱数据** 工作表。按用户最新要求，表内价格、伤害、耐久、间隔及机制记录优先于 refs；未使用其他工作表。在来源注释中记录具体单元格，文件所在个人目录不写入共享代码和文档。
- 等级攻击力不自动等于单次伤害。必须检查伤害结算系数、固定值、调用次数、临时修正、持续伤害及目标过滤。
- refs 用于补充工作表未覆盖且不冲突的机制、摆放面及属性。表格与 refs 冲突时采用表格，配置差异可留在来源注释中，不以缺失原生实现为由阻止发布表格数据。此口径仅适用于本次陷阱页面，不改变武器或插件的 Numerical 规则。
- 配置、实测记录、公式假设分别说明。表格公式采用的分母不等于独立实测周期；不能为了得到某个 DPS 随意增加后摇或隐藏增伤。
- 普通等级表不叠加科技和词缀。计算带增益结果时，先检查实测输入是否已经包含增益，防止重复计入。

## 身份与结算链

1. `DataTables/TowerDefense/TowerDefenseIDToParamKeyTable.json`：TowerId → 参数行。
2. `TowerDefenseTrapParamTable.json`：参数行 → 建造价格、摆放面、TrapSpawnPresetData。
3. `AIBehavior/ZhanQiBehavior/EnemyPreset/`：生成预设 → AICharacterClass。
4. 角色默认对象的 `TowerKey` → `TowerDefenseTowerLevelConfig.json` 对应四级的 SpellPower、MaxHealth。
5. 角色技能、父类、弹体事件 → 实际调用的 SettlementID、ModifierID、Buff 名称。
6. `DataTables/numerical_config_monsterskill.json`、`Attributes/AutoGenerate/numerical_modifier_config.json` 和 Buff 表 → 结算系数及修正。
7. 技能执行链、动画通知、周期定时器、过滤和结束回调 → 命中次数、持续伤害刷新及完整周期。

名称不等于身份。例如火墙对应源表“火焰发射器”，地刺对应“突刺陷阱”；激光箭与浮游雷的资源目录都出现 `17727031`，必须结合角色的 TowerKey 区分。

## 可重复提取

基础映射与候选属性：

```powershell
python scripts/audit-trap-sources.py --output MD/_local/trap-audit/refs-identities.json
```

脚本仅输出候选证据，不生成或覆盖 MDX。目录下的技能可能包含皮肤、欢乐防线变体或不执行的默认字段；出现某个引用不代表运行时一定使用它。遗漏字段也可能从父类继承，不能当成零。

需要执行顺序时，使用已安装的 FModel CLI 程序集读取蓝图字节码：

```powershell
& scripts/inspect-nzm-bytecode.ps1 -Assets @(
  'NZM/Content/AIBehavior/ZhanQiBehavior/17708031_DestroyerTurret/Ability/GA_DestoryerTurrent_Shoot.uasset'
)
python scripts/summarize-nzm-bytecode.py '<返回的 JSON 路径>' --function ExecuteUbergraph
```

该脚本需要兼容现有 .NET 程序集的 PowerShell 环境和本地 FModel 游戏配置，支持 `-AssemblyPath`、`-ProfilePath`。不构建或修改 FModel，不打印或保存凭据，输出固定进入被忽略的 `MD/_local/nzm-bytecode/`。

新增导出必须核对相关默认值与 refs 是否一致，再用于补足原有证据。字节码摘要保留语句偏移，但不是完整反编译器；分支跳转、回调入口和函数参数需结合原始 JSON 确认。原生 C++ 函数没有蓝图实现时，明确记录该函数边界，不能把“已读字节码”等同于“所有机制已还原”。

## 已核实的计算示例

- 破坏者：等级攻击力 × 结算系数 1 × 同位置两次 AOE。两次调用由执行流确认，而非把 Numerical 系数改成 2。
- 歼灭者：沿 −245、0、+245 三个落点循环结算，三次均命中才计算三份伤害。
- 自修复磁暴塔：父类每 0.5 秒按最大耐久 3% 恢复，持续速率为 6%/秒；启动时还有立即结算。
- 火墙：调用 AddBuffByName 时将持续时间覆盖为 2 秒，不能只读取 Buff 表的默认 4 秒。
- 高能激光：三发射点独立检测；完整循环包含等级冷却、3 秒蓄力和正反扫描动画。每束实际命中数仍受位置及边界计时影响。
- 智能枪塔：170000014—170000017 修正链得到 85% / 100% / 120% / 150%；当前页面按指定工作表发布 85% / 100% / 120% / 145%，配置值仅作来源对照。

各页末尾的 MDX 注释记录具体单元格和补充配置来源。正文优先呈现玩家需要的伤害、周期与使用方式，不堆叠取证过程。原表自带的存疑、缺失值及公式假设应简短说明；DPS 可按表内伤害和周期推算，但不能冒充新增实测，也不能凭空补出表中没有的最高倍率或恢复调度。

## 验证

纯内容修改应解析所有受影响 MDX，使用与 `lib/mdx-options.ts` 相同的 GFM、数学公式和 KaTeX 插件，检查 frontmatter、等级表与算术。涉及全部陷阱时，检查全部 28 页，而不是仅编译一个示例。

检查详情页实际返回和渲染结果，并在 PC 与手机视口确认表格横向滚动、正文和属性卡无明显溢出。最后执行 `git diff --check`。只有路由、MDX 加载或生产构建流程改变时，才按项目验证策略追加生产构建。
