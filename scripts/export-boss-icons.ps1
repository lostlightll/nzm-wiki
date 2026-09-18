#requires -Version 7.0
<# In place, selected Boss textures only. Decode the resulting manifest with
  python scripts/overlimit/decode-preview-icons.py <OutputRoot> before publishing. #>
param(
 [Parameter(Mandatory)][string[]]$Slug,
 [string]$OutputRoot = 'MD/_local/boss-icons',
 [string]$LibraryDirectory
)
$ErrorActionPreference = 'Stop'
$sourceRoot = [IO.Path]::GetFullPath('refs/Exports/NZM/Content')
$targetRoot = [IO.Path]::GetFullPath($OutputRoot)
if ($targetRoot.Equals($sourceRoot, [StringComparison]::OrdinalIgnoreCase) -or $targetRoot.StartsWith($sourceRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Source Content must remain read-only.' }
if (!$LibraryDirectory) { $LibraryDirectory = $env:NZM_CUE4PARSE_LIB }
if (!$LibraryDirectory) { $LibraryDirectory = Join-Path (Split-Path $PSScriptRoot -Parent) '../FModel/FModel.Cli/bin/Release/net10.0' }
Add-Type -TypeDefinition @'
public static class BossTextureLoader {
 public static void Register(string root) {
  System.Runtime.Loader.AssemblyLoadContext.Default.Resolving += (ctx,name) => {
   var file=System.IO.Path.Combine(root,name.Name+".dll");
   return System.IO.File.Exists(file)?ctx.LoadFromAssemblyPath(file):null;
  };
 }
}
'@
[BossTextureLoader]::Register([IO.Path]::GetFullPath($LibraryDirectory))
[Reflection.Assembly]::LoadFrom((Join-Path $LibraryDirectory 'CUE4Parse.dll')) | Out-Null
[CUE4Parse.Globals]::FatalObjectSerializationErrors = $true
$sources = Get-Content -Raw 'data/enemies/lc/boss/health-sources.json' | ConvertFrom-Json -AsHashtable
$monsters = (Get-Content -Raw "$sourceRoot/DataTables/MonsterUniqueIDTable.json" | ConvertFrom-Json -AsHashtable -NoEnumerate)[0].Rows
$manifest = @()
foreach ($name in $Slug) {
 if (!$sources.ContainsKey($name)) { throw "Unknown boss slug: $name" }
 $id = [string]$sources[$name].stages[0]
 $relative = ([string]$monsters[$id].MonsterIcon.AssetPathName).Replace('/Game/', '').Split('.')[0]
 if (!$relative.StartsWith('UI/')) { throw "Missing UI icon reference: $name ($id)" }
 $asset = Join-Path $sourceRoot "$relative.uasset"
 $destination = Join-Path $targetRoot "$relative.bin"
 if (Test-Path -LiteralPath $destination) { throw "Refusing to overwrite: $destination" }
 $provider = [CUE4Parse.FileProvider.DefaultFileProvider]::new([IO.Path]::GetDirectoryName($asset),[IO.SearchOption]::TopDirectoryOnly,[CUE4Parse.UE4.Versions.VersionContainer]::new([CUE4Parse.UE4.Versions.EGame]::GAME_AssaultFireFuture),[StringComparer]::OrdinalIgnoreCase)
 try {
  $provider.Initialize()
  $package = $provider.LoadPackage([IO.Path]::GetFileName($asset))
  $textures = @($package.ExportsLazy | ForEach-Object { $_.Value } | Where-Object { $_ -is [CUE4Parse.UE4.Assets.Exports.Texture.UTexture2D] })
  if ($textures.Count -ne 1) { throw "Expected one Texture2D: $asset" }
  $texture = $textures[0]; $mip = $texture.GetFirstMip()
  if (!$mip -or !$mip.BulkData.Data.Length) { throw "Texture has no readable mip: $asset" }
  [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($destination)) | Out-Null
  [IO.File]::WriteAllBytes($destination, $mip.BulkData.Data)
  $manifest += @{ slug=$name; sourceId=$id; path=$relative; width=$mip.SizeX; height=$mip.SizeY; format=[string]$texture.Format }
 } finally { $provider.Dispose() }
}
ConvertTo-Json -InputObject $manifest -Depth 6 | Set-Content -LiteralPath (Join-Path $targetRoot 'manifest.json') -Encoding utf8
Write-Output "Exported $($manifest.Count) selected Boss texture payloads to $targetRoot."
