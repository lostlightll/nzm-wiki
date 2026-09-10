<#
.SYNOPSIS
Read Blueprint bytecode through an already-built local FModel CLI assembly.
.DESCRIPTION
Uses the existing parser with ReadScriptData enabled. Does not build or modify
FModel, modify refs, or print/write credentials. Exports go to ignored MD/_local.
#>
param(
    [Parameter(Mandatory=$true)][string[]]$Assets,
    [string]$AssemblyPath = 'D:/Claude/FModel/FModel.Cli/bin/Release/net10.0/win-x64/FModel.Cli.dll',
    [string]$ProfilePath = 'D:/Claude/FModel/.local/nzm.json'
)
$ErrorActionPreference = 'Stop'
if (!(Test-Path -LiteralPath $AssemblyPath -PathType Leaf)) { throw 'Existing FModel.Cli.dll required; this script does not build tools.' }
if (!(Test-Path -LiteralPath $ProfilePath -PathType Leaf)) { throw 'Local game profile required.' }
$projectRoot = Split-Path -Parent $PSScriptRoot
$outputRoot = Join-Path $projectRoot ('MD/_local/nzm-bytecode/' + [Guid]::NewGuid().ToString('N'))
& git -C $projectRoot check-ignore -q -- 'MD/_local/nzm-bytecode/probe.json'
if ($LASTEXITCODE -ne 0) { throw 'Bytecode export directory must be Git-ignored.' }
for ($current = $outputRoot; $current; $current = Split-Path -Parent $current) {
    if ((Test-Path -LiteralPath $current) -and ((Get-Item -LiteralPath $current -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw 'Bytecode output cannot traverse symbolic links or junctions.'
    }
}
$assembly = [Reflection.Assembly]::LoadFrom([IO.Path]::GetFullPath($AssemblyPath))
$profileType = $assembly.GetType('FModel.Cli.GameProfile', $true)
$sessionType = $assembly.GetType('FModel.Cli.GameSession', $true)
$profileText = [IO.File]::ReadAllText($ProfilePath)
$profile = [Newtonsoft.Json.JsonConvert]::DeserializeObject($profileText, $profileType)
$profileText = $null
$profileBase = Split-Path -Parent ([IO.Path]::GetFullPath($ProfilePath))
$profile.Directory = [IO.Path]::GetFullPath($profile.Directory, $profileBase)
if ($profile.Mappings) { $profile.Mappings = [IO.Path]::GetFullPath($profile.Mappings, $profileBase) }
$profile.OutputDirectory = $outputRoot
$session = $null
try {
    $session = [Activator]::CreateInstance($sessionType, @($profile))
    $session.Provider.ReadScriptData = $true
    foreach ($asset in $Assets) {
        $session.Inspect($asset) | ConvertTo-Json -Depth 4
    }
} finally {
    if ($session) { $session.Dispose() }
    $profile = $null
}
