import { WEAPON_TYPE_ID_MAP } from "@/constants/weapons";
import type {
  DamageMode,
  ElementType,
  Rarity,
  ToughnessType,
  Weapon,
  WeaponTag,
  WeaponType,
} from "@/types";
import {
  getWeaponDataLockRow,
  parseWeaponDataLock,
  WeaponDataLockError,
  type WeaponDataLock,
  type WeaponDataLockKind,
  type WeaponDataLockRow,
} from "./weapon-data-lock";
import {
  resolveDamageSourceReferences,
  validateWeaponSourceV2,
  type AttenuationOverride,
  type DamageSection,
  type DamageSourceOverrideStep,
  type DamageSourceV2,
  type NumericalTable,
  type ResolvedDamageSourceReference,
  type WeaponSourceV2,
} from "./weapon-source-v2";
import {
  legacyNumber,
  parseLegacyTags,
  transformWeaponV1Legacy,
} from "./weapon-legacy";

export type FieldState =
  | "resolved"
  | "zero"
  | "not_applicable"
  | "missing"
  | "unavailable"
  | "unrecognized";

export type ProvenanceKind =
  | "mdx-v1"
  | "mdx-v2"
  | "lock-numerical"
  | "lock-asc"
  | "lock-feel"
  | "lock-item"
  | "lock-skill-pve"
  | "lock-gp-active-skill"
  | "derived"
  | "override"
  | "compat-fallback";

export interface FieldProvenance {
  kind: ProvenanceKind;
  sourceKey?: string;
  rawField?: string;
  sourceId?: string;
  note?: string;
}

export interface OverrideTrace<T = unknown> {
  sourceId: string;
  reason: string;
  before?: T;
  after?: T;
}

export interface ResolvedField<T> {
  state: FieldState;
  value?: T;
  provenance: readonly FieldProvenance[];
  overrideHistory: readonly OverrideTrace<T>[];
}

export type ResolvedToughnessType =
  | "none"
  | "impulse"
  | "penetration"
  | "explosion";

export type ResolutionDiagnosticCode =
  | "DUPLICATE_SETTLEMENT"
  | "UNKNOWN_SETTLEMENT"
  | "UNKNOWN_ENUM"
  | "COMPAT_MISMATCH"
  | "COMPAT_FALLBACK"
  | "INVALID_PREFERRED_FALLBACK"
  | "INVALID_ITEM_FIELD"
  | "AMMO_CONFLICT"
  | "LOSSY_LEGACY_PROJECTION"
  | "OVERRIDE_APPLIED"
  | "V1_INVALID_ATTENUATION"
  | "SOURCE_IDENTITY_DIFFERENCE";

export interface ResolutionDiagnostic {
  severity: "warning" | "info";
  code: ResolutionDiagnosticCode;
  path: string;
  message: string;
  sourceId?: string;
  sourceKey?: string;
}

export type WeaponResolutionErrorCode =
  | "UNSUPPORTED_SCHEMA_VERSION"
  | "INVALID_SOURCE"
  | "MISSING_LOCK"
  | "INVALID_LOCK_ROW"
  | "INVALID_SETTLEMENT"
  | "MISSING_REQUIRED_FIELD"
  | "INVALID_FIELD"
  | "OVERRIDE_SOURCE_MISSING"
  | "OVERRIDE_NOT_APPLICABLE"
  | "INVALID_ATTENUATION"
  | "MISSING_SKILL_SOURCE"
  | "LEGACY_PROJECTION_UNAVAILABLE"
  | "INVALID_SNAPSHOT_MAPPING";

export class WeaponResolutionError extends Error {
  readonly code: WeaponResolutionErrorCode;
  readonly path: string;
  readonly sourceId?: string;
  readonly sourceKey?: string;

  constructor(
    code: WeaponResolutionErrorCode,
    message: string,
    context: {
      path: string;
      sourceId?: string;
      sourceKey?: string;
      cause?: unknown;
    },
  ) {
    super(`[${code}] ${context.path}: ${message}`, { cause: context.cause });
    this.name = "WeaponResolutionError";
    this.code = code;
    this.path = context.path;
    this.sourceId = context.sourceId;
    this.sourceKey = context.sourceKey;
  }
}

export interface AttenuationRawValue {
  beginCm: number;
  endCm: number;
  minScale: number;
}

export type AttenuationTraceValue =
  | {
      status: "applicable";
      beginMeters: number;
      endMeters: number;
      minScale: number;
    }
  | { status: "not_applicable" };

export type ResolvedAttenuation =
  | {
      status: "applicable";
      beginMeters: number;
      endMeters: number;
      minScale: number;
      raw: AttenuationRawValue;
      provenance: readonly FieldProvenance[];
      overrideHistory: readonly OverrideTrace<AttenuationTraceValue>[];
    }
  | {
      status: "not_applicable";
      raw: AttenuationRawValue;
      provenance: readonly FieldProvenance[];
      overrideHistory: readonly OverrideTrace<AttenuationTraceValue>[];
    }
  | {
      status: "missing" | "unavailable";
      provenance: readonly FieldProvenance[];
      overrideHistory: readonly OverrideTrace<AttenuationTraceValue>[];
    };

export interface ResolvedFireBehavior {
  interval: ResolvedField<number>;
  rpm: ResolvedField<number>;
  subFireCount: ResolvedField<number>;
  subFireInterval: ResolvedField<number>;
  pellets: ResolvedField<number>;
  preFireTime: ResolvedField<number>;
  fireBoltTime: ResolvedField<number>;
  overchargeActivationTime: ResolvedField<number>;
  overchargeDeactivationTime: ResolvedField<number>;
  equipTime: ResolvedField<number>;
  weakpointLevel1Ratio: ResolvedField<number>;
  weakpointLevel2Ratio: ResolvedField<number>;
  maxRpmRatio: ResolvedField<number>;
}

export interface ResolvedAmmoBehavior {
  clip: ResolvedField<number>;
  max: ResolvedField<number>;
  changeClipAmount: ResolvedField<number>;
  costPerShot: ResolvedField<number>;
  infinite: ResolvedField<boolean>;
}

export interface ResolvedMovementBehavior {
  normal: ResolvedField<number>;
  sprint: ResolvedField<number>;
  firing: ResolvedField<number>;
  aiming: ResolvedField<number>;
  reload: ResolvedField<number>;
  chargeOrPreheat: ResolvedField<number>;
  crouching: ResolvedField<number>;
  zoom: ResolvedField<number>;
}

export interface ResolvedFeelBehavior {
  changeClipTime: ResolvedField<number>;
  changeClipEndToFire: ResolvedField<number>;
  beforeChangeClip: ResolvedField<number>;
  afterChangeClip: ResolvedField<number>;
  autoChangeClipDelay: ResolvedField<number>;
  zoomIn: ResolvedField<number>;
  zoomOut: ResolvedField<number>;
  runToFire: ResolvedField<number>;
  shotCooldown: ResolvedField<number>;
  recoilTime: ResolvedField<number>;
  recoilReturnTime: ResolvedField<number>;
  recoilUpMax: ResolvedField<number>;
  recoilSideRange: ResolvedField<number>;
  recoilVerticalScale: ResolvedField<number>;
  recoilHorizontalScale: ResolvedField<number>;
  spreadMin: ResolvedField<number>;
  spreadMax: ResolvedField<number>;
  spreadModifierBase: ResolvedField<number>;
  spreadModifierInc: ResolvedField<number>;
  spreadModifierMax: ResolvedField<number>;
  spreadReturnTime: ResolvedField<number>;
  accuracyRatios: Readonly<Record<string, ResolvedField<number>>>;
}

export interface ResolvedDamageSource {
  id: string;
  name: string;
  section: DamageSection;
  label?: string;
  damage: {
    base: ResolvedField<number>;
    impulse: ResolvedField<number>;
    toughness: ResolvedField<number>;
    flesh: ResolvedField<number>;
    hurtable: ResolvedField<number>;
  };
  element: ResolvedField<ElementType>;
  elementAddRate: ResolvedField<number>;
  weaknessMultiplier: ResolvedField<number>;
  enableWeakness: ResolvedField<boolean>;
  enableCritical: ResolvedField<boolean>;
  toughness: ResolvedField<ResolvedToughnessType>;
  ignoreShield: ResolvedField<boolean>;
  fire: ResolvedFireBehavior;
  ammo: ResolvedAmmoBehavior;
  movement: ResolvedMovementBehavior;
  feel: ResolvedFeelBehavior;
  attenuation: ResolvedAttenuation;
  settlements: readonly string[];
  unknownSettlements: readonly string[];
  raw: {
    numerical?: Readonly<Record<string, unknown>>;
    asc?: Readonly<Record<string, unknown>>;
    feel?: Readonly<Record<string, unknown>>;
  };
  provenance: readonly FieldProvenance[];
}

export interface ResolvedActiveSkill {
  id: number | undefined;
  level: 1;
  chargeTime: ResolvedField<number>;
  chargeCount: ResolvedField<number>;
  source: "weapon_pve" | "gp_fallback" | "mdx_v1";
  sourceKey?: string;
  raw?: Readonly<Record<string, unknown>>;
}

export interface ResolvedWeapon {
  slug: string;
  title: string;
  nickname?: string;
  keywords: readonly string[];
  table: NumericalTable;
  schemaVersion: 1 | 2;
  useType?: string;
  tags: readonly WeaponTag[];
  draft: boolean;
  gameMode?: NumericalTable;
  element: ResolvedField<ElementType>;
  weaponType: ResolvedField<WeaponType>;
  weaponTypeId: ResolvedField<number>;
  rarity: ResolvedField<Rarity>;
  scope: ResolvedField<string>;
  accuracy: ResolvedField<number>;
  stability: ResolvedField<number>;
  magazine: ResolvedField<number>;
  totalAmmo: ResolvedField<number>;
  explosionRange: ResolvedField<number>;
  skillDuration: ResolvedField<number>;
  skillBlocking: ResolvedField<boolean>;
  showDuration: ResolvedField<boolean>;
  shootingEnergy: ResolvedField<boolean>;
  shootingEnergyCount: ResolvedField<number>;
  officialRadar: {
    damage: ResolvedField<number>;
    range: ResolvedField<number>;
    reload: ResolvedField<number>;
    accuracy: ResolvedField<number>;
    handling: ResolvedField<number>;
    mobility: ResolvedField<number>;
  };
  changeClip: {
    timeBase: ResolvedField<number>;
    reloadRecovery: ResolvedField<number>;
  };
  melee: {
    light: ResolvedField<number>;
    heavy: ResolvedField<number>;
  };
  damageSources: readonly ResolvedDamageSource[];
  mainSourceId?: string;
  activeSkill?: ResolvedActiveSkill;
  diagnostics: readonly ResolutionDiagnostic[];
  provenance: readonly FieldProvenance[];
  raw: {
    mdx: Readonly<Record<string, unknown>>;
    item?: Readonly<Record<string, unknown>>;
    legacyWeapon?: Readonly<Weapon>;
  };
}

export interface ResolvedWeaponSnapshot {
  snapshot_version: 1;
  weapon: unknown;
}

interface ResolveContext {
  slug: string;
  expectedTable: NumericalTable;
  diagnostics: ResolutionDiagnostic[];
  weaponPath: string;
}

function missing<T>(provenance: FieldProvenance[] = []): ResolvedField<T> {
  return { state: "missing", provenance, overrideHistory: [] };
}

function unavailable<T>(provenance: FieldProvenance[] = []): ResolvedField<T> {
  return { state: "unavailable", provenance, overrideHistory: [] };
}

function notApplicable<T>(
  provenance: FieldProvenance[] = [],
): ResolvedField<T> {
  return { state: "not_applicable", provenance, overrideHistory: [] };
}

function unrecognized<T>(
  provenance: FieldProvenance[] = [],
): ResolvedField<T> {
  return { state: "unrecognized", provenance, overrideHistory: [] };
}

function resolved<T>(
  value: T,
  provenance: FieldProvenance[],
): ResolvedField<T> {
  return {
    state: typeof value === "number" && value === 0 ? "zero" : "resolved",
    value,
    provenance,
    overrideHistory: [],
  };
}

function fieldValue<T>(field: ResolvedField<T>): T | undefined {
  return field.state === "resolved" || field.state === "zero"
    ? field.value
    : undefined;
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function textList(value: unknown): string[] {
  if (typeof value === "string") {
    const text = value.trim();
    return text ? [text] : [];
  }
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const text = optionalText(item);
    return text ? [text] : [];
  });
}

function chooseMainSourceId(
  damageSources: readonly ResolvedDamageSource[],
): string | undefined {
  return (
    damageSources.find((source) => source.section === "fire_mode") ??
    damageSources[0]
  )?.id;
}

function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) return value.map(cloneValue) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [
        key,
        cloneValue(child),
      ]),
    ) as T;
  }
  return value;
}

