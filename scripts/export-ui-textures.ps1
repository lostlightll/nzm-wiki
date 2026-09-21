#requires -Version 7.0
<# Export selected UI icon mip payloads in place; decode with decode-ui-textures.py.
   Without PlanPath, only save the exact selection. No game containers are copied. #>
param(
    [Parameter(Mandatory)][string]$OutputRoot,
    [Parameter(Mandatory)][string]$ExcludeContainer,
    [string]$PlanPath,
    [string]$AssemblyPath = 'D:/Workspace/FModel/FModel.Cli/bin/Release/net10.0/FModel.Cli.dll',
    [string]$ProfilePath = 'MD/_local/nzm-assets/nzm.json',
    [int]$MaxAssets = 6000
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$OutputRoot = [IO.Path]::GetFullPath($OutputRoot, $projectRoot)
$AssemblyPath = [IO.Path]::GetFullPath($AssemblyPath, $projectRoot)
$ProfilePath = [IO.Path]::GetFullPath($ProfilePath, $projectRoot)
if (Test-Path -LiteralPath $OutputRoot) { throw 'Output root must be new.' }
for ($current = $OutputRoot; $current; $current = Split-Path -Parent $current) {
    if ((Test-Path -LiteralPath $current) -and ((Get-Item -LiteralPath $current -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Output cannot traverse links.' }
}
$assembly = [Reflection.Assembly]::LoadFrom($AssemblyPath)
$profileType = $assembly.GetType('FModel.Cli.GameProfile', $true)
$sessionType = $assembly.GetType('FModel.Cli.GameSession', $true)
$constructor = $sessionType.GetConstructor([Type[]]@($profileType, [bool], [string]))
if (!$constructor) { throw 'Native container exclusion is required.' }
$profile = [Newtonsoft.Json.JsonConvert]::DeserializeObject([IO.File]::ReadAllText($ProfilePath), $profileType)
$profileBase = Split-Path -Parent $ProfilePath
$profile.Directory = [IO.Path]::GetFullPath($profile.Directory, $profileBase)
if ($profile.Mappings) { $profile.Mappings = [IO.Path]::GetFullPath($profile.Mappings, $profileBase) }
$profile.OutputDirectory = $OutputRoot
$session = $null
$stdout = [Console]::Out
[Console]::SetOut([IO.TextWriter]::Null)
try {
    $session = $constructor.Invoke([object[]]@($profile, $true, $ExcludeContainer))
    $session.Provider.ReadScriptData = $false
    [IO.Directory]::CreateDirectory($OutputRoot) | Out-Null
    if (!$PlanPath) {
        $categories = @('Weapon','Item','Skill','WeaponSkill','MonsterHead','Monster','Character','TowerDefense','Mecha','Jewelry','Rogue','Buff','CollectionCard','Cards','Perk','Currency','Talent','TalentS0','TalentS2','TalentS3','TalentS4','Gameplay','TrialBag')
        $prefix = 'NZM/Content/UI/UI_Textures/Icons/'
        $assets = @($session.Provider.Files.Values | Where-Object {
            $_.Path.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase) -and $_.Path.EndsWith('.uasset') -and
            $_.Path.Substring($prefix.Length).Split('/')[0] -in $categories -and
            $_.Path -notmatch '(?i)(^|/)(Tests?|Examples?|Debug[^/]*|Temp|TexGen|Sprite2DGen|SP|Dynamic|Flipbook|Spine|FX)(/|\.)|(?:^|_)(?:Mask|Noise|Background|BG|Temp|Test|Effect)(?:_|\.)'
        } | ForEach-Object Path | Sort-Object -Unique)
        $plan = [ordered]@{ schemaVersion=1; excludedContainer=$ExcludeContainer; categories=$categories; count=$assets.Count; assets=$assets; mount=$session.MountSummary() }
        $plan | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $OutputRoot 'plan.json') -Encoding utf8
        $stdout.WriteLine(($assets | Group-Object { $_.Split('/')[5] } | Select-Object Count,Name | ConvertTo-Json -Compress))
        $stdout.WriteLine("Selected $($assets.Count) UI icon assets.")
        if ($assets.Count -gt $MaxAssets) { throw 'Plan exceeds bounded export count.' }
    } else {
        $plan = Get-Content -LiteralPath ([IO.Path]::GetFullPath($PlanPath, $projectRoot)) -Raw | ConvertFrom-Json
        if ($plan.excludedContainer -ne $ExcludeContainer -or $plan.count -ne $plan.assets.Count -or $plan.count -gt $MaxAssets) { throw 'Plan source/count mismatch.' }
        [IO.File]::Copy([IO.Path]::GetFullPath($PlanPath, $projectRoot), (Join-Path $OutputRoot 'plan.json'), $false)
        $writer = [IO.StreamWriter]::new((Join-Path $OutputRoot 'manifest.jsonl'), $false, [Text.UTF8Encoding]::new($false))
        try {
            $index = 0
            foreach ($asset in $plan.assets) {
                if ($asset -notmatch '^NZM/Content/UI/(?!.*\.\.)[^:]+\.uasset$') { throw 'Invalid planned asset path.' }
                $entry = [ordered]@{ asset=$asset; status='pending' }
                try {
                    $file = $session.Provider[$asset]
                    $package = $session.Provider.LoadPackage($file)
                    $textures = @($package.ExportsLazy | ForEach-Object { $_.Value } | Where-Object { $_ -is [CUE4Parse.UE4.Assets.Exports.Texture.UTexture2D] })
                    if ($textures.Count -ne 1) { throw 'Expected one Texture2D.' }
                    $texture = $textures[0]
                    $mip = $texture.GetFirstMip()
                    if (!$mip -or !$mip.BulkData.Data.Length) { throw 'No readable mip.' }
                    $relative = $asset.Substring(12) -replace '\.uasset$', ''
                    $destination = Join-Path $OutputRoot ($relative + '.bin')
                    [IO.Directory]::CreateDirectory((Split-Path -Parent $destination)) | Out-Null
                    $stream = [IO.File]::Open($destination, [IO.FileMode]::CreateNew)
                    try { $stream.Write($mip.BulkData.Data) } finally { $stream.Dispose() }
                    $entry.status='exported'; $entry.path=$relative; $entry.width=$mip.SizeX; $entry.height=$mip.SizeY
                    $entry.format=[string]$texture.Format; $entry.payloadSha256=(Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash
                    $entry.sourceContainer=$file.Vfs.Name; $entry.sourceReadOrder=$file.Vfs.ReadOrder
                } catch { $entry.status='failed'; $entry.errorType=$_.Exception.GetType().Name; $entry.message='Selected asset has no readable single Texture2D mip.' }
                $writer.WriteLine(($entry | ConvertTo-Json -Depth 6 -Compress)); $writer.Flush()
                $index++
                if ($index % 100 -eq 0) { $stdout.WriteLine("UI texture payloads processed: $index / $($plan.count)") }
            }
        } finally { $writer.Dispose() }
    }
} finally {
    if ($session) { $session.Dispose() }
    $profile = $null
    [Console]::SetOut($stdout)
}
