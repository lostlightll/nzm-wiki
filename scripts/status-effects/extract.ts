import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  ElementStatusSummary,
  StatusEffectCatalogEntry,
  StatusEffectDataLock,
  StatusEffectModifierReference,
  StatusEffectNumericalReference,
  StatusEffectPolarity,
  StatusEffectTarget,
  StatusEffectVariant,
} from "../../types/status-effects";

type JsonObject = Record<string, unknown>;

interface UnrealExport {
  Rows?: Record<string, JsonObject>;
}

interface StatusEffectSourceTables {
  buffRows: Record<string, JsonObject>;
  elementRows: Record<string, JsonObject>;
  modifierRows: Record<string, JsonObject>;
  numericalRows: Record<string, JsonObject>;
}

export interface StatusEffectIconOverride {
  publicPath: string | null;
  reason: string;
}

export interface StatusEffectExtractionResult {
  data: StatusEffectDataLock;
  iconAssets: Map<string, string>;
}

export const STATUS_EFFECT_SOURCE_PATHS = {
  buffTable:
    "refs/Exports/NZM/Content/DataTables/Buff/BuffConfigDatatableNew.json",
  elementTable:
    "refs/Exports/NZM/Content/DataTables/GameFeatureConfig/ElementConfigDataTable.json",
  modifierTable:
    "refs/Exports/NZM/Content/Attributes/AutoGenerate/numerical_modifier_config.json",
  numericalTable:
    "refs/Exports/NZM/Content/DataTables/numerical_config_others.json",
} as const;

const PUBLIC_ICON_ROOT = "/webp/icons/status-effects";

const ELEMENTS: ReadonlyArray<{
  sourceKey: string;
  id: ElementStatusSummary["id"];
  fallbackName: string;
}> = [
  { sourceKey: "Fire", id: "fire", fallbackName: "火焰" },
  { sourceKey: "Cryo", id: "cryo", fallbackName: "寒冷" },
  { sourceKey: "Shock", id: "shock", fallbackName: "电弧" },
  { sourceKey: "Corossive", id: "corossive", fallbackName: "腐蚀" },
];

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is number => typeof item === "number" && Number.isFinite(item),
  );
}

function unique<T>(values: Iterable<T>): T[] {
  return [...new Set(values)];
}

function localizedText(value: unknown): string {
  const object = asObject(value);
  return asString(object.LocalizedString) || asString(object.SourceString);
}

function getRows(filePath: string): Record<string, JsonObject> {
  const exports = JSON.parse(fs.readFileSync(filePath, "utf8")) as UnrealExport[];
  const rows = exports[0]?.Rows;
  if (!rows) throw new Error(`DataTable 缺少 Rows：${filePath}`);
  return rows;
}

export function readStatusEffectSourceTables(
  root = process.cwd(),
): StatusEffectSourceTables {
  return {
    buffRows: getRows(path.join(root, STATUS_EFFECT_SOURCE_PATHS.buffTable)),
    elementRows: getRows(path.join(root, STATUS_EFFECT_SOURCE_PATHS.elementTable)),
    modifierRows: getRows(path.join(root, STATUS_EFFECT_SOURCE_PATHS.modifierTable)),
    numericalRows: getRows(path.join(root, STATUS_EFFECT_SOURCE_PATHS.numericalTable)),
  };
}

export function getStatusEffectPolarity(
  subscriptType: unknown,
): StatusEffectPolarity | null {
  const value = asString(subscriptType);
  if (value.endsWith("::Positive")) return "positive";
  if (value.endsWith("::Negative")) return "negative";
  return null;
}

export function getStatusEffectTargets(
  displayMask: number,
  polarity: StatusEffectPolarity,
): StatusEffectTarget[] {
  const targets: StatusEffectTarget[] = [];
  if (polarity === "negative" && (displayMask === 2 || displayMask === 3)) {
    targets.push("enemy");
  }
  if (displayMask === 1 || displayMask === 3 || displayMask === 4) {
    targets.push("player");
  }
  return targets;
}

function assetPackagePath(assetPath: string): string | null {
  if (!assetPath.startsWith("/Game/")) return null;
  const packagePath = assetPath.slice("/Game/".length).split(".")[0];
  return packagePath || null;
}

export function getGeneratedIconPath(
  assetPath: string,
  overrides: Record<string, StatusEffectIconOverride> = {},
): string | null {
  if (Object.hasOwn(overrides, assetPath)) return overrides[assetPath].publicPath;
  const packagePath = assetPackagePath(assetPath);
  if (!packagePath) return null;
  const baseName = path.posix.basename(packagePath).replace(/[^a-zA-Z0-9_-]+/g, "-");
  const hash = crypto.createHash("sha1").update(assetPath).digest("hex").slice(0, 10);
  return `${PUBLIC_ICON_ROOT}/${hash}-${baseName}.webp`;
}