function escapePointer(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function sourcePath(sourceId: string, field = ""): string {
  return `/damageSources/${escapePointer(sourceId)}${field ? `/${field}` : ""}`;
}

function diagnostic(
  diagnostics: ResolutionDiagnostic[],
  value: ResolutionDiagnostic,
): void {
  diagnostics.push(value);
}

function finalizeDiagnostics(
  diagnostics: readonly ResolutionDiagnostic[],
): ResolutionDiagnostic[] {
  const unique = new Map(
    diagnostics.map((item) => [diagnosticTuple(item).join("\u0000"), item]),
  );
  return [...unique.values()].sort((left, right) =>
    compareTuple(diagnosticTuple(left), diagnosticTuple(right)),
  );
}

function directMdx(
  version: 1 | 2,
  rawField: string,
  sourceId?: string,
): FieldProvenance[] {
  return [{ kind: version === 1 ? "mdx-v1" : "mdx-v2", rawField, sourceId }];
}

function fieldFromLegacyNumber(
  value: number | undefined,
  rawField: string,
  sourceId?: string,
): ResolvedField<number> {
  return value === undefined
    ? missing()
    : resolved(value, directMdx(1, rawField, sourceId));
}

function fieldFromLegacyValue<T>(
  value: T | undefined,
  rawField: string,
  sourceId?: string,
): ResolvedField<T> {
  return value === undefined
    ? missing()
    : resolved(value, directMdx(1, rawField, sourceId));
}

function emptyFire(): ResolvedFireBehavior {
  return {
    interval: missing(),
    rpm: missing(),
    subFireCount: missing(),
    subFireInterval: missing(),
    pellets: missing(),
    preFireTime: missing(),
    fireBoltTime: missing(),
    overchargeActivationTime: missing(),
    overchargeDeactivationTime: missing(),
    equipTime: missing(),
    weakpointLevel1Ratio: missing(),
    weakpointLevel2Ratio: missing(),
    maxRpmRatio: missing(),
  };
}

function emptyAmmo(): ResolvedAmmoBehavior {
  return {
    clip: missing(),
    max: missing(),
    changeClipAmount: missing(),
    costPerShot: missing(),
    infinite: missing(),
  };
}

function emptyMovement(): ResolvedMovementBehavior {
  return {
    normal: missing(),
    sprint: missing(),
    firing: missing(),
    aiming: missing(),
    reload: missing(),
    chargeOrPreheat: missing(),
    crouching: missing(),
    zoom: missing(),
  };
}

function emptyFeel(): ResolvedFeelBehavior {
  return {
    changeClipTime: missing(),
    changeClipEndToFire: missing(),
    beforeChangeClip: missing(),
    afterChangeClip: missing(),
    autoChangeClipDelay: missing(),
    zoomIn: missing(),
    zoomOut: missing(),
    runToFire: missing(),
    shotCooldown: missing(),
    recoilTime: missing(),
    recoilReturnTime: missing(),
    recoilUpMax: missing(),
    recoilSideRange: missing(),
    recoilVerticalScale: missing(),
    recoilHorizontalScale: missing(),
    spreadMin: missing(),
    spreadMax: missing(),
    spreadModifierBase: missing(),
    spreadModifierInc: missing(),
    spreadModifierMax: missing(),
    spreadReturnTime: missing(),
    accuracyRatios: {},
  };
}

interface V1SourceDescriptor {
  id: string;
  rawPrefix: string;
  fields: Record<V1ModeField, FieldProvenance[]>;
}

type V1ModeField =
  | "fire_interval"
  | "pellets"
  | "damage.base"
  | "damage.impulse"
  | "damage.toughness"
  | "damage.flesh"
  | "damage.hurtable"
  | "element"
  | "element_add_rate"
  | "weakness_multiplier"
  | "enable_weakness"
  | "enable_critical"
  | "toughness_type"
  | "ignore_shield";

function v1Default(sourceId: string, note = "legacy-default"): FieldProvenance[] {
  return [{ kind: "derived", sourceId, note }];
}

function v1Direct(sourceId: string, rawField: string): FieldProvenance[] {
  return directMdx(1, rawField, sourceId);
}

function v1FlatDescriptor(raw: Record<string, unknown>): V1SourceDescriptor {
  const id = "v1-primary";
  const damage =
    raw.damage && typeof raw.damage === "object"
      ? (raw.damage as Record<string, unknown>)
      : {};
  const damageSource = (field: string) =>
    damage[field] !== undefined && damage[field] !== null
      ? v1Direct(id, `damage.${field}`)
      : v1Default(id);
  const topLevelSource = (field: string, present: boolean) =>
    present ? v1Direct(id, field) : v1Default(id);
  const fileRate = legacyNumber(raw.file_rate);
  const fireInterval =
    fileRate !== undefined
      ? [
          ...v1Direct(id, "file_rate"),
          { kind: "derived" as const, sourceId: id, rawField: "60 / file_rate" },
        ]
      : v1Default(id);
  return {
    id,
    rawPrefix: "damage",
    fields: {
      fire_interval: fireInterval,
      pellets: topLevelSource("pellets", legacyNumber(raw.pellets) !== undefined),
      "damage.base": damageSource("base"),
      "damage.impulse": damageSource("impulse"),
      "damage.toughness": damageSource("toughness"),
      "damage.flesh": damageSource("flesh"),
      "damage.hurtable": damageSource("hurtable"),
      element: topLevelSource("element", Boolean(raw.element)),
      element_add_rate: topLevelSource(
        "element_add_rate",
        raw.element_add_rate !== undefined && raw.element_add_rate !== null,
      ),
      weakness_multiplier: topLevelSource(
        "weekness_multiplier",
        raw.weekness_multiplier !== undefined && raw.weekness_multiplier !== null,
      ),
      enable_weakness: v1Default(id, "legacy-primary-default:true"),
      enable_critical: topLevelSource("enable_critical", "enable_critical" in raw),
      toughness_type: topLevelSource("toughness_type", Boolean(raw.toughness_type)),
      ignore_shield: topLevelSource("ignore_shield", "ignore_shield" in raw),
    },
  };
}

function v1ModeDescriptor(
  entry: Record<string, unknown>,
  index: number,
  id: string,
  inheritedInterval?: readonly FieldProvenance[],
  collection: "damage_modes" | "extra_modes" = "damage_modes",
): V1SourceDescriptor {
  const rawPrefix = `${collection}[${index}]`;
  const damage =
    entry.damage && typeof entry.damage === "object"
      ? (entry.damage as Record<string, unknown>)
      : {};
  const entrySource = (field: string, present: boolean) =>
    present ? v1Direct(id, `${rawPrefix}.${field}`) : v1Default(id);
  const damageSource = (field: string) =>
    entrySource(`damage.${field}`, damage[field] !== undefined && damage[field] !== null);
  const fireInterval =
    "fire_interval" in entry
      ? v1Direct(id, `${rawPrefix}.fire_interval`)
      : inheritedInterval
        ? [
            ...inheritedInterval,
            {
              kind: "derived" as const,
              sourceId: id,
              note: "inherited-primary-fire-interval",
            },
          ]
        : v1Default(id);
  return {
    id,
    rawPrefix,
    fields: {
      fire_interval: fireInterval,
      pellets: entrySource("pellets", typeof entry.pellets === "number"),
      "damage.base": damageSource("base"),
      "damage.impulse": damageSource("impulse"),
      "damage.toughness": damageSource("toughness"),
      "damage.flesh": damageSource("flesh"),
      "damage.hurtable": damageSource("hurtable"),
      element: entrySource("element", typeof entry.element === "string" && Boolean(entry.element)),
      element_add_rate: entrySource("element_add_rate", typeof entry.element_add_rate === "number"),
      weakness_multiplier: entrySource(
        "weakness_multiplier",
        typeof entry.weakness_multiplier === "number",
      ),
      enable_weakness: entrySource("enable_weakness", typeof entry.enable_weakness === "boolean"),
      enable_critical: entrySource("enable_critical", typeof entry.enable_critical === "boolean"),
      toughness_type: entrySource(
        "toughness_type",
        typeof entry.toughness_type === "string" && Boolean(entry.toughness_type),
      ),
      ignore_shield: entrySource("ignore_shield", typeof entry.ignore_shield === "boolean"),
    },
  };
}

function v1SourceDescriptors(
  raw: Record<string, unknown>,
  legacy: Weapon,
): { damage: V1SourceDescriptor[]; extra: V1SourceDescriptor[] } {
  const entries = new Map<number, { entry: Record<string, unknown>; index: number }>();
  if (Array.isArray(raw.damage_modes)) {
    for (const [index, entry] of (
      raw.damage_modes as Record<string, unknown>[]
    ).entries()) {
      const mode = Number(entry.mode ?? -1);
      if (mode >= 0) entries.set(mode, { entry, index });
    }
  }
  const validModeZero =
    entries.has(0) && typeof entries.get(0)!.entry.name === "string" &&
    entries.get(0)!.entry.name !== "";
  const primary = validModeZero
    ? v1ModeDescriptor(
        entries.get(0)!.entry,
        entries.get(0)!.index,
        "v1-mode-0",
      )
    : v1FlatDescriptor(raw);
  const damage: V1SourceDescriptor[] = [primary];
  for (const [mode, { entry, index }] of entries) {
    if (mode === 0 || typeof entry.name !== "string" || entry.name === "") continue;
    damage.push(
      v1ModeDescriptor(entry, index, `v1-mode-${mode}`, primary.fields.fire_interval),
    );
  }
  const extra: V1SourceDescriptor[] = [];
  if (Array.isArray(raw.extra_modes)) {
    for (const [index, entry] of (
      raw.extra_modes as Record<string, unknown>[]
    ).entries()) {
      if (typeof entry.name === "string" && entry.name !== "") {
        const descriptor = v1ModeDescriptor(
          entry,
          index,
          `v1-extra-${index}`,
          primary.fields.fire_interval,
          "extra_modes",
        );
        extra.push(descriptor);
      }
    }
  }
  return {
    damage: damage.slice(0, legacy.damageModes.length),
    extra: extra.slice(0, legacy.extraModes?.length ?? 0),
  };
}

function legacyToughness(value: ToughnessType): ResolvedToughnessType {
  if (value === "贯穿") return "penetration";
  if (value === "爆炸") return "explosion";
  return "impulse";
}

function normalizeLegacyMode(
  mode: DamageMode,
  descriptor: V1SourceDescriptor,
  section: DamageSection,
): ResolvedDamageSource {
  const { id, rawPrefix, fields } = descriptor;
  const fire = emptyFire();
  fire.interval = resolved(mode.fireIntervalBase, fields.fire_interval);
  fire.rpm =
    mode.fireIntervalBase > 0
      ? resolved(60 / mode.fireIntervalBase, [
          ...fire.interval.provenance,
          { kind: "derived", rawField: "60 / interval", sourceId: id },
        ])
      : unavailable(fire.interval.provenance as FieldProvenance[]);
  fire.pellets =
    mode.pellets === undefined
      ? missing()
      : resolved(mode.pellets, fields.pellets);
  return {
    id,
    name: mode.name,
    section,
    label: mode.damageLabel,
    damage: {
      base: resolved(mode.damage.base, fields["damage.base"]),
      impulse: resolved(
        mode.damage.impulse,
        fields["damage.impulse"],
      ),
      toughness: resolved(
        mode.damage.toughness,
        fields["damage.toughness"],
      ),
      flesh: resolved(
        mode.damage.flesh,
        fields["damage.flesh"],
      ),
      hurtable: resolved(
        mode.damage.hurtable,
        fields["damage.hurtable"],
      ),
    },
    element: resolved(mode.element, fields.element),
    elementAddRate: resolved(
      mode.elementAddRate,
      fields.element_add_rate,
    ),
    weaknessMultiplier: resolved(
      mode.weaknessMultiplier,
      fields.weakness_multiplier,
    ),
    enableWeakness: resolved(
      mode.enableWeakness,
      fields.enable_weakness,
    ),
    enableCritical: resolved(
      mode.enableCritical,
      fields.enable_critical,
    ),
    toughness: resolved(
      legacyToughness(mode.toughnessType),
      fields.toughness_type,
    ),
    ignoreShield: resolved(
      mode.ignoreShield,
      fields.ignore_shield,
    ),
    fire,
    ammo: emptyAmmo(),
    movement: emptyMovement(),
    feel: emptyFeel(),
    attenuation: { status: "missing", provenance: [], overrideHistory: [] },
    settlements: [],
    unknownSettlements: [],
    raw: {},
    provenance: [
      { kind: "mdx-v1", rawField: rawPrefix, sourceId: id, note: "identity" },
    ],
  };
}

function normalizeV1(
  raw: Record<string, unknown>,
  context: ResolveContext,
): ResolvedWeapon {
  const legacy = transformWeaponV1Legacy(raw, context.slug);
  const descriptors = v1SourceDescriptors(raw, legacy);
  const damageSources = legacy.damageModes.map((mode, index) =>
    normalizeLegacyMode(
      mode,
      descriptors.damage[index] ?? v1FlatDescriptor(raw),
      "fire_mode",
    ),
  );
  for (const [index, mode] of (legacy.extraModes ?? []).entries()) {
    damageSources.push(
      normalizeLegacyMode(
        mode,
        descriptors.extra[index] ?? v1FlatDescriptor(raw),
        "special",
      ),
    );
  }
  const mainSourceId = chooseMainSourceId(damageSources);
  const main = damageSources.find((source) => source.id === mainSourceId);
  if (main) {
    const begin = raw.attenuation_begin;
    const end = raw.attenuation_end;
    const scale = raw.attenuation_scale;
    if (begin !== undefined || end !== undefined || scale !== undefined) {
      const values = [Number(begin), Number(end), Number(scale)];
      if (
        values.every(Number.isFinite) &&
        values[0] >= 0 &&
        values[1] >= 0 &&
        values[2] >= 0 &&
        values[2] <= 1 &&
        ((values[0] === 0 && values[1] === 0) ||
          (values[1] > values[0] && values[1] > 0))
      ) {
        const rawValue = {
          beginCm: values[0] * 100,
          endCm: values[1] * 100,
          minScale: values[2],
        };
        main.attenuation =
          values[0] === 0 && values[1] === 0
            ? {
                status: "not_applicable",
                raw: rawValue,
                provenance: directMdx(1, "attenuation_begin", main.id),
                overrideHistory: [],
              }
            : {
                status: "applicable",
                beginMeters: values[0],
                endMeters: values[1],
                minScale: values[2],
                raw: rawValue,
                provenance: directMdx(1, "attenuation_begin", main.id),
                overrideHistory: [],
              };
      } else {
        main.attenuation = {
          status: "unavailable",
          provenance: directMdx(1, "attenuation_begin", main.id),
          overrideHistory: [],
        };
        diagnostic(context.diagnostics, {
          severity: "warning",
          code: "V1_INVALID_ATTENUATION",
          path: "/attenuation",
          message: "V1 attenuation cannot be normalized",
        });
      }
    }
    if (legacy.changeClip) {
      main.feel.changeClipTime = resolved(
        legacy.changeClip.timeBase,
        directMdx(1, "changeClip.timeBase", main.id),
      );
      main.feel.changeClipEndToFire = resolved(
        legacy.changeClip.reloadRecovery,
        directMdx(1, "changeClip.reloadRecovery", main.id),
      );
    }
  }

  const activeSkillId = raw.active_skill_id;
  const skillId =
    typeof activeSkillId === "number" &&
    Number.isSafeInteger(activeSkillId) &&
    activeSkillId > 0
      ? activeSkillId
      : undefined;
  const activeSkill =
    legacy.skillCooldown === undefined
      ? undefined
      : {
          id: skillId,
          level: 1 as const,
          chargeTime: resolved(
            legacy.skillCooldown,
            directMdx(1, "skill_cooldown"),
          ),
          chargeCount: missing<number>(),
          source: "mdx_v1" as const,
        };

  return {
    slug: legacy.slug,
    title: legacy.title,
    nickname: optionalText(raw.nickname),
    keywords: textList(raw.keywords),
    table: context.expectedTable,
    schemaVersion: 1,
    useType: legacy.use_type,
    tags: legacy.tags ?? [],
    draft: Boolean(legacy.draft),
    gameMode: legacy.game_mode,
    element:
      main?.element ??
      fieldFromLegacyValue<ElementType>(
        legacy.damageModes[0]?.element,
        "element",
      ),
    weaponType: fieldFromLegacyValue(legacy.weapon_type, "weapon_type"),
    weaponTypeId: fieldFromLegacyNumber(legacy.weaponTypeId, "weapon_type_id"),
    rarity: fieldFromLegacyValue(legacy.rarity, "rarity"),
    scope: fieldFromLegacyValue(legacy.scope, "scope"),
    accuracy: fieldFromLegacyNumber(legacy.accuracy, "accuracy"),
    stability: fieldFromLegacyNumber(legacy.stability, "stability"),
    magazine: fieldFromLegacyNumber(legacy.magazine, "magazine"),
    totalAmmo: fieldFromLegacyNumber(legacy.totalAmmo, "total_ammo"),
    explosionRange: fieldFromLegacyNumber(
      legacy.explosionRange,
      "explosion_range",
    ),
    skillDuration: fieldFromLegacyNumber(legacy.skillDuration, "skill_duration"),
    skillBlocking: resolved(
      Boolean(legacy.skillBlocking),
      directMdx(1, "skill_blocking"),
    ),
    showDuration: resolved(
      Boolean(legacy.showDuration),
      directMdx(1, "show_duration"),
    ),
    shootingEnergy: resolved(
      Boolean(legacy.shootingEnergy),
      directMdx(1, "shooting_energy"),
    ),
    shootingEnergyCount: fieldFromLegacyNumber(
      legacy.shootingEnergyCount,
      "shooting_energy_count",
    ),
    officialRadar: {
      damage: missing(),
      range: missing(),
      reload: missing(),
      accuracy: missing(),
      handling: missing(),
      mobility: missing(),
    },
    changeClip: {
      timeBase: fieldFromLegacyNumber(legacy.changeClip?.timeBase, "changeClip.timeBase"),
      reloadRecovery: fieldFromLegacyNumber(
        legacy.changeClip?.reloadRecovery,
        "changeClip.reloadRecovery",
      ),
    },
    melee: {
      light: fieldFromLegacyNumber(legacy.meleeDamage?.light, "melee_damage.light"),
      heavy: fieldFromLegacyNumber(legacy.meleeDamage?.heavy, "melee_damage.heavy"),
    },
    damageSources,
    mainSourceId,
    activeSkill,
    diagnostics: finalizeDiagnostics(context.diagnostics),
    provenance: [
      { kind: "mdx-v1", rawField: "schema_version", note: "schema" },
      {
        kind: "mdx-v1",
        rawField: "game_mode",
        note: `expected-table:${context.expectedTable}`,
      },
    ],
    raw: { mdx: raw, legacyWeapon: cloneValue(legacy) },
  };
}

const BASE_SETTLEMENTS = new Set(
  [
    "WeaponDamage",
    "MeleeWeaponDamage",
    "WeaponSkillDamage",
    "WeaponExplosionDamage",
    "SkillDamage",
    "DebuffDamage",
    "IndirectDamage",
    "EnvironmentDamage",
    "CustomDamage",
    "DeathExecute",
    "DropEnvironmentDamage",
  ].map((suffix) => `Numerical.SettlementType.Health.${suffix}`),
);

const SETTLEMENT_FIELDS = {
  "Numerical.SettlementType.Impulse.Base": "impulse",
  "Numerical.SettlementType.Toughness.Base": "toughness",
  "Numerical.SettlementType.Flesh.Base": "flesh",
  "Numerical.SettlementType.Hurtable.Base": "hurtable",
  "Numerical.SettlementType.Element.ElementPointAdd": "elementAddRate",
} as const;

const RECOGNIZED_UNMAPPED_SETTLEMENTS = new Set([
  "Numerical.SettlementType.KnockUp.Base",
  "Numerical.SettlementType.Health.HealthThenShieldPercentRecover",
  "Numerical.SettlementType.Health.CharStandardHealing",
  "Numerical.SettlementType.Health.CharExtraShieldRecovery",
  "Numerical.SettlementType.Health.CharStandardShieldRecovery",
  "Numerical.SettlementType.Health.CustomHealing",
  "Numerical.SettlementType.Health.CustomExtraShield",
  "Numerical.SettlementType.Toughness.Healing",
  "None",
]);

const ELEMENT_TOKEN_MAP: Readonly<Record<string, ElementType>> = {
  "EElementEffectType::EDamageType_Normal": "物理",
  "EElementEffectType::EDamageType_Kinetic": "物理",
  "EElementEffectType::EDamageType_Fire": "火焰",
  "EElementEffectType::EDamageType_Cryo": "寒冷",
  "EElementEffectType::EDamageType_Shock": "电弧",
  "EElementEffectType::EDamageType_Corossive": "腐蚀",
};

const TOUGHNESS_TOKEN_MAP: Readonly<Record<string, ResolvedToughnessType>> = {
  "EHardStrightWeaknessType::None": "none",
  "EHardStrightWeaknessType::Impulse": "impulse",
};

function readLockRow(
  lock: WeaponDataLock,
  kind: WeaponDataLockKind,
  key: string,
  path: string,
  sourceId?: string,
): WeaponDataLockRow {
  try {
    return getWeaponDataLockRow(lock, kind, key, path);
  } catch (error) {
    if (error instanceof WeaponDataLockError) {
      throw new WeaponResolutionError("MISSING_LOCK", "referenced Lock row is missing", {
        path,
        sourceId,
        sourceKey: key,
        cause: error,
      });
    }
    throw error;
  }
}

function requiredNumber(
  raw: Readonly<Record<string, unknown>>,
  rawField: string,
  context: { path: string; sourceId?: string; sourceKey?: string },
  options: { nonNegative?: boolean; safeInteger?: boolean; positive?: boolean } = {},
): number {
  if (!(rawField in raw)) {
    throw new WeaponResolutionError(
      "MISSING_REQUIRED_FIELD",
      `required field ${rawField} is missing`,
      context,
    );
  }
  const value = raw[rawField];
  const valid =
    typeof value === "number" &&
    Number.isFinite(value) &&
    (!options.safeInteger || Number.isSafeInteger(value)) &&
    (!options.nonNegative || value >= 0) &&
    (!options.positive || value > 0);
  if (!valid) {
    throw new WeaponResolutionError(
      "INVALID_FIELD",
      `field ${rawField} has an invalid value`,
      context,
    );
  }
  return value;
}

function requiredBoolean(
  raw: Readonly<Record<string, unknown>>,
  rawField: string,
  context: { path: string; sourceId?: string; sourceKey?: string },
): boolean {
  if (!(rawField in raw)) {
    throw new WeaponResolutionError(
      "MISSING_REQUIRED_FIELD",
      `required field ${rawField} is missing`,
      context,
    );
  }
  if (typeof raw[rawField] !== "boolean") {
    throw new WeaponResolutionError(
      "INVALID_FIELD",
      `field ${rawField} must be boolean`,
      context,
    );
  }
  return raw[rawField];
}

function requiredString(
  raw: Readonly<Record<string, unknown>>,
  rawField: string,
  context: { path: string; sourceId?: string; sourceKey?: string },
): string {
  if (!(rawField in raw)) {
    throw new WeaponResolutionError(
      "MISSING_REQUIRED_FIELD",
      `required field ${rawField} is missing`,
      context,
    );
  }
  if (typeof raw[rawField] !== "string" || raw[rawField].length === 0) {
    throw new WeaponResolutionError(
      "INVALID_FIELD",
      `field ${rawField} must be a non-empty string`,
      context,
    );
  }
  return raw[rawField];
}

function lockProvenance(
  kind: ProvenanceKind,
  sourceKey: string,
  rawField: string,
  sourceId: string,
): FieldProvenance[] {
  return [{ kind, sourceKey, rawField, sourceId }];
}

function parseSettlements(
  raw: Readonly<Record<string, unknown>>,
  sourceId: string,
  sourceKey: string,
  diagnostics: ResolutionDiagnostic[],
): { tags: string[]; unique: Set<string>; unknown: string[] } {
  const value = raw.Settlements;
  if (!Array.isArray(value)) {
    throw new WeaponResolutionError(
      "INVALID_SETTLEMENT",
      "Settlements must be an array",
      { path: sourcePath(sourceId, "settlements"), sourceId, sourceKey },
    );
  }
  const tags: string[] = [];
  const unique = new Set<string>();
  const unknown: string[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new WeaponResolutionError(
        "INVALID_SETTLEMENT",
        "Settlement entries must be objects",
        { path: sourcePath(sourceId, "settlements"), sourceId, sourceKey },
      );
    }
    const tag = (item as Record<string, unknown>).TagName;
    if (typeof tag !== "string" || tag.length === 0) {
      throw new WeaponResolutionError(
        "INVALID_SETTLEMENT",
        "Settlement TagName must be a non-empty string",
        { path: sourcePath(sourceId, "settlements"), sourceId, sourceKey },
      );
    }
    tags.push(tag);
    if (unique.has(tag)) {
      diagnostic(diagnostics, {
        severity: "info",
        code: "DUPLICATE_SETTLEMENT",
        path: sourcePath(sourceId, "settlements"),
        message: `Duplicate Settlement tag: ${tag}`,
        sourceId,
        sourceKey,
      });
      continue;
    }
    unique.add(tag);
    if (
      !BASE_SETTLEMENTS.has(tag) &&
      !(tag in SETTLEMENT_FIELDS) &&
      !RECOGNIZED_UNMAPPED_SETTLEMENTS.has(tag)
    ) {
      unknown.push(tag);
      diagnostic(diagnostics, {
        severity: "warning",
        code: "UNKNOWN_SETTLEMENT",
        path: sourcePath(sourceId, "settlements"),
        message: `Unknown Settlement tag: ${tag}`,
        sourceId,
        sourceKey,
      });
    }
  }
  return { tags, unique, unknown };
}

