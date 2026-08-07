"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { getAssetPath } from "@/lib/path";
import { getShanghaiDateKey } from "@/lib/date-key";
import { isPerkRecent } from "@/lib/perk-release";
import { restoreCatalogNavigation } from "@/lib/catalog-navigation";
import type { Perk, PerkSlot, Rarity } from "@/types";
import { useSelection } from "@/hooks/useSelection";
import { FilterSection } from "@/components/Filter";
import { PerkHoverPreview } from "@/components/PerkHoverPreview";
import { MultiplierSourceBadges } from "@/components/MultiplierBadges";
import {
  matchesWeaponApplicability,
  WeaponApplicabilityFilterSection,
  type WeaponApplicabilityFilter,
} from "@/components/WeaponApplicabilityFilter";
import {
  RARITY_KEY_MAP,
  RARITY_CARD_STYLES,
  RARITY_NUM_MAP,
  SLOT_OPTIONS,
  RARITY_OPTIONS,
} from "@/constants/perks";

type QuickFilter = "online" | "recent" | "offline" | "super";

const BASE_QUICK_FILTER_OPTIONS: {
  type: QuickFilter;
  label: string;
}[] = [
  { type: "online", label: "已上线" },
  { type: "offline", label: "未上线" },
  { type: "super", label: "超级插件" },
];

const RECENT_QUICK_FILTER_OPTION = {
  type: "recent" as const,
  label: "近期上线",
  highlighted: true,
};

const SUPER_PERK_NAMES = new Set([
  "切换手法",
  "技能魔术",
  "永动核心",
  "哑枪",
  "弱肉强食",
  "我只射击",
  "暴走永动",
  "武器穿透",
  "物法兼得",
  "不死狂热",
  "反弹转化",
  "弹道过载",
  "狂战",
  "狂暴连击",
  "狂轰乱炸",
  "致命爆炸",
  "连发",
]);

const DEFAULT_RARITIES: Rarity[] = ["传说"];
const DEFAULT_QUICK_FILTER: QuickFilter[] = ["online"];

const FILTER_STORAGE_KEYS = {
  slot: "perk-slot",
  rarity: "perk-rarity",
  quickFilter: "perk-availability",
  weaponApplicability: "perk-weapon-applicability",
} as const;

function PerkCard({ perk }: { perk: Perk }) {
  // 处理数字或字符串格式的稀有度
  const rarityStr =
    typeof perk.rarity === "number"
      ? RARITY_NUM_MAP[perk.rarity] || "普通"
      : perk.rarity;
  const rarityKey = RARITY_KEY_MAP[rarityStr] || "common";
  const rarityStyle = RARITY_CARD_STYLES[rarityKey];
  const href = `/perks/${perk.slug.split("/").map(encodeURIComponent).join("/")}`;

  return (
    <div className="min-w-0">
      <PerkHoverPreview perk={perk} href={href}>
        <div
          className={`flex flex-col items-center rounded-lg border-2 ${rarityStyle.border} ${rarityStyle.bg} p-3 pb-4 transition-transform duration-200 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100`}
        >
          {perk.icon ? (
            <Image
              src={getAssetPath(`/icons/perks/${perk.icon}.png`)}
              alt={perk.name}
              width={80}
              height={80}
              className="h-20 w-20 object-contain"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center bg-zinc-700 text-zinc-400">
              ?
            </div>
          )}
          <h3 className="mt-2 text-center text-sm font-medium leading-tight text-white">
            {perk.name}
          </h3>
        </div>
      </PerkHoverPreview>
      <MultiplierSourceBadges
        source={{
          type: "perk",
          slot: perk.slot,
          slug: perk.slug.split("/").at(-1) ?? perk.name,
        }}
        className="mt-1.5 justify-center"
      />
    </div>
  );
}

interface PerksPageClientProps {
  initialPerks: Perk[];
  initialDateKey: string;
}

function useShanghaiDateKey(initialDateKey: string) {
  const [dateKey, setDateKey] = useState(initialDateKey);

  useEffect(() => {
    const updateDateKey = () => setDateKey(getShanghaiDateKey());
    const initialUpdate = window.setTimeout(updateDateKey, 0);
    const interval = window.setInterval(updateDateKey, 60_000);
    return () => {
      window.clearTimeout(initialUpdate);
      window.clearInterval(interval);
    };
  }, []);

  return dateKey;
}

