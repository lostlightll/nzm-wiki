# 插件与超限的跨赛季版本管理

> 状态：active。版本管理属于维护工具，不增加历史页面，不按日期自动换季。

## 范围与数据所有权

`config/content-version.json` 记录当前工作区的赛季、版本和阶段，并可登记一个对外预览的下一版。赛季如 `s3`，版本如 `s3.2`；下一季可用 `s4`，季中发布可用 `s4.1`。日常文字修正无需新建快照；需要固定发布节点时才升级版本。`phase: candidate` 表示维护中的下一版，`current` 表示已核验的发布内容，均不代替部署状态。

- 普通插件正式内容在 `data/perks/slot-*/*.mdx` 维护；预览编辑源独立放在 `data/perk-preview/slot-*/*.mdx`，通过显式发布生成 `data/perk-preview/preview.json`。正式内容继续使用现有 MDX、Numerical 引用和 Resolver，预览运行时只读已解析的发布投影。
- 超限正式版使用 `data/overlimit/current.json`；过渡期另有 `data/overlimit/preview.json`（无预览时为 `null`）。卡片、结构化效果、独立伤害、羁绊及各档效果、等级规则、地图轮换共同属于各自版本。
- 历史放在 `archives/content-versions/<season>/<version>/`，可随 Git 保存。目录位于 `data/`、`public/` 之外，不进入路由、搜索和静态资源部署。
- 原始游戏资源留在只读 `refs/`；版本工具不移动、复制或重新导出游戏底包。
- 武器不纳入版本切换范围。插件引用武器的独立伤害保存当时解析结果与引用身份，不能靠日后读取当前武器重现旧数值。

## 归档内容

每份归档包含原始插件 MDX、插件解析后的描述/属性效果/独立伤害、跨页面关联结果、完整超限发布数据，以及引用的站点图标和地图图片。预览 MDX 从发布快照内的原文归档，不读取尚未发布的编辑文件。Numerical 证据保存在归档证据区，仅供追溯；不因恢复插件而覆盖全站共享 Lock。

`manifest.json` 记录版本、时间、摘要、逐文件字节数与 SHA-256。归档创建后拒绝覆盖；需要修正版就使用新的版本号。校验失败时不能用于比较或恢复。原始文件和解析结果都保留，以免旧 MDX 的引用随着当前 Lock 更新而产生不同数值。

`.gitattributes` 对归档关闭换行转换和源码空白检查，保留原文件的 CRLF 与空白；归档完整性由逐文件哈希校验，不能为格式检查改写历史证据。

正式归档排除 `season` 以 `-preview` 结尾的插件，并记录排除数量。S4 Preview 不会混入 S3.2 正式归档；需要保存过渡期时单独使用下文的预览归档。快照描述的是归档时维护数据的实际状态，不能把后建快照宣称为过去某天完整客户端的复原。

```powershell
pnpm content-version status
pnpm content-version archive
pnpm content-version verify --archive archives/content-versions/s3/s3.2
```

首次 S3.2 快照建立后，旧的 `MD/_local/overlimit/archives/` 保留作为本机证据，不再承担长期版本管理。`pnpm overlimit archive` 仍可用于局部操作前的临时备份；正式版本统一通过 `content-version` 归档插件与全部超限模块。

## 下一赛季准备与当前版维护

先归档并提交当前版本，再建立下一版工作区：

```powershell
pnpm content-version prepare --season s4 --version s4
```

命令要求工作区干净，从当前 HEAD 创建 `codex/content-s4` 分支和 `MD/_local/content-versions/worktrees/s4` Git 工作区，只在新工作区把版本标为 `candidate`。不会复制游戏目录、共享 `node_modules` 或给线上数据增加另一套季节分支。进入该工作区安装依赖后正常编辑；这里的初始数据仍是上一版，不能仅改版本号就视作已更新。

当前工作区照常修复插件、攻略等内容。准备期间涉及两版的修正，通过普通 Git 提交合并或 cherry-pick 到候选工作区；冲突逐项审查，不盲目复制目录。候选发布前再次合并当前维护分支并重新验证，避免遗漏准备期间的修正。

插件按 [插件标准](../standards/perk-data.md) 核验身份、投放、描述、数值和资源；超限按 [超限流程](overlimit-season.md) 核验卡池、羁绊、地图轮换和规则。新季不适用的超限规则使用 `null`，不能默认继承旧版；超限退出卡池不意味着删除普通插件。

## 过渡期：当前正式版与下一版预览并存

Preview 是可重复使用的发布阶段：SN 尚未结束，SN+1 的选定内容已经完成可供预览的编辑和核验，可以提前展示。它既不是历史归档，也不是游戏内正式上线。未完成核验的草稿继续留在候选工作区，不以 Preview 名义直接展示。