interface NumericalResolution {
  fields: Pick<
    ResolvedDamageSource,
    | "damage"
    | "element"
    | "elementAddRate"
    | "weaknessMultiplier"
    | "enableWeakness"
    | "enableCritical"
    | "toughness"
    | "ignoreShield"
    | "settlements"
    | "unknownSettlements"
  >;
  raw?: Readonly<Record<string, unknown>>;
  provenance: FieldProvenance[];
}

function pendingNumerical(): NumericalResolution {
  return {
    fields: {
      damage: {
        base: unavailable(),
        impulse: unavailable(),
        toughness: unavailable(),
        flesh: unavailable(),
        hurtable: unavailable(),
      },
      element: unavailable(),
      elementAddRate: unavailable(),
      weaknessMultiplier: unavailable(),
      enableWeakness: unavailable(),
      enableCritical: unavailable(),
      toughness: unavailable(),
      ignoreShield: unavailable(),
      settlements: [],
      unknownSettlements: [],
    },
    provenance: [],
  };
}

function withOverride<T>(
  current: ResolvedField<T>,
  value: T,
  step: DamageSourceOverrideStep,
  fieldName: string,
  diagnostics: ResolutionDiagnostic[],
  path: string,
): ResolvedField<T> {
  const trace: OverrideTrace<T> = {
    sourceId: step.sourceId,
    reason: step.reason,
    before: fieldValue(current),
    after: value,
  };
  diagnostic(diagnostics, {
    severity: "info",
    code: "OVERRIDE_APPLIED",
    path,
    message: `Applied override: ${fieldName}`,
    sourceId: step.sourceId,
  });
  return {
    ...resolved(value, [
      ...current.provenance,
      { kind: "override", rawField: fieldName, sourceId: step.sourceId },
    ]),
    overrideHistory: [...current.overrideHistory, trace],
  };
}

