"use client";

import { useState } from "react";
import type { Weapon, WeaponType, ElementType, Rarity } from "@/types";

const WEAPON_TYPES: { type: WeaponType; icon: string }[] = [
  { type: "突击步枪", icon: "🔫" },
  { type: "狙击步枪", icon: "🎯" },
  { type: "霰弹枪", icon: "💥" },
  { type: "火箭发射器", icon: "🚀" },
  { type: "冲锋枪", icon: "⚡" },
  { type: "机枪", icon: "🔥" },
  { type: "手枪", icon: "🔫" },
  { type: "单发榴弹", icon: "💣" },
  { type: "弓箭", icon: "🏹" },
  { type: "射手步枪", icon: "🎯" },
  { type: "连发榴弹", icon: "💣" },
  { type: "喷火器", icon: "🔥" },
];

const ELEMENT_TYPES: { type: ElementType; icon: string; color: string }[] = [
  { type: "火焰", icon: "🔥", color: "text-orange-400" },
  { type: "寒冷", icon: "❄️", color: "text-cyan-400" },
  { type: "电弧", icon: "⚡", color: "text-yellow-400" },
  { type: "腐蚀", icon: "☣️", color: "text-green-400" },
  { type: "物理", icon: "✧", color: "text-gray-300" },
];

const RARITY_TYPES: { type: Rarity; color: string }[] = [
  { type: "稀有", color: "text-[#578caf]" },
  { type: "史诗", color: "text-[#ac69b6]" },
  { type: "传说", color: "text-[#d0ab67]" },
];

const RARITY_COLORS: Record<string, string> = {
  普通: "bg-gray-500",
  稀有: "bg-blue-500",
  史诗: "bg-purple-500",
  传说: "bg-orange-500",
};

const ELEMENT_COLORS: Record<string, string> = {
  物理: "text-gray-300",
  火焰: "text-orange-400",
  寒冷: "text-cyan-400",
  电弧: "text-yellow-400",
  腐蚀: "text-green-400",
};

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
      <span className={`flex items-center gap-2 ${colorClass || "text-zinc-300"}`}>
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
        <div className="flex justify-between">
          <span className="text-zinc-400">单发伤害</span>
          <span className="text-white">{weapon.stats.damage}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-400">射速</span>
          <span className="text-white">{weapon.stats.fireRate}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-400">弹夹</span>
          <span className="text-white">{weapon.stats.magazine}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-400">总弹量</span>
          <span className="text-white">{weapon.stats.totalAmmo}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-400">精准度</span>
          <span className="text-white">{weapon.stats.accuracy}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-400">稳定度</span>
          <span className="text-white">{weapon.stats.stability}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-400">弱点倍率</span>
          <span className="text-white">{weapon.stats.weaknessMultiplier}x</span>
        </div>
      </div>

      {weapon.description && (
        <p className="mt-3 text-sm text-zinc-500">{weapon.description}</p>
      )}
    </div>
  );
}

export default function WeaponsClient({ weapons }: { weapons: Weapon[] }) {
  const [selectedTypes, setSelectedTypes] = useState<Set<WeaponType>>(new Set());
  const [selectedElements, setSelectedElements] = useState<Set<ElementType>>(new Set());
  const [selectedRarities, setSelectedRarities] = useState<Set<Rarity>>(new Set());

  const toggleType = (type: WeaponType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const toggleElement = (element: ElementType) => {
    setSelectedElements((prev) => {
      const next = new Set(prev);
      if (next.has(element)) {
        next.delete(element);
      } else {
        next.add(element);
      }
      return next;
    });
  };

  const toggleRarity = (rarity: Rarity) => {
    setSelectedRarities((prev) => {
      const next = new Set(prev);
      if (next.has(rarity)) {
        next.delete(rarity);
      } else {
        next.add(rarity);
      }
      return next;
    });
  };

  const filteredWeapons = weapons.filter((weapon) => {
    const typeMatch = selectedTypes.size === 0 || selectedTypes.has(weapon.type);
    const elementMatch =
      selectedElements.size === 0 || selectedElements.has(weapon.elementType);
    const rarityMatch =
      selectedRarities.size === 0 || selectedRarities.has(weapon.rarity);
    return typeMatch && elementMatch && rarityMatch;
  });

  return (
    <>
      <h1 className="mb-8 text-3xl font-bold text-white">武器列表</h1>

      {/* 筛选区域 */}
      <div className="mb-8 rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
          {/* 稀有度筛选 */}
          <div className="mb-6">
            <h2 className="mb-3 text-lg font-semibold text-zinc-300">稀有度</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {RARITY_TYPES.map(({ type, color }) => (
                <FilterCheckbox
                  key={type}
                  label={type}
                  checked={selectedRarities.has(type)}
                  onChange={() => toggleRarity(type)}
                  colorClass={color}
                />
              ))}
            </div>
          </div>

          {/* 武器类型筛选 */}
          <div className="mb-6">
            <h2 className="mb-3 text-lg font-semibold text-zinc-300">武器类型</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {WEAPON_TYPES.map(({ type, icon }) => (
                <FilterCheckbox
                  key={type}
                  label={type}
                  icon={icon}
                  checked={selectedTypes.has(type)}
                  onChange={() => toggleType(type)}
                />
              ))}
            </div>
          </div>

          {/* 元素类型筛选 */}
          <div>
            <h2 className="mb-3 text-lg font-semibold text-zinc-300">元素类型</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
              {ELEMENT_TYPES.map(({ type, icon, color }) => (
                <FilterCheckbox
                  key={type}
                  label={type}
                  icon={icon}
                  checked={selectedElements.has(type)}
                  onChange={() => toggleElement(type)}
                  colorClass={color}
                />
              ))}
            </div>
          </div>
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
