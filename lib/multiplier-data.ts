import rawMultiplierData from "@/data/guides/multiplier.json";
import { WEAPON_TYPE_SPRITES } from "@/constants/sprites";
import type { WeaponType } from "@/types";

const MULTIPLIER_FACTOR_IDS = [
  "base",
  "weakpoint-multiplier",
  "game-mode",
  "element",
  "critical",
  "weakness",
  "dilution",
  "correction",
  "damage-reduction",
] as const;

const DILUTION_ICON_KEYS = [
  "target",
  "swords",
  "sparkles",
  "locate-fixed",
  "telescope",
  "crosshair",
  "bomb",
] as const;

export type MultiplierFactorId = (typeof MULTIPLIER_FACTOR_IDS)[number];
export type DilutionIconKey = (typeof DILUTION_ICON_KEYS)[number];

type MultiplierFactor = {
  id: MultiplierFactorId;
  label: string;
};

type DilutionExample = {
  id: string;
  label: string;
  href: string;
};

type DilutionCategory = {
  id: string;
  target: string;
  attributeField: string;
  icon: DilutionIconKey;
  examples: readonly DilutionExample[];
};

type WeakpointMultiplierGroup = {
  multiplier: number;
  weaponTypes: readonly WeaponType[];
};

type WeakpointSpecialSource = {
  id: string;
  label: string;
  icon: DilutionIconKey;
  href: string;
};

export type WeakpointMultiplierData = {
  groups: readonly WeakpointMultiplierGroup[];
  specialSources: {
    multiplier: number;
    note: string;
    items: readonly WeakpointSpecialSource[];
  };
  scaleField: string;
  enableField: string;
  formula: string;
};

type FactorDetailExample = {
  id: string;
  label: string;
  icon: DilutionIconKey;
  href?: string;
  selectionId?: string;
};

type FactorAttributeField = {
  name: string;
  note?: string;
  selection?: {
    id: string;
    label: string;
  };
};

export type FactorDetailData = {
  summary: string;
  rulesHeading: string;
  rules: readonly string[];
  target: string;
  targetNote: string;
  attributeFields: readonly FactorAttributeField[];
  examples: readonly FactorDetailExample[];
  notice: string;
};