function parseNumerical(
  source: DamageSourceV2,
  effective: ResolvedDamageSourceReference,
  lock: WeaponDataLock,
  context: ResolveContext,
): NumericalResolution {
  const reference = effective.source?.numerical;
  if (!reference) {
    if (effective.pending) return pendingNumerical();
    throw new WeaponResolutionError(
      "INVALID_SOURCE",
      "effective source has no Numerical reference",
      { path: sourcePath(source.id, "source/numerical"), sourceId: source.id },
    );
  }
  const sourceKey = `${reference.table}:${reference.id}_${reference.level}`;
  const kind = `numerical-${reference.table}` as const;
  const row = readLockRow(
    lock,
    kind,
    sourceKey,
    sourcePath(source.id, "source/numerical"),
    source.id,
  );
  const expectedRowName = `${reference.id}_${reference.level}`;
  if (row.row_name !== expectedRowName) {
    throw new WeaponResolutionError(
      "INVALID_LOCK_ROW",
      "Numerical row_name does not match the reference",
      {
        path: sourcePath(source.id, "source/numerical"),
        sourceId: source.id,
        sourceKey,
      },
    );
  }
  const raw = row.raw;
  const settlement = parseSettlements(raw, source.id, sourceKey, context.diagnostics);
  const origin = effective.origins.numerical ?? source.id;
  const provenance = (rawField: string) =>
    lockProvenance("lock-numerical", sourceKey, rawField, origin);
  const applies = {
    base: [...settlement.unique].some((tag) => BASE_SETTLEMENTS.has(tag)),
    impulse: settlement.unique.has("Numerical.SettlementType.Impulse.Base"),
    toughness: settlement.unique.has("Numerical.SettlementType.Toughness.Base"),
    flesh: settlement.unique.has("Numerical.SettlementType.Flesh.Base"),
    hurtable: settlement.unique.has("Numerical.SettlementType.Hurtable.Base"),
    elementAddRate: settlement.unique.has(
      "Numerical.SettlementType.Element.ElementPointAdd",
    ),
  };
  const numberField = (
    key: keyof typeof applies,
    rawField: string,
  ): ResolvedField<number> =>
    applies[key]
      ? resolved(
          requiredNumber(
            raw,
            rawField,
            {
              path: sourcePath(source.id, key),
              sourceId: source.id,
              sourceKey,
            },
            { nonNegative: true },
          ),
          provenance(rawField),
        )
      : notApplicable();

  const elementToken = requiredString(raw, "ElementType", {
    path: sourcePath(source.id, "element"),
    sourceId: source.id,
    sourceKey,
  });
  const elementValue = ELEMENT_TOKEN_MAP[elementToken];
  const element = elementValue
    ? resolved(elementValue, provenance("ElementType"))
    : unrecognized<ElementType>(provenance("ElementType"));
  if (!elementValue) {
    diagnostic(context.diagnostics, {
      severity: "warning",
      code: "UNKNOWN_ENUM",
      path: sourcePath(source.id, "element"),
      message: `Unknown ElementType token: ${elementToken}`,
      sourceId: source.id,
      sourceKey,
    });
  }
  const toughnessToken = requiredString(raw, "ToughnessDamageType", {
    path: sourcePath(source.id, "toughness"),
    sourceId: source.id,
    sourceKey,
  });
  const toughnessValue = TOUGHNESS_TOKEN_MAP[toughnessToken];
  const toughness = toughnessValue
    ? resolved(toughnessValue, provenance("ToughnessDamageType"))
    : unrecognized<ResolvedToughnessType>(provenance("ToughnessDamageType"));
  if (!toughnessValue) {
    diagnostic(context.diagnostics, {
      severity: "warning",
      code: "UNKNOWN_ENUM",
      path: sourcePath(source.id, "toughness"),
      message: `Unknown ToughnessDamageType token: ${toughnessToken}`,
      sourceId: source.id,
      sourceKey,
    });
  }

  const fields: NumericalResolution["fields"] = {
    damage: {
      base: numberField("base", "HpCalScale"),
      impulse: numberField("impulse", "ImpulseBase"),
      toughness: numberField("toughness", "ToughnessBase"),
      flesh: numberField("flesh", "FleshDamageBase"),
      hurtable: numberField("hurtable", "HurtableBase"),
    },
    element,
    elementAddRate: numberField("elementAddRate", "ElementAddRate"),
    weaknessMultiplier: resolved(
      1 +
        requiredNumber(raw, "WeaknessDamageAddScale", {
          path: sourcePath(source.id, "weaknessMultiplier"),
          sourceId: source.id,
          sourceKey,
        }),
      provenance("WeaknessDamageAddScale"),
    ),
    enableWeakness: resolved(
      requiredBoolean(raw, "EnableWeaknessDamage", {
        path: sourcePath(source.id, "enableWeakness"),
        sourceId: source.id,
        sourceKey,
      }),
      provenance("EnableWeaknessDamage"),
    ),
    enableCritical: resolved(
      requiredBoolean(raw, "bEnableCriticalDamage", {
        path: sourcePath(source.id, "enableCritical"),
        sourceId: source.id,
        sourceKey,
      }),
      provenance("bEnableCriticalDamage"),
    ),
    toughness,
    ignoreShield: resolved(
      requiredBoolean(raw, "bDamageIgnoreShield", {
        path: sourcePath(source.id, "ignoreShield"),
        sourceId: source.id,
        sourceKey,
      }),
      provenance("bDamageIgnoreShield"),
    ),
    settlements: settlement.tags,
    unknownSettlements: settlement.unknown,
  };

  const requireApplicable = (
    applicable: boolean,
    overrideField: string,
    step: DamageSourceOverrideStep,
  ): void => {
    if (!applicable) {
      throw new WeaponResolutionError(
        "OVERRIDE_NOT_APPLICABLE",
        `override ${overrideField} is not applicable to the Settlements`,
        {
          path: sourcePath(source.id, overrideField),
          sourceId: step.sourceId,
          sourceKey,
        },
      );
    }
  };
  for (const step of effective.overrideChain) {
    const override = step.overrides.numerical;
    if (!override) continue;
    const damageEntries = Object.entries(override.damage ?? {}) as [
      keyof typeof fields.damage,
      number,
    ][];
    for (const [key, value] of damageEntries) {
      requireApplicable(applies[key], `damage.${key}`, step);
      fields.damage[key] = withOverride(
        fields.damage[key],
        value,
        step,
        `damage.${key}`,
        context.diagnostics,
        sourcePath(source.id, `damage/${key}`),
      );
    }
    if (override.element_add_rate !== undefined) {
      requireApplicable(applies.elementAddRate, "elementAddRate", step);
      fields.elementAddRate = withOverride(
        fields.elementAddRate,
        override.element_add_rate,
        step,
        "elementAddRate",
        context.diagnostics,
        sourcePath(source.id, "elementAddRate"),
      );
    }
    if (override.element !== undefined) {
      fields.element = withOverride(
        fields.element,
        override.element,
        step,
        "element",
        context.diagnostics,
        sourcePath(source.id, "element"),
      );
    }
    if (override.weakness_multiplier !== undefined) {
      fields.weaknessMultiplier = withOverride(
        fields.weaknessMultiplier,
        override.weakness_multiplier,
        step,
        "weaknessMultiplier",
        context.diagnostics,
        sourcePath(source.id, "weaknessMultiplier"),
      );
    }
    if (override.enable_critical !== undefined) {
      fields.enableCritical = withOverride(
        fields.enableCritical,
        override.enable_critical,
        step,
        "enableCritical",
        context.diagnostics,
        sourcePath(source.id, "enableCritical"),
      );
    }
    if (override.enable_weakness !== undefined) {
      fields.enableWeakness = withOverride(
        fields.enableWeakness,
        override.enable_weakness,
        step,
        "enableWeakness",
        context.diagnostics,
        sourcePath(source.id, "enableWeakness"),
      );
    }
    if (override.toughness_type !== undefined) {
      const mapped: Record<string, ResolvedToughnessType> = {
        冲击: "impulse",
        贯穿: "penetration",
        爆炸: "explosion",
      };
      fields.toughness = withOverride(
        fields.toughness,
        mapped[override.toughness_type],
        step,
        "toughness",
        context.diagnostics,
        sourcePath(source.id, "toughness"),
      );
    }
    if (override.ignore_shield !== undefined) {
      fields.ignoreShield = withOverride(
        fields.ignoreShield,
        override.ignore_shield,
        step,
        "ignoreShield",
        context.diagnostics,
        sourcePath(source.id, "ignoreShield"),
      );
    }
  }
  return {
    fields,
    raw,
    provenance: [
      {
        kind: "lock-numerical",
        sourceKey,
        sourceId: origin,
        note: "effective-reference",
      },
    ],
  };
}

interface BehaviorResolution {
  fire: ResolvedFireBehavior;
  ammo: ResolvedAmmoBehavior;
  movement: ResolvedMovementBehavior;
  feel: ResolvedFeelBehavior;
  attenuation: ResolvedAttenuation;
  rawAsc?: Readonly<Record<string, unknown>>;
  rawFeel?: Readonly<Record<string, unknown>>;
  provenance: FieldProvenance[];
}

function optionalNonNegativeNumber(
  raw: Readonly<Record<string, unknown>>,
  rawField: string,
  domainPath: string,
  provenance: FieldProvenance[],
  sourceId: string,
  sourceKey: string,
): ResolvedField<number> {
  if (!(rawField in raw)) return missing();
  const value = raw[rawField];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new WeaponResolutionError("INVALID_FIELD", `field ${rawField} is invalid`, {
      path: sourcePath(sourceId, domainPath),
      sourceId,
      sourceKey,
    });
  }
  return resolved(value, provenance);
}

function attenuationNumber(
  raw: Readonly<Record<string, unknown>>,
  rawField: string,
  sourceId: string,
  sourceKey: string,
): number {
  if (!(rawField in raw)) {
    throw new WeaponResolutionError(
      "MISSING_REQUIRED_FIELD",
      `required field ${rawField} is missing`,
      { path: sourcePath(sourceId, "attenuation"), sourceId, sourceKey },
    );
  }
  const value = raw[rawField];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new WeaponResolutionError(
      "INVALID_ATTENUATION",
      `attenuation field ${rawField} is invalid`,
      { path: sourcePath(sourceId, "attenuation"), sourceId, sourceKey },
    );
  }
  return value;
}

function attenuationTrace(value: ResolvedAttenuation): AttenuationTraceValue | undefined {
  if (value.status === "applicable") {
    return {
      status: "applicable",
      beginMeters: value.beginMeters,
      endMeters: value.endMeters,
      minScale: value.minScale,
    };
  }
  return value.status === "not_applicable"
    ? { status: "not_applicable" }
    : undefined;
}

function applyAttenuationOverride(
  current: ResolvedAttenuation,
  override: AttenuationOverride,
  step: DamageSourceOverrideStep,
  sourceId: string,
  diagnostics: ResolutionDiagnostic[],
): ResolvedAttenuation {
  if (current.status !== "applicable" && current.status !== "not_applicable") {
    throw new WeaponResolutionError(
      "OVERRIDE_SOURCE_MISSING",
      "attenuation override requires an ASC attenuation fact",
      { path: sourcePath(sourceId, "attenuation"), sourceId: step.sourceId },
    );
  }
  const after: AttenuationTraceValue =
    override.status === "applicable"
      ? {
          status: "applicable",
          beginMeters: override.begin_meters,
          endMeters: override.end_meters,
          minScale: override.min_scale,
        }
      : { status: "not_applicable" };
  const trace: OverrideTrace<AttenuationTraceValue> = {
    sourceId: step.sourceId,
    reason: step.reason,
    before: attenuationTrace(current),
    after,
  };
  diagnostic(diagnostics, {
    severity: "info",
    code: "OVERRIDE_APPLIED",
    path: sourcePath(sourceId, "attenuation"),
    message: "Applied override: attenuation",
    sourceId: step.sourceId,
  });
  const shared = {
    raw: current.raw,
    provenance: [
      ...current.provenance,
      { kind: "override" as const, rawField: "attenuation", sourceId: step.sourceId },
    ],
    overrideHistory: [...current.overrideHistory, trace],
  };
  return after.status === "applicable"
    ? { ...after, ...shared }
    : { status: "not_applicable", ...shared };
}

