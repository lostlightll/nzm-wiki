import type { MultiplierRelation } from "@/lib/multiplier-data";
import type {
  StatusEffectMultiplierRelation,
  StatusEffectPolarity,
  StatusEffectTarget,
} from "./status-effects";

export type SummonKind = "deployable" | "companion" | "season-servant";

export type SummonElement = "物理" | "火焰" | "寒冷" | "电弧" | "腐蚀";

export type SummonMechanicKind =
  | "summon"
  | "attack"
  | "skill"
  | "passive"
  | "lifecycle"
  | "command"
  | "buff";

export type SummonEvidenceLevel = "published" | "config-verified" | "partial";

export interface SummonSourceLink {
  label: string;
  href: string;
  type: "weapon" | "season-talent" | "buff" | "perk" | "guide";
}

export interface SummonFact {
  label: string;
  value: string;
  note?: string;
}

export interface SummonBuffReference {
  buffId: number;
  target: StatusEffectTarget;
  relation: "applies" | "grants" | "enhances" | "consumes";
  note?: string;
}

export interface SummonMechanicDefinition {
  id: string;
  name: string;
  icon?: string;
  kind: SummonMechanicKind;
  summary: string;
  details?: string[];
  facts?: SummonFact[];
  damageSourceIds?: string[];
  buffRefs?: SummonBuffReference[];
  link?: SummonSourceLink;
  searchTerms?: string[];
}

export interface SummonDamageDefinition {
  id: string;
  name: string;
  role: string;
  weaponSource?: {
    weaponSlug: string;
    damageSourceId: string;
  };
  lockSource?: string;
  rate?: {
    intervalSeconds?: number;
    roundsPerMinute?: number;
    attacksPerAction?: number;
    label: string;
    note?: string;
  };
  note?: string;
}

export interface SummonDamageLockRow {
  id: number;
  level: number;
  coefficient: number;
}

export interface SummonDamageLockEntry {
  id: string;
  sourceTable:
    | "numerical_config_equip"
    | "numerical_config_others"
    | "numerical_config_playerskill";
  rows: SummonDamageLockRow[];
  attackStat: "攻击力" | "技能攻击力";
  element: SummonElement;
  enableCritical: boolean;
  enableWeakness: boolean;
  weaknessMultiplier?: number;
  settlements: string[];
}

export interface SummonDamageLock {
  schemaVersion: 1;
  mode: "lc";
  baseAttack: number;
  entries: SummonDamageLockEntry[];
}

export interface SummonTalentReference {
  season: "s3";
  tree: "iron-fist" | "zero" | "grappling-hook";
  id: string;
  kind: "node" | "passive";
  relation: "defines" | "enhances" | "shared";
}

export interface SummonDefinition {
  id: string;
  name: string;
  aliases: string[];
  kind: SummonKind;
  kindLabel: string;
  evidenceLevel: SummonEvidenceLevel;
  summary: string;
  icon?: string;
  source: SummonSourceLink;
  deployment: string;
  control: string;
  targeting: string;
  lifetime: string;
  count: string;
  rateSummary: string;
  mechanics: SummonMechanicDefinition[];
  damageSources: SummonDamageDefinition[];
  buffRefs: SummonBuffReference[];
  perkSlugs: string[];
  perkSelectionNote?: string;
  talentRefs: SummonTalentReference[];
  evidenceNotes: string[];
  searchTerms: string[];
}

export interface SummonDataLock {
  schemaVersion: 1;
  mode: "lc";
  scope: string;
  sharedSystems: SummonMechanicDefinition[];
  sharedBuffRefs: SummonBuffReference[];
  sharedPerkSlugs: string[];
  sharedTalentRefs: SummonTalentReference[];
  summons: SummonDefinition[];
}

export interface SummonDamageView extends Omit<SummonDamageDefinition, "weaponSource" | "lockSource"> {
  coefficient?: number;
  attackStatLabel: "攻击力" | "技能攻击力";
  baseAttack?: number;
  baseDamage?: number;
  element?: SummonElement;
  enableCritical?: boolean;
  enableWeakness?: boolean;
  weaknessMultiplier?: number;
  settlements: string[];
  intervalSeconds?: number;
  roundsPerMinute?: number;
  attacksPerAction?: number;
  multiplierRelations: MultiplierRelation[];
  sourceHref?: string;
  sourceLabel: string;
}

export interface SummonNumericalRowView {
  id: number;
  label: string;
  coefficient: number;
  attackStatLabel: "攻击力" | "技能攻击力";
  baseAttack: number;
  baseDamage: number;
}

export interface SummonMechanicView extends SummonMechanicDefinition {
  numericalRows: SummonNumericalRowView[];
}

export interface SummonBuffView {
  buffId: number;
  name: string;
  summary: string;
  icon: string | null;
  target: StatusEffectTarget;
  relation: SummonBuffReference["relation"];
  relationLabel: string;
  note?: string;
  polarities: StatusEffectPolarity[];
  durationLabel: string;
  stackLabel: string;
  href: string;
  multiplierRelations: StatusEffectMultiplierRelation[];
}

export interface SummonPerkView {
  slug: string;
  name: string;
  description?: string;
  icon?: string;
  slot: number;
  rarity: string;
  href: string;
  multiplierRelations: MultiplierRelation[];
}

export interface SummonTalentView {
  season: "s3";
  tree: SummonTalentReference["tree"];
  id: string;
  kind: SummonTalentReference["kind"];
  relation: SummonTalentReference["relation"];
  name: string;
  descriptions: string[];
  icon: string;
  href: string;
  multiplierRelations: MultiplierRelation[];
}

export interface SummonCatalogEntryView extends Omit<
  SummonDefinition,
  "mechanics" | "damageSources" | "buffRefs" | "perkSlugs" | "talentRefs"
> {
  mechanics: SummonMechanicView[];
  damageSources: SummonDamageView[];
  buffs: SummonBuffView[];
  perks: SummonPerkView[];
  talents: SummonTalentView[];
}

export interface SummonCatalogView {
  entries: SummonCatalogEntryView[];
  sharedSystems: SummonMechanicDefinition[];
  sharedBuffs: SummonBuffView[];
  sharedPerks: SummonPerkView[];
  sharedTalents: SummonTalentView[];
  totalDamageSources: number;
  verifiedRateCount: number;
  relatedBuffCount: number;
}

export interface SummonSearchDocument {
  id: string;
  title: string;
  summonId: string;
  section?: string;
  kind: "summon" | "mechanic";
  keywords: string[];
}
