import fs from "node:fs";
import path from "node:path";
import rawProviders from "@/data/guides/multiplier-providers.json";
import { getAllOverlimitCards } from "@/lib/overlimit-cards";
import { MODIFIER_TYPES } from "@/lib/multiplier-data";
import type { PerkEffectValue, PerkStatId } from "@/types";

type Row = Record<string, unknown>;
type NumericalRow = {
  rowKey: string;
  modifierId: string;
  row: Row;
};
type EffectEvidence = {
  gpModifierIds?: readonly string[];
};

const root = process.cwd();
const refsRoot = path.join(root, "refs", "Exports", "NZM", "Content");
if (!fs.existsSync(refsRoot)) {
  console.log("未找到 refs/Exports/NZM/Content，跳过超限卡片 Numerical 审计。");
  process.exit(0);
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
const numerical = loadRows(
  "Attributes",
  "AutoGenerate",
  "numerical_modifier_config.json",
);

const providers = new Map(
  rawProviders.providers
    .filter((provider) => provider.source.type === "perk")
    .map((provider) => [provider.source.itemId, provider] as const),
);
const effectEvidenceByItem = new Map<string, EffectEvidence>();
for (const entry of [
  ...rawProviders.providers,
  ...rawProviders.exclusions,
] as readonly {
  source: { type: string; itemId?: string };
  evidence?: EffectEvidence;
}[]) {
  if (entry.source.type === "perk" && entry.source.itemId && entry.evidence) {
    effectEvidenceByItem.set(entry.source.itemId, entry.evidence);
  }
}
const modifierTypeByAttribute = new Map(
  MODIFIER_TYPES.flatMap((type) =>
    type.attributeFields.map((attribute) => [attribute, type.id] as const),
  ),
);
const numericalById = new Map<string, NumericalRow[]>();
for (const [rowKey, row] of Object.entries(numerical)) {
  const modifierId = String(row.ID ?? "");
  const rows = numericalById.get(modifierId) ?? [];
  rows.push({ rowKey, modifierId, row });
  numericalById.set(modifierId, rows);
}

const statIdByAttribute = new Map<string, PerkStatId>([
  ["GPAttributeSetCritical.CriticalRatio", "critical-rate"],
  ["GPAttributeSetFireMode.RPMAdjustRatio", "fire-rate"],
  ["GPAttributeSetCharacterWeaponAdjust.GunRPMRatioAdjust", "fire-rate"],
  ["GPAttributeSetCharacterWeaponAdjust.ChargeSpeedAddRatio", "charge-efficiency"],
  ["GPAttributeSetSkill.ChargeSpeedAddRatio", "charge-efficiency"],
  ["GPAttributeSetToughness.ToughnessRatio", "toughness-efficiency"],
  ["GPAttributeSetWeaponChangeClip.WeaponChangeClipSpeedRatio", "reload-speed"],
  ["GPAttributeSetSpeed.SpeedScale", "movement-speed"],
  ["GPAttributeSetCharacterWeaponAdjust.MeleeAttackIntervalRatio", "melee-attack-speed"],
  ["GPAttributeSetExplosion.WeaponExplosionRadiusRatio", "explosion-radius"],
  ["GPAttributeSetMelee.MeleeAttackDistanceScale", "skill-range"],
  ["GPAttributeSetWeaponDamage.DistanceBeginAddRatio", "effective-range"],
  ["GPAttributeSetWeaponDamage.DistanceEndAddRatio", "effective-range"],
]);

function localized(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const text = value as Row;
  return String(text.LocalizedString ?? text.SourceString ?? "");
}

function parseModifierIds(value: unknown): string[] {
  return String(value ?? "").match(/\d+/g) ?? [];
}

function effectIdentityForRow(row: Row): string | undefined {
  const attribute = String(row.AttributeName ?? "");
  if (
    attribute === "GPAttributeSetBearDamageRatio.DamageBearRatio" &&
    (Number(row.BaseValue ?? 0) > 0 || Number(row.CoefValue ?? 0) > 0)
  ) {
    return "stat:damage-reduction";
  }
  const statId = statIdByAttribute.get(attribute);
  if (statId) return `stat:${statId}`;
  const modifierTypeId = modifierTypeByAttribute.get(attribute);
  return modifierTypeId ? `damage:${modifierTypeId}` : undefined;
}

function effectIdentity(effect: PerkEffectValue): string {
  return effect.kind === "damage"
    ? `damage:${effect.modifierTypeId}`
    : `stat:${effect.statId}`;
}

function nonZeroPercentages(row: Row): number[] {
  if (row.GPModifierOp !== "B1" && row.GPModifierOp !== "B2") return [];
  return [Number(row.BaseValue ?? 0), Number(row.CoefValue ?? 0)]
    .filter((value) => Number.isFinite(value) && value !== 0)
    .map((value) => value * 100);
}

function stagePercentages(effect: PerkEffectValue): number[] {
  return effect.stages
    .map((stage) => Number(stage.value.replace(/[+%]/g, "")))
    .filter(Number.isFinite);
}

function sameNumbers(left: unknown, right: unknown): boolean {
  return Math.abs(Number(left ?? 0) - Number(right ?? 0)) < 1e-9;
}

const errors: string[] = [];
let verifiedEffects = 0;
const unverifiedEffects: string[] = [];

for (const card of getAllOverlimitCards()) {
  const item = weaponMods[card.id];
  const [passiveSkillId, level = "1"] = String(item?.PassiveSkill_ID ?? "").split(":");
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
  const evidence = effectEvidenceByItem.get(card.id);
  const modifierIds = [...new Set([
    ...(numericalById.has(passiveSkillId) ? [passiveSkillId] : []),
    ...configModifierIds,
    ...descriptionModifierIds,
    ...(evidence?.gpModifierIds ?? []),
  ])];
  const directRows = modifierIds.flatMap((modifierId) =>
    numericalById.get(modifierId) ?? [],
  );
  const effectsByIdentity = new Map(
    (card.effectValues ?? []).map((effect) => [effectIdentity(effect), effect] as const),
  );

  const expectedRowsByIdentity = new Map<string, NumericalRow[]>();
  for (const numericalRow of directRows) {
    const identity = effectIdentityForRow(numericalRow.row);
    if (!identity || nonZeroPercentages(numericalRow.row).length === 0) continue;
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
      for (const expectedValue of nonZeroPercentages(numericalRow.row)) {
        if (!actualValues.some((value) => Math.abs(value - expectedValue) < 1e-9)) {
          errors.push(
            `${card.id} ${card.name} 的 ${identity} 未采用 ${numericalRow.rowKey} 结构化值 ${expectedValue}%`,
          );
        }
      }
    }
    verifiedEffects += 1;
  }

  const expectedDescriptionValues = [...expectedRowsByIdentity.values()]
    .flatMap((rows) => rows.flatMap((entry) => nonZeroPercentages(entry.row)))
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
  for (const evidenceRow of provider.evidence.numericalRows) {
    const actual = numerical[evidenceRow.rowKey];
    if (!actual || String(actual.ID ?? "") !== evidenceRow.modifierId) {
      errors.push(`${card.id} ${card.name} 的证据行失联：${evidenceRow.rowKey}`);
      continue;
    }
    if (
      String(actual.AttributeName ?? "") !== evidenceRow.attributeName ||
      String(actual.GPModifierOp ?? "") !== evidenceRow.operation ||
      !sameNumbers(actual.BaseValue, evidenceRow.baseValue) ||
      !sameNumbers(actual.CoefValue, evidenceRow.coefficient)
    ) {
      errors.push(`${card.id} ${card.name} 的证据行内容过期：${evidenceRow.rowKey}`);
    }
  }

  if (configModifierIds.length === 0) continue;
  const expectedDamageIds = [...new Set(configModifierIds.filter((modifierId) =>
    (numericalById.get(modifierId) ?? []).some((entry) =>
      effectIdentityForRow(entry.row)?.startsWith("damage:"),
    ),
  ))].sort();
  if (expectedDamageIds.length === 0) continue;
  const evidenceDamageIds = [...new Set(
    provider.evidence.numericalRows
      .filter((row) => row.modifierTypeId)
      .map((row) => row.modifierId),
  )].sort();
  if (JSON.stringify(expectedDamageIds) !== JSON.stringify(evidenceDamageIds)) {
    errors.push(`${card.id} ${card.name} 的 provider 未精确绑定 CharacterModifierList`);
  }
  const expectedTypes = [...new Set(configModifierIds.flatMap((modifierId) =>
    (numericalById.get(modifierId) ?? []).flatMap((entry) => {
      const identity = effectIdentityForRow(entry.row);
      return identity?.startsWith("damage:") ? [identity.slice(7)] : [];
    }),
  ))].sort();
  const actualTypes = [...new Set(provider.modifierTypeIds)].sort();
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
