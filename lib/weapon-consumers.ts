import type {
  ElementType,
  Rarity,
  WeaponTag,
  WeaponType,
} from "@/types";
import type {
  FieldState,
  ResolvedActiveSkill,
  ResolvedAttackBehavior,
  ResolvedAmmoBehavior,
  ResolvedAttenuation,
  ResolvedDamageSource,
  ResolvedFeelBehavior,
  ResolvedField,
  ResolvedFireBehavior,
  ResolvedMovementBehavior,
  ResolvedToughnessType,
  ResolvedWeapon,
} from "./weapon-resolver";
import type { DamageSection, NumericalTable } from "./weapon-source-v2";

export interface ConsumerField<T> {
  readonly state: FieldState;
  readonly value?: T;
}

type ConsumerFields<T> = {
  readonly [K in keyof T]: T[K] extends ResolvedField<infer Value>
    ? ConsumerField<Value>
    : never;
};

export type ConsumerFireBehavior = ConsumerFields<ResolvedFireBehavior>;
export type ConsumerAttackBehavior = ConsumerFields<ResolvedAttackBehavior>;
export type ConsumerAmmoBehavior = ConsumerFields<ResolvedAmmoBehavior>;
export type ConsumerMovementBehavior = ConsumerFields<ResolvedMovementBehavior>;
export type ConsumerFeelBehavior = ConsumerFields<
  Omit<ResolvedFeelBehavior, "accuracyRatios">
> & {
  readonly accuracyRatios: Readonly<Record<string, ConsumerField<number>>>;
};

export type ConsumerAttenuation =
  | {
      readonly status: "applicable";
      readonly beginMeters: number;
      readonly endMeters: number;
      readonly minScale: number;
    }
  | { readonly status: "not_applicable" }
  | { readonly status: "missing" | "unavailable" };

export interface ConsumerDamageSource {
  readonly id: string;
  readonly name: string;
  readonly section: DamageSection;
  readonly label?: string;
  readonly damage: {
    readonly base: ConsumerField<number>;
    readonly impulse: ConsumerField<number>;
    readonly toughness: ConsumerField<number>;
    readonly flesh: ConsumerField<number>;
    readonly hurtable: ConsumerField<number>;
  };
  readonly health: ConsumerFields<ResolvedDamageSource["health"]>;
  readonly element: ConsumerField<ElementType>;
  readonly elementAddRate: ConsumerField<number>;
  readonly weaknessMultiplier: ConsumerField<number>;
  readonly enableWeakness: ConsumerField<boolean>;
  readonly enableCritical: ConsumerField<boolean>;
  readonly toughness: ConsumerField<ResolvedToughnessType>;
  readonly ignoreShield: ConsumerField<boolean>;
  readonly fire: ConsumerFireBehavior;
  readonly attack: ConsumerAttackBehavior;
  readonly ammo: ConsumerAmmoBehavior;
  readonly movement: ConsumerMovementBehavior;
  readonly feel: ConsumerFeelBehavior;
  readonly attenuation: ConsumerAttenuation;
  readonly settlements: readonly string[];
  readonly unknownSettlements: readonly string[];
}

export interface ConsumerActiveSkill {
  readonly id?: number;
  readonly level: 1;
  readonly chargeTime: ConsumerField<number>;
  readonly chargeCount: ConsumerField<number>;
  readonly source: ResolvedActiveSkill["source"];
}

interface ConsumerWeaponIdentity {
  readonly slug: string;
  readonly title: string;
  readonly nickname?: string;
  readonly keywords: readonly string[];
  readonly table: NumericalTable;
  readonly useType?: string;
  readonly tags: readonly WeaponTag[];
  readonly draft: boolean;
  readonly element: ConsumerField<ElementType>;
  readonly weaponType: ConsumerField<WeaponType>;
  readonly weaponTypeId: ConsumerField<number>;
  readonly rarity: ConsumerField<Rarity>;
  readonly scope: ConsumerField<string>;
}

