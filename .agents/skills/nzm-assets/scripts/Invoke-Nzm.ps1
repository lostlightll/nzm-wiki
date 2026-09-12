param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('mount', 'search', 'containers', 'list', 'diff', 'inspect', 'extract', 'lua-functions', 'lua-disasm', 'lua-diff')][string]$Command,
    [string]$Query,
    [string]$Extension,
    [ValidateRange(0, 2147483647)][int]$Offset = 0,
    [ValidateRange(1, 200)][int]$Limit = 20,
    [string]$Asset,
    [string]$Container,
    [string]$Against,
    [ValidateRange(1, 1000)][int]$MaxDifferences = 20,
    [ValidateRange(1, 64)][int]$MaxDepth = 32,
    [ValidateRange(1, 2000000)][int]$MaxNodes = 100000,
    [ValidateSet('auto', 'lua53', 'slua53')][string]$Dialect = 'auto',
    [string]$Function,
    [ValidateRange(1, 1000)][int]$MaxChanges = 100,
    [ValidateRange(1, 10000000)][int]$MaxWork = 2000000,
    [string]$CliPath,
    [string]$Profile
)

$ErrorActionPreference = 'Stop'
$project = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$bundledCli = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../tools/FModel.Cli.exe'))

function Resolve-ProjectPath([string]$Path) {
    if ([IO.Path]::IsPathFullyQualified($Path)) { return [IO.Path]::GetFullPath($Path) }
    return [IO.Path]::GetFullPath((Join-Path $project $Path))
}

if ([string]::IsNullOrWhiteSpace($CliPath)) {
    $CliPath = if ([string]::IsNullOrWhiteSpace($env:NZM_FMODEL_CLI)) {
        $bundledCli
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
    throw "FModel EXE not found at '$CliPath'; restore the bundled tool, set NZM_FMODEL_CLI, or provide -CliPath."
}
# A Git LFS pointer exists as a file but cannot be executed.
$cliStream = [IO.File]::OpenRead($CliPath)
try {
    if ($cliStream.ReadByte() -ne 0x4d -or $cliStream.ReadByte() -ne 0x5a) {
        throw 'FModel CLI is not a Windows executable; restore the Git LFS object if this is a pointer file.'
    }
} finally { $cliStream.Dispose() }
if (!(Test-Path -LiteralPath $Profile -PathType Leaf)) {
    throw "Private game profile not found at '$Profile'; create the project-local profile, set NZM_FMODEL_PROFILE, or provide -Profile."
}
$luaCommands = @('lua-functions', 'lua-disasm', 'lua-diff')
$pagedCommands = @('search', 'containers', 'list') + $luaCommands
if ($Command -in (@('inspect', 'extract', 'diff') + $luaCommands) -and [string]::IsNullOrWhiteSpace($Asset)) { throw '-Asset is required.' }
if ($Command -in (@('list', 'diff') + $luaCommands) -and [string]::IsNullOrWhiteSpace($Container)) { throw '-Container is required.' }
if ($Command -eq 'lua-disasm' -and [string]::IsNullOrWhiteSpace($Function)) { throw '-Function is required for lua-disasm; use an id returned by lua-functions.' }
if ($Command -notin $pagedCommands -and ($PSBoundParameters.ContainsKey('Offset') -or $PSBoundParameters.ContainsKey('Limit'))) {
    throw 'Offset and Limit apply only to search, containers, list and Lua commands.'
}
if ($Command -notin @('search', 'containers', 'list', 'lua-functions') -and $PSBoundParameters.ContainsKey('Query')) { throw 'Query applies only to search, containers, list and lua-functions.' }
if ($Command -ne 'search' -and $PSBoundParameters.ContainsKey('Extension')) { throw 'Extension is search-only.' }
if ($Command -notin (@('inspect', 'extract', 'diff') + $luaCommands) -and $PSBoundParameters.ContainsKey('Asset')) { throw 'Asset applies only to inspect, extract, diff and Lua commands.' }
if ($Command -notin (@('list', 'diff') + $luaCommands) -and $PSBoundParameters.ContainsKey('Container')) { throw 'Container applies only to list, diff and Lua commands.' }
if ($Command -notin @('diff', 'lua-diff') -and $PSBoundParameters.ContainsKey('Against')) { throw 'Against applies only to diff and lua-diff.' }
if ($Command -ne 'diff' -and ($PSBoundParameters.ContainsKey('MaxDifferences') -or $PSBoundParameters.ContainsKey('MaxDepth') -or $PSBoundParameters.ContainsKey('MaxNodes'))) { throw 'MaxDifferences, MaxDepth and MaxNodes apply only to structured diff.' }
if ($Command -notin $luaCommands -and $PSBoundParameters.ContainsKey('Dialect')) { throw 'Dialect applies only to Lua commands.' }
if ($Command -notin @('lua-disasm', 'lua-diff') -and $PSBoundParameters.ContainsKey('Function')) { throw 'Function applies only to lua-disasm and lua-diff.' }
if ($Command -eq 'lua-diff' -and $PSBoundParameters.ContainsKey('Function') -and [string]::IsNullOrWhiteSpace($Function)) { throw 'Function must be a nonempty returned id.' }
if ($Command -ne 'lua-diff' -and ($PSBoundParameters.ContainsKey('MaxChanges') -or $PSBoundParameters.ContainsKey('MaxWork'))) { throw 'MaxChanges and MaxWork apply only to lua-diff.' }

# Read-only commands pass the existing profile directly; no temporary files.
$arguments = @($Command, '--profile', $Profile)
if ($Command -in $pagedCommands) {
    $arguments += @('--offset', "$Offset", '--limit', "$Limit")
    if ($Query) { $arguments += @('--query', $Query) }
    if ($Extension) { $arguments += @('--extension', $Extension) }
}
if ($Asset) { $arguments += @('--asset', $Asset) }
if ($Container) { $arguments += @('--container', $Container) }
if ($Command -eq 'diff') {
    if ($Against) { $arguments += @('--against', $Against) }
    $arguments += @('--max-differences', "$MaxDifferences", '--max-depth', "$MaxDepth", '--max-nodes', "$MaxNodes")
}
if ($Command -in $luaCommands) {
    $arguments += @('--dialect', $Dialect)
    if ($Function) { $arguments += @('--function', $Function) }
}
if ($Command -eq 'lua-diff') {
    if ($Against) { $arguments += @('--against', $Against) }
    $arguments += @('--max-changes', "$MaxChanges", '--max-work', "$MaxWork")
}
if ($Command -in @('inspect', 'extract')) {
    $run = Join-Path $project ('MD/_local/nzm-assets/' + [guid]::NewGuid().ToString('N'))
    for ($current = $run; $current; $current = Split-Path -Parent $current) {
        if ((Test-Path -LiteralPath $current) -and ((Get-Item -LiteralPath $current -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw 'Local output cannot contain symbolic links or junctions.'
        }
    }
    & git -C $project check-ignore -q -- 'MD/_local/nzm-assets/exports/probe.json'
    if ($LASTEXITCODE -ne 0) { throw 'Asset exports must be Git-ignored.' }
    $arguments += @('--output-directory', (Join-Path $run 'exports'))
}
& $CliPath @arguments
$code = $LASTEXITCODE
exit $code
