import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import {
  MODIFIER_TYPES,
  MULTIPLIER_PROVIDERS,
  MULTIPLIER_PROVIDER_EXCLUSIONS,
} from "@/lib/multiplier-data";
import { HUNTING_SPEEDRUN_CARDS } from "@/lib/hunting-speedrun";

type Row = Record<string, unknown>;

const root = process.cwd();
const refsRoot = path.join(root, "refs", "Exports", "NZM", "Content");
if (!fs.existsSync(refsRoot)) {
  console.log("未找到 refs/Exports/NZM/Content，跳过完整乘区证据审计。");
  process.exit(0);
}

const errors: string[] = [];
const loadRows = (...parts: string[]): Record<string, Row> =>
  JSON.parse(fs.readFileSync(path.join(refsRoot, ...parts), "utf8"))[0].Rows;
const weaponMods = loadRows("DataTables", "LuaDataTable", "WeaponModItemData.json");
const passives = loadRows("DataTables", "MGE", "MGEPassive_BD.json");
const perkDescriptions = loadRows("DataTables", "MGE", "DT_GPMGESkillDesConfig_BD.json");
const numerical = loadRows("Attributes", "AutoGenerate", "numerical_modifier_config.json");
const huntingRankCards = loadRows(
  "DataTables",
  "HunterRank",
  "NZHunterRankCardConfigTable.json",
);
const buffConfigs = loadRows("DataTables", "Buff", "BuffConfigDatatableNew.json");
const weaponDescriptionTables = ["Weapon", "Skill"].map((suffix) =>
  loadRows("DataTables", "MGE", `DT_GPMGESkillDesConfig_${suffix}.json`),
);
const attributeDescriptions = loadRows("DataTables", "AttributeDescMapTable.json");
const knownAttributes = new Set(
  Object.values(attributeDescriptions).map((row) => String(row.attr_realname ?? "")),
);
const providersById = new Map(MULTIPLIER_PROVIDERS.map((provider) => [provider.id, provider]));
const exclusionsById = new Map(
  MULTIPLIER_PROVIDER_EXCLUSIONS.map((exclusion) => [exclusion.id, exclusion]),
);
const modifierTypeByAttribute = new Map(
  MODIFIER_TYPES.flatMap((modifier) =>
    modifier.attributeFields.map((attribute) => [attribute, modifier.id] as const),
  ),
);
const speedrunCardsById = new Map(
  HUNTING_SPEEDRUN_CARDS.map((card) => [card.cardId, card]),
);

function findMgeAsset(mgeId: number): string | undefined {
  const directory = path.join(refsRoot, "Abilities", "MGE", "LieChangPaiWei");
  return fs
    .readdirSync(directory)
    .find((file) => file.startsWith(`MGE_${mgeId}`) && file.endsWith(".json"));
}

function collectPropertyValues(value: unknown, propertyName: string): unknown[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectPropertyValues(item, propertyName));
  }
  if (!value || typeof value !== "object") return [];
  const record = value as Row;
  return [
    ...(propertyName in record ? [record[propertyName]] : []),
    ...Object.values(record).flatMap((item) =>
      collectPropertyValues(item, propertyName),
    ),
  ];
}
const numericalById = new Map<string, Row[]>();
for (const row of Object.values(numerical)) {
  const id = String(row.ID);
  const values = numericalById.get(id) ?? [];
  values.push(row);
  numericalById.set(id, values);
}
const weaponDescriptionsByName = new Map<string, string[]>();
for (const table of weaponDescriptionTables) {
  for (const row of Object.values(table)) {
    const name = String((row.MGEName as Row | undefined)?.LocalizedString ?? "").trim();
    if (!name) continue;
    const values = weaponDescriptionsByName.get(name) ?? [];
    values.push(String((row.MGEDescription as Row | undefined)?.LocalizedString ?? ""));
    weaponDescriptionsByName.set(name, values);
  }
}