export function getSourceIconPath(root: string, assetPath: string): string | null {
  const packagePath = assetPackagePath(assetPath);
  if (!packagePath) return null;
  return path.join(root, "refs", "Exports", "NZM", "Content", `${packagePath}.png`);
}

function buildVariant(
  rowName: string,
  row: JsonObject,
  iconOverrides: Record<string, StatusEffectIconOverride>,
): StatusEffectVariant | null {
  const polarity = getStatusEffectPolarity(row.SubscriptType);
  if (!polarity) return null;
  const displayMask = asNumber(row.DisplayPlaceEnumBitmask);
  if (getStatusEffectTargets(displayMask, polarity).length === 0) return null;

  const iconAssetPath = asString(asObject(row.BuffIconPath).AssetPathName);
  const iconAsset = iconAssetPath === "None" ? null : iconAssetPath || null;
  const numericalId = asNumber(row.NumericalID);

  return {
    rowName,
    name: asString(row.ChineseName) || rowName,
    description: localizedText(row.Desc),
    category: asString(row.Category).replace("ENZBuffCategory::", "") || "Unknown",
    polarity,
    displayMask,
    duration: asNumber(row.Duration, -1),
    period: asNumber(row.Period),
    stackLimit: asNumber(row.StackLimitCount, 1),
    levelDuration: asString(row.LevelDuration),
    icon: iconAsset ? getGeneratedIconPath(iconAsset, iconOverrides) : null,
    iconAsset,
    modifierIds: asNumberArray(row.GPModifyIDs),
    numericalId: numericalId > 0 ? numericalId : null,
  };
}

function buildEntry(buffId: number, variants: StatusEffectVariant[]): StatusEffectCatalogEntry {
  const names = unique(variants.map((variant) => variant.name).filter(Boolean));
  const descriptions = unique(
    variants.map((variant) => variant.description).filter(Boolean),
  );
  const targets = unique(
    variants.flatMap((variant) =>
      getStatusEffectTargets(variant.displayMask, variant.polarity),
    ),
  );

  return {
    buffId,
    name: names[0] || String(buffId),
    names,
    descriptions,
    categories: unique(variants.map((variant) => variant.category)),
    polarities: unique(variants.map((variant) => variant.polarity)),
    targets,
    icon: variants.find((variant) => variant.icon)?.icon ?? null,
    variants,
  };
}

function buildModifierReferences(
  rows: Record<string, JsonObject>,
  referencedIds: Set<number>,
): Record<string, StatusEffectModifierReference[]> {
  const result: Record<string, StatusEffectModifierReference[]> = {};
  for (const row of Object.values(rows)) {
    const id = asNumber(row.ID);
    if (!referencedIds.has(id)) continue;
    const reference: StatusEffectModifierReference = {
      id,
      level: asNumber(row.Level),
      attributeName: asString(row.AttributeName),
      operation: asString(row.GPModifierOp),
      baseValue: asNumber(row.BaseValue),
      coefficient: asNumber(row.CoefValue),
      description: asString(row.Description),
    };
    (result[String(id)] ??= []).push(reference);
  }
  for (const references of Object.values(result)) {
    references.sort((left, right) => left.level - right.level);
  }
  return result;
}

function tagNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asString(asObject(item).TagName))
    .filter((item) => item && item !== "None");
}

function buildNumericalReferences(
  rows: Record<string, JsonObject>,
  referencedIds: Set<number>,
): Record<string, StatusEffectNumericalReference[]> {
  const result: Record<string, StatusEffectNumericalReference[]> = {};
  for (const row of Object.values(rows)) {
    const id = asNumber(row.id ?? row.ID);
    if (!referencedIds.has(id)) continue;
    const reference: StatusEffectNumericalReference = {
      id,
      level: asNumber(row.Level),
      description: asString(row.Description),
      elementType: asString(row.ElementType).replace("EElementEffectType::", ""),
      settlements: tagNames(row.Settlements),
      enableAttributes: tagNames(row.EnableAttributes),
      hpScale: asNumber(row.HpCalScale),
      hpBase: asNumber(row.HpCalBase),
      fleshDamageBase: asNumber(row.FleshDamageBase),
    };
    (result[String(id)] ??= []).push(reference);
  }
  for (const references of Object.values(result)) {
    references.sort((left, right) => left.level - right.level);
  }
  return result;
}

