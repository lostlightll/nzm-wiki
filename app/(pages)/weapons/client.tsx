"use client";

import type { Weapon, WeaponType, ElementType, Rarity } from "@/types";
import { useSelection } from "@/hooks/useSelection";
import { FilterSection } from "@/components/Filter";
import { WeaponCard } from "@/components/WeaponCard";
import {
  WEAPON_TYPES,
  ELEMENT_TYPES,
  RARITY_OPTIONS,
} from "@/constants/weapons";

export default function WeaponsClient({ weapons }: { weapons: Weapon[] }) {
  const typeState = useSelection<WeaponType>();
  const elementState = useSelection<ElementType>();
  const rarityState = useSelection<Rarity>();

  const filteredWeapons = weapons.filter((weapon) => {
    const typeMatch =
      typeState.selected.size === 0 || typeState.selected.has(weapon.type);
    const elementMatch =
      elementState.selected.size === 0 ||
      elementState.selected.has(weapon.elementType);
    const rarityMatch =
      rarityState.selected.size === 0 ||
      rarityState.selected.has(weapon.rarity);
    return typeMatch && elementMatch && rarityMatch;
  });

  return (
    <>
      <h1 className="mb-8 text-3xl font-bold text-white">武器列表</h1>

      {/* 筛选区域 */}
      <div className="mb-8 rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
        <FilterSection
          title="稀有度"
          items={RARITY_OPTIONS}
          selected={rarityState.selected}
          onToggle={rarityState.toggle}
        />

        <FilterSection
          title="武器类型"
          items={WEAPON_TYPES}
          selected={typeState.selected}
          onToggle={typeState.toggle}
        />

        <FilterSection
          title="元素类型"
          items={ELEMENT_TYPES}
          selected={elementState.selected}
          onToggle={elementState.toggle}
          gridClass="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5"
        />
      </div>

      {/* 结果统计 */}
      <p className="mb-4 text-sm text-zinc-500">
        共 {filteredWeapons.length} 件武器
      </p>

      {/* 武器列表 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredWeapons.map((weapon, index) => (
          <WeaponCard key={weapon.id || `${weapon.name}-${index}`} weapon={weapon} />
        ))}
      </div>

      {filteredWeapons.length === 0 && (
        <div className="py-16 text-center text-zinc-500">
          没有符合条件的武器
        </div>
      )}
    </>
  );
}
