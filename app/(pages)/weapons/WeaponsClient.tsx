"use client";

import type { Weapon, WeaponType, ElementType, Rarity } from "@/types";
import { useSelection } from "@/hooks/useSelection";
import {
  WEAPON_TYPES,
  ELEMENT_TYPES,
  RARITY_TYPES,
  RARITY_COLORS,
  ELEMENT_COLORS,
  STAT_FIELDS,
} from "@/constants/weapons";

function FilterCheckbox({
  label,
  icon,
  checked,
  onChange,
  colorClass,
}: {
  label: string;
  icon?: string;
  checked: boolean;
  onChange: () => void;
  colorClass?: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center justify-between rounded border px-3 py-2 transition-colors ${
        checked
          ? "border-zinc-500 bg-zinc-700"
          : "border-zinc-700 bg-zinc-800 hover:border-zinc-600"
      }`}
    >
      <span
        className={`flex items-center gap-2 ${colorClass || "text-zinc-300"}`}
      >
        {icon && <span>{icon}</span>}
        <span>{label}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className={`h-4 w-4 appearance-none rounded border ${
          checked
            ? "border-zinc-400 bg-zinc-500"
            : "border-zinc-500 bg-zinc-700"
        }`}
      />
    </label>
  );
}

interface FilterSectionProps<T extends string> {
  title: string;
  items: { type: T; icon?: string; color?: string }[];
  selected: Set<T>;
  onToggle: (item: T) => void;
  gridClass?: string;
}

function FilterSection<T extends string>({
  title,
  items,
  selected,
  onToggle,
  gridClass = "grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6",
}: FilterSectionProps<T>) {
  return (
    <div className="mb-6">
      <h2 className="mb-3 text-lg font-semibold text-zinc-300">{title}</h2>
      <div className={gridClass}>
        {items.map((item) => (
          <FilterCheckbox
            key={item.type}
            label={item.type}
            icon={item.icon}
            checked={selected.has(item.type)}
            onChange={() => onToggle(item.type)}
            colorClass={item.color}
          />
        ))}
      </div>
    </div>
  );
}

function WeaponCard({ weapon }: { weapon: Weapon }) {
  const rarityColor = RARITY_COLORS[weapon.rarity] || "bg-gray-500";
  const elementColor = ELEMENT_COLORS[weapon.elementType] || "text-gray-300";

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">{weapon.name}</h3>
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium text-white ${rarityColor}`}
        >
          {weapon.rarity}
        </span>
      </div>

      <div className="mb-3 flex gap-2 text-sm">
        <span className="text-zinc-400">{weapon.type}</span>
        <span className={elementColor}>{weapon.elementType}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        {STAT_FIELDS.map(({ label, key, suffix }) => (
          <div key={key} className="flex justify-between">
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
          items={RARITY_TYPES}
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
        {filteredWeapons.map((weapon) => (
          <WeaponCard key={weapon.id} weapon={weapon} />
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