在 `config/content-version.json` 登记一个预览目标：

```json
"preview": {
  "season": "s4",
  "version": "s4-preview",
  "label": "S4 Preview"
}
```

- 当前 `season/version/phase` 仍为 `s3/s3.2/current`。预览的版本号独立，用于保存过渡期快照；修正版可用 `s4-preview.1`。
- 插件及其 Modifier 来源使用 `<预览赛季>-preview` 标记，例如 `s4-preview`。标记选择数据通道，不表示 `CollectMODItem=1` 已在正式服生效。预览快照小版本不改变条目标记。
- 图鉴 `/perks` 只展示正式插件，`/perks/preview` 只展示已发布预览。标题上方用两个版本按钮切换，名称来自版本配置（当前为 S3.2 / S4 Preview）；快速筛选中不再设置 Preview。只有存在该预览目标的已发布插件时才显示预览入口，未登记预览时不展示预览内容。
- 关闭预览时同步撤下或迁移预览投影、编辑源和来源登记，具体步骤见下文；不能仅隐藏入口后继续使用无归属的预览数值。
- Numerical 证据显式保存目标 `season`，只覆盖被登记预览消费者的内存数据。目标、标记、证据不匹配必须报错，不能把 S4 证据用于 S5，也不能静默回退当前正式数值。
- 当前版本与预览各自维护；提前展示不能刷新全站正式 Lock 或修改当前超限。当前普通插件的 `season` 是引入赛季，不能为发布下一季而批量重标所有存量插件。
- 同一个 ItemID 可同时存在正式版和预览版，两者分别编辑，不能互相覆盖。预览 slug 使用 `preview/slot-N/<名称>`，正式 slug 保持 `slot-N/<名称>`，来源关联按「通道 + 身份」隔离。预览集合只包含已审定条目，不代表已复制或核验下一季所有存量插件。
- 预览 MDX 的 `preview_change` 必填：`new`（新插件）、`changed`（改动插件）、`existing`（老插件）。图鉴仅在预览通道提供该分类筛选，默认全部；改动包含数值、机制、适用武器和已确认的文案调整，不等于全部都是增强或削弱。
- S4 预览纳入全部 S3.2 存量插件，包括原表中 `CollectMODItem: 1 → 0` 的 121 项。预览上下线筛选直接使用本版 `CollectMODItem`：1 为已上线，其余为已下线；这表示预览配置中的开放状态，不表示 S4 已在正式服生效。快速筛选左侧为上下线，右侧为新插件／改动插件／老插件，两组取交集，手机端上下排列。仅关闭投放的条目仍归老插件，另有数值、机制或适用范围变化才归改动插件。
- 一次性扩充工具 `pnpm exec tsx scripts/perks/expand-s4-preview.ts` 读取两版本地原表，保留已有预览编辑，补入独立副本与精确 Numerical 证据；随后执行 `pnpm exec tsx scripts/perks/sync-preview-providers.ts --content-root refs/Exports/NZM/Content --baseline-root refs/Exports/NZM/Content_S3.2 --write` 同步来源，再执行 `pnpm num-modifier:project` 和 `pnpm perks:project --channel preview`。不要把该版本专用迁移当作通用更新器。
- 存量插件的触发伤害可显式保存为 `independent_damage_snapshot`，发布时校验后与武器引用结果合并。迁移前核对相应 Numerical，运行时不回落到正式版 `trigger-damage`；缺失快照不自动补齐，重新发布也不会隐式刷新此手工冻结值。
- `getAllPerks()`、默认按名称或 ItemID 查询只返回正式内容；搜索及静态页面生成通过 `getAllPublishedPerks()` 获取已发布的两版，图鉴按路由选择通道。需要预览时显式调用 `getPerkByName(name, "preview")`、`getPerkByItemId(id, "preview")`，或使用带 `preview/` 前缀的 slug。
- 超限的候选按独立投影准备，羁绊效果和地图轮换随它一起核验。审定并写入 `preview.json` 后，`/overlimit/preview` 展示预览、`/overlimit` 继续展示正式版；共享组件，不复制赛季专用页面。仅登记配置不会自动导入内容。
- 超限同 ID 可在两个投影中并存，关联键为「通道 + ID」。预览来源登记额外带 `season: "s4-preview"`，不覆盖正式来源；普通插件详情的超限入口仍指向当前正式卡池。搜索明确标注预览版本。
- 超限预览可发布已核验的机制与数值；确有证据缺口时逐卡声明 `verification.status: partial`，省略未证实的数字。未知服务端概率/限制不能借用旧版。未审定整个规则模块时仍用 `null`。

