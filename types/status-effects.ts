export type StatusEffectPolarity = "positive" | "negative";

export type StatusEffectTarget = "enemy" | "player";

export interface StatusEffectModifierReference {
  id: number;
  level: number;
  attributeName: string;
  attributeLabel: string;
  attributeTypeId?: string;
  operation: string;
  operationModel: string;
  direction: string;
  facetLabels: string[];
  baseValue: number;
  coefficient: number;
  description: string;
}

export interface StatusEffectNumericalReference {
  id: number;
  level: number;
  description: string;
  elementType: string;
  settlements: string[];
  enableAttributes: string[];
  hpScale: number;
  hpBase: number;
  fleshDamageBase: number;
}

export interface StatusEffectVariant {
  rowName: string;
  name: string;
  description: string;
  category: string;
  polarity: StatusEffectPolarity;
  displayMask: number;
  duration: number;
  period: number;
  stackLimit: number;
  levelDuration: string;
  icon: string | null;
  iconAsset: string | null;
  modifierIds: number[];
  numericalId: number | null;
}

export interface StatusEffectCatalogEntry {
  buffId: number;
  name: string;
  names: string[];
  descriptions: string[];
  categories: string[];
  polarities: StatusEffectPolarity[];
  targets: StatusEffectTarget[];
  icon: string | null;
  variants: StatusEffectVariant[];
}

export type StatusEffectSemanticGroupId =
  | "elemental"
  | "vulnerability"
  | "damage-over-time"
  | "control"
  | "offense"
  | "defense"
  | "sustain"
  | "mobility"
  | "resource"
  | "negative"
  | "special";

export interface StatusEffectSemanticGroup {
  id: StatusEffectSemanticGroupId;
  label: string;
  description: string;
}

export interface StatusEffectMultiplierRelation {
  factorId: string;
  factorLabel: string;
  modifierTypeId: string;
  modifierTypeLabel: string;
  displayLabel: string;
  modifierIds: number[];
  href: string;
}

export type StatusEffectRelatedContentType =
  | "perk"
  | "overlimit-card"
  | "season-talent"
  | "weapon"
  | "overlimit-bond"
  | "post";

export type StatusEffectRelatedContentRelation =
  | "confirmed-source"
  | "same-multiplier";

export interface StatusEffectRelatedContent {
  id: string;
  type: StatusEffectRelatedContentType;
  typeLabel: string;
  title: string;
  href: string;
  relation: StatusEffectRelatedContentRelation;
  relationLabel: string;
  note: string;
  factorLabels: string[];
  season?: string;
}

export interface StatusEffectCatalogViewEntry extends StatusEffectCatalogEntry {
  group: StatusEffectSemanticGroup;
  summary: string;
  practical: boolean;
  multiplierRelations: StatusEffectMultiplierRelation[];
  relatedContent: StatusEffectRelatedContent[];
  searchTerms: string[];
}

export interface StatusEffectSearchDocument {
  buffId: number;
  title: string;
  target: StatusEffectTarget;
  keywords: string[];
}

export interface ElementStatusSummary {
  id: "fire" | "cryo" | "shock" | "corossive";
  name: string;
  description: string;
  icon: string;
  duration: number;
  clearTime: number;
  enemyBuffNames: string[];
  playerBuffNames: string[];
}

export interface ElementStatusViewSummary extends ElementStatusSummary {
  enemyStatus: StatusEffectVariant;
}

export interface StatusEffectDataLock {
  schemaVersion: 2;
  source: {
    mode: "lc";
    buffTable: string;
    elementTable: string;
    numericalTable: string;
  };
  summary: {
    enemyRows: number;
    enemyEntries: number;
    playerRows: number;
    playerEntries: number;
    uniqueIcons: number;
  };
  elements: ElementStatusSummary[];
  effects: StatusEffectCatalogEntry[];
  references: {
    numericals: Record<string, StatusEffectNumericalReference[]>;
  };
}
