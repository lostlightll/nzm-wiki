param(
    [string]$Asset = 'NZM/Content/Abilities/Skills/Season/S2/TabooEyes/BP_TabooEyes2.uasset',
    [string]$CliAssembly = 'D:/Claude/FModel/FModel.Cli/bin/Release/net10.0/FModel.Cli.dll',
    [string]$Profile = 'D:/Claude/FModel/.local/nzm.json',
    [ValidateSet('live', 'test', 'unknown')][string]$Dataset = 'unknown',
    [string]$SourceLabel
)

$ErrorActionPreference = 'Stop'
# Preserve the legacy entry point and JSON output consumed by cli.ts.
& (Join-Path $PSScriptRoot '../inspect-nzm-bytecode.ps1') -Assets @($Asset) -AssemblyPath $CliAssembly -ProfilePath $Profile -Dataset $Dataset -SourceLabel $SourceLabel