export default function PerksPageClient({
  initialPerks,
  initialDateKey,
}: PerksPageClientProps) {
  useEffect(() => {
    restoreCatalogNavigation();
  }, []);

  const todayKey = useShanghaiDateKey(initialDateKey);
  const slotState = useSelection<PerkSlot>(
    FILTER_STORAGE_KEYS.slot,
    undefined,
    Number as (v: string) => PerkSlot,
  );
  const rarityState = useSelection<Rarity>(
    FILTER_STORAGE_KEYS.rarity,
    DEFAULT_RARITIES,
  );
  const quickFilterState = useSelection<QuickFilter>(
    FILTER_STORAGE_KEYS.quickFilter,
    DEFAULT_QUICK_FILTER,
  );
  const quickFilterSelected = quickFilterState.selected;
  const selectQuickFilterOnly = quickFilterState.selectOnly;
  const weaponApplicabilityState = useSelection<WeaponApplicabilityFilter>(
    FILTER_STORAGE_KEYS.weaponApplicability,
  );

  const recentPerkCount = useMemo(
    () => initialPerks.filter((perk) => isPerkRecent(perk, todayKey)).length,
    [initialPerks, todayKey],
  );
  const quickFilterOptions = useMemo(
    () =>
      recentPerkCount > 0
        ? [
            BASE_QUICK_FILTER_OPTIONS[0],
            BASE_QUICK_FILTER_OPTIONS[1],
            RECENT_QUICK_FILTER_OPTION,
            BASE_QUICK_FILTER_OPTIONS[2],
          ]
        : BASE_QUICK_FILTER_OPTIONS,
    [recentPerkCount],
  );
  const effectiveQuickFilter = useMemo(() => {
    if (
      recentPerkCount === 0 &&
      quickFilterSelected.has("recent")
    ) {
      return new Set<QuickFilter>(["online"]);
    }
    return quickFilterSelected;
  }, [quickFilterSelected, recentPerkCount]);

  useEffect(() => {
    if (
      recentPerkCount === 0 &&
      quickFilterSelected.has("recent")
    ) {
      selectQuickFilterOnly("online");
    }
  }, [quickFilterSelected, recentPerkCount, selectQuickFilterOnly]);

  const filteredPerks = useMemo(() => {
    return initialPerks.filter((perk) => {
      const slotMatch =
        slotState.selected.size === 0 || slotState.selected.has(perk.slot);
      // 处理数字或字符串格式的稀有度
      const perkRarity =
        typeof perk.rarity === "number"
          ? RARITY_NUM_MAP[perk.rarity]
          : perk.rarity;
      const rarityMatch =
        rarityState.selected.size === 0 || rarityState.selected.has(perkRarity);
      const availability = perk.collectModItem === 1 ? "online" : "offline";
      const quickFilterMatch =
        effectiveQuickFilter.size === 0 ||
        effectiveQuickFilter.has(availability) ||
        (effectiveQuickFilter.has("recent") && isPerkRecent(perk, todayKey)) ||
        (effectiveQuickFilter.has("super") && SUPER_PERK_NAMES.has(perk.name));
      const weaponApplicabilityMatch = matchesWeaponApplicability(
        weaponApplicabilityState.selected,
        perk.weaponType,
        (perk.weaponNames?.length ?? 0) > 0,
      );
      return (
        slotMatch &&
        rarityMatch &&
        quickFilterMatch &&
        weaponApplicabilityMatch
      );
    });
  }, [
    effectiveQuickFilter,
    initialPerks,
    rarityState.selected,
    slotState.selected,
    todayKey,
    weaponApplicabilityState.selected,
  ]);

  const groupedBySlot = useMemo(() => {
    const groups: Record<PerkSlot, Perk[]> = { 1: [], 2: [], 3: [], 4: [] };
    for (const perk of filteredPerks) {
      groups[perk.slot].push(perk);
    }
    return groups;
  }, [filteredPerks]);

  const showGrouped = slotState.selected.size === 0;

  return (
    <>
      <h1 className="mb-8 text-3xl font-bold text-white">插件图鉴</h1>

      {/* Filter section */}
      <div className="mb-8 rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
        <FilterSection
          title="稀有度"
          items={RARITY_OPTIONS}
          selected={rarityState.selected}
          onToggle={rarityState.toggle}
          gridClass="grid max-w-md grid-cols-3 gap-2"
          centerClass="justify-center"
        />

        <FilterSection
          title="插件槽位"
          items={SLOT_OPTIONS}
          selected={slotState.selected}
          onToggle={slotState.toggle}
          gridClass="grid grid-cols-2 gap-2 sm:grid-cols-4"
          centerClass="justify-center"
        />

        <WeaponApplicabilityFilterSection
          selected={weaponApplicabilityState.selected}
          onToggle={weaponApplicabilityState.toggle}
        />

        <FilterSection
          title="快速筛选"
          items={quickFilterOptions}
          selected={quickFilterSelected}
          onToggle={(quickFilter) =>
            selectQuickFilterOnly(
              quickFilterSelected.has(quickFilter)
                ? undefined
                : quickFilter,
            )
          }
          gridClass={
            recentPerkCount > 0
              ? "grid max-w-2xl grid-cols-2 gap-2 sm:grid-cols-4"
              : "grid max-w-lg grid-cols-3 gap-2"
          }
          centerClass="justify-center"
        />
      </div>

      <p className="mb-4 text-sm text-zinc-500">
        插件总数 {filteredPerks.length}
      </p>

      {showGrouped ? (
        ([1, 2, 3, 4] as PerkSlot[]).map((slot) => {
          const slotPerks = groupedBySlot[slot];
          if (slotPerks.length === 0) return null;

          return (
            <section key={slot} className="mb-10">
              <div className="mb-4 flex items-center gap-3">
                <h2 className="text-xl font-semibold text-zinc-300">
                  {slot}号槽位
                </h2>
                <span className="text-sm text-zinc-500">
                  ({slotPerks.length}个)
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
                {slotPerks.map((perk, index) => (
                  <PerkCard
                    key={perk.id || `${perk.name}-${index}`}
                    perk={perk}
                  />
                ))}
              </div>
            </section>
          );
        })
      ) : (
        <section>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
            {filteredPerks.map((perk, index) => (
              <PerkCard key={perk.id || `${perk.name}-${index}`} perk={perk} />
            ))}
          </div>
        </section>
      )}

      {filteredPerks.length === 0 && (
        <div className="py-16 text-center text-zinc-500">
          没有符合条件的插件
        </div>
      )}
    </>
  );
}