把已审定的预览内容作为单独提交合入当前维护分支，就能在当前赛季继续运行时展示下一季内容；完整换季改动仍留在候选工作区。下一轮仅换预览配置、审定清单及对应证据，复用 `scripts/prepare-perk-preview.ts`，不复制 S5/S6 专用 Resolver 或页面。

普通插件预览编辑完成后显式发布：

```powershell
pnpm perks:project --channel preview
pnpm perks:check
```

发布投影保存插件身份、解析后的描述和结构化效果、正文、metadata 及独立伤害结果，并记录编辑源、Numerical 证据及使用的武器来源 SHA-256。运行时不解析预览 MDX，不随共享 Weapon Lock 或武器内容变化重新计算预览伤害。重新发布会按审定引用使用当前武器 Resolver 和 Lock，必须先复核它们是否仍对应目标版本；来源哈希用于追溯，不代替审计。`perks:check` 校验 Schema、配置通道和资源，已接入构建；它不会因共享武器变化而自动刷新快照。

```powershell
pnpm content-version archive-preview
```

该命令保存“当前正式底座 + 已登记预览”的过渡期快照，归档身份取 `preview.season/version`，清单标记 `channel: preview` 和 `baseRelease`，包含两版插件原始 MDX、预览发布投影、冻结独立伤害、预览 Numerical 证据、独立的超限预览投影/关联/审计证据及图像。同 ItemID 的插件按通道分别保存；两个超限通道的羁绊和轮换也不会互相覆盖。它不能当作 S4 正式归档。默认 `archive` 继续只保存正式条目。两种归档均不在网站显示。

普通插件转正或撤下按以下人工流程执行，不自动覆盖正式内容或共享 Lock：

1. 先归档当前正式版及需要保留的预览快照。
2. 转正时复核正式客户端，逐 ItemID 审查两版差异，把选定预览 MDX 合并到 `data/perks/slot-*` 的对应文件；新条目建立正式文件。复核 Numerical 引用、正式投放状态和上线日期；已有条目保留引入赛季，新条目填写正式赛季。按现有 Lock 维护流程审定所需行，不能把预览证据文件整体覆盖到共享 Lock。
3. 转正时迁移或合并相应 Modifier 来源，撤下时直接移除本季预览来源。移除已处理的预览编辑源，并把 `data/perk-preview/preview.json` 置为 `null`；尚需留存的草稿放回候选工作区或本地工作目录，不留作活跃预览来源。
4. 确认超限及其他消费者也已处理本季预览后，移除配置中的本季 `preview`，重建 `pnpm num-modifier:project` 并运行发布检查。历史预览 Numerical 证据可保留供追溯，但不能再有本季活跃消费者。

共享的 Preview 代码保留供下一次过渡使用；日期到达或字符串替换不能代替数值审计。

超限转正前先归档当前正式版，再按超限 `activate` 流程将复核后的投影写入 `current.json`，同时迁移对应来源登记。将 `preview.json` 置为 `null`，撤下本季预览来源，运行 `pnpm overlimit project` 和 `pnpm num-modifier:project`，最后移除本季预览配置。空预览不进入静态导出、搜索或站点地图；不要删除通用组件。

## 核验、发布与归档

在候选工作区完成内容审计后：

```powershell
pnpm content-version finalize
```

命令要求超限的 `season.id` 等于发布版本号且状态为 `current`，该赛季插件不得残留 `s4-preview` 等预览标记，版本配置中也不得继续登记本季预览；随后执行 `pnpm build`，通过后将工作区标为当前版并生成不可覆盖的正式归档。检查不替代游戏机制和数据来源审计。失败不会标记为正式版；不会提交、合并或部署。

复核并提交候选工作区后，按正常 Git 合并与项目发布流程切换线上版本。Git 负责源文件合并、历史代码和回退；版本工具负责明确版本身份、固定展示数据和归档完整性。不要另写一套覆盖 `data/`、共享 Lock 和站点文件的自动恢复器。

## 对比和恢复

```powershell
pnpm content-version diff --left archives/content-versions/s3/s3.2 --right archives/content-versions/s4/s4
pnpm content-version export --archive archives/content-versions/s3/s3.2 --output MD/_local/content-versions/recovery/s3.2
```

对比先验证两份归档，按文件报告新增、移除和变化。导出仅写入全新目录，拒绝覆盖现有路径；解析后的 JSON 可直接查看，不需要安装旧代码。

需要恢复旧页面行为时，在独立 Git 分支使用归档记录的提交审查对应代码，再从导出目录选择恢复内容，运行现行校验后发布。`evidence/` 只供核对，不整体覆盖到当前项目。旧版本无需保持兼容当前 Resolver，也无需出现在网站上。

归档受到 Git 管理但不会自动提交或推送；只有提交并按项目流程备份后，才具备跨机器恢复能力。
