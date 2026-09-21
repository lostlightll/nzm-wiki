import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { getAllOverlimitCards } from "@/lib/overlimit-cards";
import { getOverlimitCatalog } from "@/lib/overlimit";
import { MULTIPLIER_PROVIDERS } from "@/lib/multiplier-data";
import { NUM_MODIFIER_RESOLVER } from "@/lib/num-modifier-data";
import type { ResolvedNumModifierRow } from "@/lib/num-modifier";
import type { PerkEffectValue } from "@/types";
import { loadModifierProviderRegistry } from "./num-modifier/provider-registry";
import { auditReviewedEffects } from "./overlimit/audit-effects";

type Row = Record<string, unknown>;
type EffectRecipient = "self" | "ally" | "enemy" | "damage-event" | "unknown";
type EffectEvidence = {
  applications?: readonly {
    expression: { row: `lc:${string}`; field: "base" | "coefficient"; scale?: number };
    context: { recipient: EffectRecipient };
  }[];
};

const root = process.cwd();
if (getOverlimitCatalog().withdrawn) {
  console.log("当前正式超限已归档撤下，无活跃卡片需要数值审计。");
  process.exit(0);
}
const refsRoot = path.resolve(root, getOverlimitCatalog().provenance.contentRoot);
if (!fs.existsSync(refsRoot)) {
  throw new Error(`当前超限版本的参考目录不存在：${refsRoot}`);
}

const loadRows = (...parts: string[]): Record<string, Row> =>
  JSON.parse(fs.readFileSync(path.join(refsRoot, ...parts), "utf8"))[0].Rows;

const weaponMods = loadRows("DataTables", "LuaDataTable", "WeaponModItemData.json");
const passives = loadRows("DataTables", "MGE", "MGEPassive_BD.json");
const descriptions = loadRows(
  "DataTables",
  "MGE",
  "DT_GPMGESkillDesConfig_BD.json",
);
const mgeConfigs = loadRows("DataTables", "MGE", "MGEConfig_Season.json");
const sourceRegistry = loadModifierProviderRegistry();

const providers = new Map(
  sourceRegistry.providers
    .filter(provider => !("season" in provider.source) || !provider.source.season)
    .flatMap((provider) => provider.source.type === "perk"
      ? [[provider.source.itemId, provider] as const]
      : provider.source.type === "overlimit-card" ? [[provider.source.id, provider] as const] : []),
);
const runtimeProviders = new Map(
  MULTIPLIER_PROVIDERS.filter(provider => !("season" in provider.source) || !provider.source.season).flatMap(provider => provider.source.type === "perk"
    ? [[provider.source.itemId, provider] as const]
    : provider.source.type === "overlimit-card" ? [[provider.source.id, provider] as const] : []),
);
const effectEvidenceByItem = new Map<string, EffectEvidence>();
for (const entry of [
  ...sourceRegistry.providers,
  ...sourceRegistry.exclusions,
]) {
  if ("season" in entry.source && entry.source.season) continue;
  if ((entry.source.type === "perk" || entry.source.type === "overlimit-card") && entry.evidence) {
    effectEvidenceByItem.set(entry.source.type === "perk" ? entry.source.itemId : entry.source.id, {
      applications:
        "applications" in entry
          ? entry.applications
          : entry.evidence.applications,
    });
  }
}

