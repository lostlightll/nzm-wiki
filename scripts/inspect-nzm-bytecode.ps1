<#
.SYNOPSIS
Read Blueprint bytecode through an already-built local FModel CLI assembly.
.DESCRIPTION
Uses the existing parser with ReadScriptData enabled. Does not build or modify
FModel, modify refs, or print/write credentials. Exports go to ignored kismet/.
#>
param(
    [Parameter(Mandatory=$true)][string[]]$Assets,
    [string]$AssemblyPath = 'D:/Claude/FModel/FModel.Cli/bin/Release/net10.0/win-x64/FModel.Cli.dll',
    [string]$ProfilePath = 'D:/Claude/FModel/.local/nzm.json',
    [ValidateSet('live', 'test', 'unknown')][string]$Dataset = 'unknown',
    [string]$SourceLabel
)
$ErrorActionPreference = 'Stop'
if (!(Test-Path -LiteralPath $AssemblyPath -PathType Leaf)) { throw 'Existing FModel.Cli.dll required; this script does not build tools.' }
if (!(Test-Path -LiteralPath $ProfilePath -PathType Leaf)) { throw 'Local game profile required.' }
# Resolve in PowerShell's location before passing paths to .NET APIs.
$AssemblyPath = (Resolve-Path -LiteralPath $AssemblyPath).ProviderPath
$ProfilePath = (Resolve-Path -LiteralPath $ProfilePath).ProviderPath
$projectRoot = Split-Path -Parent $PSScriptRoot
$snapshot = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ') + '-' + [Guid]::NewGuid().ToString('N')
$outputRoot = Join-Path $projectRoot "kismet/$Dataset/$snapshot"
& git -C $projectRoot check-ignore -q -- "kismet/$Dataset/$snapshot/manifest.json"
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
$manifest = [ordered]@{
    schemaVersion = 1
    dataset = $Dataset
    sourceLabel = $SourceLabel
    createdAtUtc = [DateTime]::UtcNow.ToString('o')
    requestedAssets = @($Assets)
    tool = @{ name = 'FModel.Cli'; version = $assembly.GetName().Version.ToString(); sha256 = (Get-FileHash -LiteralPath $AssemblyPath -Algorithm SHA256).Hash }
    status = 'in-progress'
    files = @()
}
[IO.Directory]::CreateDirectory($outputRoot) | Out-Null
$manifestPath = Join-Path $outputRoot 'manifest.json'
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding utf8
$session = $null
try {
    $session = [Activator]::CreateInstance($sessionType, @($profile))
    $session.Provider.ReadScriptData = $true
    foreach ($asset in $Assets) {
        $result = $session.Inspect($asset)
        $manifest.files += @{
            asset = $result.asset
            path = [IO.Path]::GetRelativePath($outputRoot, $result.output).Replace('\', '/')
            sha256 = (Get-FileHash -LiteralPath $result.output -Algorithm SHA256).Hash
        }
        $result | ConvertTo-Json -Depth 4
    }
    $manifest.status = 'exported'
} catch {
    $manifest.status = 'failed'
    throw
} finally {
    try {
        $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding utf8
    } finally {
        if ($session) { $session.Dispose() }
        $profile = $null
    }
}
