# 超限赛季维护

> 状态：active。超限使用当前正式版与可选下一版预览两个通道，不建立每赛季页面或运行时历史库。

跨赛季正式版本统一使用 [插件与超限版本管理](content-versions.md)，将普通插件及超限的羁绊效果、地图轮换等全部模块归档到 Git 可保存的 `archives/content-versions/`。本文的本地归档命令保留为超限单次操作备份；不替代长期版本归档。

## 数据入口

- `data/overlimit/current.json` 是当前发布投影，包含版本、来源清单、卡片、已解析效果、独立伤害、羁绊、等级规则和地图轮换。
- `data/overlimit/preview.json` 是独立的下一版预览投影，无预览时为 `null`；身份必须匹配 `config/content-version.json` 登记版本，状态必须为 `preload`。同 ID 的两版卡片互不覆盖。
- `lib/overlimit.ts` 提供统一入口；页面、搜索、站点地图读取同一版本。`lib/overlimit-cards.ts` 保留卡片查询接口。
- `lib/overlimit-catalog.ts` 校验协议。卡片 ID 独立；`perkItemId` 仅表示人工确认的普通插件关联。没有插件实体的技能卡合法。
- `data/overlimit/links.json` 是自动生成的跨页面轻量关联投影，由 `pnpm overlimit project` 重建，不手工维护。普通插件及 Buff 的超限链接只指向当前卡池；旧来源记录可以保留，不继续产生旧卡链接。
- `preview-links.json` 保存显式预览来源的关联，普通插件入口不会因此切换到下一季。两版搜索、详情、羁绊反查均从自己的投影读取。
- 预览卡片的“新卡 / 老卡”筛选按卡片 ID 与当前正式卡池比较：正式卡池已有 ID 为老卡，即使羁绊、描述或效果发生变化；其余为新卡（相对当前卡池，不表示历史首次出现）。由预览页面传入正式卡池 ID，不给卡片永久写入新旧标签，不读取历史归档；仅预览显示该筛选，可与其他筛选叠加，重置或从羁绊跳转查卡时恢复全部。
- 卡片 `effectValues` 和 `independentDamage` 是已审定来源的解析结果，不是新的数值真值。卡片页面不在运行时读取当前插件、武器 Lock 或预览 Resolver。同 ID 插件更新不能隐式改动超限。
- `provenance.files` 保留生成时证据文件及 SHA-256。原始事实仍以 Numerical V2、Ability、Buff 或其他可重复执行证据为准；不能从描述抄数值、手工制造已解析效果，或用声明“已审定”代替审计。

`season.id` 是版本身份，`season.status` 为 `current` 或 `preload`。页面只读解析后的投影，不按状态重新解析数值，不创建 S4/S5 专用页面，不按系统日期自动换季。候选默认不进入运行时或搜索；只有显式写入预览通道才发布。

## 每次迭代的固定顺序

### 1. 冻结当前版本

```powershell
pnpm overlimit archive
```

命令把当前完整投影、关联证据和所引用的站点原图/WebP 保存到新的 `MD/_local/overlimit/archives/<版本>-<时间>/`。`manifest.json` 记录逐文件字节数与 SHA-256；已存在的目录拒绝覆盖。只复制选定站点资源，不复制游戏容器，也不改动 `refs`。

```powershell
pnpm overlimit verify-archive --output MD/_local/overlimit/archives/<目录>
```

归档仅供本地核查，无站内历史入口；不需要长期维护历史代码。`refs` 原始版本归档与这份站点展示快照分开保存。

### 2. 原地生成下一版候选

```powershell
pnpm overlimit prepare --season s4 --content-root refs/Exports/NZM/Content --against refs/Exports/NZM/Content_S3.2
```

输入路径必须显式指定，避免默认 `Content` 已切到下一版却误覆盖当前页面。结果保存到 `MD/_local/overlimit/candidates/`，包含输入哈希、按 ID 的增删改、身份链、原卡片字段、羁绊结构及服务端配置缺口。

输出中的 `rawDescription` 只是展示文案证据。候选不是发布协议，不能直接交给 `activate`；本命令不导入插件、不刷新全站 Lock、不改站点图标。

### 3. 审定并生成完整投影

