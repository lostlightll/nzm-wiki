"use client";

import { useState } from "react";
import Image from "next/image";
import type { Weapon, WeaponType, ElementType, Rarity } from "@/types";
import { useSelection } from "@/hooks/useSelection";
import { FilterSection } from "@/components/Filter";
import { getAssetPath } from "@/lib/path";
import {
  WEAPON_TYPES,
  ELEMENT_TYPES,
  RARITY_OPTIONS,
  ELEMENT_COLORS,
  STAT_FIELDS,
} from "@/constants/weapons";
import { RARITY_KEY_MAP, RARITY_CARD_STYLES } from "@/constants/common";

// 元素类型图标路径
const ELEMENT_ICONS: Record<ElementType, string> = {
  火焰: "/icons/elements/fire.png",
  寒冷: "/icons/elements/cryo.png",
  电弧: "/icons/elements/shock.png",
  腐蚀: "/icons/elements/corossive.png",
  物理: "/icons/elements/kinetic.png",
};

function WeaponImage({ name }: { name: string }) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return null;
  }

  return (
    <div className="relative mb-3 h-32 w-full">
      <Image
        src={getAssetPath(`/icons/weapons/normal/${name}.png`)}
        alt={name}
        width={320}
        height={160}
        className="mx-auto object-contain"
        onError={() => setHasError(true)}
      />
    </div>
  );
}

function WeaponCard({ weapon }: { weapon: Weapon }) {
  const rarityKey = RARITY_KEY_MAP[weapon.rarity] || "common";
  const rarityStyle = RARITY_CARD_STYLES[rarityKey];
  const elementIcon = ELEMENT_ICONS[weapon.elementType];

  return (
    <div className={`relative rounded-lg border-2 ${rarityStyle.border} ${rarityStyle.bg} p-4`}>
      {elementIcon && (
        <div className="absolute right-3 top-3 z-10">
          <Image src={getAssetPath(elementIcon)} alt={weapon.elementType} width={24} height={24} />
        </div>
      )}

      <div className="mb-2">
        <h3 className="text-lg font-semibold text-white">{weapon.name}</h3>
      </div>

      <div className="mb-3 text-sm">
        <span className="text-zinc-400">
          {[weapon.type, weapon.scope, ...weapon.tags].filter(Boolean).join(" | ")}
        </span>
      </div>

      {weapon.name && <WeaponImage name={weapon.name} />}

      <div className="grid grid-cols-2 gap-2 text-sm">
        {STAT_FIELDS.map(({ label, key, suffix }) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-zinc-400">{label}</span>
            <span className="text-white">
              {weapon.stats[key]}
              {suffix}
            </span>
          </div>
        ))}
      </div>

      {weapon.description && (
        <p className="mt-3 text-sm text-zinc-500">{weapon.description}</p>
      )}
    </div>
  );
}

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