export interface WeaponDetailData extends ConsumerWeaponIdentity {
  readonly accuracy: ConsumerField<number>;
  readonly stability: ConsumerField<number>;
  readonly magazine: ConsumerField<number>;
  readonly totalAmmo: ConsumerField<number>;
  readonly explosionRange: ConsumerField<number>;
  readonly skillDuration: ConsumerField<number>;
  readonly skillBlocking: ConsumerField<boolean>;
  readonly showDuration: ConsumerField<boolean>;
  readonly shootingEnergy: ConsumerField<boolean>;
  readonly shootingEnergyCount: ConsumerField<number>;
  readonly officialRadar: ConsumerFields<ResolvedWeapon["officialRadar"]>;
  readonly changeClip: ConsumerFields<ResolvedWeapon["changeClip"]>;
  readonly damageSources: readonly ConsumerDamageSource[];
  readonly mainSourceId?: string;
  readonly activeSkill?: ConsumerActiveSkill;
}

export interface ConsumerDamageSourceSummary {
  readonly id: string;
  readonly name: string;
  readonly section: DamageSection;
  readonly label?: string;
  readonly settlements: readonly string[];
  readonly damage: {
    readonly base: ConsumerField<number>;
    readonly toughness: ConsumerField<number>;
  };
  readonly element: ConsumerField<ElementType>;
  readonly elementAddRate: ConsumerField<number>;
  readonly weaknessMultiplier: ConsumerField<number>;
  readonly enableWeakness: ConsumerField<boolean>;
  readonly enableCritical: ConsumerField<boolean>;
  readonly toughness: ConsumerField<ResolvedToughnessType>;
  readonly fire: {
    readonly interval: ConsumerField<number>;
    readonly rpm: ConsumerField<number>;
    readonly pellets: ConsumerField<number>;
  };
  readonly attack: {
    readonly interval: ConsumerField<number>;
    readonly count: ConsumerField<number>;
  };
}

export interface WeaponCatalogEntry extends ConsumerWeaponIdentity {
  readonly accuracy: ConsumerField<number>;
  readonly stability: ConsumerField<number>;
  readonly magazine: ConsumerField<number>;
  readonly totalAmmo: ConsumerField<number>;
  readonly skillDuration: ConsumerField<number>;
  readonly skillBlocking: ConsumerField<boolean>;
  readonly showDuration: ConsumerField<boolean>;
  readonly shootingEnergy: ConsumerField<boolean>;
  readonly shootingEnergyCount: ConsumerField<number>;
  readonly changeClip: ConsumerFields<ResolvedWeapon["changeClip"]>;
  readonly activeSkill?: ConsumerActiveSkill;
  readonly mainSourceId?: string;
  readonly mainSource?: ConsumerDamageSourceSummary;
  readonly previewRpm?: ConsumerField<number>;
  readonly meleeSources: readonly ConsumerDamageSourceSummary[];
  readonly isAttackCapable: boolean;
}

export class WeaponConsumerInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WeaponConsumerInvariantError";
  }
}

export function getResolvedFieldValue<T>(
  field: Pick<ResolvedField<T>, "state" | "value">,
): T | undefined {
  return field.state === "resolved" || field.state === "zero"
    ? field.value
    : undefined;
}

function isAttackSource(
  source: {
    readonly damage: {
      readonly base: Pick<ResolvedField<number>, "state">;
    };
  },
): boolean {
  return (
    source.damage.base.state === "resolved" ||
    source.damage.base.state === "zero"
  );
}

function hasDisplayableSettlement(
  source: Pick<ResolvedDamageSource, "damage" | "health">,
): boolean {
  return (
    Object.values(source.damage).some(
      (field) => field.state === "resolved" || field.state === "zero",
    ) ||
    source.health.type.state === "resolved"
  );
}

export function getMainDamageSource<
  Source extends {
    readonly id: string;
    readonly damage: {
      readonly base: Pick<ResolvedField<number>, "state">;
    };
  },
>(
  weapon: {
    readonly mainSourceId?: string;
    readonly damageSources: readonly Source[];
  },
): Source | undefined {
  if (weapon.mainSourceId === undefined) {
    const attackSources = weapon.damageSources.filter(isAttackSource);
    if (attackSources.length > 0) {
      throw new WeaponConsumerInvariantError(
        "attack-capable damageSources is non-empty but mainSourceId is missing",
      );
    }
    return undefined;
  }

  const matches = weapon.damageSources.filter(
    (source) => source.id === weapon.mainSourceId,
  );
  if (matches.length !== 1) {
    throw new WeaponConsumerInvariantError(
      `mainSourceId ${weapon.mainSourceId} matched ${matches.length} sources`,
    );
  }
  if (!isAttackSource(matches[0])) {
    throw new WeaponConsumerInvariantError(
      `mainSourceId ${weapon.mainSourceId} points to a non-attacking source`,
    );
  }
  return matches[0];
}