先核对身份与投放状态，再沿技能/MGE/Modifier 审计 Numerical；非 Numerical 数值沿 Ability/Buff 执行配置核验。复用现有 Num Modifier V2 和武器解析器，保存精确引用及来源哈希，导出已解析结果到独立候选文件。此步包含人工机制判断，`prepare` 不代替审定，也不自动把原描述变成数值。

- 保持 ID 稳定，同名多卡不能按名称合并；替代旧卡必须有身份证据。
- `weight` 缺少配置时省略。预览 `slot` 优先使用同版本超限卡表的明确标记（`bSlot4=true` 为四插），否则按同 `MODItemID` 回退到该版本插件表唯一有效的 `MODSlotIndex.Values`（1–4），并在逐卡证据中记录回退来源。没有对应插件、槽位缺失或多槽歧义时省略，不使用旧季或体验服槽位。适用范围未核实时设 `applicabilityKnown: false`，三个武器范围数组保持为空，不能解释成“全部武器”。
- 尚未审定的规则模块使用 `null`，页面与搜索不显示该模块，不能继承旧赛季规则。
- 羁绊档位以 `RequiredCount` 为准，保留 `mergeType` 和 `overrides`（原始阶段序号），不能默认累加。
- 更新同一卡片的描述、结构化效果与独立伤害时，使用同一证据版本。
- 数值审定状态由原生或普通卡审定记录共同决定，不按卡片来源类别统一标记待核实。已审定记录且无未解析效果、无 `partial` 具体缺口时移除 `verification`；剩余独立伤害、回复量等缺口在该卡审定记录的 `partial` 中逐项说明。全零 B1 行无效果，不作为未知运算；适用武器未知继续由 `applicabilityKnown` 单独表示。
- 预览的原生卡审定清单是 Modifier 选择的完整集合；存在清单时不再自动合并 CDO 中可能停用的旧 ID。普通卡的动态调用、系数单位和触发范围记录在 `preview-ordinary-review.json`，生成器按显式 `field: coefficient` 取值，禁止把 `BaseValue=0` 当成无效果，或未审定单位就直接展示 CoefValue。
- 原生独立卡片的增伤必须按通用 Modifier 来源协议登记后才能通过全量检查；不能为了发布跳过孤立数值校验。候选身份已支持此类卡片，但身份确证不代表其全部效果已审定。
- 独立卡片来源使用 `source: { type: "overlimit-card", id: "<卡片ID>" }`、来源 ID `overlimit-card:<卡片ID>`，并保存 `applications` 或有依据的排除项。羁绊名称为数据，阶段为正整数，不因下个赛季改名或增加档位而增加运行时分支。

新图标只生成选定资源，并使用稳定文件名；同路径已有图像不得覆盖成不同内容。发布目录与候选目录分离，旧页面继续可用。数值审定和投影生成逻辑应按真实配置结构复用，不能按赛季复制导入器。

### 4. 核验并替换本地当前投影

```powershell
pnpm overlimit check --catalog MD/_local/overlimit/<已审定投影>.json
```

检查输出投影的 SHA-256。审定记录是一个本地 JSON，包含 `status: "approved"`、`catalogSha256` 和说明 Numerical/执行配置审计依据的 `basis`。它绑定具体文件字节，文件再变动就要重新核验，不能只批准“某个赛季”。

```powershell
pnpm overlimit activate --catalog MD/_local/overlimit/<已审定投影>.json --review MD/_local/overlimit/<审定记录>.json
pnpm test:overlimit-cards
pnpm build
```

`activate` 只替换本地数据：先校验协议、资源及审定摘要，自动归档并核验旧投影，再原子替换 `current.json`、重建链接投影。它不部署、不提交、不推送。构建还会执行投影检查、乘区检查、搜索与站点地图生成。

涉及数值、独立伤害或通用来源目录时，追加相关 Numerical/武器/乘区检查。超限 Numerical 审计使用当前投影的 `provenance.contentRoot`，不盲读已经换版的默认目录。

### 5. 发布后收尾

按项目发布流程部署核验通过的当前投影。退出卡池的卡片不再生成详情和搜索记录；不因此删除普通插件。清理仅服务于旧超限的活动引用，不运行无差别资源删除。归档和候选继续在被忽略的本地目录，正常项目构建不读取它们。

