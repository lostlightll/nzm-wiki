import type {
  ResolvedDamageSource,
  ResolvedField,
  ResolvedWeapon,
} from "./weapon-resolver";
import type { DamageSection } from "./weapon-source-v2";
import {
  getHealthSettlementDefinition,
  type WeaponHealthSettlementType,
} from "./weapon-health-settlement";

export type WeaponModeDiffField =
  | "availability"
  | "health.type"
  | "health.scale"
  | "health.base"
  | "damage.base"
  | "damage.toughness"
  | "element"
  | "elementAddRate"
  | "weaknessMultiplier"
  | "enableWeakness"
  | "enableCritical"
  | "toughness"
  | "ignoreShield";

export interface WeaponModeDiffRow {
  readonly sourceId: string;
  readonly sourceName: string;
  readonly sourceSection: DamageSection;
  readonly field: WeaponModeDiffField;
  readonly lcAvailable: boolean;
  readonly tdAvailable: boolean;
  readonly lcField?: ResolvedField<unknown>;
  readonly tdField?: ResolvedField<unknown>;
  readonly lcPellets?: number;
  readonly tdPellets?: number;
  readonly lcHealthType?: WeaponHealthSettlementType;
  readonly tdHealthType?: WeaponHealthSettlementType;
}

interface ComparedField {
  readonly field: Exclude<WeaponModeDiffField, "availability">;
  readonly read: (source: ResolvedDamageSource) => ResolvedField<unknown>;
  readonly include?: (
    lcSource: ResolvedDamageSource,
    tdSource: ResolvedDamageSource,
  ) => boolean;
}

function healthType(
  source: ResolvedDamageSource,
): WeaponHealthSettlementType | undefined {
  return source.health.type.state === "resolved"
    ? source.health.type.value
    : undefined;
}

function isRecovery(source: ResolvedDamageSource): boolean {
  const type = healthType(source);
  return Boolean(
    type && getHealthSettlementDefinition(type).kind === "recovery",
  );
}

const COMPARED_FIELDS: readonly ComparedField[] = [
  { field: "health.type", read: (source) => source.health.type },
  {
    field: "health.scale",
    read: (source) => source.health.scale,
    include: (lcSource, tdSource) =>
      isRecovery(lcSource) || isRecovery(tdSource),
  },
  {
    field: "health.base",
    read: (source) => source.health.base,
    include: (lcSource, tdSource) =>
      isRecovery(lcSource) || isRecovery(tdSource),
  },
  { field: "damage.base", read: (source) => source.damage.base },
  { field: "damage.toughness", read: (source) => source.damage.toughness },
  { field: "element", read: (source) => source.element },
  { field: "elementAddRate", read: (source) => source.elementAddRate },
  {
    field: "weaknessMultiplier",
    read: (source) => source.weaknessMultiplier,
  },
  { field: "enableWeakness", read: (source) => source.enableWeakness },
  { field: "enableCritical", read: (source) => source.enableCritical },
  { field: "toughness", read: (source) => source.toughness },
  { field: "ignoreShield", read: (source) => source.ignoreShield },
];

function fieldIdentity(field: ResolvedField<unknown>): string {
  return JSON.stringify({ state: field.state, value: field.value });
}

function resolvedNumber(field: ResolvedField<number>): number | undefined {
  return field.state === "resolved" || field.state === "zero"
    ? field.value
    : undefined;
}

export function buildWeaponModeDiff(
  lcWeapon: ResolvedWeapon,
  tdWeapon: ResolvedWeapon,
): readonly WeaponModeDiffRow[] {
  if (lcWeapon.slug !== tdWeapon.slug) {
    throw new Error("weapon mode diff requires matching slugs");
  }
  if (lcWeapon.table !== "lc" || tdWeapon.table !== "td") {
    throw new Error("weapon mode diff requires LC and TD projections");
  }

  const lcById = new Map(lcWeapon.damageSources.map((source) => [source.id, source]));
  const tdById = new Map(tdWeapon.damageSources.map((source) => [source.id, source]));
  const sourceIds = [
    ...lcWeapon.damageSources.map((source) => source.id),
    ...tdWeapon.damageSources
      .map((source) => source.id)
      .filter((id) => !lcById.has(id)),
  ];
  const rows: WeaponModeDiffRow[] = [];

  for (const sourceId of sourceIds) {
    const lcSource = lcById.get(sourceId);
    const tdSource = tdById.get(sourceId);
    const sourceName = lcSource?.name ?? tdSource?.name ?? sourceId;
    const sourceSection = (lcSource ?? tdSource)!.section;
    if (!lcSource || !tdSource) {
      rows.push({
        sourceId,
        sourceName,
        sourceSection,
        field: "availability",
        lcAvailable: Boolean(lcSource),
        tdAvailable: Boolean(tdSource),
      });
      continue;
    }

    for (const compared of COMPARED_FIELDS) {
      if (compared.include && !compared.include(lcSource, tdSource)) continue;
      const lcField = compared.read(lcSource);
      const tdField = compared.read(tdSource);
      if (fieldIdentity(lcField) === fieldIdentity(tdField)) continue;
      rows.push({
        sourceId,
        sourceName,
        sourceSection,
        field: compared.field,
        lcAvailable: true,
        tdAvailable: true,
        lcField,
        tdField,
        lcPellets: resolvedNumber(lcSource.fire.pellets),
        tdPellets: resolvedNumber(tdSource.fire.pellets),
        lcHealthType: healthType(lcSource),
        tdHealthType: healthType(tdSource),
      });
    }
  }

  return Object.freeze(rows);
}

export const WEAPON_MODE_DIFF_LABELS: Readonly<
  Record<WeaponModeDiffField, string>
> = Object.freeze({
  availability: "来源可用性",
  "health.type": "生命结算类型",
  "health.scale": "生命结算比例",
  "health.base": "生命结算固定值",
  "damage.base": "基础伤害",
  "damage.toughness": "破韧伤害",
  element: "元素",
  elementAddRate: "元素异常概率",
  weaknessMultiplier: "弱点倍率",
  enableWeakness: "弱点伤害",
  enableCritical: "暴击",
  toughness: "破韧类型",
  ignoreShield: "无视护盾",
});

export function getWeaponModeDiffFieldLabel(row: WeaponModeDiffRow): string {
  if (
    row.field === "damage.base" ||
    row.field === "health.scale" ||
    row.field === "health.base"
  ) {
    const type = row.lcHealthType ?? row.tdHealthType;
    if (type) return getHealthSettlementDefinition(type).label;
  }
  if (row.field !== "damage.base") return WEAPON_MODE_DIFF_LABELS[row.field];

  return WEAPON_MODE_DIFF_LABELS[row.field];
}
