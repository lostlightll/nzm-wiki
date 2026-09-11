import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { getLegacyTalentCatalog, type LegacyTalentTree } from "../../lib/s0s1-season-talents";
import { NUM_MODIFIER_RESOLVER } from "../../lib/num-modifier-data";
import { MODIFIER_TYPES } from "../../lib/multiplier-data";
import { parseModifierProviderRegistry, type ModifierProviderRegistry } from "../../lib/modifier-provider-registry";
import { LEGACY_PROVIDER_GAPS, mechanicalPowerApplications } from "./provider-supplements";

const registryPath = "data/modifier-providers.json";
const damageFacets = new Set(MODIFIER_TYPES.map(type => type.id));
const isLegacy = (entry: { source: { type: string; season?: string } }) => entry.source.type === "season-talent" && ["s0", "s1"].includes(entry.source.season ?? "");

export function buildLegacyProviders(trees: readonly LegacyTalentTree[]) {
  const providers: ModifierProviderRegistry["providers"] = [];
  const exclusions: ModifierProviderRegistry["exclusions"] = [];
  for (const tree of trees.filter(tree => tree.historicalStatus === "video-confirmed")) for (const node of tree.nodes) {
    const identity = {
      id: `season:${tree.season}:${tree.id}:${node.id}`,
      label: `${tree.season.toUpperCase()} ${tree.name}·${node.name}`,
      source: { type: "season-talent" as const, season: tree.season, tree: tree.id, nodeId: node.id },
    };
    const conflicts = node.levels.flatMap(level => level.valueReview?.executionConflict ? [level.valueReview.executionConflict] : []);
    const supplement = !conflicts.length && tree.season === "s0" && node.id === "1003206" ? mechanicalPowerApplications() : undefined;
    const reviewed = [...node.levels.flatMap(level => level.valueReview?.executionConflict ? [] : level.valueReview?.applications ?? []), ...supplement?.applications ?? []];
    const applications = [...new Map(reviewed.map(application => [JSON.stringify(application), application])).values()];
    const damageApplications = applications.filter(application => NUM_MODIFIER_RESOLVER.resolveEffect(application.expression, application.context, identity.id).facets.some(facet => damageFacets.has(facet.id)));
    const basis = [...new Set([...node.levels.flatMap(level => level.valueReview?.sources ?? []), ...supplement?.basis ?? []])];
    const limitation = "当前结构化配置和最新主 Lock 的来源映射；不宣称数值与历史赛季实测一致。";
    if (damageApplications.length) {
      assert.ok(basis.length, `${identity.id}: reviewed applications need provenance`);
      providers.push({ ...identity, applications: damageApplications, evidence: { kind: "reviewed-chain", basis: [...basis, limitation] } });
    } else {
      const gaps = node.skillIds.flatMap(id => LEGACY_PROVIDER_GAPS[String(id)] ?? []);
      const missing = conflicts.length || gaps.length || node.levels.some(level => !level.valueReview || level.valueReview.remaining || level.videoReview || level.description.includes("〔数值待核实〕") || level.description.includes("缺少该等级描述") || level.semanticConflicts?.length);
      exclusions.push({ ...identity, reasonCode: missing ? "unverified-evidence" : "not-damage-multiplier",
        reason: conflicts.length ? [...new Set(conflicts.map(conflict => conflict.message))].join("；") : gaps.length ? gaps.join("；") : missing ? "尚未确认该节点的增伤来源链；缺失或冲突证据不按名称推定乘区。" : "已核验效果没有可发布的增伤分面，不因治疗、充能或独立伤害效果推定乘区。",
        evidence: { basis: [...basis, ...conflicts.flatMap(conflict => conflict.sources), ...node.levels.flatMap(level => level.valueReview?.notes ?? []), limitation] },
      });
    }
  }
  return { providers, exclusions };
}

export function syncLegacyProviders(write = false) {
  const raw = JSON.parse(readFileSync(registryPath, "utf8")) as ModifierProviderRegistry;
  const registry = parseModifierProviderRegistry(raw);
  const expected = buildLegacyProviders([...getLegacyTalentCatalog("s0"), ...getLegacyTalentCatalog("s1")]);
  if (write) {
    raw.providers = [...raw.providers.filter(entry => !isLegacy(entry)), ...expected.providers];
    raw.exclusions = [...raw.exclusions.filter(entry => !isLegacy(entry)), ...expected.exclusions];
    parseModifierProviderRegistry(raw);
    writeFileSync(registryPath, JSON.stringify(raw, null, 2) + "\n");
  } else {
    assert.deepEqual(registry.providers.filter(isLegacy), expected.providers, "S0/S1 provider evidence drift: rerun providers --write and num-modifier:project");
    assert.deepEqual(registry.exclusions.filter(isLegacy), expected.exclusions, "S0/S1 exclusion evidence drift");
  }
  console.log(`S0/S1: ${expected.providers.length} verified multiplier sources; ${expected.exclusions.length} explicit exclusions.`);
  return expected;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) syncLegacyProviders(process.argv.includes("--write"));
