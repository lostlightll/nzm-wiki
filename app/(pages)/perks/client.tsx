"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { getAssetPath } from "@/lib/path";
import type { Perk, PerkSlot, Rarity } from "@/types";
import { useSelection } from "@/hooks/useSelection";
import { FilterSection } from "@/components/Filter";
import {
  RARITY_KEY_MAP,
  RARITY_CARD_STYLES,
  RARITY_NUM_MAP,
  SLOT_OPTIONS,
  RARITY_OPTIONS,
} from "@/constants/perks";

type AvailabilityFilter = "online" | "offline";

const AVAILABILITY_OPTIONS: { type: AvailabilityFilter; label: string }[] = [
  { type: "online", label: "已上线" },
  { type: "offline", label: "未上线" },
];

function PerkCard({ perk }: { perk: Perk }) {
  // 处理数字或字符串格式的稀有度
  const rarityStr =
    typeof perk.rarity === "number"
      ? RARITY_NUM_MAP[perk.rarity] || "普通"
      : perk.rarity;
  const rarityKey = RARITY_KEY_MAP[rarityStr] || "common";
  const rarityStyle = RARITY_CARD_STYLES[rarityKey];

  return (
    <Link href={`/perks/${perk.slug.split("/").map(encodeURIComponent).join("/")}`}>
      <div
        className={`flex flex-col items-center rounded-lg border-2 ${rarityStyle.border} ${rarityStyle.bg} p-3 pb-4 transition-transform hover:scale-[1.05]`}
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
    </Link>
  );
}

interface PerksPageClientProps {
  initialPerks: Perk[];
}

export default function PerksPageClient({
  initialPerks,
}: PerksPageClientProps) {
  const slotState = useSelection<PerkSlot>(
    "slot",
    undefined,
    Number as (v: string) => PerkSlot,
  );
  const rarityState = useSelection<Rarity>("rarity");
  const availabilityState = useSelection<AvailabilityFilter>("availability");

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
      const availabilityMatch =
        availabilityState.selected.size === 0 ||
        availabilityState.selected.has(availability);
      return slotMatch && rarityMatch && availabilityMatch;
    });
  }, [
    availabilityState.selected,
    initialPerks,
    rarityState.selected,
    slotState.selected,
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
        />

        <FilterSection
          title="插件槽位"
          items={SLOT_OPTIONS}
          selected={slotState.selected}
          onToggle={slotState.toggle}
          gridClass="grid grid-cols-2 gap-2 sm:grid-cols-4"
        />

        <FilterSection
          title="上线状态"
          items={AVAILABILITY_OPTIONS}
          selected={availabilityState.selected}
          onToggle={(availability) =>
            availabilityState.selectOnly(
              availabilityState.selected.has(availability)
                ? undefined
                : availability,
            )
          }
          gridClass="grid max-w-sm grid-cols-2 gap-2"
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
