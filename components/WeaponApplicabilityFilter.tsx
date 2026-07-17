"use client";

import { Crosshair, LockKeyhole } from "lucide-react";
import { FilterSection } from "@/components/Filter";
import { WEAPON_TYPES, WEAPON_TYPE_ID_MAP } from "@/constants/weapons";
import type { WeaponType } from "@/types";

const UNIVERSAL_WEAPONS_FILTER = "全部武器类型" as const;
const EXCLUSIVE_WEAPONS_FILTER = "专属插件" as const;

export type WeaponApplicabilityFilter =
  | WeaponType
  | typeof UNIVERSAL_WEAPONS_FILTER
  | typeof EXCLUSIVE_WEAPONS_FILTER;

const WEAPON_APPLICABILITY_OPTIONS = [
  {
    type: UNIVERSAL_WEAPONS_FILTER,
    label: "通用插件",
    icon: <Crosshair aria-hidden="true" className="h-5 w-5" />,
  },
  {
    type: EXCLUSIVE_WEAPONS_FILTER,
    label: EXCLUSIVE_WEAPONS_FILTER,
    icon: <LockKeyhole aria-hidden="true" className="h-5 w-5" />,
  },
  ...WEAPON_TYPES,
];

export function matchesWeaponApplicability(
  selected: ReadonlySet<WeaponApplicabilityFilter>,
  weaponTypeIds: readonly number[] | undefined,
  isExclusive: boolean,
) {
  if (selected.size === 0) return true;

  const appliesToAllWeapons = (weaponTypeIds?.length ?? 0) === 0 && !isExclusive;

  for (const filter of selected) {
    if (filter === UNIVERSAL_WEAPONS_FILTER && appliesToAllWeapons) return true;
    if (filter === EXCLUSIVE_WEAPONS_FILTER && isExclusive) return true;
    if (
      weaponTypeIds?.some((id) => WEAPON_TYPE_ID_MAP[id] === filter)
    ) {
      return true;
    }
  }

  return false;
}

export function WeaponApplicabilityFilterSection({
  selected,
  onToggle,
}: {
  selected: Set<WeaponApplicabilityFilter>;
  onToggle: (filter: WeaponApplicabilityFilter) => void;
}) {
  return (
    <FilterSection
      title="武器类型"
      items={WEAPON_APPLICABILITY_OPTIONS}
      selected={selected}
      onToggle={onToggle}
      centerClass="sm:justify-center"
    />
  );
}
