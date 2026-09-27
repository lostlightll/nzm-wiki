#requires -Version 7.0
# Export only the texture references used by the Origin talent table.
[CmdletBinding()]
param(
    [string]$LibraryDirectory,
    [string]$ExportDirectory,
    [int]$Limit = 23
)
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
if (!$LibraryDirectory) { $LibraryDirectory = Join-Path (Split-Path $root -Parent) 'FModel/FModel.Cli/bin/Release/net10.0' }
$run = if ($ExportDirectory) { [IO.Path]::GetFullPath($ExportDirectory) } else { Join-Path $root ('MD/_local/origin-talents/icons-' + [guid]::NewGuid().ToString('N')) }
[IO.Directory]::CreateDirectory($run) | Out-Null
$cli = Join-Path $root '.agents/skills/nzm-assets/tools/FModel.Cli.exe'
$profile = Join-Path $root 'MD/_local/nzm-assets/nzm.json'
Add-Type -TypeDefinition @'
public static class TalentAssemblyLoader {
    public static void Register(string root) {
        System.Runtime.Loader.AssemblyLoadContext.Default.Resolving += (ctx, name) => {
            string path = System.IO.Path.Combine(root, name.Name + ".dll");
            return System.IO.File.Exists(path) ? ctx.LoadFromAssemblyPath(path) : null;
        };
    }
}
'@
[TalentAssemblyLoader]::Register($LibraryDirectory)
[Reflection.Assembly]::LoadFrom((Join-Path $LibraryDirectory 'CUE4Parse.dll')) | Out-Null
[CUE4Parse.Globals]::FatalObjectSerializationErrors = $true
[CUE4Parse.UE4.Assets.ObjectTypeRegistry]::RegisterClass('Texture2DSpriteAtlas', [CUE4Parse.UE4.Assets.Exports.Texture.UTexture2D])
function Export-SelectedAsset([string]$virtualPath, [string]$directory) {
    $existing = Join-Path $directory ('raw/' + $virtualPath)
    if (Test-Path -LiteralPath $existing) { return $existing }
    $response = & $cli extract --profile $profile --asset $virtualPath --output-directory $directory
    if ($LASTEXITCODE -ne 0) { throw "Selected texture extraction failed: $virtualPath" }
    $parsed = $response | ConvertFrom-Json
    return @($parsed.result.files | Where-Object { $_.output.EndsWith('.uasset') })[0].output
}
$table = Get-Content (Join-Path $root 'refs/Exports/NZM/Content/DataTables/LuaDataTable/RoguelikeTechEffectConfig.json') -Raw | ConvertFrom-Json
$overrides = Get-Content (Join-Path $root 'data/origin/talent-icon-overrides.json') -Raw | ConvertFrom-Json -AsHashtable
$assets = @($table[0].Rows.psobject.Properties.Value | Where-Object { !$overrides.ContainsKey([string]$_.TechSkill_Id) } | ForEach-Object { $_.IconPath.AssetPathName } | Sort-Object -Unique | Select-Object -First $Limit)
$manifest = @()
foreach ($asset in $assets) {
    $virtual = ($asset.Split('.')[0] -replace '^/Game/', 'NZM/Content/') + '.uasset'
    $inputFile = Export-SelectedAsset $virtual (Join-Path $run 'raw')
    $provider = [CUE4Parse.FileProvider.DefaultFileProvider]::new(
        [IO.Path]::GetDirectoryName($inputFile), [IO.SearchOption]::TopDirectoryOnly,
        [CUE4Parse.UE4.Versions.VersionContainer]::new([CUE4Parse.UE4.Versions.EGame]::GAME_AssaultFireFuture), [StringComparer]::OrdinalIgnoreCase)
    try {
        $provider.Initialize()
        $package = $provider.LoadPackage([IO.Path]::GetFileName($inputFile))
        $exports = @($package.ExportsLazy | ForEach-Object { $_.Value })
        $texture = @($exports | Where-Object { $_ -is [CUE4Parse.UE4.Assets.Exports.Texture.UTexture] })[0]
        $crop = $null
        $atlasProvider = $null
        if (!$texture) {
            $objects = [Newtonsoft.Json.JsonConvert]::SerializeObject($exports) | ConvertFrom-Json
            $sprite = @($objects | Where-Object Type -eq 'PaperSprite')[0]
            if (!$sprite) { throw "Expected texture or PaperSprite: $virtual" }
            $properties = $sprite.Properties
            $atlasPath = ($properties.BakedSourceTexture.ObjectPath -replace '^/Game/', 'NZM/Content/') + '.uasset'
            $atlasFile = Export-SelectedAsset $atlasPath (Join-Path $run 'atlas')
            $atlasProvider = [CUE4Parse.FileProvider.DefaultFileProvider]::new(
                [IO.Path]::GetDirectoryName($atlasFile), [IO.SearchOption]::TopDirectoryOnly,
                [CUE4Parse.UE4.Versions.VersionContainer]::new([CUE4Parse.UE4.Versions.EGame]::GAME_AssaultFireFuture), [StringComparer]::OrdinalIgnoreCase)
            $atlasProvider.Initialize()
            $atlasPackage = $atlasProvider.LoadPackage([IO.Path]::GetFileName($atlasFile))
            $texture = @($atlasPackage.ExportsLazy | ForEach-Object { $_.Value } | Where-Object { $_ -is [CUE4Parse.UE4.Assets.Exports.Texture.UTexture] })[0]
            $crop = @([int]$properties.BakedSourceUV.X, [int]$properties.BakedSourceUV.Y, [int]$properties.BakedSourceDimension.X, [int]$properties.BakedSourceDimension.Y)
        }
        $mip = $texture.GetMip($texture.GetFirstMipIndex())
        $bytes = $mip.BulkData.Data
        if (!$bytes.Length) { throw "Empty texture mip: $virtual" }
        $name = [IO.Path]::GetFileNameWithoutExtension($inputFile)
        $payload = Join-Path $run ($name + '.bin')
        if (!(Test-Path -LiteralPath $payload)) { [IO.File]::WriteAllBytes($payload, $bytes) }
        $manifest += [ordered]@{ name=$name; asset=$virtual; width=$mip.SizeX; height=$mip.SizeY; format=$texture.Format.ToString(); payload=$payload; crop=$crop }
        Write-Host "Read texture: $name ($($mip.SizeX)x$($mip.SizeY), $($texture.Format))"
    } finally { if ($atlasProvider) { $atlasProvider.Dispose() }; $provider.Dispose() }
}
$manifestPath = Join-Path $run 'manifest.json'
ConvertTo-Json -InputObject $manifest -Depth 5 | Set-Content -LiteralPath $manifestPath -Encoding utf8
python (Join-Path $PSScriptRoot 'decode-talent-icons.py') $manifestPath (Join-Path $root 'public/icons/origin/talents')
if ($LASTEXITCODE -ne 0) { throw 'Texture image decoding failed' }
Write-Host "Texture provenance: $manifestPath"