function toConsumerField<T>(field: ResolvedField<T>): ConsumerField<T> {
  const value = getResolvedFieldValue(field);
  return value === undefined
    ? { state: field.state }
    : { state: field.state, value };
}

function toConsumerFields<T extends object>(value: T): ConsumerFields<T> {
  return Object.fromEntries(
    Object.entries(value).map(([key, field]) => [
      key,
      toConsumerField(field as ResolvedField<unknown>),
    ]),
  ) as ConsumerFields<T>;
}

function toConsumerAttenuation(
  attenuation: ResolvedAttenuation,
): ConsumerAttenuation {
  if (attenuation.status === "applicable") {
    return {
      status: "applicable",
      beginMeters: attenuation.beginMeters,
      endMeters: attenuation.endMeters,
      minScale: attenuation.minScale,
    };
  }
  return { status: attenuation.status };
}

function toConsumerActiveSkill(
  activeSkill: ResolvedActiveSkill | undefined,
): ConsumerActiveSkill | undefined {
  if (!activeSkill) return undefined;
  return {
    id: activeSkill.id,
    level: activeSkill.level,
    chargeTime: toConsumerField(activeSkill.chargeTime),
    chargeCount: toConsumerField(activeSkill.chargeCount),
    source: activeSkill.source,
  };
}

function toConsumerIdentity(weapon: ResolvedWeapon): ConsumerWeaponIdentity {
  return {
    slug: weapon.slug,
    title: weapon.title,
    nickname: weapon.nickname,
    keywords: [...weapon.keywords],
    table: weapon.table,
    useType: weapon.useType,
    tags: [...weapon.tags],
    draft: weapon.draft,
    element: toConsumerField(weapon.element),
    weaponType: toConsumerField(weapon.weaponType),
    weaponTypeId: toConsumerField(weapon.weaponTypeId),
    rarity: toConsumerField(weapon.rarity),
    scope: toConsumerField(weapon.scope),
  };
}

export function toConsumerDamageSource(
  source: ResolvedDamageSource,
): ConsumerDamageSource {
  const { accuracyRatios, ...feelFields } = source.feel;
  return {
    id: source.id,
    name: source.name,
    section: source.section,
    label: source.label,
    damage: toConsumerFields(source.damage),
    health: toConsumerFields(source.health),
    element: toConsumerField(source.element),
    elementAddRate: toConsumerField(source.elementAddRate),
    weaknessMultiplier: toConsumerField(source.weaknessMultiplier),
    enableWeakness: toConsumerField(source.enableWeakness),
    enableCritical: toConsumerField(source.enableCritical),
    toughness: toConsumerField(source.toughness),
    ignoreShield: toConsumerField(source.ignoreShield),
    fire: toConsumerFields(source.fire),
    attack: toConsumerFields(source.attack),
    ammo: toConsumerFields(source.ammo),
    movement: toConsumerFields(source.movement),
    feel: {
      ...toConsumerFields(feelFields),
      accuracyRatios: Object.fromEntries(
        Object.entries(accuracyRatios).map(([key, field]) => [
          key,
          toConsumerField(field),
        ]),
      ),
    },
    attenuation: toConsumerAttenuation(source.attenuation),
    settlements: [...source.settlements],
    unknownSettlements: [...source.unknownSettlements],
  };
}

function toConsumerDamageSourceSummary(
  source: ResolvedDamageSource,
): ConsumerDamageSourceSummary {
  return {
    id: source.id,
    name: source.name,
    section: source.section,
    label: source.label,
    settlements: [...source.settlements],
    damage: {
      base: toConsumerField(source.damage.base),
      toughness: toConsumerField(source.damage.toughness),
    },
    element: toConsumerField(source.element),
    elementAddRate: toConsumerField(source.elementAddRate),
    weaknessMultiplier: toConsumerField(source.weaknessMultiplier),
    enableWeakness: toConsumerField(source.enableWeakness),
    enableCritical: toConsumerField(source.enableCritical),
    toughness: toConsumerField(source.toughness),
    fire: {
      interval: toConsumerField(source.fire.interval),
      rpm: toConsumerField(source.fire.rpm),
      pellets: toConsumerField(source.fire.pellets),
    },
    attack: {
      interval: toConsumerField(source.attack.interval),
      count: toConsumerField(source.attack.count),
    },
  };
}

