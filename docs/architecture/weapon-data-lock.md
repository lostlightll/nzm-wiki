# Weapon Data Lock

> 状态：active
> Lock Schema：`1`
> 产物：`data/weapon-data-lock.json`

Weapon Data Lock 是 V2 武器显式引用到的游戏原始行快照。MDX 决定选取哪些来源，Lock 保存事实，后续 Resolver 才负责把 Unreal 字段转换成页面领域数据。

## 1. 边界

- 刷新器读取 `refs/Exports/NZM/Content`，普通构建和离线检查不读取 `refs/`。
- 只扫描 `data/weapons` 中 `schema_version: 2` 的 MDX；每份文档按 `game_modes` 展开为 LC/TD 投影。无版本的 V1 文件忽略，未知显式版本报错。
- 继承使用 `resolveDamageSourceReferences()` 展开。只收集 MDX 内已经显式声明的有效引用，不从 PrototypeConfig 自动生成 Numerical、ASC、Feel、Item 或技能 ID。
- PrototypeConfig 只参加刷新期交叉校验，不进入 Lock。
- Lock 保存完整原始行，不解释 Settlement、不判断 ASC 距离衰减是否适用，也不应用人工 overrides。

## 2. 文件结构

Lock 使用一个严格、带命名空间的 JSON 文件：

```json
{
  "schema_version": 1,
  "sources": {
    "numerical-lc": {
      "source_path": "DataTables/numerical_config_composite.json",
      "sha256": "..."
    }
  },
  "rows": {
    "numerical-lc": {
      "lc:120300110_1": {
        "row_name": "120300110_1",
        "raw": {}
      }
    },
    "numerical-td": {},
    "asc": {},
    "feel": {},
    "item": {},
    "skill-pve": {},
    "gp-active-skill": {}
  },
  "active_skills": {
    "5004901_1": {
      "source": "gp_fallback",
      "source_key": "5004901"
    }
  }
}
```

七个 namespace 始终存在：

| Namespace | Key |
| :--- | :--- |
| `numerical-lc` | `lc:${id}_${level}` |
| `numerical-td` | `td:${id}_${level}` |
| `asc` | `ASCTypeID` |
| `feel` | `WeaponFeelParamID` |
| `item` | 显式 `item_id` |
| `skill-pve` | `${SkillID}_${Level}` |
| `gp-active-skill` | GP Unreal rowName |

`active_skills` 保存已经确定的 PVE/GP 选择，不复制充能数值。具体数值仍从对应完整 `raw` 行读取。

元数据中的哈希是原始物理文件字节的 SHA-256。路径使用 `NZM/Content` 相对路径，不保存本机路径。当前导出没有权威的游戏内容版本，因此 `game_content_version` 省略；不得用刷新时间代替内容版本。

## 3. 收集规则

- Numerical 根据当前模式投影分别进入 LC 或 TD；公共 `source` 会在全部已声明模式中收集，`sources` 只收集对应模式键，禁止跨表回退。
- 普通近战的每段轻击和重击都是独立 Numerical 引用，必须逐段收集并在 LC/TD namespace 中各自保留；共享 ASC 不会合并这些 Numerical 行。
- 每个有效 ASC 同时收集 Feel；未显式填写 `feel_param_id` 时使用有效 ASC ID，显式例外优先。
- `item_id` 只做精确读取。缺失时不会根据 `ModelID` 的单候选或多候选自动选择。
- `active_skill_id > 0` 当前固定 Level 1。PVE 整行存在时使用 PVE；只有 PVE 缺行时才使用 GP 整行。
- `active_skill_id: 0` 是迁移哨兵，不收集技能行；若 V2 MDX 显式写入该值且与 Prototype Mode 0 不一致，刷新审计仍会报错。
- pending 可以没有 Numerical；已经填写的候选引用仍必须存在，不能用 pending 隐藏悬空 ID。
- 同一 key 被多个武器或来源引用时只保存一行。
- 当前没有技能人工 override 协议。PVE 与 GP 均缺失时直接失败；只有正式 Schema 定义带原因的 override 后才能扩展。

## 4. 命令

### 刷新

```bash
pnpm weapon-data:lock
```

刷新器执行以下步骤：

1. 扫描并验证全部 V2 MDX。
2. 从统一读取层精确取得完整原始行。
3. 校验带 `prototype_mode` 的 Numerical、ASC 和 Feel 关系。
4. 校验显式主动技能 ID 与 Prototype Mode 0；Item 差异只报告，不自动改值。
5. 在内存中构造并验证完整候选 Lock，成功后才覆盖原文件。
6. 报告新增、删除或未使用行、JSON Pointer 字段变化、Settlement Tag 变化、来源哈希变化和非阻断警告。

Prototype 多候选时只允许 rowName 与武器 `title` 或 `${title}_${mode}` 精确匹配。无法唯一匹配时失败，不做模糊匹配或 first-wins。

### 离线检查

```bash
pnpm weapon-data:check
```

该命令只读取 MDX 和已提交 Lock：

- 不实例化原表读取器，不访问 PrototypeConfig 或 `refs/`，不写文件。
- 检查每个有效引用都有对应行，并拒绝未使用 Lock 行。
- 检查主动技能选择与被锁定的 PVE/GP 行一致。
- 检查 namespace、key、rowName、严格身份字段和来源逻辑路径。
- Numerical 行内 `id/Level` 的已知原表异常不会覆盖 rowName 权威身份；GP 行内 `AbilityID` 差异同样保留为源数据事实。
- ASC 行必须保留 `DistanceBeginAttenuationBase`、`DistanceEndAttenuationBase` 和 `AttenuationMinScale`，包括零值。

`weapon-data:check` 尚未接入 `build` 或 CI；该收尾工作见 [`../plans/weapon-v2-cleanup.md`](../plans/weapon-v2-cleanup.md)。

## 5. 确定性与公共接口

`lib/weapon-data-lock.ts` 导出：

- `weaponDataLockSchema`、`parseWeaponDataLock()`。
- `WeaponDataLock`、`WeaponDataLockKind`、`WeaponDataLockRow` 等公共类型。
- `getWeaponDataLockRow()`，按 namespace/key 精确取行，缺失时携带引用 MDX 报错。
- `serializeWeaponDataLock()`，递归排序对象键、保留数组顺序，统一 2 空格、LF 和末尾换行。

序列化不包含生成时间、绝对路径或其他机器相关值。相同 MDX 和相同源文件会得到逐字节相同的 Lock。

## 6. 当前基线

112 份武器文档均使用单文件双模式 V2。已提交 Lock 包含全部 LC/TD 投影的有效显式引用、来源元数据、完整原始行和主动技能选择；普通近战连段同样按每次结算独立锁定。普通构建只读取该提交产物。
