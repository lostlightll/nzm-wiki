param(
    [string]$Asset = 'NZM/Content/Abilities/Skills/Season/S2/TabooEyes/BP_TabooEyes2.uasset',
    [string]$CliAssembly,
    [string]$Profile,
    [ValidateSet('live', 'test', 'unknown')][string]$Dataset = 'unknown',
    [string]$SourceLabel
)

$ErrorActionPreference = 'Stop'
# Preserve the legacy entry point and JSON output consumed by cli.ts.
$paths = @{}
if ($PSBoundParameters.ContainsKey('CliAssembly')) { $paths.AssemblyPath = $CliAssembly }
if ($PSBoundParameters.ContainsKey('Profile')) { $paths.ProfilePath = $Profile }
& (Join-Path $PSScriptRoot '../inspect-nzm-bytecode.ps1') -Assets @($Asset) -Dataset $Dataset -SourceLabel $SourceLabel @paths
