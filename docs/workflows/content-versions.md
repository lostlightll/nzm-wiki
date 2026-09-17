# 插件与超限的跨赛季版本管理

> 状态：active。版本管理属于维护工具，不增加历史页面，不按日期自动换季。

## 范围与数据所有权

`config/content-version.json` 记录当前工作区的赛季、版本和阶段。赛季如 `s3`，版本如 `s3.2`；下一季可用 `s4`，季中发布可用 `s4.1`。日常文字修正无需新建快照；需要固定发布节点时才升级版本。`phase: candidate` 表示维护中的下一版，`current` 表示已核验的发布内容，均不代替部署状态。

- 普通插件仍在 `data/perks/` 维护，继续使用现有 MDX、Numerical 引用和 Resolver。
- 超限仍使用 `data/overlimit/current.json`，卡片、结构化效果、独立伤害、羁绊及各档效果、等级规则、地图轮换共同属于版本。
- 历史放在 `archives/content-versions/<season>/<version>/`，可随 Git 保存。目录位于 `data/`、`public/` 之外，不进入路由、搜索和静态资源部署。
- 原始游戏资源留在只读 `refs/`；版本工具不移动、复制或重新导出游戏底包。
- 武器不纳入版本切换范围。插件引用武器的独立伤害保存当时解析结果与引用身份，不能靠日后读取当前武器重现旧数值。

## 归档内容

每份归档包含原始插件 MDX、插件解析后的描述/属性效果/独立伤害、跨页面关联结果、完整超限发布数据，以及引用的站点图标和地图图片。Numerical 证据保存在归档证据区，仅供追溯；不因恢复插件而覆盖全站共享 Lock。

`manifest.json` 记录版本、时间、摘要、逐文件字节数与 SHA-256。归档创建后拒绝覆盖；需要修正版就使用新的版本号。校验失败时不能用于比较或恢复。原始文件和解析结果都保留，以免旧 MDX 的引用随着当前 Lock 更新而产生不同数值。

`.gitattributes` 对归档关闭换行转换和源码空白检查，保留原文件的 CRLF 与空白；归档完整性由逐文件哈希校验，不能为格式检查改写历史证据。

正式归档排除 `season` 以 `-preview` 结尾的插件，并记录排除数量。现有 S4 Preview 不会混入 S3.2 正式归档；其开发历史仍保存在 Git。快照描述的是归档时维护数据的实际状态，不能把后建快照宣称为过去某天完整客户端的复原。

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

现有 S4 预览工具是本次迁移的存量入口；此系统不新增 S5/S6 预览特判。S4 发布时需完成现有预览的正式数值审计、共享 Lock/来源登记迁移、插件标记与对应 UI/Resolver 清理。这些内容变更不能由版本工具根据日期或字符串替换自动完成。

## 核验、发布与归档

在候选工作区完成内容审计后：

```powershell
pnpm content-version finalize
```

命令要求超限的 `season.id` 等于发布版本号且状态为 `current`，该赛季插件不得残留 `s4-preview` 等预览标记；随后执行 `pnpm build`，通过后将工作区标为当前版并生成不可覆盖的正式归档。检查不替代游戏机制和数据来源审计。失败不会标记为正式版；不会提交、合并或部署。

复核并提交候选工作区后，按正常 Git 合并与项目发布流程切换线上版本。Git 负责源文件合并、历史代码和回退；版本工具负责明确版本身份、固定展示数据和归档完整性。不要另写一套覆盖 `data/`、共享 Lock 和站点文件的自动恢复器。

## 对比和恢复

```powershell
pnpm content-version diff --left archives/content-versions/s3/s3.2 --right archives/content-versions/s4/s4
pnpm content-version export --archive archives/content-versions/s3/s3.2 --output MD/_local/content-versions/recovery/s3.2
```

对比先验证两份归档，按文件报告新增、移除和变化。导出仅写入全新目录，拒绝覆盖现有路径；解析后的 JSON 可直接查看，不需要安装旧代码。

需要恢复旧页面行为时，在独立 Git 分支使用归档记录的提交审查对应代码，再从导出目录选择恢复内容，运行现行校验后发布。`evidence/` 只供核对，不整体覆盖到当前项目。旧版本无需保持兼容当前 Resolver，也无需出现在网站上。

归档受到 Git 管理但不会自动提交或推送；只有提交并按项目流程备份后，才具备跨机器恢复能力。
