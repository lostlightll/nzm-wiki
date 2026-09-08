# S0/S1 Season Talents

## Commands

Use one command to regenerate the published trees and multiplier index from
committed evidence, without local game exports:

```powershell
pnpm project:s0s1-talents
pnpm check:s0s1-talents
```

`project` replays both audits against the current reviewed mappings and committed
Numerical Lock, then updates S0/S1 providers and both Num runtime projections.
It finishes with tree, provider, projection and multiplier-index checks. Each
consumer runs in a fresh process so newly generated JSON is not hidden by module
caching. It does not refresh source evidence or imply that unresolved values have
been verified. Both trees are validated before either tree is written.

To refresh from formal Content with the configured local FModel installation:

```powershell
pnpm extract:s0s1-talents
```

This exports fresh ReadScriptData evidence, prepares icons, extracts both seasons,
updates the multiplier index and verifies the results. `refresh:s0s1-talents` is
an alias for the same workflow. The PowerShell helper uses the existing local
installation and private profile; it does not install tools or print credentials.
For a different installation, run `export-taboo-script.ps1` with `-CliAssembly`
and `-Profile`, then supply its output. Existing exports may also be selected:

```powershell
pnpm refresh:s0s1-talents --s1-taboo-script=<actor-export.json> --prepare-assets
pnpm refresh:s0s1-talents --s1-taboo-script=<actor-export.json> --assets=MD/_local/s0s1Talent/asset-evidence.json
pnpm check:s0s1-talents --sources --s1-taboo-script=<actor-export.json>
```

`refresh` runs asset preparation when requested, extraction, provider registration,
Num projections and all checks, including comparison to current source evidence.
It uses a newly exported or explicitly supplied blueprint; it never recycles the
committed blueprint as proof of a new export. The icon exporter requires the existing texture exports
and reviewed atlas hash. Missing exports or changed evidence fail with their
original diagnostics. Neither mode refreshes the shared Numerical Lock or search
index. A failure stops later steps; the whole pipeline is not a filesystem
transaction, so rerun after resolving the reported failure.

Individual maintenance commands remain available:

```powershell
pnpm exec tsx scripts/s0s1-season-talents/extract.ts --s1-taboo-script=<actor-export.json> --assets=MD/_local/s0s1Talent/asset-evidence.json
pnpm exec tsx scripts/s0s1-season-talents/check.ts
pnpm exec tsx scripts/s0s1-season-talents/check.ts --sources
pnpm exec tsx --test lib/s0s1-season-talents.test.ts
pnpm exec tsx scripts/s0s1-season-talents/providers.ts --write
pnpm num-modifier:project
pnpm exec tsx scripts/s0s1-season-talents/audit-values.ts --out=MD/_local/s0s1Talent/value-review.json
```

The low-level extractor reads formal Content tables, reviewed structured exports
and the existing Numerical adapter. It writes only `data/season-talents/s0/` and
`data/season-talents/s1/`; use the commands above for the complete pipeline.

`trees.json` is the resolved projection with explicit Modifier references and sanitized description templates. `audit.json` preserves the relevant Main/GPActive rows, source SHA-256 hashes, excluded Basic nodes and visual verification limitations. Offline check reads the original JSON directly and replays committed evidence against the current Numerical Resolver; it never calls the live reader, which would hide stale projections. `--sources` additionally compares the original export hashes and the evidence subset. Optional asset evidence records explicit missing sprites; checks never require image files to exist.

## Evidence Boundaries

