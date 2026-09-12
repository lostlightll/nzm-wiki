param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('mount', 'search', 'inspect', 'extract')][string]$Command,
    [string]$Query,
    [string]$Extension,
    [ValidateRange(0, 2147483647)][int]$Offset = 0,
    [ValidateRange(1, 200)][int]$Limit = 50,
    [string]$Asset,
    [string]$CliPath,
    [string]$Profile
)

$ErrorActionPreference = 'Stop'
$project = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))

function Resolve-ProjectPath([string]$Path) {
    if ([IO.Path]::IsPathFullyQualified($Path)) { return [IO.Path]::GetFullPath($Path) }
    return [IO.Path]::GetFullPath((Join-Path $project $Path))
}

if ([string]::IsNullOrWhiteSpace($CliPath)) {
    $CliPath = if ([string]::IsNullOrWhiteSpace($env:NZM_FMODEL_CLI)) {
        'MD/_local/nzm-assets/tools/FModel.Cli.exe'
    } else {
        $env:NZM_FMODEL_CLI
    }
}
if ([string]::IsNullOrWhiteSpace($Profile)) {
    $Profile = if ([string]::IsNullOrWhiteSpace($env:NZM_FMODEL_PROFILE)) {
        'MD/_local/nzm-assets/nzm.json'
    } else {
        $env:NZM_FMODEL_PROFILE
    }
}
$CliPath = Resolve-ProjectPath $CliPath
$Profile = Resolve-ProjectPath $Profile

if (!(Test-Path -LiteralPath $CliPath -PathType Leaf)) {
    throw "FModel EXE not found at '$CliPath'; install it at the project-local default, set NZM_FMODEL_CLI, or provide -CliPath."
}
if (!(Test-Path -LiteralPath $Profile -PathType Leaf)) {
    throw "Private game profile not found at '$Profile'; create the project-local profile, set NZM_FMODEL_PROFILE, or provide -Profile."
}
if ($Command -in @('inspect', 'extract') -and [string]::IsNullOrWhiteSpace($Asset)) { throw '-Asset is required.' }
if ($Command -ne 'search' -and ($PSBoundParameters.ContainsKey('Query') -or $PSBoundParameters.ContainsKey('Extension') -or $PSBoundParameters.ContainsKey('Offset') -or $PSBoundParameters.ContainsKey('Limit'))) {
    throw 'Query, Extension, Offset and Limit are search-only options.'
}
if ($Command -notin @('inspect', 'extract') -and $PSBoundParameters.ContainsKey('Asset')) { throw 'Asset is inspect/extract-only.' }

$run = Join-Path $project ('MD/_local/nzm-assets/' + [guid]::NewGuid().ToString('N'))
# Keep temporary credentials out of linked directories and tracked locations.
for ($current = $run; $current; $current = Split-Path -Parent $current) {
    if ((Test-Path -LiteralPath $current) -and ((Get-Item -LiteralPath $current -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw 'Local output cannot contain symbolic links or junctions.'
    }
}
& git -C $project check-ignore -q -- 'MD/_local/nzm-assets/profile.json'
if ($LASTEXITCODE -ne 0) { throw 'MD/_local/nzm-assets must be Git-ignored before storing a private temporary profile.' }

$config = Get-Content -LiteralPath $Profile -Raw | ConvertFrom-Json
$base = Split-Path -Parent ([IO.Path]::GetFullPath($Profile))
$config.Directory = [IO.Path]::GetFullPath($config.Directory, $base)
if ($config.Mappings) { $config.Mappings = [IO.Path]::GetFullPath($config.Mappings, $base) }
$config.OutputDirectory = Join-Path $run 'exports'
[IO.Directory]::CreateDirectory($run) | Out-Null
$temporaryProfile = Join-Path $run 'profile.json'
$arguments = @($Command, '--profile', $temporaryProfile)
if ($Command -eq 'search') {
    $arguments += @('--offset', "$Offset", '--limit', "$Limit")
    if ($Query) { $arguments += @('--query', $Query) }
    if ($Extension) { $arguments += @('--extension', $Extension) }
}
if ($Asset) { $arguments += @('--asset', $Asset) }
try {
    $config | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $temporaryProfile -Encoding utf8
    & $CliPath @arguments
    $code = $LASTEXITCODE
}
finally {
    if (Test-Path -LiteralPath $temporaryProfile) { Remove-Item -LiteralPath $temporaryProfile -Force }
}
exit $code
