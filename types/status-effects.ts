export type StatusEffectPolarity = "positive" | "negative";

export type StatusEffectTarget = "enemy" | "player";

export interface StatusEffectModifierReference {
  id: number;
  level: number;
  attributeName: string;
  operation: string;
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

export interface StatusEffectDataLock {
  schemaVersion: 1;
  source: {
    mode: "lc";
    buffTable: string;
    elementTable: string;
    modifierTable: string;
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
    modifiers: Record<string, StatusEffectModifierReference[]>;
    numericals: Record<string, StatusEffectNumericalReference[]>;
  };
}