- `historicalStatus` applies only to branch appearance, based on the user's supplied video conclusions. It does not confirm individual nodes, edges or historical values. S0 destruction-dream is an unconfirmed reference branch; consumers should separate it from the two confirmed S0 branches.
- No video was independently inspected by this extractor. Node/edge correspondence and atlas images remain pending manual review.
- Selection uses SeasonID=1, SeasonPhaseID=0/1 and the seven rows in each Structure1/2/3. Extra Basic nodes are retained only in audit evidence.
- Applicable weapons follow root Basic `AdaptWeapon` to the exact phase's `AdaptWeaponTable.TextID`; formatting tags and the label prefix are removed. Older offline audits without the table omit this field. Fresh evidence must have one matching row; no cross-phase or weapon-name fallback is used.
- Reviewed prose for the five confirmed branches follows Basic skill identity -> exact-level MGEPassiveMainTable -> MGEConfig.Id and MGE.Id/MGEDescriptionId -> selected Main rows. A skill ID is not necessarily its ConfigId or MGEId. SeasonSkill descriptions require exact SkillId/SkillLevel. Missing levels are not substituted. The original direct same-ID facts remain diagnostic only.
- SeasonSkill also joins GPActiveSkillDataTable by exact row key and AbilityID. Duration and CooldownDuration are source-labelled raw seconds. Missing rows/fields warn; mismatched identities and invalid scalar values fail. Duration=0 does not prove a zero-duration effect. Only the reviewed standalone cooldown lines for SkillIDs 6001301, 6001401 and 6002301 at level 1 bind to CooldownDuration. Ambiguous lines and effect durations stay masked.
- Explicit Modifier parameters use `getRowsById("lc", id)` filtered by the Basic level. GPModifier tokens retain their own exact level/index; tokens without a level use the Resolver default of 1 and warn on higher talent levels. No token level rewriting occurs.
- Non-Modifier Numerical IDs remain structured references, not invented damage formulas. Parameters without a confirmed gameplay mapping are displayed only as source-labelled technical facts.
- The configured `descriptionTemplate` continues to mask quantities without a verified binding. `descriptionReferences` separately preserves the original wording, exact description source and missing-chain reason for the remaining slots, after video and reported supplements. The page renders these in ordinary body text, with a source notice and hover explanation, so phrases such as “一次” remain readable. They never replace a verified binding, affect audit counts or register multiplier applications. Unsupported game tokens remain unresolved rather than becoming displayed numbers.
- Main parameter facts and description-token facts are retained independently. They can disagree; neither identity chain is rewritten to imitate the other, and old MGEConfig_Season rows never override Main.
- Same-ID joins prove only current configuration references, never continuity of a historical node's effect. Every extracted fact carries `historicalEffectStatus: unverified | semantic-conflict` and `evidenceKind: basic-identity | current-same-id | current-description-token`. Branch `historicalStatus` is independent. A description Token with a resolvable number is still not confirmed historical evidence.
- Runtime reads the small projections and recomputes Modifier facts and GPToken prose through the existing server-only Numerical adapter. It never reads refs or audit evidence. The full Lock remains server-side; clients use type-only imports and receive resolved data from a server component. Changes to the committed Lock take effect when the server module is reloaded/rebuilt, not by hot-reading a changed Lock file.
- Modifier facts carry `modifierRow?: NumModifierRowKey`; `source` is opaque provenance and never parsed for row keys. `value: string` retains technical AttributeName/BaseValue/CoefValue/GPModifierOp/Level facts. `label` uses the canonical attribute label and operation. Optional `displayValue` formats only B1 with a known quantity as additive values; all other operations retain raw values without guessed factors. Nonzero coefficients remain separate, with no inferred variable or formula.
- `descriptionTemplate?: string` contains sanitized prose, reviewed structured scalars, V2 binding placeholders and supported GPModifier tokens. `descriptionBindings` resolves against the latest main Lock at runtime; `valueReview` records sources, limitations and reviewed applications. Missing live Modifier rows or unresolved live tokens fail rather than falling back to cached values. Missing extraction-time references still require re-extraction when new evidence becomes available.

## Reviewed Values and Index

S1 swarm nodes now carry `valueReview.executionConflict` after checking the exact
Passive level, Config `1319022030`, `ModifyID=160202005`, charge-speed Numerical
attribute and absent MGE registration. Any change requires another review.
These nodes cannot publish applications; the provider exclusions record the
specific broken link instead of treating charge parameters as swarm effects.
`swarm-evidence.ts` compares formal Content and Content_S2 and traces the actual
enemy/teammate projectile candidate under `MGE_1398001250`. That candidate has no
proven talent entry link, so its parameters are not assigned to these talents.

```powershell
pnpm exec tsx scripts/s0s1-season-talents/swarm-evidence.ts
```

