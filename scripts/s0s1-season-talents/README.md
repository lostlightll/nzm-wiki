# S0/S1 Season Talents

## Commands

```powershell
pnpm exec tsx scripts/s0s1-season-talents/extract.ts
pnpm exec tsx scripts/s0s1-season-talents/extract.ts --assets=MD/_local/s0s1Talent/asset-evidence.json
pnpm exec tsx scripts/s0s1-season-talents/check.ts
pnpm exec tsx scripts/s0s1-season-talents/check.ts --sources
pnpm exec tsx --test lib/s0s1-season-talents.test.ts
```

Extraction reads only the formal `refs/Exports/NZM/Content/DataTables` tables and the existing Numerical adapter. It writes only `data/season-talents/s0/` and `data/season-talents/s1/`. No Lock refresh, image conversion or shared script registration is performed.

`trees.json` is the resolved projection with explicit Modifier references and sanitized description templates. `audit.json` preserves the relevant Main/GPActive rows, source SHA-256 hashes, excluded Basic nodes and visual verification limitations. Offline check reads the original JSON directly and replays committed evidence against the current Numerical Resolver; it never calls the live reader, which would hide stale projections. `--sources` additionally compares the original export hashes and the evidence subset. Optional asset evidence records explicit missing sprites; checks never require image files to exist.

## Evidence Boundaries

- `historicalStatus` applies only to branch appearance, based on the user's supplied video conclusions. It does not confirm individual nodes, edges or historical values. S0 destruction-dream is an unconfirmed reference branch; consumers should separate it from the two confirmed S0 branches.
- No video was independently inspected by this extractor. Node/edge correspondence and atlas images remain pending manual review.
- Selection uses SeasonID=1, SeasonPhaseID=0/1 and the seven rows in each Structure1/2/3. Extra Basic nodes are retained only in audit evidence.
- Basic `TalentSkillsID` and `AttributeSkillsID` join the exact current Main ConfigId; descriptions require exact MGEId/TextID. SeasonSkill descriptions require exact SkillId/SkillLevel. Missing levels are not substituted.
- SeasonSkill also joins GPActiveSkillDataTable by exact row key and AbilityID. Duration and CooldownDuration are source-labelled raw seconds. Missing rows/fields warn; mismatched identities and invalid scalar values fail. Duration=0 does not prove a zero-duration effect. Only the reviewed standalone cooldown lines for SkillIDs 6001301, 6001401 and 6002301 at level 1 bind to CooldownDuration. Ambiguous lines and effect durations stay masked.
- Explicit Modifier parameters use `getRowsById("lc", id)` filtered by the Basic level. GPModifier tokens retain their own exact level/index; tokens without a level use the Resolver default of 1 and warn on higher talent levels. No token level rewriting occurs.
- Non-Modifier Numerical IDs remain structured references, not invented damage formulas. Parameters without a confirmed gameplay mapping are displayed only as source-labelled technical facts.
- Numbers in ordinary descriptions are masked even if a similarly valued parameter exists; matching digits is not a semantic mapping. Unsupported game tokens are also masked. Non-numeric semantics remain intact.
- Main parameter facts and description-token facts are retained independently. They can disagree; neither identity chain is rewritten to imitate the other, and old MGEConfig_Season rows never override Main.
- Same-ID joins prove only current configuration references, never continuity of a historical node's effect. Every extracted fact carries `historicalEffectStatus: unverified | semantic-conflict` and `evidenceKind: basic-identity | current-same-id | current-description-token`. Branch `historicalStatus` is independent. A description Token with a resolvable number is still not confirmed historical evidence.
- Runtime reads the small projections and recomputes Modifier facts and GPToken prose through the existing server-only Numerical adapter. It never reads refs or audit evidence. The full Lock remains server-side; clients use type-only imports and receive resolved data from a server component. Changes to the committed Lock take effect when the server module is reloaded/rebuilt, not by hot-reading a changed Lock file.
- Modifier facts carry `modifierRow?: NumModifierRowKey`; `source` is opaque provenance and never parsed for row keys. `value: string` retains technical AttributeName/BaseValue/CoefValue/GPModifierOp/Level facts. `label` uses the canonical attribute label and operation. Optional `displayValue` formats only B1 with a known quantity as additive values; all other operations retain raw values without guessed factors. Nonzero coefficients remain separate, with no inferred variable or formula.
- `descriptionTemplate?: string` contains only sanitized prose and supported GPModifier tokens. Missing live Modifier rows or unresolved live tokens fail rather than falling back to cached values. Missing extraction-time references still require re-extraction when new evidence becomes available.

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
pnpm exec tsx scripts/s0s1-season-talents/extract.ts --assets=MD/_local/s0s1Talent/asset-evidence.json
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