const reviewedEvidencePath = path.join(root, "data/overlimit/current-evidence.json");
if (fs.existsSync(reviewedEvidencePath)) {
  const catalog = getOverlimitCatalog();
  for (const source of catalog.provenance.files) {
    const sourcePath = path.resolve(/^(scripts|public|MD)\//.test(source.path) ? root : refsRoot, source.path);
    const actual = createHash("sha256").update(fs.readFileSync(sourcePath)).digest("hex");
    if (actual !== source.sha256) throw new Error(`Current overlimit evidence changed: ${source.path}`);
  }
  const announcement = catalog.provenance.files.find(file => /^scripts\/overlimit\/[^/]*announcement\.json$/.test(file.path));
  const descriptionOverrides = announcement
    ? JSON.parse(fs.readFileSync(path.join(root, announcement.path), "utf8")).cardDescriptions
    : {};
  const runtimeCardIds = new Set(MULTIPLIER_PROVIDERS.flatMap(provider =>
    provider.source.type === "overlimit-card" && !provider.source.season ? [provider.source.id] : []));
  const result = auditReviewedEffects(catalog, JSON.parse(fs.readFileSync(reviewedEvidencePath, "utf8")),
    NUM_MODIFIER_RESOLVER, loadModifierProviderRegistry(), runtimeCardIds, descriptionOverrides);
  console.log(`超限卡片 Numerical 效果审计通过：${result.cards} 张卡，${result.verifiedEffects} 项效果；逐项核对审定表达式、field、scale、单位和正式来源。`);
  process.exit(0);
}

function localized(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const text = value as Row;
  return String(text.LocalizedString ?? text.SourceString ?? "");
}

function parseModifierIds(value: unknown): string[] {
  return String(value ?? "").match(/\d+/g) ?? [];
}

function effectIdentityForRow(
  row: ResolvedNumModifierRow,
  recipient?: EffectRecipient,
): string | undefined {
  const effect = NUM_MODIFIER_RESOLVER.resolveEffect(
    { row: row.key, field: row.baseValue !== 0 ? "base" : "coefficient" },
    recipient ? { recipient } : undefined,
  );
  const facet = effect.facets.find(
    (candidate) => candidate.consumer === "damage" || candidate.consumer === "stat",
  );
  return facet ? `${facet.consumer}:${facet.id}` : undefined;
}

function effectIdentity(effect: PerkEffectValue): string {
  return effect.kind === "damage"
    ? `damage:${effect.modifierTypeId}`
    : `stat:${effect.statId}`;
}

function nonZeroPercentages(row: ResolvedNumModifierRow): number[] {
  if (row.operation !== "B1" && row.operation !== "B2") return [];
  return [row.baseValue, row.coefficient]
    .filter((value) => Number.isFinite(value) && value !== 0)
    .map((value) => value * 100);
}

function stagePercentages(effect: PerkEffectValue): number[] {
  return effect.stages
    .map((stage) => Number(stage.value.replace(/[+%]/g, "")))
    .filter(Number.isFinite);
}

const errors: string[] = [];
let verifiedEffects = 0;
const unverifiedEffects: string[] = [];

for (const card of getAllOverlimitCards()) {
  const item = card.perkItemId ? weaponMods[card.perkItemId] : undefined;
  const [passiveSkillId, level = "1"] = String(item?.PassiveSkill_ID ?? card.id).split(":");
  const passive = passives[`${passiveSkillId}_${level}`];
  const configId = String(
    (passive?.MGEConfig as Row | undefined)?.Id ?? passiveSkillId,
  );
  const descriptionRowKey = `${configId}_${String(passive?.MGEDescriptionId ?? 1)}`;
  const description = localized(descriptions[descriptionRowKey]?.MGEDescription);
  const configModifierIds = ((mgeConfigs[configId]?.Parameters as Row[] | undefined) ?? [])
    .filter((parameter) => parameter.Name === "CharacterModifierList")
    .flatMap((parameter) => parseModifierIds(parameter.Value));
  const descriptionModifierIds = [...description.matchAll(/\{GPModifier:(\d+):/g)]
    .map((match) => match[1]);
  const provider = providers.get(card.id);
  const runtimeProvider = runtimeProviders.get(card.id);
  const evidence = effectEvidenceByItem.get(card.id);
  const evidenceApplications = evidence?.applications ?? [];
  const evidenceRows = evidenceApplications.map((application) =>
    NUM_MODIFIER_RESOLVER.getRow(
      application.expression.row,
      `data/modifier-providers.json#perk:${card.id}`,
    ),
  );
  const evidenceRecipientByRow = new Map(
    evidenceApplications.map((application) => [
      application.expression.row,
      application.context.recipient,
    ]),
  );
  const effectIdentityForCardRow = (row: ResolvedNumModifierRow) =>
    effectIdentityForRow(row, evidenceRecipientByRow.get(row.key));
  const modifierIds = [...new Set([
    ...(NUM_MODIFIER_RESOLVER.getRowsById("lc", Number(passiveSkillId)).length > 0
      ? [passiveSkillId]
      : []),
    ...configModifierIds,
    ...descriptionModifierIds,
    ...evidenceRows.map((row) => String(row.id)),
  ])];
  const directRows = modifierIds.flatMap((modifierId) =>
    NUM_MODIFIER_RESOLVER.getRowsById("lc", Number(modifierId)),
  );
  const effectsByIdentity = new Map(
    (card.effectValues ?? []).map((effect) => [effectIdentity(effect), effect] as const),
  );

  const expectedRowsByIdentity = new Map<string, ResolvedNumModifierRow[]>();
  for (const numericalRow of directRows) {
    const identity = effectIdentityForCardRow(numericalRow);
    if (!identity || nonZeroPercentages(numericalRow).length === 0) continue;
    const rows = expectedRowsByIdentity.get(identity) ?? [];
    rows.push(numericalRow);
    expectedRowsByIdentity.set(identity, rows);
  }

  for (const [identity, rows] of expectedRowsByIdentity) {
    const effect = effectsByIdentity.get(identity);
    if (!effect) {
      errors.push(`${card.id} ${card.name} 缺少 ${identity} effect_values`);
      continue;
    }
    const actualValues = stagePercentages(effect);
    for (const numericalRow of rows) {
      for (const expectedValue of nonZeroPercentages(numericalRow)) {
        if (!actualValues.some((value) => Math.abs(value - expectedValue) < 1e-9)) {
          errors.push(
            `${card.id} ${card.name} 的 ${identity} 未采用 ${numericalRow.key} 结构化值 ${expectedValue}%`,
          );
        }
      }
    }
    verifiedEffects += 1;
  }

  const expectedDescriptionValues = [...expectedRowsByIdentity.values()]
    .flatMap((rows) => rows.flatMap(nonZeroPercentages))
    .map(Math.abs);
  const describedValues = [...card.description.matchAll(/(-?\d+(?:\.\d+)?)%/g)]
    .map((match) => Math.abs(Number(match[1])))
    .filter(Number.isFinite);
  if (
    expectedDescriptionValues.length > 0 &&
    describedValues.length > 0 &&
    !expectedDescriptionValues.some((expected) =>
      describedValues.some((actual) => Math.abs(actual - expected) < 1e-9),
    )
  ) {
    errors.push(`${card.id} ${card.name} 的卡片简述仍包含与 Numerical 冲突的百分比`);
  }

  for (const identity of effectsByIdentity.keys()) {
    if (!expectedRowsByIdentity.has(identity)) {
      unverifiedEffects.push(`${card.id} ${card.name} ${identity}`);
    }
  }

  if (!provider) continue;
  if (!runtimeProvider) {
    errors.push(`${card.id} ${card.name} 缺少运行时 provider 投影`);
    continue;
  }

  if (configModifierIds.length === 0) continue;
  const expectedDamageIds = [...new Set(configModifierIds.filter((modifierId) =>
    NUM_MODIFIER_RESOLVER.getRowsById("lc", Number(modifierId)).some((entry) =>
      effectIdentityForCardRow(entry)?.startsWith("damage:"),
    ),
  ))].sort();
  if (expectedDamageIds.length === 0) continue;
  const evidenceDamageIds = [...new Set(
    evidenceRows
      .filter((row) => effectIdentityForCardRow(row)?.startsWith("damage:"))
      .map((row) => String(row.id)),
  )].sort();
  if (JSON.stringify(expectedDamageIds) !== JSON.stringify(evidenceDamageIds)) {
    errors.push(`${card.id} ${card.name} 的 provider 未精确绑定 CharacterModifierList`);
  }
  const expectedTypes = [...new Set(configModifierIds.flatMap((modifierId) =>
    NUM_MODIFIER_RESOLVER.getRowsById("lc", Number(modifierId)).flatMap((entry) => {
      const identity = effectIdentityForCardRow(entry);
      return identity?.startsWith("damage:") ? [identity.slice(7)] : [];
    }),
  ))].sort();
  const actualTypes = [...new Set(runtimeProvider.modifierTypeIds)].sort();
  if (JSON.stringify(expectedTypes) !== JSON.stringify(actualTypes)) {
    errors.push(`${card.id} ${card.name} 的 provider 通道与 Numerical 不一致`);
  }
}

if (errors.length > 0) {
  throw new Error(
    `超限卡片 Numerical 效果审计失败：\n${errors.map((error) => `- ${error}`).join("\n")}`,
  );
}

console.log(
  `超限卡片 Numerical 效果审计通过：已验证 ${verifiedEffects} 项；` +
    `${unverifiedEffects.length} 项没有直连 Numerical，未使用描述自动判定。`,
);
if (unverifiedEffects.length > 0) {
  console.log(`未直连效果：\n${unverifiedEffects.map((item) => `- ${item}`).join("\n")}`);
}