type MultiplierData = {
  schemaVersion: 8;
  defaultFactorId: MultiplierFactorId;
  factors: readonly MultiplierFactor[];
  weakpointMultiplier: WeakpointMultiplierData;
  dilutionCategories: readonly DilutionCategory[];
  factorDetails: Partial<Record<MultiplierFactorId, FactorDetailData>>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseMultiplierData(value: unknown): MultiplierData {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 8 ||
    typeof value.defaultFactorId !== "string" ||
    !Array.isArray(value.factors) ||
    !isRecord(value.weakpointMultiplier) ||
    !Array.isArray(value.dilutionCategories) ||
    !isRecord(value.factorDetails)
  ) {
    throw new Error("乘区数据顶层结构无效");
  }

  const factorIds = new Set<string>();
  for (const factor of value.factors) {
    if (
      !isRecord(factor) ||
      typeof factor.id !== "string" ||
      !MULTIPLIER_FACTOR_IDS.includes(factor.id as MultiplierFactorId) ||
      typeof factor.label !== "string" ||
      factorIds.has(factor.id)
    ) {
      throw new Error("乘区节点存在无效或重复字段");
    }
    factorIds.add(factor.id);
  }

  if (!factorIds.has(value.defaultFactorId)) {
    throw new Error("默认乘区不存在");
  }

  const weakpointMultiplier = value.weakpointMultiplier;
  if (
    !Array.isArray(weakpointMultiplier.groups) ||
    weakpointMultiplier.groups.length !== 5 ||
    !isRecord(weakpointMultiplier.specialSources) ||
    typeof weakpointMultiplier.scaleField !== "string" ||
    typeof weakpointMultiplier.enableField !== "string" ||
    typeof weakpointMultiplier.formula !== "string"
  ) {
    throw new Error("弱点倍率数据结构无效");
  }

  const validWeaponTypes = new Set<string>(Object.keys(WEAPON_TYPE_SPRITES));
  const weakpointMultipliers = new Set<number>();
  const weakpointWeaponTypes = new Set<string>();
  let previousWeakpointMultiplier = Number.POSITIVE_INFINITY;

  for (const group of weakpointMultiplier.groups) {
    if (
      !isRecord(group) ||
      typeof group.multiplier !== "number" ||
      !Number.isFinite(group.multiplier) ||
      group.multiplier <= 0 ||
      group.multiplier >= previousWeakpointMultiplier ||
      weakpointMultipliers.has(group.multiplier) ||
      !Array.isArray(group.weaponTypes) ||
      group.weaponTypes.length === 0
    ) {
      throw new Error("弱点倍率分组存在无效或重复字段");
    }

    weakpointMultipliers.add(group.multiplier);
    previousWeakpointMultiplier = group.multiplier;

    for (const weaponType of group.weaponTypes) {
      if (
        typeof weaponType !== "string" ||
        !validWeaponTypes.has(weaponType) ||
        weakpointWeaponTypes.has(weaponType)
      ) {
        throw new Error("弱点倍率武器类型存在无效或重复数据");
      }
      weakpointWeaponTypes.add(weaponType);
    }
  }

  if (weakpointWeaponTypes.size !== validWeaponTypes.size) {
    throw new Error("弱点倍率武器类型覆盖不完整");
  }

  const specialSources = weakpointMultiplier.specialSources;
  if (
    typeof specialSources.multiplier !== "number" ||
    !Number.isFinite(specialSources.multiplier) ||
    specialSources.multiplier <= 0 ||
    weakpointMultipliers.has(specialSources.multiplier) ||
    typeof specialSources.note !== "string" ||
    !Array.isArray(specialSources.items) ||
    specialSources.items.length === 0
  ) {
    throw new Error("弱点倍率特殊来源结构无效");
  }

  const specialSourceIds = new Set<string>();
  for (const item of specialSources.items) {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      specialSourceIds.has(item.id) ||
      typeof item.label !== "string" ||
      typeof item.icon !== "string" ||
      !DILUTION_ICON_KEYS.includes(item.icon as DilutionIconKey) ||
      typeof item.href !== "string" ||
      !item.href.startsWith("/")
    ) {
      throw new Error("弱点倍率特殊来源存在无效或重复字段");
    }
    specialSourceIds.add(item.id);
  }

  const categoryIds = new Set<string>();
  const exampleIds = new Set<string>();
  for (const category of value.dilutionCategories) {
    if (
      !isRecord(category) ||
      typeof category.id !== "string" ||
      categoryIds.has(category.id) ||
      typeof category.target !== "string" ||
      typeof category.attributeField !== "string" ||
      typeof category.icon !== "string" ||
      !DILUTION_ICON_KEYS.includes(category.icon as DilutionIconKey) ||
      !Array.isArray(category.examples) ||
      category.examples.length === 0
    ) {
      throw new Error("大稀释分类存在无效或重复字段");
    }
    categoryIds.add(category.id);

    for (const example of category.examples) {
      if (
        !isRecord(example) ||
        typeof example.id !== "string" ||
        exampleIds.has(example.id) ||
        typeof example.label !== "string" ||
        typeof example.href !== "string" ||
        !example.href.startsWith("/")
      ) {
        throw new Error("典型案例存在无效或重复字段");
      }
      exampleIds.add(example.id);
    }
  }

  for (const [factorId, detail] of Object.entries(value.factorDetails)) {
    if (
      !MULTIPLIER_FACTOR_IDS.includes(factorId as MultiplierFactorId) ||
      !factorIds.has(factorId) ||
      !isRecord(detail) ||
      typeof detail.summary !== "string" ||
      typeof detail.rulesHeading !== "string" ||
      !Array.isArray(detail.rules) ||
      detail.rules.length === 0 ||
      detail.rules.some((rule) => typeof rule !== "string") ||
      typeof detail.target !== "string" ||
      typeof detail.targetNote !== "string" ||
      !Array.isArray(detail.attributeFields) ||
      detail.attributeFields.length === 0 ||
      !Array.isArray(detail.examples) ||
      typeof detail.notice !== "string"
    ) {
      throw new Error("乘区详情数据结构无效");
    }

    const attributeFieldNames = new Set<string>();
    const selectionIds = new Set<string>();
    for (const attributeField of detail.attributeFields) {
      if (
        !isRecord(attributeField) ||
        typeof attributeField.name !== "string" ||
        attributeFieldNames.has(attributeField.name) ||
        (attributeField.note !== undefined &&
          typeof attributeField.note !== "string") ||
        (attributeField.selection !== undefined &&
          (!isRecord(attributeField.selection) ||
            typeof attributeField.selection.id !== "string" ||
            typeof attributeField.selection.label !== "string" ||
            selectionIds.has(attributeField.selection.id)))
      ) {
        throw new Error("乘区详情属性字段存在无效或重复数据");
      }
      attributeFieldNames.add(attributeField.name);
      if (isRecord(attributeField.selection)) {
        selectionIds.add(attributeField.selection.id as string);
      }
    }

    for (const example of detail.examples) {
      if (
        !isRecord(example) ||
        typeof example.id !== "string" ||
        exampleIds.has(example.id) ||
        typeof example.label !== "string" ||
        typeof example.icon !== "string" ||
        !DILUTION_ICON_KEYS.includes(example.icon as DilutionIconKey) ||
        (example.href !== undefined &&
          (typeof example.href !== "string" || !example.href.startsWith("/"))) ||
        (example.selectionId !== undefined &&
          (typeof example.selectionId !== "string" ||
            !selectionIds.has(example.selectionId)))
      ) {
        throw new Error("乘区详情案例存在无效或重复字段");
      }
      exampleIds.add(example.id);
    }
  }

  return value as unknown as MultiplierData;
}

export const MULTIPLIER_DATA = parseMultiplierData(rawMultiplierData);
export const MULTIPLIER_FACTORS = MULTIPLIER_DATA.factors;
export const WEAKPOINT_MULTIPLIER_DATA = MULTIPLIER_DATA.weakpointMultiplier;
export const DILUTION_CATEGORIES = MULTIPLIER_DATA.dilutionCategories;
export const MULTIPLIER_FACTOR_DETAILS = MULTIPLIER_DATA.factorDetails;

const defaultMultiplierFactor = MULTIPLIER_FACTORS.find(
  (factor) => factor.id === MULTIPLIER_DATA.defaultFactorId,
);

if (!defaultMultiplierFactor) {
  throw new Error("默认乘区数据读取失败");
}

export const DEFAULT_MULTIPLIER_FACTOR = defaultMultiplierFactor;
