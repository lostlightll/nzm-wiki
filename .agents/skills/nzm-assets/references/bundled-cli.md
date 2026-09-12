# 内置 CLI 的边界与维护

内置 `tools/FModel.Cli.exe` 是 Windows x64 自包含单文件 FModel CLI。`mount` / `search` / `containers` / `list` / `diff` 原地读取已有文件并返回 JSON；`lua-functions` / `lua-disasm` / `lua-diff` 原生读取 Lua 5.3 / Tencent slua 字节码，列函数、反汇编和比较版本，不恢复完整 Lua 源码。`inspect` 输出属性 JSON，`extract` 输出选定资产及配套文件，二者通过 `--output-directory` 指定输出。当前版本不提供 Blueprint Kismet 接口，也不是供 PowerShell 反射加载的独立 DLL。

`.uasset` 导出后由 `nzm-uasset` 负责分析。不要将 EXE 路径传给旧 Kismet 脚本的 `-AssemblyPath`；该脚本仍依赖另行提供的兼容 DLL 安装。完善独立资产分析能力时，应先核验其解析器和输入格式，不在 Wiki 中自行派生 FModel 补丁。

## 更新内置工具

1. 在 FModel 源码项目维护 CLI；从已提交且可追溯的源码及其固定 CUE4Parse 子模块构建。改动 CLI 能力时同步更新其源码、帮助和测试，不直接修改二进制。
2. 发布为 `net10.0` / `win-x64` 自包含单文件，包含自解压本机库，关闭 trimming 与调试符号。构建输出暂存于忽略目录，验证后替换 Skill 内置 EXE。仅运行工具不需要 SDK，重新构建需要兼容 SDK。
3. 更新 `tools/BUILDINFO.json` 的源码 commit、构建日期、SDK 版本和 EXE SHA-256，核对许可证，包括 Lua / slua 指令映射的来源与许可。元数据使用仓库标识和相对路径，不记录开发者本机路径或 profile 内容。
4. 执行 `scripts/Test-BundledCli.ps1`，并用 `git check-attr filter -- .agents/skills/nzm-assets/tools/FModel.Cli.exe` 确认 LFS 属性。用已有 profile 验证按容器列条目、单资产 diff 和本次改动的 Lua 接口，检查未新增导出目录；分发自检不需要 AES 或 profile。只有需要检查导出行为时才额外导出一个小资产。

私有配置默认位于项目内 `MD/_local/nzm-assets/nzm.json`，缺失时提示用户配置，不创建 AES key，不将外部配置自动复制进 Skill。`-CliPath` / `-Profile` 优先于对应环境变量，再使用内置 EXE / 项目内 profile；所有相对覆盖路径相对于项目根目录。
