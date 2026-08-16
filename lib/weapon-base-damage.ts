import type { ElementType } from "@/types";
import { BASE_DAMAGE_DATA } from "./multiplier-data";
import { getResolvedFieldValue } from "./weapon-consumers";
import type { ResolvedDamageSource, ResolvedWeapon } from "./weapon-resolver";
import type { NumericalTable } from "./weapon-source-v2";
import type { WeaponHealthSettlementType } from "./weapon-health-settlement";

const SETTLEMENT_TYPES = {
  WeaponDamage: { channel: "hit", label: "命中" },
  MeleeWeaponDamage: { channel: "hit", label: "命中" },
  WeaponExplosionDamage: { channel: "explosion", label: "爆炸" },
  WeaponSkillDamage: { channel: "weapon-skill", label: "武器技能" },
  SkillDamage: { channel: "other", label: "非武器技能" },
  DebuffDamage: { channel: "other", label: "持续伤害" },
  IndirectDamage: { channel: "other", label: "间接伤害" },
} as const;

type SettlementType = keyof typeof SETTLEMENT_TYPES;

export type WeaponBaseDamageChannel =
  (typeof SETTLEMENT_TYPES)[SettlementType]["channel"];

export type WeaponBaseDamageModeData = {
  order: number;
  coefficient: number;
  baseAttack: number;
  baseDamage: number;
  settlementType: SettlementType;
  channel: WeaponBaseDamageChannel;
  channelLabel: string;
  sourceTypeLabel: string;
  element: ElementType;
  enableCritical: boolean;
  enableWeakness: boolean;
  weaknessMultiplier: number;
  href: string;
};

export type WeaponBaseDamageEntry = {
  id: string;
  weaponTitle: string;
  sourceName: string;
  displayName: string;
  modes: Partial<Record<NumericalTable, WeaponBaseDamageModeData>>;
};

export type WeaponBaseDamageFilters = {
  query: string;
  channel: "all" | WeaponBaseDamageChannel;
  element: "all" | ElementType;
};

export type VisibleWeaponBaseDamageEntry = {
  entry: WeaponBaseDamageEntry;
  mode: WeaponBaseDamageModeData;
};

export class WeaponBaseDamageIndexError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WeaponBaseDamageIndexError";
  }
}

function requireField<T>(
  weapon: ResolvedWeapon,
  source: ResolvedDamageSource,
  label: string,
  value: T | undefined,
): T {
  if (value !== undefined) return value;
  throw new WeaponBaseDamageIndexError(
    `${weapon.slug}:${source.id} 缺少可展示的${label}`,
  );
}

function getSettlementType(
  weapon: ResolvedWeapon,
  source: ResolvedDamageSource,
): SettlementType {
  const type = getResolvedFieldValue(source.health.type);
  if (!type || !(type in SETTLEMENT_TYPES)) {
    throw new WeaponBaseDamageIndexError(
      `${weapon.slug}:${source.id} 的生命伤害 Settlement 无法归类`,
    );
  }
  return type as Extract<WeaponHealthSettlementType, SettlementType>;
}

function getBaseAttack(table: NumericalTable): number {
  const mode = BASE_DAMAGE_DATA.modes.find((item) => item.id === table);
  if (!mode) {
    throw new WeaponBaseDamageIndexError(`未配置 ${table} 模式基础攻击力`);
  }
  return mode.baseAttack;
}

function modeHref(
  slug: string,
  sourceId: string,
  table: NumericalTable,
): string {
  const modePath = table === "td" ? "/td" : "";
  return `/weapons${modePath}/${encodeURIComponent(slug)}#damage-source-${encodeURIComponent(sourceId)}`;
}

export function buildWeaponBaseDamageIndex(
  weaponsByMode: Readonly<Record<NumericalTable, readonly ResolvedWeapon[]>>,
): readonly WeaponBaseDamageEntry[] {
  const entries: WeaponBaseDamageEntry[] = [];
  const entriesById = new Map<string, WeaponBaseDamageEntry>();

  for (const table of ["lc", "td"] as const) {
    const baseAttack = getBaseAttack(table);
    let sourceOrder = 0;
    for (const weapon of weaponsByMode[table]) {
      if (weapon.useType === "近战武器") continue;
      for (const source of weapon.damageSources) {
        const coefficient = getResolvedFieldValue(source.damage.base);
        if (coefficient === undefined) continue;

        const id = `${weapon.slug}:${source.id}`;
        const settlementType = getSettlementType(weapon, source);
        const settlement = SETTLEMENT_TYPES[settlementType];
        const modeData: WeaponBaseDamageModeData = {
          order: sourceOrder,
          coefficient,
          baseAttack,
          baseDamage: coefficient * baseAttack,
          settlementType,
          channel: settlement.channel,
          channelLabel:
            settlement.channel === "other" ? "其他" : settlement.label,
          sourceTypeLabel: settlement.label,
          element: requireField(
            weapon,
            source,
            "元素类型",
            getResolvedFieldValue(source.element),
          ),
          enableCritical: requireField(
            weapon,
            source,
            "暴击许可",
            getResolvedFieldValue(source.enableCritical),
          ),
          enableWeakness: requireField(
            weapon,
            source,
            "弱点许可",
            getResolvedFieldValue(source.enableWeakness),
          ),
          weaknessMultiplier: requireField(
            weapon,
            source,
            "弱点倍率",
            getResolvedFieldValue(source.weaknessMultiplier),
          ),
          href: modeHref(weapon.slug, source.id, table),
        };
        sourceOrder += 1;

        const existing = entriesById.get(id);
        if (existing) {
          if (
            existing.weaponTitle !== weapon.title ||
            existing.sourceName !== source.name
          ) {
            throw new WeaponBaseDamageIndexError(`${id} 的跨模式身份不一致`);
          }
          existing.modes[table] = modeData;
          continue;
        }

        const entry: WeaponBaseDamageEntry = {
          id,
          weaponTitle: weapon.title,
          sourceName: source.name,
          displayName: `${weapon.title} ${source.name}`,
          modes: { [table]: modeData },
        };
        entries.push(entry);
        entriesById.set(id, entry);
      }
    }
  }

  return entries;
}

export function filterWeaponBaseDamageEntries(
  entries: readonly WeaponBaseDamageEntry[],
  mode: NumericalTable,
  filters: WeaponBaseDamageFilters,
): readonly VisibleWeaponBaseDamageEntry[] {
  const normalizedQuery = filters.query.trim().toLocaleLowerCase("zh-CN");

  return entries
    .flatMap((entry): VisibleWeaponBaseDamageEntry[] => {
      const modeData = entry.modes[mode];
      if (!modeData) return [];
      if (filters.channel !== "all" && modeData.channel !== filters.channel) {
        return [];
      }
      if (filters.element !== "all" && modeData.element !== filters.element) {
        return [];
      }
      if (
        normalizedQuery &&
        !entry.displayName.toLocaleLowerCase("zh-CN").includes(normalizedQuery)
      ) {
        return [];
      }
      return [{ entry, mode: modeData }];
    })
    .sort((left, right) => left.mode.order - right.mode.order);
}