`s0-reviewed-values.ts` and `s1-reviewed-values.ts` audit every level in the five confirmed branches. Compact `audit.json.valueEvidence` permits replay without refs. Tests guard exact identities, semantics, parameter types, levels, quantities and missing-row behavior. Description numbers are never copied as evidence. Structured scalars are allowed only with a reviewed field/meaning mapping. Valid GPModifier tokens with unresolved attribute quantity keep the existing Resolver format, but do not become new bindings or index applications.

`providers.ts` covers all 143 confirmed nodes with either reviewed damage applications or explicit exclusions. `unverified-evidence` means the source chain is incomplete, not that the skill has no damage effect. Only `valueReview.applications` supplies relations; old same-ID facts and description tokens cannot establish effect ownership. Existing S2/S3/S4 registrations are preserved. Regenerate providers and both Num projections after extraction; `multiplier-index:check` detects drift.

The detailed local audit command above records every reviewed and missing quantity. Current configuration values do not prove historical values. The unconfirmed S0 destruction-dream branch is intentionally excluded.

`range-values.ts` supplies the shared near/far distance evidence after the caller verifies the exact Passive/Modifier chain. The PVE system preset selects `BP_NumericalConfigSystem`; its CDO selects `NumericalSettlementConstantConfig`. Exact `CloseRangeDamageThreshold` / `LongRangeDamageThreshold` fields supply world distances, converted from centimetres to metres. The snapshot retains source hashes, the selected preset and CDO, and both constant rows. Loader identity, flags, scope and invalid values fail closed. This establishes current thresholds only, not historical values or runtime equality at the boundary.

S1 TabooEyes execution evidence additionally requires an actor JSON export with CUE4Parse `ReadScriptData` enabled. Pass its local path using `--s1-taboo-script=<path>` to both `extract.ts` and `check.ts --sources`. The export is copied into a compact offline `valueEvidence.s1.taboo` snapshot; page rendering, tests and offline checks need no local script file. Once this evidence exists, extraction without the explicit script input fails before writing either season, rather than silently discarding reviewed bindings. The review follows exact HasSeasonTalent calls, SetBool tags, component enable conditions and fields; changed control flow fails closed.

`export-taboo-script.ps1 -CliAssembly <installed FModel.Cli.dll> -Profile <private game profile>` repeats this special export in a PowerShell host compatible with the installed CLI's .NET runtime (currently .NET 10). It enables the existing provider's `ReadScriptData` in memory and writes to a new ignored `MD/_local/nzm-assets/s1-kismet-*` directory. It does not install/build tools, amend refs, or print the private profile. The reflected CLI API is version-specific; failures require inspection, not fallback to signature-only JSON.

## Recording Display Supplements

`data/season-talents/video-values.json` preserves manually inspected recording
observations separately from configuration evidence. Each observation specifies
the exact season, branch, node, level, timestamp, level-selection evidence,
recording/frame SHA-256, masked-template SHA-256 and individual replacement slots.
Only masked slots may be filled; reviewed scalars, V2 bindings and index
applications are unchanged. Template drift fails closed and requires re-review.
No value is extrapolated to another level, node or season.

`videoReview` labels these values as `video-display-unverified` in the page and
retains conflict notes. The configuration audit's `remaining` count deliberately
does not decrease: a recording display is not verified configuration. The local
report separates configuration-verified, recording-filled and still-empty counts.
Its frame links assume the report and extracted frames share the local directory.

```powershell
pnpm exec tsx scripts/s0s1-season-talents/report-video-values.ts --write --out=MD/_local/s0s1Talent/video-supplements.md
pnpm exec tsx scripts/s0s1-season-talents/report-video-values.ts --out=MD/_local/s0s1Talent/video-supplements.md --frames=MD/_local/s0s1Talent
pnpm exec tsx --test scripts/s0s1-season-talents/video-values.test.ts
```

The first command replays committed evidence without refs and refreshes only the
two season tree projections. `--frames` optionally verifies the local recording
and screenshot hashes. Neither recording nor screenshots are runtime dependencies.
The earlier masking rules still apply to every slot without an explicit observation.

## Atlas Recovery

`atlas-crops.ts` records 21 visually reviewed regions from the current Content
talent atlas, with the exact node ID and recording timestamp for each match.
The RGBA pixel hash is identical in the supplied S1, S2, S3.1 and current
snapshots. Export fails if that hash changes; do not reuse coordinates blindly.
These regions are manual visual matches, not recovered PaperSprite UV metadata.
The exported WebP files are lossless and tested for nonblank pixels and unclipped
transparent edges. The Buff prefix fallback also recovers `Icons_Buff_10000052`.

