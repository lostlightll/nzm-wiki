import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import runes from "../../data/origin/runes.json";
import multiplier from "../../data/guides/multiplier.json";
import { NUM_MODIFIER_LOCK, NUM_MODIFIER_RESOLVER, NUM_MODIFIER_SEMANTICS } from "../../lib/num-modifier-data";
import { parseModifierProviderRegistry, type ModifierProviderRegistry } from "../../lib/modifier-provider-registry";

const root = process.cwd();
const content = path.join(root, "refs/Exports/NZM/Content");
const passivePath = path.join(content, "DataTables/MGE/MGEPassiveMainTable.json");
const registryPath = path.join(root, "data/modifier-providers.json");

type RawRow = { ID: number; Level: number; AttributeName: string; GPModifierOp: string; BaseValue: number; CoefValue: number };
type PassiveRow = { PassiveSkillID: number; MGE: { Id: string }; MGEConfig: { Id: string } };

function rows<T>(file: string): Record<string, T> {
  const table = JSON.parse(fs.readFileSync(file, "utf8")) as { Rows: Record<string, T> }[];
  if (table.length !== 1 || !table[0]?.Rows) throw new Error(`Invalid source table: ${file}`);
  return table[0].Rows;
}

export function projectOriginRuneSources(
  passiveRows: Record<string, PassiveRow>,
) {
  const numericalRows = Object.fromEntries(Object.entries(NUM_MODIFIER_LOCK.rows.lc)
    .map(([key, row]) => [key, row.raw])) as Record<string, RawRow>;
  const damageFacets = new Set(multiplier.damageChannelMatrix.channels.map((channel) => channel.facetId));
  const providers: ModifierProviderRegistry["providers"] = [];
  const exclusions: ModifierProviderRegistry["exclusions"] = [];

  for (const rune of runes.runes) {
    const passive = passiveRows[`${rune.id}_1`];
    if (passive?.PassiveSkillID !== Number(rune.id)) throw new Error(`Missing passive identity: ${rune.id}`);
    const prefix = `1300${rune.id.slice(-5, -1)}`;
    const candidates = Object.entries(numericalRows).filter(([, row]) =>
      row.Level === 1 && (String(row.ID) === rune.id || (String(row.ID).length === 9 && String(row.ID).startsWith(prefix))));
    const applications: NonNullable<ModifierProviderRegistry["providers"][number]["applications"]> = [];
    for (const [key, row] of candidates) {
      if (NUM_MODIFIER_SEMANTICS.attributes[row.AttributeName]?.status !== "indexed") continue;
      const expression = { row: `lc:${key}` as const, field: row.BaseValue !== 0 ? "base" as const : "coefficient" as const };
      const recipient = row.AttributeName.startsWith("Numerical.ExecutionCtx.") ? "damage-event" as const : "self" as const;
      const resolved = NUM_MODIFIER_RESOLVER.resolveEffect(expression, { recipient }, `origin-rune:${rune.id}`);
      if (resolved.facets.some((facet) => damageFacets.has(facet.id))) {
        applications.push({ expression, context: { recipient } });
      }
    }

    const id = `origin-rune:${rune.id}`;
    const source = { type: "origin-rune" as const, id: rune.id };
    if (applications.length) {
      providers.push({
        id, label: rune.name, source, applications,
        evidence: {
          kind: "reviewed-chain",
          passiveSkillId: rune.id,
          basis: [
            `NZM/Content/DataTables/MGE/MGEPassiveMainTable.json#${rune.id}_1: MGE=${passive.MGE.Id}, MGEConfig=${passive.MGEConfig.Id}`,
            `NZM/Content/${NUM_MODIFIER_LOCK.sources.lc.modifiers.source_path}#${applications.map((application) => application.expression.row.slice(3)).join(", ")}; 此处仅索引属性，不推断施加时机与受益对象。`,
          ],
        },
      });
    } else {
      exclusions.push({
        id, label: rune.name, source,
        reasonCode: candidates.length ? "not-damage-multiplier" : "unverified-evidence",
        reason: candidates.length
          ? "关联的一级 Numerical 行未解析出可索引的增伤分面。"
          : "当前 Numerical 表中无同身份的增伤行；独立伤害或动态效果尚无可核定的乘区来源。",
        evidence: {
          passiveSkillId: rune.id,
          basis: [
            `NZM/Content/DataTables/MGE/MGEPassiveMainTable.json#${rune.id}_1`,
            `NZM/Content/${NUM_MODIFIER_LOCK.sources.lc.modifiers.source_path}#${candidates.map(([key]) => key).join(", ") || "无同身份行"}`,
          ],
        },
      });
    }
  }
  return { providers, exclusions };
}

function main() {
  const check = process.argv.includes("--check");
  const projected = projectOriginRuneSources(rows<PassiveRow>(passivePath));
  const registry = parseModifierProviderRegistry(JSON.parse(fs.readFileSync(registryPath, "utf8")));
  const originProviders = registry.providers.filter((entry) => entry.source.type === "origin-rune");
  const originExclusions = registry.exclusions.filter((entry) => entry.source.type === "origin-rune");
  if (check) {
    if (JSON.stringify(originProviders) !== JSON.stringify(projected.providers) ||
      JSON.stringify(originExclusions) !== JSON.stringify(projected.exclusions)) {
      throw new Error("Origin rune multiplier index is stale; run pnpm origin-runes:multiplier:project");
    }
  } else {
    const updated = {
      ...registry,
      providers: [...registry.providers.filter((entry) => entry.source.type !== "origin-rune"), ...projected.providers],
      exclusions: [...registry.exclusions.filter((entry) => entry.source.type !== "origin-rune"), ...projected.exclusions],
    };
    fs.writeFileSync(registryPath, `${JSON.stringify(updated, null, 2)}\n`);
  }
  console.log(`Origin rune multipliers: ${projected.providers.length} providers, ${projected.exclusions.length} exclusions (${check ? "checked" : "projected"})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { main(); } catch (error) { console.error(error); process.exitCode = 1; }
}