function applyFireIntervalOverride(
  fire: ResolvedFireBehavior,
  value: number,
  step: DamageSourceOverrideStep,
  sourceId: string,
  diagnostics: ResolutionDiagnostic[],
): void {
  const beforeInterval = fieldValue(fire.interval);
  const beforeRpm = fieldValue(fire.rpm);
  fire.interval = withOverride(
    fire.interval,
    value,
    step,
    "fire.interval",
    diagnostics,
    sourcePath(sourceId, "fire/interval"),
  );
  const rpmAfter = value > 0 ? 60 / value : undefined;
  const rpmTrace: OverrideTrace<number> = {
    sourceId: step.sourceId,
    reason: step.reason,
    before: beforeRpm,
    after: rpmAfter,
  };
  const rpmProvenance: FieldProvenance[] = [
    ...fire.interval.provenance,
    {
      kind: "derived",
      rawField: "60 / interval",
      sourceId,
      note:
        beforeInterval === value
          ? "recomputed-after-equal-override"
          : "recomputed-after-override",
    },
  ];
  fire.rpm =
    rpmAfter === undefined
      ? {
          state: "unavailable",
          provenance: rpmProvenance,
          overrideHistory: [...fire.rpm.overrideHistory, rpmTrace],
        }
      : {
          ...resolved(rpmAfter, rpmProvenance),
          overrideHistory: [...fire.rpm.overrideHistory, rpmTrace],
        };
}

function parseFeel(
  source: DamageSourceV2,
  effective: ResolvedDamageSourceReference,
  lock: WeaponDataLock,
): {
  value: ResolvedFeelBehavior;
  raw?: Readonly<Record<string, unknown>>;
  provenance: FieldProvenance[];
} {
  const feelId = effective.source?.feel_param_id ?? effective.source?.asc_type_id;
  if (!feelId) return { value: emptyFeel(), provenance: [] };
  const row = readLockRow(
    lock,
    "feel",
    feelId,
    sourcePath(source.id, "source/feel"),
    source.id,
  );
  if (row.row_name !== feelId || String(row.raw.WeaponFeelParamID) !== feelId) {
    throw new WeaponResolutionError(
      "INVALID_LOCK_ROW",
      "Feel row identity does not match the reference",
      { path: sourcePath(source.id, "source/feel"), sourceId: source.id, sourceKey: feelId },
    );
  }
  const raw = row.raw;
  const origin = effective.origins.feel_param_id ?? effective.origins.asc_type_id ?? source.id;
  const mappings = {
    changeClipTime: "WeaponChangeClipTimeBase",
    changeClipEndToFire: "WeaponChangeClipEndToFireTime",
    beforeChangeClip: "WeaponBeforeChangeClipTimeBase",
    afterChangeClip: "WeaponAfterChangeClipTimeBase",
    autoChangeClipDelay: "AutoChangeClipAfterFireInterval",
    zoomIn: "ZoomTimeBase",
    zoomOut: "ZoomOutTimeBase",
    runToFire: "RunToFireInterval",
    shotCooldown: "ShotCooldownTime",
    recoilTime: "RecoilTime",
    recoilReturnTime: "RecoilReturnTime",
    recoilUpMax: "RecoilUpTotalMax",
    recoilSideRange: "RecoilSideRange",
    recoilVerticalScale: "RecoilScaleBase_Vert",
    recoilHorizontalScale: "RecoilScaleBase_Hori",
    spreadMin: "SpreadMin",
    spreadMax: "SpreadMax",
    spreadModifierBase: "SpreadModifierBase",
    spreadModifierInc: "SpreadModifierInc",
    spreadModifierMax: "SpreadModifierMax",
    spreadReturnTime: "SpreadReturnTime",
  } as const;
  const value = emptyFeel();
  for (const [domainField, rawField] of Object.entries(mappings) as [
    keyof Omit<ResolvedFeelBehavior, "accuracyRatios">,
    string,
  ][]) {
    value[domainField] = optionalNonNegativeNumber(
      raw,
      rawField,
      `feel/${domainField}`,
      lockProvenance("lock-feel", feelId, rawField, origin),
      source.id,
      feelId,
    );
  }
  value.accuracyRatios = Object.fromEntries(
    Object.keys(raw)
      .filter((key) => key.startsWith("AccuracyRatio_"))
      .sort()
      .map((rawField) => [
        rawField,
        optionalNonNegativeNumber(
          raw,
          rawField,
          `feel/accuracyRatios/${escapePointer(rawField)}`,
          lockProvenance("lock-feel", feelId, rawField, origin),
          source.id,
          feelId,
        ),
      ]),
  );
  return {
    value,
    raw,
    provenance: [
      {
        kind: "lock-feel",
        sourceKey: feelId,
        sourceId: origin,
        note: "effective-reference",
      },
    ],
  };
}

function parseBehavior(
  source: DamageSourceV2,
  effective: ResolvedDamageSourceReference,
  lock: WeaponDataLock,
  context: ResolveContext,
): BehaviorResolution {
  const ascId = effective.source?.asc_type_id;
  if (!ascId) {
    const fire = emptyFire();
    if (effective.fire_interval !== undefined) {
      fire.interval = resolved(effective.fire_interval, [
        {
          kind: "compat-fallback",
          rawField: "fire_interval",
          sourceId: effective.origins.fire_interval,
          note: "missing-preferred",
        },
      ]);
      fire.rpm =
        effective.fire_interval > 0
          ? resolved(60 / effective.fire_interval, [
              ...fire.interval.provenance,
              {
                kind: "derived",
                rawField: "60 / interval",
                sourceId: source.id,
              },
            ])
          : unavailable(fire.interval.provenance as FieldProvenance[]);
    }
    if (effective.pellets !== undefined) {
      fire.pellets = resolved(effective.pellets, [
        {
          kind: "compat-fallback",
          rawField: "pellets",
          sourceId: effective.origins.pellets,
          note: "missing-preferred",
        },
      ]);
    }
    for (const step of effective.overrideChain) {
      if (step.overrides.asc) {
        throw new WeaponResolutionError(
          "OVERRIDE_SOURCE_MISSING",
          "ASC override requires an effective ASC reference",
          { path: sourcePath(source.id, "overrides/asc"), sourceId: step.sourceId },
        );
      }
    }
    return {
      fire,
      ammo: emptyAmmo(),
      movement: emptyMovement(),
      feel: emptyFeel(),
      attenuation: { status: "missing", provenance: [], overrideHistory: [] },
      provenance: [
        ...(effective.fire_interval !== undefined
          ? [
              {
                kind: "mdx-v2" as const,
                rawField: "fire_interval",
                sourceId: effective.origins.fire_interval,
                note: "effective-reference",
              },
            ]
          : []),
        ...(effective.pellets !== undefined
          ? [
              {
                kind: "mdx-v2" as const,
                rawField: "pellets",
                sourceId: effective.origins.pellets,
                note: "effective-reference",
              },
            ]
          : []),
      ],
    };
  }

  const row = readLockRow(
    lock,
    "asc",
    ascId,
    sourcePath(source.id, "source/asc"),
    source.id,
  );
  if (row.row_name !== ascId || String(row.raw.ASCTypeID) !== ascId) {
    throw new WeaponResolutionError(
      "INVALID_LOCK_ROW",
      "ASC row identity does not match the reference",
      { path: sourcePath(source.id, "source/asc"), sourceId: source.id, sourceKey: ascId },
    );
  }
  const raw = row.raw;
  const origin = effective.origins.asc_type_id ?? source.id;
  const required = (
    rawField: string,
    domainPath: string,
    options: { safeInteger?: boolean } = {},
  ): ResolvedField<number> =>
    resolved(
      requiredNumber(
        raw,
        rawField,
        { path: sourcePath(source.id, domainPath), sourceId: source.id, sourceKey: ascId },
        { nonNegative: true, safeInteger: options.safeInteger },
      ),
      lockProvenance("lock-asc", ascId, rawField, origin),
    );
  const optional = (rawField: string, domainPath: string) =>
    optionalNonNegativeNumber(
      raw,
      rawField,
      domainPath,
      lockProvenance("lock-asc", ascId, rawField, origin),
      source.id,
      ascId,
    );
  const interval = required("FireIntervalBase", "fire/interval");
  const fire: ResolvedFireBehavior = {
    interval,
    rpm:
      fieldValue(interval)! > 0
        ? resolved(60 / fieldValue(interval)!, [
            ...interval.provenance,
            { kind: "derived", rawField: "60 / interval", sourceId: source.id },
          ])
        : unavailable(interval.provenance as FieldProvenance[]),
    subFireCount: required("SubFireCountPerShot", "fire/subFireCount", {
      safeInteger: true,
    }),
    subFireInterval: required("SubFireIntervalBase", "fire/subFireInterval"),
    pellets: required("SplinterNum", "fire/pellets", { safeInteger: true }),
    preFireTime: optional("PreFireTimeBase", "fire/preFireTime"),
    fireBoltTime: optional("FireBoltTimeBase", "fire/fireBoltTime"),
    overchargeActivationTime: optional(
      "OverchargeActivationTime",
      "fire/overchargeActivationTime",
    ),
    overchargeDeactivationTime: optional(
      "OverchargeDeactivationTime",
      "fire/overchargeDeactivationTime",
    ),
    equipTime: optional("EquipTimeBase", "fire/equipTime"),
    weakpointLevel1Ratio: optional(
      "WeakpointLevel1DamageRatio",
      "fire/weakpointLevel1Ratio",
    ),
    weakpointLevel2Ratio: optional(
      "WeakpointLevel2DamageRatio",
      "fire/weakpointLevel2Ratio",
    ),
    maxRpmRatio: optional("MaxGunRPMRatio", "fire/maxRpmRatio"),
  };
  const infiniteRaw = raw.HaveInfinityAmmo;
  if (
    !(typeof infiniteRaw === "boolean") &&
    infiniteRaw !== 0 &&
    infiniteRaw !== 1
  ) {
    const code = "HaveInfinityAmmo" in raw ? "INVALID_FIELD" : "MISSING_REQUIRED_FIELD";
    throw new WeaponResolutionError(code, "HaveInfinityAmmo must be boolean or 0/1", {
      path: sourcePath(source.id, "ammo/infinite"),
      sourceId: source.id,
      sourceKey: ascId,
    });
  }
  const ammo: ResolvedAmmoBehavior = {
    clip: required("ClipAmmoCountBase", "ammo/clip", { safeInteger: true }),
    max: required("MaxAmmoCount", "ammo/max", { safeInteger: true }),
    changeClipAmount: required("ChangeClipAmmoCount", "ammo/changeClipAmount", {
      safeInteger: true,
    }),
    costPerShot: required("WeaponAmmoCost", "ammo/costPerShot", {
      safeInteger: true,
    }),
    infinite: resolved(
      infiniteRaw === true || infiniteRaw === 1,
      lockProvenance("lock-asc", ascId, "HaveInfinityAmmo", origin),
    ),
  };
  if (fieldValue(ammo.infinite) && (fieldValue(ammo.clip)! > 0 || fieldValue(ammo.max)! > 0)) {
    diagnostic(context.diagnostics, {
      severity: "warning",
      code: "AMMO_CONFLICT",
      path: sourcePath(source.id, "ammo"),
      message: "Infinite ammo conflicts with finite ammo fields",
      sourceId: source.id,
      sourceKey: ascId,
    });
  }
  const movementMap = {
    normal: "WeaponMovingScaleBase",
    sprint: "WeaponSprintMovingScaleBase",
    firing: "WeaponFiringMovingScale",
    aiming: "WeaponAimingMovingScale",
    reload: "WeaponReloadMovingScale",
    chargeOrPreheat: "WeaponChargeStrengthOrPreheatMovingScale",
    crouching: "WeaponCrouchingMovingScale",
    zoom: "WeaponZoomMovingScaleBase",
  } as const;
  const movement = emptyMovement();
  for (const [domainField, rawField] of Object.entries(movementMap) as [
    keyof ResolvedMovementBehavior,
    string,
  ][]) {
    movement[domainField] = optional(rawField, `movement/${domainField}`);
  }

  const beginCm = attenuationNumber(raw, "DistanceBeginAttenuationBase", source.id, ascId);
  const endCm = attenuationNumber(raw, "DistanceEndAttenuationBase", source.id, ascId);
  const minScale = attenuationNumber(raw, "AttenuationMinScale", source.id, ascId);
  if (minScale > 1) {
    throw new WeaponResolutionError(
      "INVALID_ATTENUATION",
      "AttenuationMinScale must be between 0 and 1",
      { path: sourcePath(source.id, "attenuation"), sourceId: source.id, sourceKey: ascId },
    );
  }
  const rawAttenuation = { beginCm, endCm, minScale };
  const attenuationProvenance = lockProvenance(
    "lock-asc",
    ascId,
    "DistanceBeginAttenuationBase",
    origin,
  );
  let attenuation: ResolvedAttenuation;
  if (beginCm === 0 && endCm === 0) {
    attenuation = {
      status: "not_applicable",
      raw: rawAttenuation,
      provenance: attenuationProvenance,
      overrideHistory: [],
    };
  } else if (endCm > beginCm && endCm > 0) {
    attenuation = {
      status: "applicable",
      beginMeters: beginCm / 100,
      endMeters: endCm / 100,
      minScale,
      raw: rawAttenuation,
      provenance: attenuationProvenance,
      overrideHistory: [],
    };
  } else {
    throw new WeaponResolutionError(
      "INVALID_ATTENUATION",
      "attenuation end must be greater than begin and zero",
      { path: sourcePath(source.id, "attenuation"), sourceId: source.id, sourceKey: ascId },
    );
  }
  for (const step of effective.overrideChain) {
    const ascOverride = step.overrides.asc;
    if (!ascOverride) continue;
    if (ascOverride.fire_interval !== undefined) {
      applyFireIntervalOverride(
        fire,
        ascOverride.fire_interval,
        step,
        source.id,
        context.diagnostics,
      );
    }
    if (ascOverride.attenuation) {
      attenuation = applyAttenuationOverride(
        attenuation,
        ascOverride.attenuation,
        step,
        source.id,
        context.diagnostics,
      );
    }
  }
  if (
    effective.fire_interval !== undefined &&
    effective.fire_interval !== fieldValue(fire.interval)
  ) {
    diagnostic(context.diagnostics, {
      severity: "warning",
      code: "COMPAT_MISMATCH",
      path: sourcePath(source.id, "fire/interval"),
      message: "Compatibility value differs from ASC: fire.interval",
      sourceId: source.id,
      sourceKey: ascId,
    });
  }
  if (effective.pellets !== undefined && effective.pellets !== fieldValue(fire.pellets)) {
    diagnostic(context.diagnostics, {
      severity: "warning",
      code: "COMPAT_MISMATCH",
      path: sourcePath(source.id, "fire/pellets"),
      message: "Compatibility value differs from ASC: fire.pellets",
      sourceId: source.id,
      sourceKey: ascId,
    });
  }
  const feel = parseFeel(source, effective, lock);
  return {
    fire,
    ammo,
    movement,
    feel: feel.value,
    attenuation,
    rawAsc: raw,
    rawFeel: feel.raw,
    provenance: [
      {
        kind: "lock-asc",
        sourceKey: ascId,
        sourceId: origin,
        note: "effective-reference",
      },
      ...feel.provenance,
    ],
  };
}

