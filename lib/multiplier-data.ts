import rawMultiplierData from "@/data/guides/multiplier.json";
import { WEAPON_TYPE_SPRITES } from "@/constants/sprites";
import type { ElementType, WeaponType } from "@/types";

const MULTIPLIER_FACTOR_IDS = [
  "base",
  "weakpoint-multiplier",
  "game-mode",
  "dilution",
  "element",
  "weakness",
  "critical",
  "correction",
  "damage-reduction",
] as const;

const DAMAGE_CHANNEL_GROUPS = ["factor", "dilution", "correction"] as const;
const DAMAGE_CHANNEL_STATUSES = ["applies", "conditional", "none"] as const;

export type MultiplierFactorId = (typeof MULTIPLIER_FACTOR_IDS)[number];
export type DilutionIconKey =
  | "target"
  | "swords"
  | "sparkles"
  | "locate-fixed"
  | "telescope"
  | "crosshair"
  | "bomb";
export type DamageChannelGroup = (typeof DAMAGE_CHANNEL_GROUPS)[number];
export type DamageChannelStatus = (typeof DAMAGE_CHANNEL_STATUSES)[number];

export type MultiplierSource =
  | { type: "weapon"; slug: string; anchor?: string }
  | { type: "perk"; slot: 1 | 2 | 3 | 4; slug: string; anchor?: string }
  | { type: "overlimit-card"; id: string; anchor?: string }
  | {
      type: "overlimit-bond";
      name: string;
      count: 2 | 4 | 6;
      anchor?: string;
    }
  | { type: "post"; slug: string; anchor?: string }
  | {
      type: "season-talent";
      season: string;
      tree?: string;
      nodeId?: string;
      anchor?: string;
    };

export type MultiplierFactor = {
  id: MultiplierFactorId;
  label: string;
};

type DilutionExample = {
  id: string;
  label: string;
  href: string;
};

