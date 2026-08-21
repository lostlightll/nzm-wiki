"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { WeaponType, ElementType, Rarity } from "@/types";
import { useSelection } from "@/hooks/useSelection";
import { FilterSection } from "@/components/Filter";
import { WeaponCard } from "@/components/WeaponCard";
import { WeaponMasonry } from "@/components/WeaponMasonry";
import { restoreCatalogNavigation } from "@/lib/catalog-navigation";
import {
  getResolvedFieldValue,
  type WeaponCatalogEntry,
} from "@/lib/weapon-consumers";
import {
  WEAPON_TYPES,
  ELEMENT_TYPES,
  RARITY_OPTIONS,
  WEAPON_SLOTS,
  type WeaponSlot,
} from "@/constants/weapons";

const DETAIL_COLUMN_QUERIES = [
  { query: "(min-width: 1280px)", columns: 3 },
  { query: "(min-width: 768px)", columns: 2 },
] as const;

const DEFAULT_WEAPON_SLOTS: WeaponSlot[] = ["主武器"];
const DEFAULT_RARITIES: Rarity[] = ["传说"];

function isWeaponSlot(value: string | undefined): value is WeaponSlot {
  return value === "主武器" || value === "副武器" || value === "近战武器";
}

function subscribeDetailColumns(onStoreChange: () => void) {
  const mediaQueries = DETAIL_COLUMN_QUERIES.map(({ query }) =>
    window.matchMedia(query),
  );

  mediaQueries.forEach((mediaQuery) =>
    mediaQuery.addEventListener("change", onStoreChange),
  );

  return () => {
    mediaQueries.forEach((mediaQuery) =>
      mediaQuery.removeEventListener("change", onStoreChange),
    );
  };
}

function getDetailColumnCount() {
  return (
    DETAIL_COLUMN_QUERIES.find(({ query }) => window.matchMedia(query).matches)
      ?.columns ?? 1
  );
}

function getServerDetailColumnCount() {
  return 1;
}

export default function WeaponsClient({
  weapons,
  tdWeapons,
}: {
  weapons: WeaponCatalogEntry[];
  tdWeapons: WeaponCatalogEntry[];
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const mode = searchParams.get("mode");
  const isTD = mode === "td";

  useEffect(() => {
    restoreCatalogNavigation();
  }, []);

  const [showDetails, setShowDetails] = useState(true);
  const detailColumnCount = useSyncExternalStore(
    subscribeDetailColumns,
    getDetailColumnCount,
    getServerDetailColumnCount,
  );
  const slotState = useSelection<WeaponSlot>("slot", DEFAULT_WEAPON_SLOTS);
  const typeState = useSelection<WeaponType>("type");
  const elementState = useSelection<ElementType>("element");
  const rarityState = useSelection<Rarity>("rarity", DEFAULT_RARITIES);
  const currentWeapons = isTD ? tdWeapons : weapons;

  const slotsByWeaponType = useMemo(() => {
    const slots = new Map<WeaponType, Set<WeaponSlot>>();

    for (const weapon of currentWeapons) {
      const weaponType = getResolvedFieldValue(weapon.weaponType);
      if (!weaponType || !isWeaponSlot(weapon.useType)) continue;

      const typeSlots = slots.get(weaponType) ?? new Set<WeaponSlot>();
      typeSlots.add(weapon.useType);
      slots.set(weaponType, typeSlots);
    }

    return slots;
  }, [currentWeapons]);

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

  const toggleWeaponType = (weaponType: WeaponType) => {
    const isSelecting = !typeState.selected.has(weaponType);
    const compatibleSlots = slotsByWeaponType.get(weaponType);
    const hasCompatibleSlot =
      compatibleSlots !== undefined &&
      [...slotState.selected].some((slot) => compatibleSlots.has(slot));

    if (
      isSelecting &&
      slotState.selected.size > 0 &&
      compatibleSlots?.size === 1 &&
      !hasCompatibleSlot
    ) {
      slotState.selectOnly(compatibleSlots.values().next().value);
    }

    typeState.toggle(weaponType);
  };

  const toggleMode = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (isTD) {
      params.delete("mode");
    } else {
      params.set("mode", "td");
    }
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const filteredWeapons = useMemo(
    () =>
      currentWeapons.filter((weapon) => {
        const weaponType = getResolvedFieldValue(weapon.weaponType);
        const element = getResolvedFieldValue(weapon.element);
        const rarity = getResolvedFieldValue(weapon.rarity);
        const slotMatch =
          slotState.selected.size === 0 ||
          (weapon.useType &&
            slotState.selected.has(weapon.useType as WeaponSlot));
        const typeMatch =
          typeState.selected.size === 0 ||
          (weaponType && typeState.selected.has(weaponType));
        const elementMatch =
          elementState.selected.size === 0 ||
          (element !== undefined && elementState.selected.has(element));
        const rarityMatch =
          rarityState.selected.size === 0 ||
          (rarity !== undefined && rarityState.selected.has(rarity));
        return slotMatch && typeMatch && elementMatch && rarityMatch;
      }),
    [
      elementState.selected,
      currentWeapons,
      rarityState.selected,
      slotState.selected,
      typeState.selected,
    ],
  );

  return (
    <>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold text-white">
            {isTD ? "塔防武器图鉴" : "武器图鉴"}
          </h1>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <button
            onClick={toggleMode}
            className="min-h-11 flex-1 rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-700 sm:flex-none"
          >
            {isTD ? "猎场模式" : "塔防模式"}
          </button>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="min-h-11 flex-1 rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-700 sm:flex-none"
          >
            {showDetails ? "简洁模式" : "详细模式"}
          </button>
        </div>
      </div>

      {/* 筛选区域 */}
      <div className="mb-8 rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
        <FilterSection
          title="稀有度"
          items={RARITY_OPTIONS.map((item) => ({
            ...item,
            colorOnlyWhenChecked: true,
          }))}
          selected={rarityState.selected}
          onToggle={rarityState.toggle}
          gridClass="grid grid-cols-3 gap-2 max-w-md"
          centerClass="justify-center"
        />

        <FilterSection
          title="武器槽位"
          items={WEAPON_SLOTS}
          selected={slotState.selected}
          onToggle={slotState.toggle}
          gridClass="grid grid-cols-3 gap-2 max-w-2xl"
          iconOnlyOnMobile
        />

        <FilterSection
          title="武器类型"
          items={WEAPON_TYPES}
          selected={typeState.selected}
          onToggle={toggleWeaponType}
          centerClass="sm:justify-center"
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
      {showDetails ? (
        <WeaponMasonry
          weapons={filteredWeapons}
          columnCount={detailColumnCount}
        />
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {filteredWeapons.map((weapon) => (
            <WeaponCard key={weapon.slug} weapon={weapon} />
          ))}
        </div>
      )}

      {filteredWeapons.length === 0 && (
        <div className="py-16 text-center text-zinc-500">
          没有符合条件的武器
        </div>
      )}
    </>
  );
}