type PreferredResult<T> =
  | { status: "valid"; value: T; provenance: FieldProvenance[] }
  | { status: "missing" }
  | { status: "invalid"; provenance: FieldProvenance[] }
  | { status: "unrecognized"; provenance: FieldProvenance[] };

function resolvePreferred<T>(
  preferred: PreferredResult<T>,
  fallback: T | undefined,
  input: {
    field: string;
    mdxField: string;
    diagnostics: ResolutionDiagnostic[];
    itemId?: string;
  },
): ResolvedField<T> {
  if (preferred.status === "valid") return resolved(preferred.value, preferred.provenance);
  if (fallback !== undefined) {
    if (preferred.status === "missing") {
      diagnostic(input.diagnostics, {
        severity: "info",
        code: "COMPAT_FALLBACK",
        path: `/${input.field}`,
        message: `Using compatibility fallback: ${input.field}`,
        sourceKey: input.itemId,
      });
      return resolved(fallback, [
        {
          kind: "compat-fallback",
          rawField: input.mdxField,
          note: "missing-preferred",
        },
      ]);
    }
    diagnostic(input.diagnostics, {
      severity: "warning",
      code: "INVALID_PREFERRED_FALLBACK",
      path: `/${input.field}`,
      message: `Preferred source is invalid; using compatibility fallback: ${input.field}`,
      sourceKey: input.itemId,
    });
    const rejected =
      preferred.status === "unrecognized"
        ? preferred.provenance.map((entry) => ({
            ...entry,
            note: "rejected:unrecognized",
          }))
        : preferred.provenance;
    return resolved(fallback, [
      ...rejected,
      {
        kind: "compat-fallback",
        rawField: input.mdxField,
        note:
          preferred.status === "invalid"
            ? "invalid-preferred"
            : "unrecognized-preferred",
      },
    ]);
  }
  if (preferred.status === "invalid") return unavailable(preferred.provenance);
  if (preferred.status === "unrecognized") return unrecognized(preferred.provenance);
  return missing();
}

interface ItemResolution {
  weaponType: ResolvedField<WeaponType>;
  weaponTypeId: ResolvedField<number>;
  rarity: ResolvedField<Rarity>;
  scope: ResolvedField<string>;
  accuracy: ResolvedField<number>;
  stability: ResolvedField<number>;
  officialRadar: ResolvedWeapon["officialRadar"];
  raw?: Readonly<Record<string, unknown>>;
}

function parseItem(
  weapon: WeaponSourceV2,
  lock: WeaponDataLock,
  context: ResolveContext,
): ItemResolution {
  const itemId = weapon.item_id;
  let raw: Readonly<Record<string, unknown>> | undefined;
  if (itemId) {
    const row = readLockRow(lock, "item", itemId, "/item_id");
    if (
      row.row_name !== itemId ||
      !(typeof row.raw.ItemID === "string" || typeof row.raw.ItemID === "number") ||
      String(row.raw.ItemID) !== itemId
    ) {
      throw new WeaponResolutionError(
        "INVALID_LOCK_ROW",
        "ItemID, row_name and item_id must match",
        { path: "/item_id", sourceKey: itemId },
      );
    }
    raw = row.raw;
  }
  const itemProvenance = (
    rawField: string,
    note?: string,
  ): FieldProvenance[] =>
    itemId
      ? [{ kind: "lock-item", sourceKey: itemId, rawField, note }]
      : [];
  const numericPreferred = (
    rawField: string,
    min: number,
    max: number,
  ): PreferredResult<number> => {
    if (!raw || !(rawField in raw)) return { status: "missing" };
    const value = raw[rawField];
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
      diagnostic(context.diagnostics, {
        severity: "warning",
        code: "INVALID_ITEM_FIELD",
        path: `/${rawField}`,
        message: `Invalid Item field: ${rawField}`,
        sourceKey: itemId,
      });
      return {
        status: "invalid",
        provenance: itemProvenance(rawField, "rejected:invalid"),
      };
    }
    return { status: "valid", value, provenance: itemProvenance(rawField) };
  };

  const accuracyPreferred = numericPreferred("AccuracyInt", 0, 100);
  const stabilityPreferred = numericPreferred("StabilityInt", 0, 100);
  const scopePreferred: PreferredResult<string> = (() => {
    if (!raw || !("Weapon_Scope" in raw)) return { status: "missing" };
    const value = raw.Weapon_Scope;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      diagnostic(context.diagnostics, {
        severity: "warning",
        code: "INVALID_ITEM_FIELD",
        path: "/scope",
        message: "Invalid Item field: Weapon_Scope",
        sourceKey: itemId,
      });
      return {
        status: "invalid",
        provenance: itemProvenance("Weapon_Scope", "rejected:invalid"),
      };
    }
    const object = value as Record<string, unknown>;
    const scope =
      typeof object.LocalizedString === "string" && object.LocalizedString.trim()
        ? object.LocalizedString.trim()
        : typeof object.SourceString === "string" && object.SourceString.trim()
          ? object.SourceString.trim()
          : undefined;
    if (!scope) {
      diagnostic(context.diagnostics, {
        severity: "warning",
        code: "INVALID_ITEM_FIELD",
        path: "/scope",
        message: "Invalid Item field: Weapon_Scope",
        sourceKey: itemId,
      });
      return {
        status: "invalid",
        provenance: itemProvenance("Weapon_Scope", "rejected:invalid"),
      };
    }
    return {
      status: "valid",
      value: scope,
      provenance: itemProvenance("Weapon_Scope"),
    };
  })();
  const qualityPreferred: PreferredResult<Rarity> = (() => {
    if (!raw || !("Quality" in raw)) return { status: "missing" };
    const map: Record<number, Rarity> = { 2: "稀有", 3: "史诗", 4: "传说" };
    const value = raw.Quality;
    if (typeof value !== "number" || !Number.isSafeInteger(value)) {
      diagnostic(context.diagnostics, {
        severity: "warning",
        code: "INVALID_ITEM_FIELD",
        path: "/rarity",
        message: "Invalid Item field: Quality",
        sourceKey: itemId,
      });
      return {
        status: "invalid",
        provenance: itemProvenance("Quality", "rejected:invalid"),
      };
    }
    if (!map[value]) {
      diagnostic(context.diagnostics, {
        severity: "warning",
        code: "UNKNOWN_ENUM",
        path: "/rarity",
        message: `Unknown Quality token: ${value}`,
        sourceKey: itemId,
      });
      return {
        status: "unrecognized",
        provenance: itemProvenance("Quality", "unrecognized"),
      };
    }
    return { status: "valid", value: map[value], provenance: itemProvenance("Quality") };
  })();
  const typeIdPreferred: PreferredResult<number> = (() => {
    if (!raw || !("WeaponType" in raw)) return { status: "missing" };
    const value = raw.WeaponType;
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
      diagnostic(context.diagnostics, {
        severity: "warning",
        code: "INVALID_ITEM_FIELD",
        path: "/weaponTypeId",
        message: "Invalid Item field: WeaponType",
        sourceKey: itemId,
      });
      return {
        status: "invalid",
        provenance: itemProvenance("WeaponType", "rejected:invalid"),
      };
    }
    return { status: "valid", value, provenance: itemProvenance("WeaponType") };
  })();
  const typePreferred: PreferredResult<WeaponType> = (() => {
    if (typeIdPreferred.status !== "valid") return typeIdPreferred;
    const value = WEAPON_TYPE_ID_MAP[typeIdPreferred.value];
    if (!value) {
      diagnostic(context.diagnostics, {
        severity: "warning",
        code: "UNKNOWN_ENUM",
        path: "/weaponType",
        message: `Unknown WeaponType token: ${typeIdPreferred.value}`,
        sourceKey: itemId,
      });
      return {
        status: "unrecognized",
        provenance: itemProvenance("WeaponType", "unrecognized"),
      };
    }
    return { status: "valid", value, provenance: itemProvenance("WeaponType") };
  })();

  const fallbackType = Object.values(WEAPON_TYPE_ID_MAP).includes(
    weapon.weapon_type as WeaponType,
  )
    ? (weapon.weapon_type as WeaponType)
    : undefined;
  const fields = {
    accuracy: resolvePreferred(
      accuracyPreferred,
      weapon.accuracy,
      { field: "accuracy", mdxField: "accuracy", diagnostics: context.diagnostics, itemId },
    ),
    stability: resolvePreferred(
      stabilityPreferred,
      weapon.stability,
      { field: "stability", mdxField: "stability", diagnostics: context.diagnostics, itemId },
    ),
    scope: resolvePreferred(scopePreferred, weapon.scope, {
      field: "scope",
      mdxField: "scope",
      diagnostics: context.diagnostics,
      itemId,
    }),
    rarity: resolvePreferred(qualityPreferred, weapon.rarity, {
      field: "rarity",
      mdxField: "rarity",
      diagnostics: context.diagnostics,
      itemId,
    }),
    weaponType: resolvePreferred(typePreferred, fallbackType, {
      field: "weaponType",
      mdxField: "weapon_type",
      diagnostics: context.diagnostics,
      itemId,
    }),
    weaponTypeId: resolvePreferred(
      typeIdPreferred,
      weapon.weapon_type_id,
      {
        field: "weaponTypeId",
        mdxField: "weapon_type_id",
        diagnostics: context.diagnostics,
        itemId,
      },
    ),
  };
  const directComparisons: [PreferredResult<unknown>, unknown, string][] = [
    [accuracyPreferred, weapon.accuracy, "accuracy"],
    [stabilityPreferred, weapon.stability, "stability"],
    [scopePreferred, weapon.scope, "scope"],
    [qualityPreferred, weapon.rarity, "rarity"],
    [typePreferred, fallbackType, "weaponType"],
    [typeIdPreferred, weapon.weapon_type_id, "weaponTypeId"],
  ];
  for (const [preferred, compatibility, field] of directComparisons) {
    if (
      preferred.status === "valid" &&
      compatibility !== undefined &&
      !Object.is(preferred.value, compatibility)
    ) {
      diagnostic(context.diagnostics, {
        severity: "warning",
        code: "COMPAT_MISMATCH",
        path: `/${field}`,
        message: `Compatibility value differs from Item: ${field}`,
        sourceKey: itemId,
      });
    }
  }
  const radarMap = {
    damage: "Radar_Damage",
    range: "Radar_Range",
    reload: "Radar_Reload",
    accuracy: "Radar_Accuracy",
    handling: "Radar_Handling",
    mobility: "Radar_Mobility",
  } as const;
  const officialRadar = {} as ResolvedWeapon["officialRadar"];
  for (const [domainField, rawField] of Object.entries(radarMap) as [
    keyof ResolvedWeapon["officialRadar"],
    string,
  ][]) {
    const preferred = numericPreferred(rawField, 0, 10);
    officialRadar[domainField] =
      preferred.status === "valid"
        ? resolved(preferred.value, preferred.provenance)
        : preferred.status === "invalid"
          ? unavailable(preferred.provenance)
          : missing();
  }
  return { ...fields, officialRadar, raw };
}

