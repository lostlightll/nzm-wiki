"use client";

import { useState } from "react";
import type { Weapon, WeaponType, ElementType, Rarity } from "@/types";
import { useSelection } from "@/hooks/useSelection";
import { FilterSection } from "@/components/Filter";
import { WeaponCard } from "@/components/WeaponCard";
import {
  WEAPON_TYPES,
  ELEMENT_TYPES,
  RARITY_OPTIONS,
  WEAPON_SLOTS,
  type WeaponSlot,
} from "@/constants/weapons";

export default function WeaponsClient({ weapons }: { weapons: Weapon[] }) {
  const [showDetails, setShowDetails] = useState(true);
  const slotState = useSelection<WeaponSlot>("slot", ["主武器"]);
  const typeState = useSelection<WeaponType>("type");
  const elementState = useSelection<ElementType>("element");
  const rarityState = useSelection<Rarity>("rarity", ["传说"]);

  const hasFilter =
    slotState.selected.size > 0 ||
    typeState.selected.size > 0 ||
    elementState.selected.size > 0 ||
    rarityState.selected.size > 0;

  const resetFilters = () => {
    slotState.clear();
    typeState.clear();
    elementState.clear();
    rarityState.clear();
  };

  const filteredWeapons = weapons.filter((weapon) => {
    const slotMatch =
      slotState.selected.size === 0 ||
      (weapon.use_type && slotState.selected.has(weapon.use_type as WeaponSlot));
    const typeMatch =
      typeState.selected.size === 0 ||
      (weapon.weapon_type && typeState.selected.has(weapon.weapon_type));
    const elementMatch =
      elementState.selected.size === 0 ||
      elementState.selected.has(weapon.element);
    const rarityMatch =
      rarityState.selected.size === 0 ||
      (weapon.rarity && rarityState.selected.has(weapon.rarity));
    return slotMatch && typeMatch && elementMatch && rarityMatch;
  });

  return (
    <>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">武器图鉴</h1>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-700"
        >
          {showDetails ? "简洁模式" : "详细模式"}
        </button>
      </div>

      {/* 筛选区域 */}
      <div className="mb-8 rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
        <FilterSection
          title="稀有度"
          items={RARITY_OPTIONS}
          selected={rarityState.selected}
          onToggle={rarityState.toggle}
          gridClass="grid grid-cols-3 gap-2 max-w-md"
        />

        <FilterSection
          title="武器槽位"
          items={WEAPON_SLOTS}
          selected={slotState.selected}
          onToggle={slotState.toggle}
          gridClass="grid grid-cols-3 gap-2 max-w-md"
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

        {hasFilter && (
          <button
            onClick={resetFilters}
            className="mt-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            重置筛选
          </button>
        )}
      </div>

      {/* 结果统计 */}
      <p className="mb-4 text-sm text-zinc-500">
        共 {filteredWeapons.length} 件武器
      </p>

      {/* 武器列表 */}
      <div className={`grid gap-5 ${showDetails ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"}`}>
        {filteredWeapons.map((weapon) => (
          <WeaponCard key={weapon.slug} weapon={weapon} showDetails={showDetails} />
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
