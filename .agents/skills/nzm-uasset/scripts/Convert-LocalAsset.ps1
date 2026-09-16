#requires -Version 7.0
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$AssetPath,
    [string]$OutputPath,
    [string]$LibraryDirectory,
    [string]$MappingsPath,
    [string]$Game = 'GAME_AssaultFireFuture'
)

$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$inputPath = [IO.Path]::GetFullPath($AssetPath)
if ([IO.Path]::GetExtension($inputPath) -ieq '.uexp') {
    $inputPath = [IO.Path]::ChangeExtension($inputPath, '.uasset')
}
if ([IO.Path]::GetExtension($inputPath) -ine '.uasset' -or ![IO.File]::Exists($inputPath)) {
    throw 'AssetPath must identify an existing .uasset (or its companion .uexp).'
}
$destination = if ($OutputPath) { [IO.Path]::GetFullPath($OutputPath) } else {
    [IO.Path]::ChangeExtension($inputPath, '.json')
}
if ([IO.Path]::GetExtension($destination) -ine '.json') { throw 'OutputPath must end in .json.' }
foreach ($referenceRoot in @('refs', 'refs-test', 'kismet')) {
    $protectedPrefix = [IO.Path]::GetFullPath((Join-Path $projectRoot $referenceRoot)) + [IO.Path]::DirectorySeparatorChar
    if ($destination.StartsWith($protectedPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Reference directories are read-only; specify OutputPath under MD/_local/<topic>/.'
    }
}
for ($ancestor = [IO.Path]::GetDirectoryName($destination); $ancestor; $ancestor = [IO.Path]::GetDirectoryName($ancestor)) {
    if ([IO.Directory]::Exists($ancestor) -and ([IO.File]::GetAttributes($ancestor) -band [IO.FileAttributes]::ReparsePoint)) {
        throw 'Output directory must not pass through a symbolic link or junction.'
    }
}
if (Test-Path -LiteralPath $destination) { throw "Output already exists: $destination" }
if (!$LibraryDirectory) { $LibraryDirectory = $env:NZM_CUE4PARSE_LIB }
if (!$LibraryDirectory) {
    $LibraryDirectory = Join-Path (Split-Path $projectRoot -Parent) 'FModel/FModel.Cli/bin/Release/net10.0'
}
$libraryRoot = [IO.Path]::GetFullPath($LibraryDirectory)
$parserPath = Join-Path $libraryRoot 'CUE4Parse.dll'
if (![IO.File]::Exists($parserPath)) {
    throw 'CUE4Parse.dll not found. Set LibraryDirectory or NZM_CUE4PARSE_LIB to an existing FModel DLL directory.'
}
if ($MappingsPath) {
    $MappingsPath = [IO.Path]::GetFullPath($MappingsPath)
    if (![IO.File]::Exists($MappingsPath)) { throw 'MappingsPath does not exist.' }
}

# A compiled resolver avoids recursive PowerShell module auto-loading callbacks.
Add-Type -TypeDefinition @'
public static class NzmLocalAssetAssemblyLoader {
    public static System.Func<System.Runtime.Loader.AssemblyLoadContext, System.Reflection.AssemblyName, System.Reflection.Assembly> Register(string root) {
        System.Func<System.Runtime.Loader.AssemblyLoadContext, System.Reflection.AssemblyName, System.Reflection.Assembly> resolver = (ctx, name) => {
            string path = System.IO.Path.Combine(root, name.Name + ".dll");
            return System.IO.File.Exists(path) ? ctx.LoadFromAssemblyPath(path) : null;
        };
        System.Runtime.Loader.AssemblyLoadContext.Default.Resolving += resolver;
        return resolver;
    }
}
'@
$resolver = [NzmLocalAssetAssemblyLoader]::Register($libraryRoot)
$provider = $null
$previousFatal = $null
try {
    $assembly = [Reflection.Assembly]::LoadFrom($parserPath)
    $previousFatal = [CUE4Parse.Globals]::FatalObjectSerializationErrors
    [CUE4Parse.Globals]::FatalObjectSerializationErrors = $true
    $gameValue = [Enum]::Parse([CUE4Parse.UE4.Versions.EGame], $Game)
    $provider = [CUE4Parse.FileProvider.DefaultFileProvider]::new(
        [IO.Path]::GetDirectoryName($inputPath), [IO.SearchOption]::TopDirectoryOnly,
        [CUE4Parse.UE4.Versions.VersionContainer]::new($gameValue), [StringComparer]::OrdinalIgnoreCase)
    if ($MappingsPath) {
        $provider.MappingsContainer = [CUE4Parse.MappingsProvider.Usmap.FileUsmapTypeMappingsProvider]::new($MappingsPath)
    }
    # Loose-file indexing only; do not mount containers or submit game keys.
    $provider.Initialize()
    $package = $provider.LoadPackage([IO.Path]::GetFileName($inputPath))
    if (!$package.CanDeserialize) { throw 'Package cannot deserialize; check matching mappings and game version.' }
    $exports = @($package.ExportsLazy | ForEach-Object { $_.Value })
    if (!$exports.Count -or @($exports | Where-Object { $null -eq $_ }).Count) {
        throw 'Package returned empty or null exports.'
    }
    $json = [Newtonsoft.Json.JsonConvert]::SerializeObject($exports, [Newtonsoft.Json.Formatting]::Indented)
    $parsed = ConvertFrom-Json -InputObject $json -AsHashtable -NoEnumerate -Depth 1024
    if ($parsed -isnot [array] -or $parsed.Count -ne $exports.Count) { throw 'JSON export count mismatch.' }
    $summary = @($parsed | ForEach-Object {
        $item = [ordered]@{ name = $_.Name; type = $_.Type }
        if ($_.ContainsKey('Rows')) { $item.rows = $_.Rows.Count }
        $item
    })
    [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($destination)) | Out-Null
    $stream = [IO.File]::Open($destination, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    try {
        $bytes = [Text.UTF8Encoding]::new($false).GetBytes($json)
        $stream.Write($bytes, 0, $bytes.Length)
    } finally { $stream.Dispose() }
    [ordered]@{
        input = $inputPath; output = $destination; bytes = $bytes.Length
        parser = $assembly.FullName; game = $Game; exportCount = $exports.Count; exports = $summary
    } | ConvertTo-Json -Depth 8
} finally {
    if ($provider) { $provider.Dispose() }
    if ($null -ne $previousFatal) { [CUE4Parse.Globals]::FatalObjectSerializationErrors = $previousFatal }
    [Runtime.Loader.AssemblyLoadContext]::Default.remove_Resolving($resolver)
}