function getPreviewRpmSource(
  weapon: ResolvedWeapon,
  mainSource: ResolvedDamageSource | undefined,
): ResolvedDamageSource | undefined {
  const mainRpm = mainSource
    ? getResolvedFieldValue(mainSource.fire.rpm)
    : undefined;
  if (mainRpm !== undefined && mainRpm !== 0) return mainSource;

  return (
    weapon.damageSources.find((source) => source.name.includes("命中")) ??
    mainSource
  );
}

export function toWeaponDetailData(weapon: ResolvedWeapon): WeaponDetailData {
  getMainDamageSource(weapon);
  return {
    ...toConsumerIdentity(weapon),
    accuracy: toConsumerField(weapon.accuracy),
    stability: toConsumerField(weapon.stability),
    magazine: toConsumerField(weapon.magazine),
    totalAmmo: toConsumerField(weapon.totalAmmo),
    explosionRange: toConsumerField(weapon.explosionRange),
    skillDuration: toConsumerField(weapon.skillDuration),
    skillBlocking: toConsumerField(weapon.skillBlocking),
    showDuration: toConsumerField(weapon.showDuration),
    shootingEnergy: toConsumerField(weapon.shootingEnergy),
    shootingEnergyCount: toConsumerField(weapon.shootingEnergyCount),
    officialRadar: toConsumerFields(weapon.officialRadar),
    changeClip: toConsumerFields(weapon.changeClip),
    damageSources: weapon.damageSources
      .filter(hasDisplayableSettlement)
      .map(toConsumerDamageSource),
    mainSourceId: weapon.mainSourceId,
    activeSkill: toConsumerActiveSkill(weapon.activeSkill),
  };
}

export function toWeaponCatalogEntry(
  weapon: ResolvedWeapon,
): WeaponCatalogEntry {
  const mainSource = getMainDamageSource(weapon);
  const previewRpmSource = getPreviewRpmSource(weapon, mainSource);
  return {
    ...toConsumerIdentity(weapon),
    accuracy: toConsumerField(weapon.accuracy),
    stability: toConsumerField(weapon.stability),
    magazine: toConsumerField(weapon.magazine),
    totalAmmo: toConsumerField(weapon.totalAmmo),
    skillDuration: toConsumerField(weapon.skillDuration),
    skillBlocking: toConsumerField(weapon.skillBlocking),
    showDuration: toConsumerField(weapon.showDuration),
    shootingEnergy: toConsumerField(weapon.shootingEnergy),
    shootingEnergyCount: toConsumerField(weapon.shootingEnergyCount),
    changeClip: toConsumerFields(weapon.changeClip),
    activeSkill: toConsumerActiveSkill(weapon.activeSkill),
    mainSourceId: weapon.mainSourceId,
    mainSource: mainSource
      ? toConsumerDamageSourceSummary(mainSource)
      : undefined,
    previewRpm: previewRpmSource
      ? toConsumerField(previewRpmSource.fire.rpm)
      : undefined,
    meleeSources: weapon.damageSources
      .filter((source) => isAttackSource(source) && source.section === "melee")
      .map(toConsumerDamageSourceSummary),
    isAttackCapable: mainSource !== undefined,
  };
}

export function getFullReloadTime(
  changeClip: {
    readonly timeBase: ConsumerField<number>;
    readonly reloadRecovery: ConsumerField<number>;
  },
): number | undefined {
  const timeBase = getResolvedFieldValue(changeClip.timeBase);
  if (timeBase === undefined) return undefined;
  return timeBase + (getResolvedFieldValue(changeClip.reloadRecovery) ?? 0);
}

export function getActiveSkillDisplay(
  activeSkill: ConsumerActiveSkill | undefined,
  contentCount?: number,
): { cooldown?: number; count?: number } {
  return {
    cooldown: activeSkill
      ? getResolvedFieldValue(activeSkill.chargeTime)
      : undefined,
    count: activeSkill
      ? (getResolvedFieldValue(activeSkill.chargeCount) ?? contentCount)
      : contentCount,
  };
}
