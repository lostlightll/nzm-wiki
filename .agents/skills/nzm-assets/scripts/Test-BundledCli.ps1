<# Validates the bundled distribution without reading a game profile or mounting game files. #>
$ErrorActionPreference = 'Stop'
$skill = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$exe = Join-Path $skill 'tools/FModel.Cli.exe'
$infoPath = Join-Path $skill 'tools/BUILDINFO.json'
if (!(Test-Path -LiteralPath $exe -PathType Leaf)) { throw 'Bundled FModel.Cli.exe is missing; restore its Git LFS object.' }
if (!(Test-Path -LiteralPath $infoPath -PathType Leaf)) { throw 'Bundled BUILDINFO.json is missing.' }
$stream = [IO.File]::OpenRead($exe)
try {
    if ($stream.ReadByte() -ne 0x4d -or $stream.ReadByte() -ne 0x5a) {
        throw 'Bundled CLI is not a Windows executable; check whether Git LFS left a pointer file.'
    }
} finally { $stream.Dispose() }
$info = Get-Content -LiteralPath $infoPath -Raw | ConvertFrom-Json
if ($info.sha256 -notmatch '^[0-9a-fA-F]{64}$' -or $info.sourceCommit -notmatch '^[0-9a-fA-F]{40}$') { throw 'Invalid bundled build provenance.' }
if ((Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash -ne $info.sha256) { throw 'Bundled CLI does not match BUILDINFO.json SHA-256.' }
foreach ($name in @('FModel-LICENSE', 'FModel-NOTICE', 'CUE4Parse-LICENSE', 'Lua-NOTICE')) {
    if (!(Test-Path -LiteralPath (Join-Path $skill "licenses/$name") -PathType Leaf)) { throw "Missing bundled notice: $name" }
}
$help = (& $exe --help) -join "`n"
if ($LASTEXITCODE -ne 0) { throw 'Bundled CLI help check failed.' }
foreach ($command in @('mount', 'search', 'containers', 'list', 'diff', 'inspect', 'extract', 'lua-functions', 'lua-disasm', 'lua-diff')) {
    if ($help -notmatch "\b$command\b") { throw "Bundled CLI is missing required command: $command" }
}
[ordered]@{
    ok = $true
    sourceCommit = $info.sourceCommit
    sha256 = $info.sha256
    runtimeIdentifier = $info.runtimeIdentifier
    bytes = (Get-Item -LiteralPath $exe).Length
} | ConvertTo-Json