function buffNames(row: JsonObject, prefix: "BuffName" | "PlayerBuffName"): string[] {
  return unique(
    [row[prefix], row[`${prefix}Type1`], row[`${prefix}Type2`], row[`${prefix}Type3`]]
      .map((value) => asString(value))
      .filter((value) => value && value !== "None"),
  );
}

function buildElementSummaries(
  rows: Record<string, JsonObject>,
  iconOverrides: Record<string, StatusEffectIconOverride>,
): ElementStatusSummary[] {
  return ELEMENTS.map(({ sourceKey, id, fallbackName }) => {
    const row = rows[sourceKey];
    if (!row) throw new Error(`元素配置缺少 ${sourceKey}`);
    const iconAsset = asString(asObject(row.ElementIconPath).AssetPathName);
    const icon = getGeneratedIconPath(iconAsset, iconOverrides);
    if (!icon) throw new Error(`元素 ${sourceKey} 缺少可解析图标`);
    return {
      id,
      name: localizedText(row.Name) || fallbackName,
      description: localizedText(row.DetailDescription),
      icon,
      duration: asNumber(row.ElementDuration),
      clearTime: asNumber(row.ElementClearTime),
      enemyBuffNames: buffNames(row, "BuffName"),
      playerBuffNames: buffNames(row, "PlayerBuffName"),
    };
  });
}

export function extractStatusEffects(
  tables: StatusEffectSourceTables,
  iconOverrides: Record<string, StatusEffectIconOverride> = {},
): StatusEffectExtractionResult {
  const grouped = new Map<number, StatusEffectVariant[]>();
  const iconAssets = new Map<string, string>();

  for (const [rowName, row] of Object.entries(tables.buffRows)) {
    const variant = buildVariant(rowName, row, iconOverrides);
    if (!variant) continue;
    const buffId = asNumber(row.BuffID);
    if (buffId <= 0) throw new Error(`可见 Buff 缺少有效 BuffID：${rowName}`);
    const variants = grouped.get(buffId) ?? [];
    variants.push(variant);
    grouped.set(buffId, variants);
    if (
      variant.icon?.startsWith(PUBLIC_ICON_ROOT) &&
      variant.iconAsset &&
      !Object.hasOwn(iconOverrides, variant.iconAsset)
    ) {
      iconAssets.set(variant.icon, variant.iconAsset);
    }
  }

  const elements = buildElementSummaries(tables.elementRows, iconOverrides);
  for (const element of elements) {
    const sourceRow = tables.elementRows[
      ELEMENTS.find((item) => item.id === element.id)!.sourceKey
    ];
    const assetPath = asString(asObject(sourceRow.ElementIconPath).AssetPathName);
    if (
      element.icon.startsWith(PUBLIC_ICON_ROOT) &&
      !Object.hasOwn(iconOverrides, assetPath)
    ) {
      iconAssets.set(element.icon, assetPath);
    }
  }

  const effects = [...grouped.entries()]
    .map(([buffId, variants]) => buildEntry(buffId, variants))
    .sort((left, right) => left.buffId - right.buffId);
  const modifierIds = new Set(
    effects.flatMap((effect) => effect.variants.flatMap((variant) => variant.modifierIds)),
  );
  const numericalIds = new Set(
    effects.flatMap((effect) =>
      effect.variants.flatMap((variant) =>
        variant.numericalId ? [variant.numericalId] : [],
      ),
    ),
  );
  const enemyEffects = effects.filter((effect) => effect.targets.includes("enemy"));
  const playerEffects = effects.filter((effect) => effect.targets.includes("player"));
  const countRowsForTarget = (target: StatusEffectTarget) =>
    effects.reduce(
      (count, effect) =>
        count +
        effect.variants.filter((variant) =>
          getStatusEffectTargets(variant.displayMask, variant.polarity).includes(target),
        ).length,
      0,
    );
  const publishedIcons = new Set(
    [
      ...effects.flatMap((effect) => effect.variants.map((variant) => variant.icon)),
      ...elements.map((element) => element.icon),
    ].filter((icon): icon is string => Boolean(icon)),
  );

  const data: StatusEffectDataLock = {
    schemaVersion: 1,
    source: {
      mode: "lc",
      ...STATUS_EFFECT_SOURCE_PATHS,
    },
    summary: {
      enemyRows: countRowsForTarget("enemy"),
      enemyEntries: enemyEffects.length,
      playerRows: countRowsForTarget("player"),
      playerEntries: playerEffects.length,
      uniqueIcons: publishedIcons.size,
    },
    elements,
    effects,
    references: {
      modifiers: buildModifierReferences(tables.modifierRows, modifierIds),
      numericals: buildNumericalReferences(tables.numericalRows, numericalIds),
    },
  };

  return { data, iconAssets };
}
