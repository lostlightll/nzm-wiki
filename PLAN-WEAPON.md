# 武器数据管线改造

## 已完成

### 类型系统 (`types/index.ts`)

新增三个类型：

- **`DamageMode`** — 射击模式（普通/技能/技能改造后），含伤害、元素、射速、破韧等完整属性，额外字段 `damageLabel` 支持伤害标签自定义
- **`WeaponChangeClip`** — 换弹时间（timeBase + endToFireTime）
- **`Weapon`** — 重构为 `damageModes[]` + `changeClip` + `extraModes[]` 结构，旧 flat 字段废弃

### 数据管线 (`lib/weapon-data.ts`)

4 个懒加载缓存 loader，首次访问读 JSON，后续命中缓存：

| Loader | 数据源 | 索引键 |
|:---|:---|:---|
| `loadPrototypeConfig()` | WeaponPrototypeConfig.json | 武器中文名 / PrototypeID |
| `loadASC()` | attr_weapon_asc.json | ASCTypeID |
| `loadFeelParam()` | WeaponFeelParamTable.json | WeaponFeelParamID (= ASCTypeID) |
| `loadNumericalConfig()` | numerical_config_composite.json → equip/playerskill 回退 | `{NumericalID}_{Level}` |

查询链路：
```
武器名 (中文)
    │
    ▼
WeaponPrototypeConfig ──→ ASCTypeID ──→ attr_weapon_asc ──→ FireIntervalBase
    │                  │                │                     ClipAmmoCountBase
    │                  │                │                     MaxAmmoCount
    │                  │                │                     SplinterNum
    │                  │                │
    │                  │                └──→ WeaponFeelParamTable ──→ WeaponChangeClipTimeBase
    │                  │                                              WeaponChangeClipEndToFireTime
    │                  │
    │                  └──→ NumericalID ──→ numerical_config ──→ HpCalScale (base 伤害)
    │                                       (key: {ID}_{Level})   ImpulseBase (冲击)
    │                                                            ToughnessBase (破韧)
    │                                                            FleshDamageBase (血肉)
    │                                                            HurtableBase (受伤)
    │                                                            WeaknessDamageAddScale
    │                                                            ElementType (元素类型)
    │                                                            ElementAddRate (元素异常率)
    │                                                            bEnableCriticalDamage (暴击)
    │                                                            bDamageIgnoreShield (无视护盾)
    │                                                            ToughnessDamageType (破韧类型)
    │                                                            EnableWeaknessDamage (弱点开关)
```

数值数据优先查 `numerical_config_composite`（联合 equip + playerskill + monsterskill + others），查不到回退 `numerical_config_equip`。

三个手动覆盖表（`lib/weapon-data.ts`）：

| 覆盖表 | 作用 | 示例 |
|:---|:---|:---|
| `MODE_NAME_OVERRIDES` | 模式显示名 | 精绝兽神: {0:"速射模式",1:"爆发模式",2:"秘法榴弹"} |
| `SKILL_NUMERICAL_OVERRIDES` | 技能用不同的 NumericalID | 精绝兽神 Mode 2 → 120100242 (WeaponSkillDamage) |

**模式分类规则**：新出现的 NumericalID → `damageModes`（武器模式切换）；已见过的 NumericalID → `extraModes`（射速变体/alt-fire）。

### 数据注入 (`lib/weapons.ts`)

`transformWeapon(raw, slug)` — 优先从游戏数据注入数值，查不到回退 MDX 旧字段：

- `fireIntervalBase` ← ASC FireIntervalBase（替代 MDX file_rate 反算）
- `changeClip` ← FeelParam TimeBase + EndToFireTime（替代 MDX reload_time 拼凑）
- `damage.*` ← Numerical HpCalScale / ImpulseBase / ToughnessBase 等
- `element` / `weaknessMultiplier` / `enableCritical` / `ignoreShield` ← Numerical
- `magazine` / `totalAmmo` / `pellets` ← ASC ClipAmmo / MaxAmmo / SplinterNum
- `accuracy` / `stability` / `skillCooldown` ← 保留 MDX（游戏源为 FeelParam Spread/Recoil，后续可扩展）

