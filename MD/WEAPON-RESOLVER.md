# Weapon Resolver

`lib/weapon-resolver.ts` 是武器 frontmatter 到页面领域数据的唯一解析入口。它支持迁移期 V1 与正式 V2，并保证普通构建只读取已提交的 `data/weapon-data-lock.json`，不访问 `refs/`。

## 公共入口

```ts
parseWeaponSource(input, { slug, expectedTable })
resolveWeapon(input, { slug, expectedTable, lock })
resolveDamageSource(weapon, sourceId, { lock, expectedTable, weaponPath })
toLegacyWeapon(resolved)
createResolvedWeaponSnapshot(resolved, { sourceIdMap })
```

- 无 `schema_version` 的输入按 V1 解析。
- 只有数字 `schema_version: 2` 是 V2；其他显式版本全部拒绝。
- V2 必须提供 Weapon Data Lock；V1 不读取 Lock。
- `expectedTable` 是 LC/TD 权威上下文，frontmatter 不能覆盖。

## 领域模型

`ResolvedWeapon` 不继承旧 `Weapon`，也不提供含义模糊的 `range`。它保存：

- 有序的 `damageSources` 与明确的 `mainSourceId`。
- Numerical 伤害、元素、弱点、暴击、破韧和 Settlement。
- ASC 射击节奏、弹丸、弹药、移动倍率和来源级距离衰减。
- Feel 换弹、开镜、操作时间、后坐力和散布。
- Item 展示属性与六项官方雷达值。
- 主动技能的 `chargeTime`、`chargeCount` 和 PVE/GP 来源。
- 字段状态、diagnostics、provenance、override history 和完整原始行。

字段状态与值来源分开：

| 状态 | 含义 |
| :--- | :--- |
| `resolved` | 得到非零有效值 |
| `zero` | 确定为零 |
| `not_applicable` | Settlement 或机制明确不适用 |
| `missing` | 协议允许缺少该可选字段 |
| `unavailable` | 字段适用，但当前无法取得或派生 |
| `unrecognized` | 原始枚举或语义尚未登记 |

人工覆盖不占用状态枚举。每个被覆盖字段保留从父来源到子来源的完整 `overrideHistory`。

## Settlement

Resolver 对完整 `TagName` 做精确匹配，不做后缀猜测。Settlement 决定五类伤害值和元素积累是否适用；不适用字段即使原始行为零也不会被解释为“确定为零”。

以下情况直接失败：

- `Settlements` 缺失、非数组或条目没有非空 `TagName`。
- Settlement 适用但必要原始字段缺失或非法。
- override 试图给不适用的 Settlement 造值。

重复 Tag 保留原始顺序并产生 info；未知 Tag 保留并产生 warning。

## ASC 与 Feel

ASC 引用存在时，Lock 行是权威来源。required 字段缺失或非法时直接失败，不能使用 MDX compatibility 字段掩盖。没有 ASC 引用时，来源级 `fire_interval` 和 `pellets` 才作为迁移 fallback。

经实测确认的射击间隔差异使用 `overrides.asc.fire_interval`。Resolver 按继承链顺序应用覆盖，保留 ASC 原始值及每一步 interval/RPM 历史，并在每一步后重新计算 RPM；最终间隔为零时 RPM 明确为 `unavailable`。兼容 `fire_interval` 与最终有效值比较，不与覆盖前 ASC 值比较。

距离衰减按伤害来源解析：

- `0 / 0` 为 `not_applicable`。
- `end > begin` 且 `end > 0` 为 `applicable`，厘米转换为米。
- 最低倍率必须在 `[0, 1]`。
- 其他组合为 `INVALID_ATTENUATION`。

合法 ASC 候选可以通过 `overrides.asc.attenuation` 改为适用或不适用。原始厘米值、有效值和覆盖原因同时保留。

Feel 固定字段与所有 `AccuracyRatio_*` 均为可选；存在时必须是有限非负数。`accuracyRatios` 保留完整原始键名。

## Item 与技能

Item 只读取显式 `item_id`。行缺失或身份不一致直接失败；取得合法行后，单个展示字段缺失、非法或枚举未知时才允许按协议回退 MDX，并保留被拒来源与 fallback provenance。

主动技能只使用 Lock 的 `active_skills["{id}_1"]` 选择：

- `weapon_pve` 读取 `ChargeNeedTime` 与 `SkillCount`。
- `gp_fallback` 读取 `CooldownDuration` 与 `MaxChargeStackCount`。
- PVE 行存在时禁止 GP fallback。
- PVE 行非法时禁止改走 GP。

## V1 与旧消费者

`lib/weapon-legacy.ts` 保存迁移前转换语义。V1 先转成旧 `Weapon`，再归一化为同形 `ResolvedWeapon`；`toLegacyWeapon()` 对 V1 返回保存的精确 bridge。

Task 4 期间 `lib/weapons.ts` 仍向现有消费者返回 `Weapon`，但内部已经统一为：

```text
frontmatter -> resolveWeapon() -> toLegacyWeapon()
```

V2 到旧模型是明确的有损适配：Settlement 不适用或缺失的旧必填数字使用 `0`，旧模型无法表达的 toughness `none` 使用旧默认“冲击”，并产生 `LOSSY_LEGACY_PROJECTION`。V2 不恢复旧 `range` 或顶层衰减字段。

## Snapshot

`createResolvedWeaponSnapshot()` 返回 `snapshot_version: 1`：

- 递归删除所有 `raw` 和 `undefined` 对象属性。
- 对象键稳定排序，数组保持领域顺序。
- override history 保持父到子顺序。
- diagnostics 精确去重并稳定排序。
- `sourceIdMap` 支持迁移前后稳定 ID 对齐；未知 ID、非法目标和最终冲突全部拒绝。

## 命令

```text
pnpm test:weapon-source-v2
pnpm test:weapon-resolver
pnpm test:weapon-data-reader
pnpm test:weapon-skill-charge
pnpm test:weapon-data-lock
pnpm weapon-data:check
```

Resolver 测试包含 LC/TD 全部 224 个 V1 文件的旧 bridge 深比较。生产构建不需要 `refs/`。
