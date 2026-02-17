用户会提供一个或多个塔防陷阱名称: $ARGUMENTS

## 流程

对于每个陷阱名称，执行以下步骤：

### 1. 查找陷阱配置表数据

在 `refs/Exports/NZM/Content/DataTables/TowerDefense/TowerDefenseTrapParamTable.json` 中搜索陷阱名称（如"天网"），获取：
- FriendlyName（友好名称）
- Description（描述）
- CoinCost（建造费用）
- TrapParamKey（如 `TD_TrapSkyNet_170`）
- PlaceTypeRestrict（放置类型：WALL/CEILING/GROUND）
- ConfigGridNum（占地格数）
- bAllowRotation（是否允许旋转）
- TrapUpgrades（升级分支）
- TrapAttackRangePreview（攻击范围预览）
- CanUseMainLevelWhiteList（可用关卡列表）

如果找不到，告知用户并跳过。

### 2. 查找等级配置数据

从 TrapParamKey 提取 TowerKey（如 `TD_TrapSkyNet_170` → 推断 TowerKey 可能是 `TD_SkyNet` 或类似）。

在 `refs/Exports/NZM/Content/DataTables/TowerDefense/TowerDefenseTowerLevelConfig.json` 中搜索 TowerKey，获取各等级的：
- SpellPower（技能攻击力）
- MaxHealth（生命值）

### 3. 查找蓝图数据

在 `refs/Exports/NZM/Content/AIBehavior/ZhanQiBehavior/` 下搜索与陷阱相关的目录。目录名格式通常为 `<NPCAttributeID>_<InternalName>/`。

可以通过以下方式定位：
- 在 TrapParamTable 中找到 TrapSpawnPresetData 的 AssetPathName
- 或直接在 ZhanQiBehavior 目录下搜索陷阱相关关键词

#### 3.1 角色蓝图 (BP_AIChar_*.json)

搜索并提取：
- NPCAttributeID
- TrapParamKey
- TowerKey
- LevelHealthScale（各等级生命缩放）
- CDConfig（冷却配置）
- ChargeTime（蓄力时间）
- AnimType（动画类型）
- TowerConfigs（各等级配置）
- 各种 BoxExtent / SphereRadius（碰撞和检测范围）
- NPCSize（怪物体型）

#### 3.2 技能蓝图 (Ability/GA_*.json)

搜索 Ability 目录下的技能文件，提取：
- GEConfigs / LevelEffects（各等级伤害/效果配置）
  - GPEffect（游戏效果类型）
  - Duration（持续时间）
  - SetByCallerTagValues（如 SpeedScale 减速值）
  - SkillId
- AreaShape（攻击范围形状：Box/Sphere）
- AreaHalfSize（攻击范围半尺寸）
- CD（攻击间隔）
- AttackDuration（攻击持续时间）
- TraceInterval（检测间隔）
- 特殊技能（如 AOE 爆炸）：
  - CDTime（冷却时间）
  - AOEDamageRatio（AOE 伤害倍率）

### 4. 整理输出

将所有数据整理为结构化的分析报告，包含：

1. **基础属性表**：ID、名称、放置位置、建造费用、生命值、占地面积等
2. **各等级数据表**：技能攻击力、生命值、特殊效果（不需要输出升级费用）
3. **攻击机制**：攻击间隔、范围、持续时间、特殊效果（减速/灼烧等）
4. **特殊技能**：AOE、成对机制等
5. **碰撞/检测范围**：各 BoxExtent/SphereRadius 组件
6. **源数据引用**：关键 ID 和蓝图路径

### 5. 缺失数据提示

如果以下关键文件未找到，明确告知用户：
- TrapParamTable 中找不到该陷阱 → "在配置表中未找到该陷阱"
- TowerLevelConfig 中找不到等级数据 → "未找到等级配置，TowerKey 可能不同"
- ZhanQiBehavior 下找不到蓝图目录 → "未找到蓝图文件，请确认内部名称"
- Ability 目录下无技能文件 → "未找到技能数据文件"

列出所有找到和未找到的文件路径，让用户确认。