function parseActiveSkill(
  weapon: WeaponSourceV2,
  lock: WeaponDataLock,
  diagnostics: ResolutionDiagnostic[],
): ResolvedActiveSkill | undefined {
  const id = weapon.active_skill_id;
  if (!id) return undefined;
  const selectorKey = `${id}_1`;
  const selection = lock.active_skills[selectorKey];
  if (!selection) {
    throw new WeaponResolutionError(
      "MISSING_SKILL_SOURCE",
      "active skill has no locked source selection",
      { path: "/active_skill_id", sourceKey: selectorKey },
    );
  }
  const pve = selection.source === "weapon_pve";
  const expectedKey = pve ? selectorKey : String(id);
  if (selection.source_key !== expectedKey) {
    throw new WeaponResolutionError(
      "INVALID_LOCK_ROW",
      "active skill selector source_key is inconsistent",
      { path: "/active_skill_id", sourceKey: selection.source_key },
    );
  }
  if (!pve && lock.rows["skill-pve"][selectorKey]) {
    throw new WeaponResolutionError(
      "INVALID_LOCK_ROW",
      "GP fallback is forbidden when the PVE row exists",
      { path: "/active_skill_id", sourceKey: expectedKey },
    );
  }
  const kind = pve ? "skill-pve" : "gp-active-skill";
  const row = readLockRow(lock, kind, expectedKey, "/active_skill_id");
  const raw = row.raw;
  const identityValid = pve
    ? row.row_name === expectedKey &&
      String(raw.SkillID) === String(id) &&
      raw.Level === 1
    : row.row_name === expectedKey;
  if (!identityValid) {
    throw new WeaponResolutionError(
      "INVALID_LOCK_ROW",
      "active skill row identity is inconsistent",
      { path: "/active_skill_id", sourceKey: expectedKey },
    );
  }
  if (!pve && raw.AbilityID !== undefined && String(raw.AbilityID) !== String(id)) {
    diagnostic(diagnostics, {
      severity: "warning",
      code: "SOURCE_IDENTITY_DIFFERENCE",
      path: "/active_skill_id",
      message: `GP AbilityID differs from rowName: ${String(raw.AbilityID)}`,
      sourceKey: expectedKey,
    });
  }
  const timeField = pve ? "ChargeNeedTime" : "CooldownDuration";
  const countField = pve ? "SkillCount" : "MaxChargeStackCount";
  const provenanceKind = pve ? "lock-skill-pve" : "lock-gp-active-skill";
  const chargeTime = requiredNumber(
    raw,
    timeField,
    { path: "/activeSkill/chargeTime", sourceKey: expectedKey },
    { nonNegative: true },
  );
  const chargeCount = requiredNumber(
    raw,
    countField,
    { path: "/activeSkill/chargeCount", sourceKey: expectedKey },
    { safeInteger: true, positive: true },
  );
  return {
    id,
    level: 1,
    chargeTime: resolved(chargeTime, [
      { kind: provenanceKind, sourceKey: expectedKey, rawField: timeField },
    ]),
    chargeCount: resolved(chargeCount, [
      { kind: provenanceKind, sourceKey: expectedKey, rawField: countField },
    ]),
    source: selection.source,
    sourceKey: expectedKey,
    raw,
  };
}

function assembleDamageSource(
  weapon: WeaponSourceV2,
  source: DamageSourceV2,
  effective: ResolvedDamageSourceReference,
  lock: WeaponDataLock,
  context: ResolveContext,
): ResolvedDamageSource {
  if (!effective.source?.numerical) {
    const numericalOverride = effective.overrideChain.find(
      (step) => step.overrides.numerical,
    );
    if (numericalOverride) {
      throw new WeaponResolutionError(
        "OVERRIDE_SOURCE_MISSING",
        "Numerical override requires an effective Numerical reference",
        {
          path: sourcePath(source.id, "overrides/numerical"),
          sourceId: numericalOverride.sourceId,
        },
      );
    }
  }
  const numerical = parseNumerical(source, effective, lock, context);
  const behavior = parseBehavior(source, effective, lock, context);
  return {
    id: source.id,
    name: source.name,
    section: source.section,
    label: effective.label,
    ...numerical.fields,
    fire: behavior.fire,
    ammo: behavior.ammo,
    movement: behavior.movement,
    feel: behavior.feel,
    attenuation: behavior.attenuation,
    raw: {
      numerical: numerical.raw,
      asc: behavior.rawAsc,
      feel: behavior.rawFeel,
    },
    provenance: [
      {
        kind: "mdx-v2",
        rawField: `damage_sources.${source.id}`,
        sourceId: source.id,
        note: "identity",
      },
      ...numerical.provenance,
      ...behavior.provenance,
    ],
  };
}

function summaryField<T>(
  preferred: ResolvedField<T> | undefined,
  compatibility: T | undefined,
  input: {
    field: string;
    mdxField: string;
    diagnostics: ResolutionDiagnostic[];
    mainSourceId?: string;
  },
): ResolvedField<T> {
  if (preferred && fieldValue(preferred) !== undefined) {
    if (compatibility !== undefined && !Object.is(fieldValue(preferred), compatibility)) {
      diagnostic(input.diagnostics, {
        severity: "warning",
        code: "COMPAT_MISMATCH",
        path: `/${input.field}`,
        message: `Compatibility value differs from source: ${input.field}`,
        sourceId: input.mainSourceId,
      });
    }
    return {
      ...preferred,
      provenance: [...preferred.provenance],
      overrideHistory: [...preferred.overrideHistory],
    };
  }
  if ((!preferred || preferred.state === "missing") && compatibility !== undefined) {
    diagnostic(input.diagnostics, {
      severity: "info",
      code: "COMPAT_FALLBACK",
      path: `/${input.field}`,
      message: `Using compatibility fallback: ${input.field}`,
      sourceId: input.mainSourceId,
    });
    return resolved(compatibility, [
      {
        kind: "compat-fallback",
        rawField: input.mdxField,
        sourceId: input.mainSourceId,
        note: "missing-preferred",
      },
    ]);
  }
  return preferred ?? missing();
}

function addLossyDiagnostic(
  diagnostics: ResolutionDiagnostic[],
  sourceId: string,
  field: string,
  action: "compatibility" | "default" = "default",
): void {
  diagnostic(diagnostics, {
    severity: "warning",
    code: "LOSSY_LEGACY_PROJECTION",
    path: sourcePath(sourceId, field),
    message: `Legacy projection uses ${action} value: ${field.replaceAll("/", ".")}`,
    sourceId,
  });
}

function addLegacyProjectionDiagnostics(
  weapon: WeaponSourceV2,
  damageSources: readonly ResolvedDamageSource[],
  diagnostics: ResolutionDiagnostic[],
  changeClip: ResolvedWeapon["changeClip"],
): void {
  for (const source of damageSources) {
    for (const [key, field] of Object.entries(source.damage)) {
      if (fieldValue(field) === undefined) addLossyDiagnostic(diagnostics, source.id, `damage/${key}`);
    }
    if (fieldValue(source.elementAddRate) === undefined) {
      addLossyDiagnostic(diagnostics, source.id, "elementAddRate");
    }
    if (fieldValue(source.fire.interval) === undefined) {
      addLossyDiagnostic(diagnostics, source.id, "fire/interval");
    }
    if (fieldValue(source.element) === undefined && source.element.state !== "unrecognized") {
      addLossyDiagnostic(diagnostics, source.id, "element");
    }
    if (source.element.state === "unrecognized") {
      addLossyDiagnostic(diagnostics, source.id, "element", "compatibility");
    }
    if (fieldValue(source.toughness) === undefined || fieldValue(source.toughness) === "none") {
      addLossyDiagnostic(diagnostics, source.id, "toughness");
    }
    for (const [key, field] of [
      ["weaknessMultiplier", source.weaknessMultiplier],
      ["enableWeakness", source.enableWeakness],
      ["enableCritical", source.enableCritical],
      ["ignoreShield", source.ignoreShield],
    ] as const) {
      if (field.state !== "resolved" && field.state !== "zero") {
        addLossyDiagnostic(diagnostics, source.id, key);
      }
    }
  }
  const clipValues = [fieldValue(changeClip.timeBase), fieldValue(changeClip.reloadRecovery)];
  if (clipValues.filter((value) => value !== undefined).length === 1) {
    diagnostic(diagnostics, {
      severity: "warning",
      code: "LOSSY_LEGACY_PROJECTION",
      path: "/changeClip",
      message: "Legacy projection uses default value: changeClip",
    });
  }
  void weapon;
}

function resolveV2(
  weapon: WeaponSourceV2,
  lockInput: WeaponDataLock | undefined,
  context: ResolveContext,
): ResolvedWeapon {
  if (!lockInput) {
    throw new WeaponResolutionError("MISSING_LOCK", "V2 resolution requires a Lock", {
      path: context.weaponPath,
    });
  }
  let lock: WeaponDataLock;
  try {
    lock = parseWeaponDataLock(lockInput);
  } catch (error) {
    throw new WeaponResolutionError("INVALID_LOCK_ROW", "Weapon Data Lock is invalid", {
      path: context.weaponPath,
      cause: error,
    });
  }
  const effective = resolveDamageSourceReferences(weapon);
  const damageSources = weapon.damage_sources.map((source) =>
    assembleDamageSource(weapon, source, effective.get(source.id)!, lock, context),
  );
  const mainSourceId = chooseMainSourceId(damageSources);
  const main = damageSources.find((source) => source.id === mainSourceId);
  const item = parseItem(weapon, lock, context);
  const element = summaryField(main?.element, weapon.element, {
    field: "element",
    mdxField: "element",
    diagnostics: context.diagnostics,
    mainSourceId,
  });
  const magazine = summaryField(main?.ammo.clip, weapon.magazine, {
    field: "magazine",
    mdxField: "magazine",
    diagnostics: context.diagnostics,
    mainSourceId: main?.id,
  });
  const totalAmmo = summaryField(main?.ammo.max, weapon.total_ammo, {
    field: "totalAmmo",
    mdxField: "total_ammo",
    diagnostics: context.diagnostics,
    mainSourceId: main?.id,
  });
  const changeClip = {
    timeBase: summaryField(main?.feel.changeClipTime, weapon.changeClip?.timeBase, {
      field: "changeClip/timeBase",
      mdxField: "changeClip.timeBase",
      diagnostics: context.diagnostics,
      mainSourceId: main?.id,
    }),
    reloadRecovery: summaryField(
      main?.feel.changeClipEndToFire,
      weapon.changeClip?.reloadRecovery,
      {
        field: "changeClip/reloadRecovery",
        mdxField: "changeClip.reloadRecovery",
        diagnostics: context.diagnostics,
        mainSourceId: main?.id,
      },
    ),
  };
  addLegacyProjectionDiagnostics(weapon, damageSources, context.diagnostics, changeClip);
  const numberMdx = (value: number | undefined, field: string) =>
    value === undefined ? missing<number>() : resolved(value, directMdx(2, field));
  const result: ResolvedWeapon = {
    slug: context.slug,
    title: weapon.title,
    nickname: weapon.nickname,
    keywords: textList(weapon.keywords),
    table: context.expectedTable,
    schemaVersion: 2,
    useType: weapon.use_type.trim() || undefined,
    tags: parseLegacyTags(weapon.tags),
    draft: Boolean(weapon.draft),
    gameMode: context.expectedTable,
    element,
    weaponType: item.weaponType,
    weaponTypeId: item.weaponTypeId,
    rarity: item.rarity,
    scope: item.scope,
    accuracy: item.accuracy,
    stability: item.stability,
    magazine,
    totalAmmo,
    explosionRange: numberMdx(weapon.explosion_range, "explosion_range"),
    skillDuration: numberMdx(weapon.skill_duration, "skill_duration"),
    skillBlocking: resolved(Boolean(weapon.skill_blocking), directMdx(2, "skill_blocking")),
    showDuration: resolved(Boolean(weapon.show_duration), directMdx(2, "show_duration")),
    shootingEnergy: resolved(
      Boolean(weapon.shooting_energy),
      directMdx(2, "shooting_energy"),
    ),
    shootingEnergyCount: numberMdx(
      weapon.shooting_energy_count,
      "shooting_energy_count",
    ),
    officialRadar: item.officialRadar,
    changeClip,
    melee: { light: missing(), heavy: missing() },
    damageSources,
    mainSourceId,
    activeSkill: parseActiveSkill(weapon, lock, context.diagnostics),
    diagnostics: context.diagnostics,
    provenance: [
      { kind: "mdx-v2", rawField: "schema_version", note: "schema" },
      {
        kind: "mdx-v2",
        rawField: "game_mode",
        note: `expected-table:${context.expectedTable}`,
      },
    ],
    raw: { mdx: weapon, item: item.raw },
  };
  return result;
}