function directPositiveModifiers(description: string): string[] {
  const modifierIds = [...description.matchAll(/\{GPModifier:(\d+):/g)].map(
    (match) => match[1],
  );
  return modifierIds.filter((modifierId) =>
    (numericalById.get(modifierId) ?? []).some((row) => {
      const modifierTypeId = modifierTypeByAttribute.get(String(row.AttributeName));
      if (!modifierTypeId) return false;
      const values = [Number(row.BaseValue ?? 0), Number(row.CoefValue ?? 0)];
      const isVulnerability =
        modifierTypeId === "vulnerability" ||
        modifierTypeId === "element-vulnerability";
      return isVulnerability
        ? values.some((value) => value < 0)
        : values.some((value) => value > 0);
    }),
  );
}

for (const provider of MULTIPLIER_PROVIDERS) {
  for (const row of provider.evidence.numericalRows) {
    const actual = numerical[row.rowKey];
    if (!actual || String(actual.ID) !== row.modifierId) {
      errors.push(`${provider.id} 的 Numerical 行已失联：${row.rowKey}`);
      continue;
    }
    if (String(actual.AttributeName) !== row.attributeName) {
      errors.push(`${provider.id} 的属性字段已变化：${row.rowKey}`);
    }
    const actualModifierTypeId = modifierTypeByAttribute.get(
      String(actual.AttributeName),
    );
    if (actualModifierTypeId !== row.modifierTypeId) {
      errors.push(
        `${provider.id} 的 Numerical AttributeName 反查乘区不一致：${row.rowKey}`,
      );
    }
    if (!knownAttributes.has(row.attributeName) && !row.attributeName.startsWith("Numerical.")) {
      errors.push(`${provider.id} 的属性不在 AttributeDescMapTable：${row.attributeName}`);
    }
    if (
      (row.modifierTypeId === "vulnerability" ||
        row.modifierTypeId === "element-vulnerability") &&
      Number(actual.BaseValue ?? 0) >= 0 &&
      Number(actual.CoefValue ?? 0) >= 0
    ) {
      errors.push(`${provider.id} 将非负承伤字段错列为易伤`);
    }
  }

  if (provider.source.type === "card") {
    const card = speedrunCardsById.get(provider.source.cardId);
    if (!card || card.slug !== provider.source.slug) {
      errors.push(`${provider.id} 的 CardID 或 slug 不在当前 38 张卡池`);
      continue;
    }
    if (provider.evidence.kind === "reviewed-override") {
      errors.push(`${provider.id} 的卡牌来源禁止使用 reviewed-override`);
    }
    if (provider.evidence.numericalRows.length === 0) {
      errors.push(`${provider.id} 的卡牌来源缺少 Numerical 行`);
    }
    const evidenceModifierTypes = new Set(
      provider.evidence.numericalRows.map((row) => row.modifierTypeId),
    );
    const providerModifierTypes = new Set(provider.modifierTypeIds);
    if (
      evidenceModifierTypes.size !== providerModifierTypes.size ||
      [...evidenceModifierTypes].some((id) => !providerModifierTypes.has(id))
    ) {
      errors.push(`${provider.id} 的 modifierTypeIds 与 Numerical 证据不一致`);
    }
    const evidenceModifierIds = new Set(
      provider.evidence.numericalRows.map((row) => row.modifierId),
    );
    if (
      !provider.evidence.gpModifierIds ||
      provider.evidence.gpModifierIds.some((id) => !evidenceModifierIds.has(id)) ||
      evidenceModifierIds.size !== provider.evidence.gpModifierIds.length
    ) {
      errors.push(`${provider.id} 的 GPModifier 与 Numerical 行不一致`);
    }

    const chain = provider.evidence.cardChain;
    const cardRow = huntingRankCards[String(provider.source.cardId)];
    const actualFunctionIds = [
      Number(cardRow?.Card_Function1_Id ?? 0),
      Number(cardRow?.Card_Function2_Id ?? 0),
      Number(cardRow?.Card_Function3_Id ?? 0),
    ].filter(Boolean);
    if (
      !chain ||
      chain.functionIds.length === 0 ||
      chain.mgeIds.length === 0 ||
      chain.functionIds.some((id) => !actualFunctionIds.includes(id))
    ) {
      errors.push(`${provider.id} 的 Card_Function → MGE 证据链不完整`);
      continue;
    }

    const directModifierIds = new Set<string>();
    for (const mgeId of chain.mgeIds) {
      const assetFile = findMgeAsset(mgeId);
      if (!assetFile) {
        errors.push(`${provider.id} 的 MGE 资源不存在：${mgeId}`);
        continue;
      }
      const asset = JSON.parse(
        fs.readFileSync(
          path.join(refsRoot, "Abilities", "MGE", "LieChangPaiWei", assetFile),
          "utf8",
        ),
      );
      for (const value of collectPropertyValues(asset, "ModifierID")) {
        directModifierIds.add(String(value));
      }
    }

    const buffModifierIds = new Set<string>();
    for (const buffId of chain.buffIds ?? []) {
      const buff = Object.values(buffConfigs).find(
        (row) => Number(row.BuffID) === buffId,
      );
      if (!buff) {
        errors.push(`${provider.id} 的 Buff 不存在：${buffId}`);
        continue;
      }
      for (const modifierId of (buff.GPModifyIDs as unknown[] | undefined) ?? []) {
        buffModifierIds.add(String(modifierId));
      }
    }
    for (const modifierId of provider.evidence.gpModifierIds ?? []) {
      if (!directModifierIds.has(modifierId) && !buffModifierIds.has(modifierId)) {
        errors.push(`${provider.id} 的 MGE/Buff 未连接 GPModifier ${modifierId}`);
      }
    }
    continue;
  }

  if (provider.source.type !== "perk") continue;
  const item = weaponMods[provider.source.itemId];
  if (!item) {
    errors.push(`${provider.id} 的 ItemID 不在 WeaponModItemData`);
    continue;
  }
  const [passiveSkillId, level = "1"] = String(item.PassiveSkill_ID ?? "").split(":");
  if (
    provider.evidence.passiveSkillId &&
    provider.evidence.passiveSkillId !== passiveSkillId
  ) {
    errors.push(`${provider.id} 的 PassiveSkill_ID 已变化`);
  }
  if (provider.evidence.kind !== "gp-modifier") continue;
  const passive = passives[`${passiveSkillId}_${level}`];
  const descriptionRowKey = passive
    ? `${String((passive.MGEConfig as Row | undefined)?.Id ?? passiveSkillId)}_${String(passive.MGEDescriptionId ?? 1)}`
    : "";
  const description = String(
    (perkDescriptions[descriptionRowKey]?.MGEDescription as Row | undefined)?.LocalizedString ?? "",
  );
  for (const modifierId of provider.evidence.gpModifierIds ?? []) {
    if (!description.includes(`{GPModifier:${modifierId}:`)) {
      errors.push(`${provider.id} 的 GPModifier ${modifierId} 已从 MGE 描述失联`);
    }
  }
}

for (const exclusion of MULTIPLIER_PROVIDER_EXCLUSIONS) {
  const source = exclusion.source;
  let description = "";
  if (source.type === "perk") {
    const item = weaponMods[source.itemId];
    const [passiveSkillId, level = "1"] = String(item?.PassiveSkill_ID ?? "").split(":");
    const passive = passives[`${passiveSkillId}_${level}`];
    const descriptionRowKey = passive
      ? `${String((passive.MGEConfig as Row | undefined)?.Id ?? passiveSkillId)}_${String(passive.MGEDescriptionId ?? 1)}`
      : "";
    description = String(
      (perkDescriptions[descriptionRowKey]?.MGEDescription as Row | undefined)?.LocalizedString ?? "",
    );
  } else if (source.type === "weapon") {
    description = (weaponDescriptionsByName.get(source.skillName) ?? []).join("\n");
  }
  const directModifiers = directPositiveModifiers(description);
  if (directModifiers.length > 0) {
    errors.push(
      `${exclusion.id} 已被排除，但现在出现正向 GPModifier：${directModifiers.join(", ")}`,
    );
  }
}

const candidateIds = new Set<string>();
const cardIds = new Set(
  (JSON.parse(fs.readFileSync(path.join(root, "data", "overlimit-cards.json"), "utf8")) as { id: string }[])
    .map((card) => String(card.id)),
);
for (const slotDirectory of fs.readdirSync(path.join(root, "data", "perks"), { withFileTypes: true })) {
  if (!slotDirectory.isDirectory()) continue;
  for (const file of fs.readdirSync(path.join(root, "data", "perks", slotDirectory.name))) {
    if (!file.endsWith(".mdx")) continue;
    const parsed = matter(
      fs.readFileSync(path.join(root, "data", "perks", slotDirectory.name, file), "utf8"),
    );
    const itemId = String(parsed.data.id);
    if (Number(parsed.data.CollectMODItem) === 1 || cardIds.has(itemId)) {
      candidateIds.add(`perk:${itemId}`);
    }
  }
}

const missing = [...candidateIds].filter(
  (id) => !providersById.has(id) && !exclusionsById.has(id),
);
for (const id of missing) errors.push(`缺少证据或处理决定：${id}`);

if (errors.length > 0) {
  throw new Error(`乘区来源完整证据审计失败：\n${errors.map((error) => `- ${error}`).join("\n")}`);
}

console.log(
  `乘区来源完整证据审计通过：已映射 ${MULTIPLIER_PROVIDERS.length}，明确排除 ${MULTIPLIER_PROVIDER_EXCLUSIONS.length}，缺少证据 ${missing.length}。`,
);