```powershell
pnpm exec tsx scripts/prepare-s0s1-talent-assets.ts
pnpm refresh:s0s1-talents --s1-taboo-script=<actor-export.json> --assets=MD/_local/s0s1Talent/asset-evidence.json
pnpm test:s0s1-talents
```

All five video-confirmed branches now have exported node icons. Nine unique
icons on the unconfirmed destruction-dream archive remain unlocated, plus bd27
on an excluded Basic node. A missing independent file does not mean its pixels
were removed from the atlas. `video-matched` audits apply only to icon identity,
not numerical values or allocation rules. Other exported assets still require
their own visual review.

## Data Interface

`lib/s0s1-season-talents.ts` exports `LegacyTalentTree`, `LegacyTalentNode`, `LegacyTalentLevel`, `LegacyTalentFact`, `LegacyTalentSeason`, and `LegacyTalentHistoricalStatus`.

`getLegacyTalentCatalog(season: string): LegacyTalentTree[]` returns all three branches in type order, including unconfirmed branches. Unknown seasons return `[]`.

`getLegacyTalentTree(season: string, id: string): LegacyTalentTree | undefined` returns the requested tree. Node count is `nodeCount`. Icons retain raw asset basenames under `/webp/images/season-talents/s0s1/`; consumers apply `getAssetPath()` and their image fallback.

## Same-ID Semantic Conflicts

This section documents the old direct same-ID diagnostic, not the authoritative skill execution chain. A conflict here does not invalidate a separately reviewed exact-level Passive chain. These records stay available as raw evidence; reviewed prose and index entries never use this shortcut.

`semantic-conflicts.ts` records a targeted review of 11 nodes / 22 levels, not an exhaustive audit. Exact node/MGE identities, parameter values, description semantics and canonical Numerical attributes guard each finding. Evidence changes fail with `SEMANTIC_REVIEW_DRIFT` and require re-review. Missing Numerical levels remain missing; no level fallback is introduced.

`levels[].semanticConflicts` links both source tables and the exact available parameter-chain Modifier rows. `facts[].conflictIds` marks only affected current parameter facts. Description-token facts remain separately identified and historically unverified. The same findings appear in `warnings` and `audit.json.semanticReview`. Current technical values are retained, not reinterpreted as the historical effect. ID reuse or semantic changes are plausible explanations, not established version history.

| Node | Description Semantics | Current Same-ID Parameter Target |
| --- | --- | --- |
| S0 1001308 膛线保养 | 飞弹发射间隔 | 移动速度 |
| S0 1002206 灼热裂口 | 裂口及弱点命中 | 伤害减免 |
| S0 1002704 云霄飞车 | 聚能与充能速度 | 伤害减免 |
| S1 1012507 蛇神之力I | 赤寰与减速 | 武器技能伤害 |
| S1 1012605 蛇神之力II | 换弹后减速 | 武器技能伤害 |
| S1 1012705 充能传递 | 给友方技能充能 | 武器技能伤害 |
| S1 1012709 侵蚀加深 | 按负面状态增加技能伤害 | 赛季技能充能速度 |
| S1 1013207 血曈回响 | 赤瞳提高弱点伤害增幅 | 角色全武器换弹速度 |
| S1 1013305 摸金符 | 射线期间伤害减免 | 角色全武器换弹速度 |
| S1 1013409 充能加速 | 赛季技能充能速度 | 武器弱点伤害 |
| S1 1013505 洞穿万障 | 射线穿透 | 角色全武器换弹速度 |

For 1013207 level 3, the exact chain is Basic `10132073.TalentSkillsID=1319022011` -> Main `1319022011.Parameters[0].ModifyID=160202006` -> `lc:160202006_3_0`. Current facts are `GPAttributeSetCharacterWeaponAdjust.ChangeClipTimeAdjust`, `B1`, `BaseValue=0.15`, `CoefValue=0`, `Level=3`. The description row `1319022011_3` instead discusses 赤瞳 and weak-point amplification. The value 0.15 is not an established historical 血曈回响 effect.
