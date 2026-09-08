param(
    [string]$Asset = 'NZM/Content/Abilities/Skills/Season/S2/TabooEyes/BP_TabooEyes2.uasset',
    [string]$CliAssembly = 'D:/Claude/FModel/FModel.Cli/bin/Release/net10.0/FModel.Cli.dll',
    [string]$Profile = 'D:/Claude/FModel/.local/nzm.json'
)

$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$profilePath = (Resolve-Path -LiteralPath $Profile).Path
$assemblyPath = (Resolve-Path -LiteralPath $CliAssembly).Path
$output = Join-Path $root ('MD/_local/nzm-assets/s1-kismet-' + [guid]::NewGuid().ToString('N'))
& git -C $root check-ignore -q -- 'MD/_local/nzm-assets/profile.json'
if ($LASTEXITCODE -ne 0) { throw 'Evidence output must be Git-ignored.' }
for ($parent = $output; $parent; $parent = Split-Path -Parent $parent) {
    if ((Test-Path -LiteralPath $parent) -and ((Get-Item -LiteralPath $parent -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw 'Evidence output must not traverse a link or junction.'
    }
}

# The existing CLI has no ReadScriptData switch; enable its provider in memory.
# Requires a PowerShell host compatible with the installed CLI's .NET runtime.
$assembly = [Reflection.Assembly]::LoadFrom($assemblyPath)
$profileType = $assembly.GetType('FModel.Cli.GameProfile', $true)
$sessionType = $assembly.GetType('FModel.Cli.GameSession', $true)
$config = [Newtonsoft.Json.JsonConvert]::DeserializeObject([IO.File]::ReadAllText($profilePath), $profileType)
$base = Split-Path -Parent $profilePath
$config.Directory = [IO.Path]::GetFullPath($config.Directory, $base)
if ($config.Mappings) { $config.Mappings = [IO.Path]::GetFullPath($config.Mappings, $base) }
$config.OutputDirectory = $output
$session = [Activator]::CreateInstance($sessionType, [object[]]@($config))
try {
    $provider = $sessionType.GetProperty('Provider').GetValue($session)
    $provider.ReadScriptData = $true
    $result = $sessionType.GetMethod('Inspect').Invoke($session, [object[]]@(
        $Asset))
    [Newtonsoft.Json.JsonConvert]::SerializeObject($result)
} finally {
    $session.Dispose()
}
