import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import affixes from "../../data/origin/affixes.json";
import { parseModifierProviderRegistry, type ModifierProviderRegistry } from "../../lib/modifier-provider-registry";
import { NUMERICAL_SOURCE_PATH, passiveDamageApplications, readPassiveRows, type PassiveRow } from "./passive-multiplier";

const registryPath = path.join(process.cwd(), "data/modifier-providers.json");

/**
 * The formal client has no AffixID -> PassiveSkillID table (the pool configs only ship in the test client).
 * The mapping follows the matching sequence of AffixWeaponAffixDisplayConfig and the 1378040xxx passive block,
 * reviewed against MGE names and Numerical descriptions; gaps in either sequence are listed explicitly.
 */
type Segment = readonly [firstAffix: number, lastAffix: number, firstPassive: number];
const SEGMENTS: readonly Segment[] = [
  [10001, 10021, 1378040010],
  // 1378040220 has no affix; 10024 刺影·隐身 also has a twin passive 1378040251 sharing the same Numerical row.
  [10022, 10024, 1378040230],
  // 1378040260 元宵来袭 has no affix, matching the missing AffixID 10025.
  [10026, 10026, 1378040270],
  // 1378040280 哈士奇好友 and 1378040300 剑喷 belong to weapon-specific effects.
  [10027, 10027, 1378040290],
  [10028, 10046, 1378040310],
  // 10047 元素附魔 is resolved separately; 1378040500/040510/040530 are the per-element enchants.
  [10048, 10048, 1378040520],
  [10049, 10089, 1378040540],
  // 1378040950 does not exist; the four attack tiers follow.
  [10090, 10093, 1378040960],
];
const UNMAPPED: Record<string, string> = {
  "10047": "元素附魔在正式服无唯一被动映射：候选 1378040500/040510/040530 为分元素附魔，1378042280 属原点强化「元素流」段，均无可索引的增伤行。",
};
const WEAPON_SPECIFIC_REASON = "武器专属词条在正式服没有 AffixID 到被动技能的映射表，被动身份未核定，不按描述推定乘区。";
const reviewedModifierIds: Record<string, readonly number[]> = {
  // 130040031-130040039 are S5 return-event rows sharing the segment, not 毒皇·腐蚀.
  "1378040030": [130040030],
  // 130040041 is the S5 return-event 火神 fire-rate row.
  "1378040040": [130040040],
  // 130040341/130040342 belong to 模式2强化 and the overlimit variant.
  "1378040340": [130040340],
  // 130040351 is the overlimit variant.
  "1378040350": [130040350],
};

export const AFFIX_PASSIVES: Readonly<Record<string, string>> = Object.fromEntries(SEGMENTS.flatMap(([first, last, passive]) =>
  Array.from({ length: last - first + 1 }, (_, index) => [String(first + index), String(passive + index * 10)])));

type AffixEntry = { id: string; name: string };

export function projectOriginAffixSources(passiveRows: Record<string, PassiveRow>, entries: readonly AffixEntry[] = affixes.affixes) {
  const providers: ModifierProviderRegistry["providers"] = [];
  const exclusions: ModifierProviderRegistry["exclusions"] = [];
  const known = new Set(entries.map((affix) => affix.id));
  for (const id of [...Object.keys(AFFIX_PASSIVES), ...Object.keys(UNMAPPED)]) {
    if (!known.has(id)) throw new Error(`Affix mapping references missing affix: ${id}`);
  }

  for (const affix of entries) {
    const id = `origin-affix:${affix.id}`;
    const source = { type: "origin-affix" as const, id: affix.id };
    const passiveId = AFFIX_PASSIVES[affix.id];
    if (!passiveId) {
      if (Number(affix.id) < 10094 && !UNMAPPED[affix.id]) throw new Error(`Unreviewed affix without passive: ${affix.id}`);
      exclusions.push({
        id, label: affix.name, source, reasonCode: "unverified-evidence",
        reason: UNMAPPED[affix.id] ?? WEAPON_SPECIFIC_REASON,
        evidence: { basis: [`NZM/Content/DataTables/Roguelike/AffixWeapon/AffixWeaponAffixDisplayConfig.json#${affix.id}`] },
      });
      continue;
    }
    const passive = passiveRows[`${passiveId}_1`];
    if (passive?.PassiveSkillID !== Number(passiveId)) throw new Error(`Missing passive identity: ${affix.id} -> ${passiveId}`);
    const { candidateKeys, applications } = passiveDamageApplications(passiveId, id, reviewedModifierIds[passiveId]);
    const passiveBasis = `NZM/Content/DataTables/MGE/MGEPassiveMainTable.json#${passiveId}_1: MGE=${passive.MGE.Id}, MGEConfig=${passive.MGEConfig.Id}`;
    const affixBasis = `NZM/Content/DataTables/Roguelike/AffixWeapon/AffixWeaponAffixDisplayConfig.json#${affix.id}: 按词条与 1378040xxx 被动段的序列及名称对应，正式服无直接映射表。`;
    if (applications.length) {
      providers.push({
        id, label: affix.name, source, applications,
        evidence: {
          kind: "reviewed-chain",
          passiveSkillId: passiveId,
          basis: [
            affixBasis,
            passiveBasis,
            `${NUMERICAL_SOURCE_PATH}#${applications.map((application) => application.expression.row.slice(3)).join(", ")}; 此处仅索引属性，不推断施加时机与受益对象。`,
          ],
        },
      });
    } else {
      exclusions.push({
        id, label: affix.name, source,
        reasonCode: candidateKeys.length ? "not-damage-multiplier" : "unverified-evidence",
        reason: candidateKeys.length
          ? "关联的一级 Numerical 行未解析出可索引的增伤分面。"
          : "当前 Numerical 表中无同身份的增伤行；独立伤害或动态效果尚无可核定的乘区来源。",
        evidence: {
          passiveSkillId: passiveId,
          basis: [affixBasis, passiveBasis, `${NUMERICAL_SOURCE_PATH}#${candidateKeys.join(", ") || "无同身份行"}`],
        },
      });
    }
  }
  return { providers, exclusions };
}

function main() {
  const check = process.argv.includes("--check");
  const projected = projectOriginAffixSources(readPassiveRows());
  const registry = parseModifierProviderRegistry(JSON.parse(fs.readFileSync(registryPath, "utf8")));
  const isAffix = (entry: { source: { type: string } }) => entry.source.type === "origin-affix";
  if (check) {
    if (JSON.stringify(registry.providers.filter(isAffix)) !== JSON.stringify(projected.providers) ||
      JSON.stringify(registry.exclusions.filter(isAffix)) !== JSON.stringify(projected.exclusions)) {
      throw new Error("Origin affix multiplier index is stale; run pnpm origin-affixes:multiplier:project");
    }
  } else {
    const updated = {
      ...registry,
      providers: [...registry.providers.filter((entry) => !isAffix(entry)), ...projected.providers],
      exclusions: [...registry.exclusions.filter((entry) => !isAffix(entry)), ...projected.exclusions],
    };
    fs.writeFileSync(registryPath, `${JSON.stringify(updated, null, 2)}\n`);
  }
  console.log(`Origin affix multipliers: ${projected.providers.length} providers, ${projected.exclusions.length} exclusions (${check ? "checked" : "projected"})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { main(); } catch (error) { console.error(error); process.exitCode = 1; }
}