export function parseWeaponSource(
  input: unknown,
  context: { slug: string; expectedTable: NumericalTable },
):
  | { version: 1; raw: Record<string, unknown> }
  | { version: 2; value: WeaponSourceV2 } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new WeaponResolutionError("INVALID_SOURCE", "frontmatter must be an object", {
      path: context.slug,
    });
  }
  const raw = input as Record<string, unknown>;
  if (!Object.hasOwn(raw, "schema_version")) return { version: 1, raw };
  if (raw.schema_version !== 2) {
    throw new WeaponResolutionError(
      "UNSUPPORTED_SCHEMA_VERSION",
      `unsupported schema_version ${String(raw.schema_version)}`,
      { path: context.slug },
    );
  }
  try {
    return {
      version: 2,
      value: validateWeaponSourceV2(raw, { expectedTable: context.expectedTable }),
    };
  } catch (error) {
    throw new WeaponResolutionError("INVALID_SOURCE", "V2 frontmatter is invalid", {
      path: context.slug,
      cause: error,
    });
  }
}

export function resolveWeapon(
  input: unknown,
  context: {
    slug: string;
    expectedTable: NumericalTable;
    lock?: WeaponDataLock;
  },
): ResolvedWeapon {
  const parsed = parseWeaponSource(input, context);
  const resolveContext: ResolveContext = {
    slug: context.slug,
    expectedTable: context.expectedTable,
    diagnostics: [],
    weaponPath: context.slug,
  };
  return parsed.version === 1
    ? normalizeV1(parsed.raw, resolveContext)
    : resolveV2(parsed.value, context.lock, resolveContext);
}

export function resolveDamageSource(
  weapon: WeaponSourceV2,
  sourceId: string,
  context: {
    lock: WeaponDataLock;
    expectedTable: NumericalTable;
    weaponPath: string;
  },
): ResolvedDamageSource {
  let parsed: WeaponSourceV2;
  try {
    parsed = validateWeaponSourceV2(weapon, { expectedTable: context.expectedTable });
  } catch (error) {
    throw new WeaponResolutionError("INVALID_SOURCE", "V2 frontmatter is invalid", {
      path: context.weaponPath,
      cause: error,
    });
  }
  const source = parsed.damage_sources.find((candidate) => candidate.id === sourceId);
  if (!source) {
    throw new WeaponResolutionError("INVALID_SOURCE", "damage source does not exist", {
      path: sourcePath(sourceId),
      sourceId,
    });
  }
  let lock: WeaponDataLock;
  try {
    lock = parseWeaponDataLock(context.lock);
  } catch (error) {
    throw new WeaponResolutionError("INVALID_LOCK_ROW", "Weapon Data Lock is invalid", {
      path: context.weaponPath,
      cause: error,
    });
  }
  const effective = resolveDamageSourceReferences(parsed).get(sourceId)!;
  return assembleDamageSource(
    parsed,
    source,
    effective,
    lock,
    {
      slug: context.weaponPath,
      expectedTable: context.expectedTable,
      diagnostics: [],
      weaponPath: context.weaponPath,
    },
  );
}

function legacyNumberValue(field: ResolvedField<number>, fallback = 0): number {
  return fieldValue(field) ?? fallback;
}

function legacyElement(source: ResolvedDamageSource, weapon: ResolvedWeapon): ElementType {
  const value = fieldValue(source.element);
  if (value) return value;
  if (source.element.state === "unrecognized") {
    const fallback = weapon.raw.mdx.element;
    if (
      fallback === "物理" ||
      fallback === "火焰" ||
      fallback === "寒冷" ||
      fallback === "电弧" ||
      fallback === "腐蚀"
    ) {
      return fallback;
    }
    throw new WeaponResolutionError(
      "LEGACY_PROJECTION_UNAVAILABLE",
      "unrecognized element has no compatibility fallback",
      { path: sourcePath(source.id, "element"), sourceId: source.id },
    );
  }
  return "物理";
}

function legacyToughnessType(source: ResolvedDamageSource): ToughnessType {
  const value = fieldValue(source.toughness);
  if (value === "penetration") return "贯穿";
  if (value === "explosion") return "爆炸";
  if (value === "impulse" || value === "none" || value === undefined) {
    if (source.toughness.state === "unrecognized") {
      throw new WeaponResolutionError(
        "LEGACY_PROJECTION_UNAVAILABLE",
        "unrecognized toughness type cannot be projected",
        { path: sourcePath(source.id, "toughness"), sourceId: source.id },
      );
    }
    return "冲击";
  }
  return "冲击";
}

function legacyMode(source: ResolvedDamageSource, weapon: ResolvedWeapon): DamageMode {
  const mode: DamageMode = {
    name: source.name,
    damage: {
      base: legacyNumberValue(source.damage.base),
      impulse: legacyNumberValue(source.damage.impulse),
      toughness: legacyNumberValue(source.damage.toughness),
      flesh: legacyNumberValue(source.damage.flesh),
      hurtable: legacyNumberValue(source.damage.hurtable),
    },
    element: legacyElement(source, weapon),
    elementAddRate: legacyNumberValue(source.elementAddRate),
    weaknessMultiplier: legacyNumberValue(source.weaknessMultiplier, 1),
    enableWeakness: fieldValue(source.enableWeakness) ?? false,
    enableCritical: fieldValue(source.enableCritical) ?? false,
    fireIntervalBase: legacyNumberValue(source.fire.interval),
    toughnessType: legacyToughnessType(source),
    ignoreShield: fieldValue(source.ignoreShield) ?? false,
  };
  const pellets = fieldValue(source.fire.pellets);
  if (pellets !== undefined && pellets > 1) mode.pellets = pellets;
  if (source.label !== undefined) mode.damageLabel = source.label;
  return mode;
}

export function toLegacyWeapon(resolvedWeapon: ResolvedWeapon): Weapon {
  if (resolvedWeapon.schemaVersion === 1) {
    if (!resolvedWeapon.raw.legacyWeapon) {
      throw new WeaponResolutionError(
        "LEGACY_PROJECTION_UNAVAILABLE",
        "V1 resolution has no legacy bridge",
        { path: resolvedWeapon.slug },
      );
    }
    return cloneValue(resolvedWeapon.raw.legacyWeapon) as Weapon;
  }
  const fireModeSources = resolvedWeapon.damageSources.filter(
    (source) => source.section === "fire_mode",
  );
  const fallbackMain =
    fireModeSources.length === 0 && resolvedWeapon.mainSourceId
      ? resolvedWeapon.damageSources.find(
          (source) => source.id === resolvedWeapon.mainSourceId,
        )
      : undefined;
  const primarySources =
    fireModeSources.length > 0
      ? fireModeSources
      : fallbackMain
        ? [fallbackMain]
        : [];
  const primarySourceIds = new Set(primarySources.map((source) => source.id));
  const damageModes = primarySources.map((source) =>
    legacyMode(source, resolvedWeapon),
  );
  const projectedExtra = resolvedWeapon.damageSources
    .filter((source) => !primarySourceIds.has(source.id))
    .map((source) => legacyMode(source, resolvedWeapon));
  const timeBase = fieldValue(resolvedWeapon.changeClip.timeBase);
  const reloadRecovery = fieldValue(resolvedWeapon.changeClip.reloadRecovery);
  const changeClip =
    timeBase === undefined && reloadRecovery === undefined
      ? undefined
      : { timeBase: timeBase ?? 0, reloadRecovery: reloadRecovery ?? 0 };
  const meleeLight = fieldValue(resolvedWeapon.melee.light);
  const meleeHeavy = fieldValue(resolvedWeapon.melee.heavy);
  const meleeDamage =
    meleeLight === undefined && meleeHeavy === undefined
      ? undefined
      : { light: meleeLight, heavy: meleeHeavy };
  return {
    slug: resolvedWeapon.slug,
    title: resolvedWeapon.title,
    use_type: resolvedWeapon.useType,
    weapon_type: fieldValue(resolvedWeapon.weaponType),
    weaponTypeId: fieldValue(resolvedWeapon.weaponTypeId),
    rarity: fieldValue(resolvedWeapon.rarity),
    tags: [...resolvedWeapon.tags],
    scope: fieldValue(resolvedWeapon.scope),
    magazine: fieldValue(resolvedWeapon.magazine),
    totalAmmo: fieldValue(resolvedWeapon.totalAmmo),
    accuracy: fieldValue(resolvedWeapon.accuracy),
    stability: fieldValue(resolvedWeapon.stability),
    explosionRange: fieldValue(resolvedWeapon.explosionRange),
    skillCooldown: resolvedWeapon.activeSkill
      ? fieldValue(resolvedWeapon.activeSkill.chargeTime)
      : undefined,
    skillDuration: fieldValue(resolvedWeapon.skillDuration),
    skillBlocking: fieldValue(resolvedWeapon.skillBlocking),
    showDuration: fieldValue(resolvedWeapon.showDuration),
    shootingEnergy: fieldValue(resolvedWeapon.shootingEnergy),
    shootingEnergyCount: fieldValue(resolvedWeapon.shootingEnergyCount),
    changeClip,
    damageModes,
    meleeDamage,
    extraModes: projectedExtra.length > 0 ? projectedExtra : undefined,
    draft: resolvedWeapon.draft,
    game_mode: resolvedWeapon.table === "td" ? "td" : undefined,
  };
}

function compareTuple(left: readonly string[], right: readonly string[]): number {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const a = left[index] ?? "";
    const b = right[index] ?? "";
    if (a < b) return -1;
    if (a > b) return 1;
  }
  return 0;
}

function provenanceTuple(value: FieldProvenance): string[] {
  return [
    value.kind,
    value.sourceId ?? "",
    value.sourceKey ?? "",
    value.rawField ?? "",
    value.note ?? "",
  ];
}

function diagnosticTuple(value: ResolutionDiagnostic): string[] {
  return [
    value.severity,
    value.code,
    value.path,
    value.sourceId ?? "",
    value.sourceKey ?? "",
    value.message,
  ];
}

function canonicalSnapshot(value: unknown, parentKey = ""): unknown {
  if (Array.isArray(value)) {
    let items = value.map((child) => canonicalSnapshot(child));
    if (parentKey === "provenance") {
      items = (items as FieldProvenance[]).sort((left, right) =>
        compareTuple(provenanceTuple(left), provenanceTuple(right)),
      );
    } else if (parentKey === "diagnostics") {
      const diagnostics = items as ResolutionDiagnostic[];
      const unique = new Map(
        diagnostics.map((item) => [diagnosticTuple(item).join("\u0000"), item]),
      );
      items = [...unique.values()].sort((left, right) =>
        compareTuple(diagnosticTuple(left), diagnosticTuple(right)),
      );
    }
    return items;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([key, child]) => key !== "raw" && child !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, child]) => [key, canonicalSnapshot(child, key)]);
    return Object.fromEntries(entries);
  }
  return value;
}

function applySourceIdMap(
  resolvedWeapon: ResolvedWeapon,
  sourceIdMap: Readonly<Record<string, string>>,
): ResolvedWeapon {
  const currentIds = new Set(resolvedWeapon.damageSources.map((source) => source.id));
  for (const [sourceId, target] of Object.entries(sourceIdMap)) {
    if (!currentIds.has(sourceId) || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(target)) {
      throw new WeaponResolutionError(
        "INVALID_SNAPSHOT_MAPPING",
        "sourceIdMap contains an unknown source or invalid target",
        { path: "/sourceIdMap", sourceId },
      );
    }
  }
  const finalIds = resolvedWeapon.damageSources.map(
    (source) => sourceIdMap[source.id] ?? source.id,
  );
  if (new Set(finalIds).size !== finalIds.length) {
    throw new WeaponResolutionError(
      "INVALID_SNAPSHOT_MAPPING",
      "sourceIdMap produces duplicate source IDs",
      { path: "/sourceIdMap" },
    );
  }
  const rewrite = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(rewrite);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, child]) => {
          if ((key === "sourceId" || key === "mainSourceId") && typeof child === "string") {
            return [key, sourceIdMap[child] ?? child];
          }
          if (key === "path" && typeof child === "string") {
            const path = child;
            for (const [from, to] of Object.entries(sourceIdMap)) {
              const prefix = `/damageSources/${escapePointer(from)}`;
              if (path === prefix || path.startsWith(`${prefix}/`)) {
                return [
                  key,
                  `/damageSources/${escapePointer(to)}${path.slice(prefix.length)}`,
                ];
              }
            }
            return [key, path];
          }
          return [key, rewrite(child)];
        }),
      );
    }
    return value;
  };
  const clone = rewrite(resolvedWeapon) as ResolvedWeapon;
  clone.damageSources = clone.damageSources.map((source) => ({
    ...source,
    id: sourceIdMap[source.id] ?? source.id,
  }));
  return clone;
}

export function createResolvedWeaponSnapshot(
  resolvedWeapon: ResolvedWeapon,
  options: { sourceIdMap?: Readonly<Record<string, string>> } = {},
): ResolvedWeaponSnapshot {
  const mapped = options.sourceIdMap
    ? applySourceIdMap(cloneValue(resolvedWeapon), options.sourceIdMap)
    : cloneValue(resolvedWeapon);
  return {
    snapshot_version: 1,
    weapon: canonicalSnapshot(mapped),
  };
}
