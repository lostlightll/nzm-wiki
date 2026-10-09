import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import runes from "../../data/origin/runes.json";
import { parseModifierProviderRegistry, type ModifierProviderRegistry } from "../../lib/modifier-provider-registry";
import { NUMERICAL_SOURCE_PATH, passiveDamageApplications, readPassiveRows, type PassiveRow } from "./passive-multiplier";

const registryPath = path.join(process.cwd(), "data/modifier-providers.json");
const reviewedModifierIds: Record<string, readonly number[]> = {
  // The adjacent 130044211 belongs to the separate S4 overlimit card's buff.
  "1378044210": [130044210],
  // 130044311 is applied by the separate S4 overlimit card's buff.
  "1378044310": [],
  // 130044381 belongs to S4 overlimit card 1317113001.
  "1378044380": [130044380],
  // 130044411-130044413 are used by separate perk and overlimit effects.
  "1378044410": [130044410],
  // The adjacent 130045113 is applied by S4 overlimit card 1317109001.
  "1378045110": [130045111],
  // 130045121 belongs to S4 overlimit card 1317111001.
  "1378045120": [130045120],
};

export function projectOriginRuneSources(
  passiveRows: Record<string, PassiveRow>,
) {
  const providers: ModifierProviderRegistry["providers"] = [];
  const exclusions: ModifierProviderRegistry["exclusions"] = [];

  for (const rune of runes.runes) {
    const passive = passiveRows[`${rune.id}_1`];
    if (passive?.PassiveSkillID !== Number(rune.id)) throw new Error(`Missing passive identity: ${rune.id}`);
    const id = `origin-rune:${rune.id}`;
    const { candidateKeys, applications } = passiveDamageApplications(rune.id, id, reviewedModifierIds[rune.id]);
    const source = { type: "origin-rune" as const, id: rune.id };
    if (applications.length) {
      providers.push({
        id, label: rune.name, source, applications,
        evidence: {
          kind: "reviewed-chain",
          passiveSkillId: rune.id,
          basis: [
            `NZM/Content/DataTables/MGE/MGEPassiveMainTable.json#${rune.id}_1: MGE=${passive.MGE.Id}, MGEConfig=${passive.MGEConfig.Id}`,
            `${NUMERICAL_SOURCE_PATH}#${applications.map((application) => application.expression.row.slice(3)).join(", ")}; 此处仅索引属性，不推断施加时机与受益对象。`,
          ],
        },
      });
    } else {
      exclusions.push({
        id, label: rune.name, source,
        reasonCode: candidateKeys.length ? "not-damage-multiplier" : "unverified-evidence",
        reason: candidateKeys.length
          ? "关联的一级 Numerical 行未解析出可索引的增伤分面。"
          : "当前 Numerical 表中无同身份的增伤行；独立伤害或动态效果尚无可核定的乘区来源。",
        evidence: {
          passiveSkillId: rune.id,
          basis: [
            `NZM/Content/DataTables/MGE/MGEPassiveMainTable.json#${rune.id}_1`,
            `${NUMERICAL_SOURCE_PATH}#${candidateKeys.join(", ") || "无同身份行"}`,
          ],
        },
      });
    }
  }
  return { providers, exclusions };
}

export function mergeOriginRuneSources(
  registry: ModifierProviderRegistry,
  projected: ReturnType<typeof projectOriginRuneSources>,
): ModifierProviderRegistry {
  function merge<T extends { id: string; source: { type: string } }>(current: T[], next: T[]): T[] {
    const replacements = new Map(next.map(entry => [entry.id, entry]));
    const entries = current.flatMap(entry => {
      if (entry.source.type !== "origin-rune") return [entry];
      const replacement = replacements.get(entry.id);
      replacements.delete(entry.id);
      return replacement ? [replacement] : [];
    });
    return [...entries, ...replacements.values()];
  }
  return { ...registry,
    providers: merge(registry.providers, projected.providers),
    exclusions: merge(registry.exclusions, projected.exclusions),
  };
}

function main() {
  const check = process.argv.includes("--check");
  const projected = projectOriginRuneSources(readPassiveRows());
  const registry = parseModifierProviderRegistry(JSON.parse(fs.readFileSync(registryPath, "utf8")));
  const originProviders = registry.providers.filter((entry) => entry.source.type === "origin-rune");
  const originExclusions = registry.exclusions.filter((entry) => entry.source.type === "origin-rune");
  if (check) {
    const serialize = (entries: { id: string }[]) => JSON.stringify([...entries].sort((a, b) => a.id.localeCompare(b.id)));
    if (serialize(originProviders) !== serialize(projected.providers) ||
      serialize(originExclusions) !== serialize(projected.exclusions)) {
      throw new Error("Origin rune multiplier index is stale; run pnpm origin-runes:multiplier:project");
    }
  } else {
    const updated = mergeOriginRuneSources(registry, projected);
    fs.writeFileSync(registryPath, `${JSON.stringify(updated, null, 2)}\n`);
  }
  console.log(`Origin rune multipliers: ${projected.providers.length} providers, ${projected.exclusions.length} exclusions (${check ? "checked" : "projected"})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { main(); } catch (error) { console.error(error); process.exitCode = 1; }
}
