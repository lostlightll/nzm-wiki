# Lua 字节码与版本差异

用户追问 `.luac` 的具体行为或函数变化时使用本流程。普通补丁概览先用 `list` / `diff` 确认哪些脚本发生变化；原地读取和禁止复制容器的边界沿用 [pak 分析流程](pak-analysis.md)。

## 命令入口

从项目根目录运行；`$asset` 使用容器列表返回的准确虚拟路径：

```powershell
$tool = '.agents/skills/nzm-assets/scripts/Invoke-Nzm.ps1'
$container = 'P_1.0.50.485.0_R_4519726_P.pak'
$asset = 'NZM/Content/LuaSource/Common/Onlines/CommonResListOnline.luac'
& $tool -Command lua-diff -Container $container -Asset $asset -Limit 20
& $tool -Command lua-functions -Container $container -Asset $asset -Query Login -Limit 20
# $functionId 使用上一命令返回的完整 id，不根据函数名字拼接。
& $tool -Command lua-disasm -Container $container -Asset $asset -Function $functionId -Limit 20
& $tool -Command lua-diff -Container $container -Asset $asset -Function $functionId -MaxChanges 100
# 根函数的注册表、模块常量同样可能影响行为；PowerShell 用单引号传递 $。
& $tool -Command lua-disasm -Container $container -Asset $asset -Function '$' -Offset 0 -Limit 20
```

三个命令都要求 `-Container` / `-Asset`，都支持 `-Offset` / `-Limit`。`lua-functions` 可用 `-Query` 筛函数；`lua-disasm` 要求准确 `-Function`。`lua-diff` 可用 `-Against` 指定前版，否则沿用资产前版选择规则；`-MaxChanges` 限制差异条目，`-MaxWork` 限制比较工作量。

Wrapper 每页默认 20、最多 200 项，差异默认 100、最多 1000 条，比较预算默认 200 万、最多 1000 万。解析硬限为单脚本 4 MiB、4096 个函数、25 万条总指令和 64 层嵌套；触及硬限时报告限制，不自动扩大读取或改用全量导出。

`-Dialect auto` 为默认值；仅在来源已确认时显式指定 `lua53` 或 `slua53`。显式映射仍须通过校验，不作为绕过解析错误的重试开关。这些命令直接返回 JSON，不创建导出目录。

## 读取结果

- 外层检查 `ok`、`mountComplete` 和退出码。Lua 解析失败不等于脚本未变；不要改用二进制大小相同来推断逻辑相同。
- `lua-functions` 返回 `functions`、筛选后的 `total` 和分页信息。`id` 是后续命令的准确标识；`identityKind: structural-signature` 表示结构签名身份，变化后可能表现为删除/新增，不能据此断言开发者真的删除、创建了函数。
- `lua-disasm` 返回 `instructions`、`total` 和函数 `metadata`。`pc` 为从 1 开始的指令位置，`line` 是可缺失的调试行号，`targetPc` 标出跳转目标；`normalized` 用于消除池编号等噪声。窗口外的目标须继续按需读取。
- `lua-diff` 的 `before` / `after` 和 SHA-256 标识两边来源；`diff.changedFunctions` 给出变化函数及 `changes`，其中插入/删除指令、`metadata` 和 `branch-target` 都可能影响行为。检查全局及每个函数的 `truncated` / `reasons`；`kind: incomplete` 不能判作无变化，`totalChangedFunctions: null` 表示总数未确定，`changedFunctionCountLowerBound` 仅为已证实下限。
- `scope` 说明检查整个资产还是指定函数；`childFunctionsCompared: false` 时不包括子函数，`unresolvedChildIdentities: true` 表示仍有未解决的子函数身份，不能扩大结论范围。
- 长常量使用有限预览和完整内容 SHA-256，指令的 `previewTruncated` 会提示展示缩短。不能拿缩短后的预览重建源码或断言完整字符串内容；比较仍保留完整内容身份。

## 分析顺序

1. 固定目标容器、准确虚拟路径和实际前版。前版依据该资产的容器优先级，不能用当前合并视图冒充旧版。
2. 使用内置 CLI 的 Lua 接口识别格式、校验指令并列出函数变化。Lua 5.3 文件头不能证明指令编号标准；NZM 使用的 Tencent slua 映射由 CLI 维护。未知或歧义格式须先解决，不能套另一套 opcode 表继续解释。
3. 先看变化函数摘要，再按返回的函数身份展开指令。方法名、局部函数和闭包的身份须结合所属函数判断；子函数序号、常量池编号、upvalue 顺序或调试行号变化本身不证明业务逻辑变化。
4. 沿变化处检查条件、提前返回、调用参数和相关回调。配置项中的函数没改，也可能因顶层注册的触发时机、常量或捕获值变化而改变行为；不要只看具名方法或新增字符串。
5. 证据足够解释用户关注的变化即结束。大量指令只展开相关函数和窗口；遇到截断先缩小范围或翻页，不能把当前窗口当作完整函数。

遇到 `AmbiguousLuaFunctionIdentity` 时，不能把同名或完全相同的匿名闭包按序号强行配对。如果问题只涉及模块注册表或常量，可显式 `-Function '$'` 限定根函数比较/反汇编；必须在结论中注明这个范围，不据此宣称其余函数未变化。

根函数限定结果中的 `unresolved-local-prototype` 保留本版局部编号，以免隐藏闭包替换；它不是跨版本身份。寄存器分配也没有归一化，不能把每一条反汇编差异都直接算成玩法改动。

## 解释与证据

- 输出是字节码反汇编与差异，不是恢复出的原始 Lua 源码。人工整理的伪代码应注明这一点；不能执行游戏脚本来“验证”含义。
- 结论引用容器、资产虚拟路径、函数身份、前后 PC 和可用调试行号。编译时嵌入的源码路径不代表本机存在该文件。
- 将已确认的配置/指令变化、推导出的行为和未验证的运行效果分开。日志中的“成功”“完成”等措辞不能替代控制流检查。
- 解释重试、队列和登录状态时检查计数何时重置、失败是否跳过、重连是否重置标记，以及“次数”是否包含首次请求。
- 解析器、指令映射和版本比较只在 FModel 源码项目维护；Skill 不复制一套 Python 解析器。保存选定脚本或分析证据仅在任务确有需要时进行，不能以解析失败为由复制容器。