## 2026-09-17：S3.2 → S4

已完成：

- S3.2 展示归档：`MD/_local/overlimit/archives/s3.2-20260917/`，147 张卡、22 组独立伤害及引用图像。
- 当前投影独立于普通插件动态解析；统一页面、搜索、站图入口；旧的四份超限 JSON 与直接覆盖导入器已退役。
- S4 候选：`MD/_local/overlimit/candidates/s4-20260917.json`。177 张卡中 114 张为插件身份、63 张直接关联 `MGEPassive_BD[ModId_1]`；相对 S3.2 新增 77 ID、退出 47 ID，共有 100 ID。

S4 预览通过独立通道展示，正式通道仍为 S3.2。9 月 22 日正式服上线后复核，再按上述流程替换当前投影。各卡片证据缺口以 `verification` 和 `preview-evidence.json` 为准；预览导入不代表所有独立伤害结算已审定。

已确认的 S4 配置变化：

- `MainDataTablesLoadConfig` 将 `HuntingGroundRoguelikeConstantsTable`、`HuntingGroundRoguelikeModSelectTable`、`HuntingGroundRoguelikeQualityWeightTable`、`HuntingGroundRoguelikeWeaponModServerTable` 标为 `OnlyServer`，当前客户端无这些表。旧概率和限制规则不迁入 S4。
- 重抽费用表仍可读取，100 行与 S3.2 一致；费用事实可以独立审定，但不能据此推断抽卡概率。
- 力场、瞬暴、狩猎、叠叠乐使用 2/5/8 档，部分档位替代前档。

槽位补充核对（2026-09-17）：`refs-test/Exports/NZM/Content` 的体验服导出同样缺少 `HuntingGroundRoguelikeWeaponModServerTable`；客户端卡表包含预载全部 177 个 ID，但只提供 `bSlot4`，其中 33 个 ID 的标记与正式预载不同，不采用体验服回填。按维护者确认的优先级，保留 S4 预载超限明确标记的四插，其余使用同包同 ID 插件槽位作为回退。弱肉强食、换弹冲击、万伤掷弹、飞毛腿、驰射淬锋、疾风残影虽为普通三插插件，在超限中仍使用明确标记的四插。每次重建都保留槽位来源，正式服上线后复核回退项。

## 重建已审定的超限预览

本地导出未含图标 PNG 时，先仅解码卡池实际引用的纹理（需要本地 CUE4Parse 库与 Python Pillow；库路径可通过 `-LibraryDirectory` 指定）：

```powershell
pwsh -NoProfile -File scripts/overlimit/export-preview-icons.ps1 -ContentRoot refs/Exports/NZM/Content
python scripts/overlimit/decode-preview-icons.py
```

输出位于 `MD/_local/overlimit/preview-icons`，不写回 `refs`。底包缺失的纹理仅按完全相同的引用名沿用已有站点图标，并在逐卡证据标记 `iconFallback`，不能拿同名卡片的不同图标代替。

```powershell
pnpm exec tsx scripts/overlimit/prepare-preview.ts --content-root refs/Exports/NZM/Content --updated-at 2026-09-17
pnpm num-modifier:project
pnpm overlimit check
pnpm build
```

导入器只写预览投影、预览关联、审计证据和显式预览来源，不写正式超限或正式 Numerical Lock。卡片按 ID 审计；羁绊审定清单绑定底包文件哈希，来源变化必须重新审定，不能只改赛季标签。以后换季复用导入器和规则协议，替换审定清单，不复制赛季代码。生成图标使用内容哈希，避免覆盖 S3 图标。

羁绊按实际档位组合分组，2/5/8 与 2/4/6 分开展示，保留档位替换关系。S4 地图排期由 `RogueAffixesTable` 经入口表的 `RogueAffixesId` 关联，预载起点为 2026-09-21 02:00，不能擅自改为开季日期。原始时间和完整行保存在预览证据中。缺失的服务端等级概率模块保持 `null`。

截图仅作布局参考。例如瞬暴8档 Numerical 为50%超暴概率，结算配置为2倍；截图25%及描述3倍均不能覆盖结构化证据。