export type DilutionCategory = {
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
  selection?: { id: string; label: string };
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

export type DamageType = { id: string; label: string };

type DamageChannelEffect = {
  damageTypeId: string;
  status: DamageChannelStatus;
  label?: string;
};

export type DamageChannel = {
  id: string;
  label: string;
  group: DamageChannelGroup;
  attributeFields: readonly string[];
  summary: string;
  effects: readonly DamageChannelEffect[];
};

export type DamageChannelMatrixData = {
  damageTypes: readonly DamageType[];
  channels: readonly DamageChannel[];
};

export type ModifierType = DamageChannel & {
  factorId: MultiplierFactorId;
};

export type ProviderEffect = {
  id: string;
  label: string;
  modifierTypeIds: readonly string[];
  evidence: readonly string[];
};

type ProviderPlacement = {
  effectId: string;
  source: MultiplierSource;
};

export type MultiplierRelation = {
  kind: "provider" | "target";
  factorId: MultiplierFactorId;
  factorLabel: string;
  modifierTypeId: string;
  modifierTypeLabel: string;
  effectId?: string;
  effectLabel?: string;
  source?: MultiplierSource;
  sourceHref?: string;
};

export type DamageProfile = {
  damageTypeIds: readonly string[];
  damageTags: readonly string[];
  element?: ElementType;
  enableCritical: boolean;
  enableWeakness: boolean;
};

type DamageProfileInput = {
  section?: string;
  settlements: readonly string[];
  element?: ElementType | { state?: string; value?: ElementType };
  enableCritical?: boolean | { state?: string; value?: boolean };
  enableWeakness?: boolean | { state?: string; value?: boolean };
};

type RawMultiplierData = {
  schemaVersion: 10;
  defaultFactorId: MultiplierFactorId;
  factors: readonly MultiplierFactor[];
  providerEffects: readonly ProviderEffect[];
  providerPlacements: readonly ProviderPlacement[];
  damageChannelMatrix: DamageChannelMatrixData;
  weakpointMultiplier: WeakpointMultiplierData;
  dilutionCategories: readonly DilutionCategory[];
  factorDetails: Partial<Record<MultiplierFactorId, FactorDetailData>>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertMultiplierData(value: unknown): asserts value is RawMultiplierData {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 10 ||
    typeof value.defaultFactorId !== "string" ||
    !Array.isArray(value.factors) ||
    !Array.isArray(value.providerEffects) ||
    !Array.isArray(value.providerPlacements) ||
    !isRecord(value.damageChannelMatrix) ||
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

  const matrix = value.damageChannelMatrix;
  if (!Array.isArray(matrix.damageTypes) || !Array.isArray(matrix.channels)) {
    throw new Error("增幅通道矩阵数据结构无效");
  }
  const damageTypeIds = new Set<string>();
  for (const damageType of matrix.damageTypes) {
    if (
      !isRecord(damageType) ||
      typeof damageType.id !== "string" ||
      typeof damageType.label !== "string" ||
      damageTypeIds.has(damageType.id)
    ) {
      throw new Error("伤害类型存在无效或重复字段");
    }
    damageTypeIds.add(damageType.id);
  }

  const modifierTypeIds = new Set<string>();
  for (const channel of matrix.channels) {
    if (
      !isRecord(channel) ||
      typeof channel.id !== "string" ||
      typeof channel.label !== "string" ||
      !DAMAGE_CHANNEL_GROUPS.includes(channel.group as DamageChannelGroup) ||
      !Array.isArray(channel.attributeFields) ||
      !Array.isArray(channel.effects) ||
      modifierTypeIds.has(channel.id)
    ) {
      throw new Error("增幅通道存在无效或重复字段");
    }
    modifierTypeIds.add(channel.id);
    for (const effect of channel.effects) {
      if (
        !isRecord(effect) ||
        typeof effect.damageTypeId !== "string" ||
        !damageTypeIds.has(effect.damageTypeId) ||
        !DAMAGE_CHANNEL_STATUSES.includes(effect.status as DamageChannelStatus)
      ) {
        throw new Error("增幅通道适用范围无效");
      }
    }
  }

  const effectIds = new Set<string>();
  for (const effect of value.providerEffects) {
    if (
      !isRecord(effect) ||
      typeof effect.id !== "string" ||
      typeof effect.label !== "string" ||
      effectIds.has(effect.id) ||
      !Array.isArray(effect.modifierTypeIds) ||
      effect.modifierTypeIds.length === 0 ||
      effect.modifierTypeIds.some(
        (id) => typeof id !== "string" || !modifierTypeIds.has(id),
      ) ||
      !Array.isArray(effect.evidence) ||
      effect.evidence.some((item) => typeof item !== "string")
    ) {
      throw new Error("增伤效果存在无效或重复字段");
    }
    effectIds.add(effect.id);
  }

  for (const placement of value.providerPlacements) {
    if (
      !isRecord(placement) ||
      typeof placement.effectId !== "string" ||
      !effectIds.has(placement.effectId) ||
      !isRecord(placement.source) ||
      typeof placement.source.type !== "string"
    ) {
      throw new Error("增伤来源落点无效");
    }
  }

  const validWeaponTypes = new Set(Object.keys(WEAPON_TYPE_SPRITES));
  const weakpoint = value.weakpointMultiplier as Record<string, unknown>;
  if (!Array.isArray(weakpoint.groups)) throw new Error("弱点倍率数据无效");
  const seenWeaponTypes = new Set<string>();
  for (const group of weakpoint.groups) {
    if (!isRecord(group) || !Array.isArray(group.weaponTypes)) {
      throw new Error("弱点倍率分组无效");
    }
    for (const weaponType of group.weaponTypes) {
      if (
        typeof weaponType !== "string" ||
        !validWeaponTypes.has(weaponType) ||
        seenWeaponTypes.has(weaponType)
      ) {
        throw new Error("弱点倍率武器类型无效");
      }
      seenWeaponTypes.add(weaponType);
    }
  }
}

assertMultiplierData(rawMultiplierData);
const data = rawMultiplierData as unknown as RawMultiplierData;

function factorIdForModifier(channel: DamageChannel): MultiplierFactorId {
  if (channel.group === "dilution") return "dilution";
  if (channel.id === "game-mode") return "game-mode";
  if (channel.id === "element") return "element";
  if (channel.id === "critical") return "critical";
  if (channel.id === "weakness") return "weakness";
  return "correction";
}

export const MULTIPLIER_DATA = data;
export const MULTIPLIER_FACTORS = data.factors;
export const DAMAGE_CHANNEL_MATRIX = data.damageChannelMatrix;
export const WEAKPOINT_MULTIPLIER_DATA = data.weakpointMultiplier;
export const DILUTION_CATEGORIES = data.dilutionCategories;
export const MULTIPLIER_FACTOR_DETAILS = data.factorDetails;
export const DAMAGE_TYPES = data.damageChannelMatrix.damageTypes;
export const MODIFIER_TYPES: readonly ModifierType[] =
  data.damageChannelMatrix.channels.map((channel) => ({
    ...channel,
    factorId: factorIdForModifier(channel),
  }));
export const PROVIDER_EFFECTS = data.providerEffects;
export const PROVIDER_PLACEMENTS = data.providerPlacements;

const factorById = new Map(MULTIPLIER_FACTORS.map((factor) => [factor.id, factor]));
const modifierTypeById = new Map(MODIFIER_TYPES.map((modifier) => [modifier.id, modifier]));
const providerEffectById = new Map(PROVIDER_EFFECTS.map((effect) => [effect.id, effect]));

const defaultMultiplierFactor = factorById.get(data.defaultFactorId);
if (!defaultMultiplierFactor) throw new Error("默认乘区数据读取失败");
export const DEFAULT_MULTIPLIER_FACTOR = defaultMultiplierFactor;

function withAnchor(path: string, anchor?: string): string {
  return anchor ? `${path}#${encodeURIComponent(anchor)}` : path;
}

export function resolveMultiplierSourceHref(source: MultiplierSource): string {
  switch (source.type) {
    case "weapon":
      return withAnchor(`/weapons/${encodeURIComponent(source.slug)}`, source.anchor);
    case "perk":
      return withAnchor(
        `/perks/slot-${source.slot}/${encodeURIComponent(source.slug)}`,
        source.anchor,
      );
    case "overlimit-card":
      return withAnchor(`/overlimit/${encodeURIComponent(source.id)}`, source.anchor);
    case "overlimit-bond":
      return withAnchor("/overlimit?module=bonds", source.anchor);
    case "post":
      return withAnchor(`/posts/${encodeURIComponent(source.slug)}`, source.anchor);
    case "season-talent": {
      const suffix = [source.season, source.tree, source.nodeId]
        .filter(Boolean)
        .map((part) => encodeURIComponent(part as string))
        .join("/");
      return withAnchor(`/guides/season-talents/${suffix}`, source.anchor);
    }
  }
}

export function resolveMultiplierFactorHref(
  factorId: MultiplierFactorId,
  options: { view?: "providers" | "targets"; modifierTypeId?: string } = {},
): string {
  const params = new URLSearchParams({ factor: factorId });
  if (options.view) params.set("view", options.view);
  if (options.modifierTypeId) params.set("modifier", options.modifierTypeId);
  return `/guides?${params.toString()}#multiplier`;
}

function sourceIndexKey(source: MultiplierSource): string {
  switch (source.type) {
    case "weapon":
      return `weapon:${source.slug}`;
    case "perk":
      return `perk:${source.slot}:${source.slug}`;
    case "overlimit-card":
      return `overlimit-card:${source.id}`;
    case "overlimit-bond":
      return `overlimit-bond:${source.name}:${source.count}`;
    case "post":
      return `post:${source.slug}`;
    case "season-talent":
      return `season-talent:${source.season}:${source.tree ?? ""}:${source.nodeId ?? ""}`;
  }
}

function parseLegacyHref(href: string): MultiplierSource | undefined {
  const [pathname, anchor] = href.split("#", 2);
  const segments = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  if (segments[0] === "weapons" && segments[1]) {
    return { type: "weapon", slug: segments[1], anchor };
  }
  if (segments[0] === "perks" && /^slot-[1-4]$/.test(segments[1] ?? "") && segments[2]) {
    return {
      type: "perk",
      slot: Number(segments[1].slice(-1)) as 1 | 2 | 3 | 4,
      slug: segments[2],
      anchor,
    };
  }
  if (segments[0] === "overlimit" && segments[1]) {
    return { type: "overlimit-card", id: segments[1], anchor };
  }
  if (segments[0] === "posts" && segments[1]) {
    return { type: "post", slug: segments[1], anchor };
  }
  if (segments[0] === "guides" && segments[1] === "season-talents" && segments[2]) {
    return {
      type: "season-talent",
      season: segments[2],
      tree: segments[3],
      nodeId: segments[4],
      anchor,
    };
  }
  return undefined;
}

function relationFor(
  modifierTypeId: string,
  values: Partial<MultiplierRelation>,
): MultiplierRelation | undefined {
  const modifier = modifierTypeById.get(modifierTypeId);
  if (!modifier) return undefined;
  const factor = factorById.get(modifier.factorId);
  if (!factor) return undefined;
  return {
    kind: values.kind ?? "provider",
    factorId: factor.id,
    factorLabel: factor.label,
    modifierTypeId: modifier.id,
    modifierTypeLabel: modifier.label,
    effectId: values.effectId,
    effectLabel: values.effectLabel,
    source: values.source,
    sourceHref: values.sourceHref,
  };
}

function buildProviderRelations(): MultiplierRelation[] {
  const relations: MultiplierRelation[] = [];
  const explicitEffectIds = new Set(PROVIDER_EFFECTS.map((effect) => effect.id));
  const explicitSourceModifiers = new Set<string>();

  for (const placement of PROVIDER_PLACEMENTS) {
    const effect = providerEffectById.get(placement.effectId);
    if (!effect) continue;
    for (const modifierTypeId of effect.modifierTypeIds) {
      const relation = relationFor(modifierTypeId, {
        kind: "provider",
        effectId: effect.id,
        effectLabel: effect.label,
        source: placement.source,
        sourceHref: resolveMultiplierSourceHref(placement.source),
      });
      if (relation) {
        relations.push(relation);
        explicitSourceModifiers.add(
          `${sourceIndexKey(placement.source)}:${modifierTypeId}`,
        );
      }
    }
  }

  for (const category of DILUTION_CATEGORIES) {
    for (const example of category.examples) {
      if (explicitEffectIds.has(example.id)) continue;
      const source = parseLegacyHref(example.href);
      if (!source) continue;
      if (explicitSourceModifiers.has(`${sourceIndexKey(source)}:${category.id}`)) {
        continue;
      }
      const relation = relationFor(category.id, {
        kind: "provider",
        effectId: example.id,
        effectLabel: example.label,
        source,
        sourceHref: example.href,
      });
      if (relation) relations.push(relation);
    }
  }

  const factorModifierIds: Partial<Record<MultiplierFactorId, string>> = {
    "game-mode": "game-mode",
    element: "element",
    weakness: "weakness",
    critical: "critical",
    correction: "correction",
  };
  for (const [factorId, detail] of Object.entries(MULTIPLIER_FACTOR_DETAILS)) {
    const modifierTypeId = factorModifierIds[factorId as MultiplierFactorId];
    if (!modifierTypeId || !detail) continue;
    for (const example of detail.examples) {
      if (!example.href || explicitEffectIds.has(example.id)) continue;
      const source = parseLegacyHref(example.href);
      if (!source) continue;
      if (explicitSourceModifiers.has(`${sourceIndexKey(source)}:${modifierTypeId}`)) {
        continue;
      }
      const relation = relationFor(modifierTypeId, {
        kind: "provider",
        effectId: example.id,
        effectLabel: example.label,
        source,
        sourceHref: example.href,
      });
      if (relation) relations.push(relation);
    }
  }

  const seen = new Set<string>();
  return relations.filter((relation) => {
    if (!relation.source || !relation.effectId) return false;
    const key = `${sourceIndexKey(relation.source)}:${relation.effectId}:${relation.modifierTypeId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const PROVIDER_RELATIONS = buildProviderRelations();

export function getProviderRelationsForSource(
  source: MultiplierSource,
): readonly MultiplierRelation[] {
  const key = sourceIndexKey(source);
  return PROVIDER_RELATIONS.filter(
    (relation) => relation.source && sourceIndexKey(relation.source) === key,
  );
}

export function getSourcesForModifierType(
  modifierTypeId: string,
): readonly MultiplierRelation[] {
  return PROVIDER_RELATIONS.filter(
    (relation) => relation.modifierTypeId === modifierTypeId,
  );
}

function fieldValue<T>(value: T | { state?: string; value?: T } | undefined): T | undefined {
  return isRecord(value) ? (value.value as T | undefined) : value;
}

const SETTLEMENT_TO_DAMAGE_TYPE: Readonly<Record<string, string>> = {
  "Numerical.SettlementType.Health.WeaponDamage": "hit-damage",
  "Numerical.SettlementType.Health.MeleeWeaponDamage": "hit-damage",
  "Numerical.SettlementType.Health.WeaponExplosionDamage": "explosion-damage",
  "Numerical.SettlementType.Health.WeaponSkillDamage": "weapon-skill-damage",
  "Numerical.SettlementType.Health.SkillDamage": "non-weapon-skill-damage",
  "Numerical.SettlementType.Health.DebuffDamage": "element-dot-damage",
  "Numerical.SettlementType.Health.IndirectDamage": "extra-trigger-damage",
  "Numerical.SettlementType.Health.EnvironmentDamage": "extra-trigger-damage",
  "Numerical.SettlementType.Health.CustomDamage": "extra-trigger-damage",
  "Numerical.SettlementType.Health.DeathExecute": "extra-trigger-damage",
  "Numerical.SettlementType.Health.DropEnvironmentDamage": "extra-trigger-damage",
};

export function buildDamageProfile(input: DamageProfileInput): DamageProfile {
  const damageTypeIds = new Set<string>();
  for (const settlement of input.settlements) {
    const damageTypeId = SETTLEMENT_TO_DAMAGE_TYPE[settlement];
    if (damageTypeId) damageTypeIds.add(damageTypeId);
  }
  if (damageTypeIds.size === 0 && input.section) {
    if (input.section === "dot") damageTypeIds.add("element-dot-damage");
    else if (input.section === "skill") damageTypeIds.add("weapon-skill-damage");
    else if (input.section === "special") damageTypeIds.add("extra-trigger-damage");
    else damageTypeIds.add("hit-damage");
  }

  const element = fieldValue(input.element);
  const enableCritical = fieldValue(input.enableCritical) === true;
  const enableWeakness = fieldValue(input.enableWeakness) === true;
  const damageTags = [
    ...input.settlements,
    ...(element ? [`element:${element}`] : []),
    ...(enableCritical ? ["critical-enabled"] : []),
    ...(enableWeakness ? ["weakness-enabled"] : []),
  ];
  return {
    damageTypeIds: [...damageTypeIds],
    damageTags,
    element,
    enableCritical,
    enableWeakness,
  };
}

export function getApplicableModifierTypes(
  profileOrInput: DamageProfile | DamageProfileInput,
): readonly MultiplierRelation[] {
  const profile = "damageTypeIds" in profileOrInput
    ? profileOrInput
    : buildDamageProfile(profileOrInput);
  const relations: MultiplierRelation[] = [];
  for (const modifier of MODIFIER_TYPES) {
    // ExecutionRatio belongs to a concrete event context and cannot be inferred
    // from a weapon Settlement profile alone.
    if (modifier.id === "correction") continue;
    if (modifier.id === "critical" && !profile.enableCritical) continue;
    if (modifier.id === "weakness" && !profile.enableWeakness) continue;
    if (modifier.id === "element" && !profile.element) continue;
    const matchingEffects = modifier.effects.filter(
      (effect) =>
        profile.damageTypeIds.includes(effect.damageTypeId) &&
        effect.status !== "none",
    );
    if (matchingEffects.length === 0) continue;
    const relation = relationFor(modifier.id, { kind: "target" });
    if (relation) relations.push(relation);
  }
  return relations;
}

export function getRelationsByFactor(
  relations: readonly MultiplierRelation[],
): readonly {
  factorId: MultiplierFactorId;
  factorLabel: string;
  relations: readonly MultiplierRelation[];
}[] {
  const groups = new Map<MultiplierFactorId, MultiplierRelation[]>();
  for (const relation of relations) {
    const group = groups.get(relation.factorId) ?? [];
    group.push(relation);
    groups.set(relation.factorId, group);
  }
  return [...groups.entries()].map(([factorId, groupedRelations]) => ({
    factorId,
    factorLabel: groupedRelations[0].factorLabel,
    relations: groupedRelations,
  }));
}
