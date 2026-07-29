import rawMultiplierData from "@/data/guides/multiplier.json";

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

type SpecialCorrectionExample = {
  id: string;
  label: string;
  icon: DilutionIconKey;
  href?: string;
};

type SpecialCorrectionData = {
  summary: string;
  rules: readonly string[];
  target: string;
  attributeField: string;
  examples: readonly SpecialCorrectionExample[];
  notice: string;
};

type MultiplierData = {
  schemaVersion: 2;
  defaultFactorId: MultiplierFactorId;
  factors: readonly MultiplierFactor[];
  dilutionCategories: readonly DilutionCategory[];
  specialCorrection: SpecialCorrectionData;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseMultiplierData(value: unknown): MultiplierData {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 2 ||
    typeof value.defaultFactorId !== "string" ||
    !Array.isArray(value.factors) ||
    !Array.isArray(value.dilutionCategories) ||
    !isRecord(value.specialCorrection)
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

  const specialCorrection = value.specialCorrection;
  if (
    typeof specialCorrection.summary !== "string" ||
    !Array.isArray(specialCorrection.rules) ||
    specialCorrection.rules.length === 0 ||
    specialCorrection.rules.some((rule) => typeof rule !== "string") ||
    typeof specialCorrection.target !== "string" ||
    typeof specialCorrection.attributeField !== "string" ||
    !Array.isArray(specialCorrection.examples) ||
    specialCorrection.examples.length === 0 ||
    typeof specialCorrection.notice !== "string"
  ) {
    throw new Error("特殊修正数据结构无效");
  }

  for (const example of specialCorrection.examples) {
    if (
      !isRecord(example) ||
      typeof example.id !== "string" ||
      exampleIds.has(example.id) ||
      typeof example.label !== "string" ||
      typeof example.icon !== "string" ||
      !DILUTION_ICON_KEYS.includes(example.icon as DilutionIconKey) ||
      (example.href !== undefined &&
        (typeof example.href !== "string" || !example.href.startsWith("/")))
    ) {
      throw new Error("特殊修正案例存在无效或重复字段");
    }
    exampleIds.add(example.id);
  }

  return value as unknown as MultiplierData;
}

export const MULTIPLIER_DATA = parseMultiplierData(rawMultiplierData);
export const MULTIPLIER_FACTORS = MULTIPLIER_DATA.factors;
export const DILUTION_CATEGORIES = MULTIPLIER_DATA.dilutionCategories;
export const SPECIAL_CORRECTION = MULTIPLIER_DATA.specialCorrection;

const defaultMultiplierFactor = MULTIPLIER_FACTORS.find(
  (factor) => factor.id === MULTIPLIER_DATA.defaultFactorId,
);

if (!defaultMultiplierFactor) {
  throw new Error("默认乘区数据读取失败");
}

export const DEFAULT_MULTIPLIER_FACTOR = defaultMultiplierFactor;
