# 本地资产转 JSON

使用已有 CUE4Parse DLL 直接解析指定 `.uasset`，同目录的 `.uexp` / `.ubulk` 由解析器按需读取。传入 `.uexp` 时脚本自动定位同名 `.uasset`。不连接游戏目录，不需要 AES，不用其他版本的 JSON 替代输入。

## 调用

在仓库根目录，用独立 PowerShell 7 进程运行，避免已加载 DLL 版本冲突：

```powershell
pwsh -NoProfile -File .agents/skills/nzm-uasset/scripts/Convert-LocalAsset.ps1 `
  -AssetPath 'D:/path/numerical_modifier_config.uasset'
```

默认输出为同目录同名 `.json`，已有文件会报错且保持原样。需要另存时加 `-OutputPath 'D:/path/result.json'`。输入在 `refs/`、`refs-test/` 或 `kismet/` 时，明确将输出指定到 `MD/_local/<主题>/`。

需要核验所选 Blueprint 的硬编码参数时，可加 `-ReadScriptData` 读取该本地资产的 Kismet。默认不读取字节码；开关不挂载游戏、不扩大资产范围。检查输出中目标函数的 `ScriptBytecode`，按 [Kismet 规范](kismet.md) 追踪入口、参数与控制流，不能把函数签名视为实现。

依赖为现有 FModel 构建目录中的 `CUE4Parse.dll` 及配套 DLL，默认寻找仓库同级 `FModel/FModel.Cli/bin/Release/net10.0`。可用 `-LibraryDirectory` 或环境变量 `NZM_CUE4PARSE_LIB` 指定其他安装。当前已验证 PowerShell 7.6 / .NET 10 与支持 `GAME_AssaultFireFuture` 的 CUE4Parse；脚本不下载或构建工具。单文件 `FModel.Cli.exe` 不能作为 DLL 目录。

需要 unversioned mappings 时加 `-MappingsPath 'D:/path/game.usmap'`，必须与输入来源匹配。默认 `-Game GAME_AssaultFireFuture`；其他游戏配置尚未验证。普通 NZM Numerical DataTable 的本次验证不需要 mappings。

## 验证与失败处理

成功时返回 JSON 摘要：输入、输出、解析库版本、导出对象数量、对象类型及 DataTable 行数。输出是 CUE4Parse 完整 exports 数组，保留 `Type`、`Name`、`Properties`、`Rows` 等结构，不展开成站点数据或 CSV。

脚本启用严格反序列化错误，序列化后重新解析 JSON，再以拒绝覆盖的方式写入。JSON 可解析与行数校验不证明所有 UE 类型都被完整支持；遇到未解析类型或缺字段，应报告限制。

缺 DLL、运行时不兼容、缺配套文件、mappings 或反序列化失败时，根据错误定位条件；不要修改输入或不断重试相同配置。若只有 pak 路径，转用 `nzm-assets` 的按需包内导出流程。

实现中的两个已验证细节：程序集解析回调用 C#，PowerShell scriptblock 回调可能递归触发模块加载导致栈溢出；导出通过 `ExportsLazy.Value` 读取，PowerShell 无法直接调用接口的无参默认 `GetExports()`。