**MDX 扩展字段**：

| 字段 | 类型 | 说明 |
|:---|:---|:---|
| `prototype_id` | string | 匹配 WeaponPrototypeConfig |
| `damage_label` | number | 0=命中(默认) / 1=爆炸 / 2=自定义 |
| `damage_label_text` | string | damage_label=2 时的自定义文字 |
| `extra_modes` | array | PrototypeConfig 之外的技能模式，每项 `{name, numerical_id, fire_interval?, label?}` |

**数据修正**（MDX 手填错误，以游戏数据为准）：

| 武器 | 字段 | 旧值 | 新值 |
|:---|:---|:---|:---|
| 星海狂想 | RPM | 747 | 375 |
| 炼狱蝎王 | 弹匣 | 30 | 100 |

### 计算层 (`lib/weapon-calcs.ts`)

导出 7 个纯函数：`calcRPM` / `calcDisplayDamage` / `calcDPS` / `calcFullReload` / `calcTacticalReload` / `calcChargeRate` / `calcReloadTime`。

### UI (`components/WeaponCard.tsx`)

**ModeStats** 三种显示模式：

| 模式 | 条件 | 显示 |
|:---|:---|:---|
| 完整 | 默认 | 9 字段：命中伤害 / 单发破韧值 / 弱点倍率 / 元素异常概率 / 暴击 / 弱点 / 射速 / 单发耗时 / 破韧类型 |
| 技能效果 | fireIntervalBase=0 | 6 字段：无射速/耗时/破韧类型 |
| 射速变体 | damage.base 匹配 damageModes | 2 字段：仅射速+单发耗时 |

**WeaponDetailCard** 三区布局：

1. **射击模式** — `damageModes`，多模式各自白字标签，单模式灰色标题（有技能区则白色）
2. **技能 / 特殊攻击** — `extraModes`，≥3 条时默认折叠仅显示前 2 条
3. **武器属性** — 弹夹/总弹量/精准度/稳定度/战术换弹/完整换弹/技能冷却/充能速率

**浮点精度**：`round1()` / `formatPrecise()` 修复 IEEE 754 `toFixed` 陷阱（0.15→0.1）。

### 已录入的武器模式

| 武器 | damageModes | extraModes |
|:---|:---|:---|
| 精绝兽神 | 速射模式, 爆发模式 | 秘法榴弹(爆炸伤害, NumID override→120100242) |
| 飓风之龙 | 霰弹射击, 龙炎弹, 龙炎弹四连发 | 龙炎弹爆炸, 索命龙炎, 霰弹四连发, 龙炎弹四连发(射速变体折叠) |
| 能源之影 | 普通射击 | 浮游模式 |
| 暗夜之殇 | 普通射击 | 爆炸弹 |
| 炼狱蝎王 | 普通射击 | 腾炎, 蝎刺 |
| 胜利誓约 | 普通射击 | 酸液手雷 |
| 死神猎手 | 普通射击 | 死神之光 |

---

## 后续

### 待完成

- `app/(pages)/weapons/client.tsx` — 仍引用旧 `weapon.element` 字段，需适配
- `components/DamageCalculator.tsx` — 仍引用旧 `weapon.damage_base` 字段，需适配为 damageModes
- `scripts/generate-search-index.ts` / `weapon-stats` — 适配新 Weapon 类型
- 武器图片覆盖率

### 新武器录入流程

1. MDX 已有 `prototype_id` 且 PrototypeConfig 有匹配条目 → 自动注入，无需额外操作
2. 模式名不理想 → 加 `MODE_NAME_OVERRIDES`
3. 有不在 PrototypeConfig 中的技能 → MDX 加 `extra_modes`
4. 技能伤害在 playerskill 表 → MDX `extra_modes` 指定 `numerical_id`
5. 非命中伤害标签 → MDX `damage_label: 1` 或 extra_modes 项内 `label: "xxx"`
