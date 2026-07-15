import { WEAPON_TYPE_ID_MAP } from "@/constants/weapons";
import type { WeaponType } from "@/types";

export function getPerkWeaponApplicability(
  weaponType?: number[],
  weaponNames?: string[],
) {
  const weaponTypeIds = weaponType ?? [];
  const applicableWeaponTypes = Array.from(
    new Set(
      weaponTypeIds
        .map((id) => WEAPON_TYPE_ID_MAP[id])
        .filter((type): type is WeaponType => type !== undefined),
    ),
  );
  const exclusiveWeaponNames = Array.from(
    new Set(
      (weaponNames ?? [])
        .map((weaponName) => weaponName.trim())
        .filter(Boolean),
    ),
  );

  return {
    applicableWeaponTypes,
    exclusiveWeaponNames,
    hasUnknownWeaponTypes:
      applicableWeaponTypes.length < weaponTypeIds.length,
    appliesToAllWeapons:
      weaponTypeIds.length === 0 && exclusiveWeaponNames.length === 0,
  };
}
