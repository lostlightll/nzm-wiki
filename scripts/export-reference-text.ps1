<#
.SYNOPSIS
Plan or export a bounded set of meaningful reference JSON using a prior export.
.DESCRIPTION
Uses native FModel container selection and Inspect, with bytecode disabled.
Never exports raw packages or visual media. Plan first, then pass its exact path
to -PlanPath. Existing destination files are verified and never overwritten.
#>
param(
    [Parameter(Mandatory=$true)][string]$OutputRoot,
    [string]$PriorContent = 'refs/Exports/NZM/Content_S3.2',
    [string]$DestinationContent = 'refs/Exports/NZM/Content',
    [string]$AssemblyPath = 'D:/Workspace/FModel/FModel.Cli/bin/Release/net10.0/FModel.Cli.dll',
    [string]$ProfilePath = 'MD/_local/nzm-assets/nzm.json',
    [Parameter(Mandatory=$true)][string]$ExcludeContainer,
    [string]$PlanPath,
    [int]$MaxAssets = 20000
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
function Absolute([string]$path) { [IO.Path]::GetFullPath($path, $projectRoot) }
$OutputRoot = Absolute $OutputRoot
$PriorContent = Absolute $PriorContent
$DestinationContent = Absolute $DestinationContent
$AssemblyPath = Absolute $AssemblyPath
$ProfilePath = Absolute $ProfilePath
if (Test-Path -LiteralPath $OutputRoot) { throw 'Output root must be new.' }
if ($PlanPath) { $PlanPath = Absolute $PlanPath }
foreach ($path in @($OutputRoot, $DestinationContent)) {
    for ($current = $path; $current; $current = Split-Path -Parent $current) {
        if ((Test-Path -LiteralPath $current) -and ((Get-Item -LiteralPath $current -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw 'Output paths cannot traverse links or junctions.'
        }
    }
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
$records = [Collections.Generic.List[object]]::new()
try {
    $session = $constructor.Invoke([object[]]@($profile, $true, $ExcludeContainer))
    $session.Provider.ReadScriptData = $false
    [IO.Directory]::CreateDirectory($OutputRoot) | Out-Null
    if (!$PlanPath) {
        $old = [Collections.Generic.Dictionary[string,string]]::new([StringComparer]::OrdinalIgnoreCase)
        $known = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
        $tableTypes = '^(DataTable|CompositeDataTable|CurveTable|StringTable)$'
        $logicTypes = '^(Function|BlueprintGeneratedClass|BehaviorTree|BlackboardData|EnvQuery|SkillItemData|NZAISpawnPresetData|AITargetConfigAsset|AIDataProvider_Blackboard|PickupItemData|UserDefinedStruct|UserDefinedEnum)$'
        $weaponTypes = '^(WeaponItemData|WeaponSkillConfig|WeaponEnergySkillConfig|ModifierConfig|ModifierSubComponent|AttributeStaticModifierSubComponent|WeaponRecoilConfig|WeaponMeleeAttackConfigAsset|WeaponMeleeAttackModule|AutoFireRaycastSubComponent|Function|BlueprintGeneratedClass)$'
        $buffer = [char[]]::new(4096)
        foreach ($file in [IO.Directory]::EnumerateFiles($PriorContent, '*.json', [IO.SearchOption]::AllDirectories)) {
            $rel = [IO.Path]::GetRelativePath($PriorContent, $file).Replace('\','/')
            [void]$known.Add('NZM/Content/' + $rel.Substring(0,$rel.Length-5) + '.uasset')
            $top = $rel.Split('/')[0]
            if ($top -notin @('DataTables','Attributes','Numerical','StringTables','Abilities','AIBehavior','Weapon','Blueprints','Inventorys','UI')) { continue }
            if ($rel -match '(?i)(^|/)(_?Tests?|Examples?|Debug[^/]*)(/|\.)') { continue }
            $reader = [IO.File]::OpenText($file)
            try { $length = $reader.ReadBlock($buffer, 0, $buffer.Length); $head = [string]::new($buffer,0,$length) } finally { $reader.Dispose() }
            if ($head -notmatch '"Type"\s*:\s*"([^"\r\n]+)"') { continue }
            $type = $Matches[1]
            $keep = $type -match $tableTypes
            if ($top -in @('Abilities','AIBehavior','Numerical','Blueprints','Inventorys') -and $type -match $logicTypes) { $keep = $true }
            if ($top -eq 'Weapon' -and $type -match $weaponTypes -and $rel -notmatch '/(Appearance|Skin|Charm|Camera)/') { $keep = $true }
            if ($top -eq 'UI' -and $type -match '^(WidgetBlueprintGeneratedClass|Function|BlueprintGeneratedClass)$') { $keep = $true }
            if ($keep) { $old['NZM/Content/' + $rel.Substring(0,$rel.Length-5) + '.uasset'] = $type }
        }
        $seen = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
        foreach ($file in $session.Provider.Files.Values) {
            $asset = $file.Path
            if (!$asset.StartsWith('NZM/Content/', [StringComparison]::OrdinalIgnoreCase) -or !$asset.EndsWith('.uasset') -or !$seen.Add($asset)) { continue }
            $rel = $asset.Substring(12)
            if ($rel -match '(?i)(^|/)(_?Tests?|Examples?|Debug[^/]*)(/|\.)') { continue }
            $reason = $null
            if ($old.ContainsKey($asset)) { $reason = 'S3.2 semantic type: ' + $old[$asset] }
            elseif ($known.Contains($asset)) { continue }
            elseif ($rel -match '^(Attributes/|StringTables/|DataTables/(?!LODSettings/|Audio/)|UI/(?:DataTables|StringTable)/)') { $reason = 'S4 structured-table directory' }
            elseif ($rel -match '^(?:Abilities|AIBehavior|Numerical|Blueprints)/.*(?:^|/)(?:GA_|MGE_|BP_|BT_|BB_|EQS_|SKT_|DA_)[^/]+\.uasset$' -and $rel -notmatch '(?i)/(Material|Texture|Effect|Audio|Anim|Mesh|WaterSystem)[^/]*/') { $reason = 'S4 semantic blueprint naming' }
            elseif ($rel -match '^UI/UI_Widgets/.*/WB_[^/]+\.uasset$') { $reason = 'S4 UI widget Text JSON' }
            elseif ($rel -match '^Weapon/Data/[^/]+/[^/]+/[^/]+\.uasset$' -and $rel -notmatch '(?i)(AnimSet_|Curve|Color|Particle|Audio|Material|Mesh|Texture)') { $reason = 'S4 weapon item/config entry' }
            if ($reason) { $records.Add([ordered]@{asset=$asset; reason=$reason}) }
        }
        $plan = [ordered]@{schemaVersion=1; priorContent=$PriorContent; excludedContainer=$ExcludeContainer; readScriptData=$false; count=$records.Count; assets=@($records | Sort-Object asset)}
        $plan | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $OutputRoot 'plan.json') -Encoding utf8
        $records | Group-Object { $_.asset.Split('/')[2] } | Select-Object Count,Name | ConvertTo-Json
        if ($records.Count -gt $MaxAssets) { throw "Plan saved for review but exceeds export limit ($($records.Count) > $MaxAssets)." }
    } else {
        $plan = Get-Content -LiteralPath $PlanPath -Raw | ConvertFrom-Json
        if ($plan.excludedContainer -ne $ExcludeContainer -or $plan.count -ne $plan.assets.Count -or $plan.assets.Count -gt $MaxAssets) { throw 'Plan source/count mismatch.' }
        $writer = [IO.StreamWriter]::new((Join-Path $OutputRoot 'manifest.jsonl'), $false, [Text.UTF8Encoding]::new($false))
        try {
            $i = 0
            foreach ($item in $plan.assets) {
                $asset = [string]$item.asset
                if ($asset -notmatch '^NZM/Content/(?!.*\.\.)[^:]+\.uasset$') { throw 'Invalid planned asset path.' }
                $relative = $asset.Substring(12) -replace '\.uasset$', '.json'
                $destination = Join-Path $DestinationContent $relative
                $entry = [ordered]@{asset=$asset; reason=$item.reason; status='pending'}
                try {
                    if (Test-Path -LiteralPath $destination) {
                        $entry.status = 'existing-preserved'; $entry.sha256 = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash
                    } else {
                        $result = $session.Inspect($asset)
                        $hash = (Get-FileHash -LiteralPath $result.output -Algorithm SHA256).Hash
                        [IO.Directory]::CreateDirectory((Split-Path -Parent $destination)) | Out-Null
                        [IO.File]::Copy($result.output, $destination, $false)
                        if ((Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash -ne $hash) { throw 'Copied JSON hash mismatch.' }
                        $entry.status = 'exported'; $entry.sha256 = $hash; $entry.output = [IO.Path]::GetRelativePath($OutputRoot,$result.output)
                    }
                } catch { $entry.status='failed'; $entry.errorType=$_.Exception.GetType().Name; $entry.message='Asset could not be exported or published; inspect this exact asset separately.' }
                $writer.WriteLine(($entry | ConvertTo-Json -Compress -Depth 5)); $writer.Flush()
                $i++
                if ($i % 250 -eq 0) {
                    $result = $null
                    [GC]::Collect()
                    [GC]::WaitForPendingFinalizers()
                    Write-Output "Processed $i / $($plan.assets.Count)"
                }
            }
        } finally { $writer.Dispose() }
        [ordered]@{schemaVersion=1; plan=$PlanPath; planSha256=(Get-FileHash $PlanPath -Algorithm SHA256).Hash; excludedContainer=$ExcludeContainer; toolSha256=(Get-FileHash $AssemblyPath -Algorithm SHA256).Hash; count=$plan.assets.Count; readScriptData=$false; completedAtUtc=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $OutputRoot 'source.json') -Encoding utf8
    }
} finally { if ($session) { $session.Dispose() }; $profile=$null }
