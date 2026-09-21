param(
    [Parameter(Mandatory = $true)][string]$OutputDirectory,
    [string]$Profile = 'MD/_local/nzm-assets/nzm.json',
    [string]$CliPath = '.agents/skills/nzm-assets/tools/FModel.Cli.exe',
    [string]$ExcludeContainer
)

# Export the selected source tables in place. Never copy game containers or
# merge a previous export into a new release's evidence.
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$destination = [IO.Path]::GetFullPath($OutputDirectory)
if (Test-Path -LiteralPath $destination) { throw 'Output directory must be new.' }
$cli = [IO.Path]::GetFullPath($CliPath, $root)
$profilePath = [IO.Path]::GetFullPath($Profile, $root)
$mountArgs = @('--profile', $profilePath)
if ($ExcludeContainer) { $mountArgs += @('--exclude-container', $ExcludeContainer) }
$mountResponse = & $cli mount @mountArgs
if ($LASTEXITCODE -ne 0) { throw 'Mount failed or incomplete.' }
$mount = $mountResponse | ConvertFrom-Json
if (!$mount.ok) { throw 'Mount failed.' }
[IO.Directory]::CreateDirectory($destination) | Out-Null
$mountResponse | Set-Content -LiteralPath (Join-Path $destination 'mount.json') -Encoding utf8
$tables = @(
    'DataTables/numerical_config_composite',
    'DataTables/TD_numerical_config_composite',
    'Attributes/AutoGenerate/attr_weapon_asc',
    'DataTables/WeaponFeelParamTable',
    'DataTables/LuaDataTable/WeaponItemConfigTable',
    'DataTables/WeaponPrototypeConfig',
    'DataTables/SkillConfigTable_Weapon_PVE',
    'DataTables/GPActiveSkillDataTable',
    'Attributes/AutoGenerate/numerical_modifier_config',
    'DataTables/AttributeDescMapTable',
    'DataTables/numerical_config_equip',
    'DataTables/numerical_config_others',
    'DataTables/numerical_config_playerskill',
    'DataTables/LuaDataTable/WeaponModItemData',
    'DataTables/System/Items/CommonItemDataTable',
    'DataTables/MGE/DT_GPMGESkillDesConfigTable_Main',
    'DataTables/HuntingGroundRoguelike/HuntingGroundRoguelikeWeaponModTable',
    'DataTables/AttributeChannelDescriptionTable',
    'DataTables/LuaDataTable/WeaponModItemTagData',
    'DataTables/LuaDataTable/WeaponModSetTable',
    'DataTables/MGE/MGEPassive_BD',
    'DataTables/MGE/GPModularGameplayEffectTable',
    'DataTables/MGE/MGEConfig_Season',
    'DataTables/Buff/BuffConfigDatatableNew',
    'DataTables/HuntingGroundRoguelike/HuntingGroundRoguelikeRerollCostTable',
    'DataTables/MainDataTablesLoadConfig'
)
$manifest = @()
foreach ($table in $tables) {
    $asset = "NZM/Content/$table.uasset"
    $response = & $cli inspect @mountArgs --asset $asset --output-directory $destination
    if ($LASTEXITCODE -ne 0) { throw "Export failed: $asset" }
    $result = $response | ConvertFrom-Json
    if (!$result.ok -or !$result.mountComplete) { throw "Incomplete export: $asset" }
    $target = Join-Path $destination "Content/$table.json"
    [IO.Directory]::CreateDirectory((Split-Path -Parent $target)) | Out-Null
    Move-Item -LiteralPath $result.result.output -Destination $target
    $manifest += [ordered]@{ asset = $asset; path = "Content/$table.json"; sha256 = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() }
    Write-Output "Exported $table"
}
$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $destination 'manifest.json') -Encoding utf8
Write-Output "Exported $($manifest.Count) tables to $destination"
