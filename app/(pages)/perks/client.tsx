"use client";

import { useMemo } from "react";
import type { Perk, PerkSlot, Rarity } from "@/types";
import { useSelection } from "@/hooks/useSelection";
import { FilterSection } from "@/components/Filter";
import {
  RARITY_KEY_MAP,
  RARITY_CARD_STYLES,
  SLOT_OPTIONS,
  RARITY_OPTIONS,
} from "@/constants/perks";

function PerkCard({ perk }: { perk: Perk }) {
  const rarityKey = RARITY_KEY_MAP[perk.rarity];
  const rarityStyle = RARITY_CARD_STYLES[rarityKey];

  return (
    <div
      className={`rounded-lg border-2 ${rarityStyle.border} ${rarityStyle.bg} p-3`}
    >
      <img
        src="https://placehold.co/64x64/374151/9ca3af?text=icon"
        alt={perk.name}
        className="mx-auto mb-2 h-16 w-16 rounded-lg border border-zinc-600"
      />
      <h3 className="text-center text-sm font-medium leading-tight text-white">
        {perk.name}
      </h3>
    </div>
  );
}

interface PerksPageClientProps {
  initialPerks: Perk[];
}

export default function PerksPageClient({
  initialPerks,
}: PerksPageClientProps) {
  const slotState = useSelection<PerkSlot>();
  const rarityState = useSelection<Rarity>();

  const filteredPerks = useMemo(() => {
    return initialPerks.filter((perk) => {
      const slotMatch =
        slotState.selected.size === 0 || slotState.selected.has(perk.slot);
      const rarityMatch =
        rarityState.selected.size === 0 ||
        rarityState.selected.has(perk.rarity);
      return slotMatch && rarityMatch;
    });
  }, [initialPerks, slotState.selected, rarityState.selected]);

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
              <div
                className="grid gap-3"
                style={{
                  gridTemplateColumns: "repeat(auto-fill, minmax(128px, 128px))",
                }}
              >
                {slotPerks.map((perk) => (
                  <PerkCard key={perk.id} perk={perk} />
                ))}
              </div>
            </section>
          );
        })
      ) : (
        <section>
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(128px, 128px))",
            }}
          >
            {filteredPerks.map((perk) => (
              <PerkCard key={perk.id} perk={perk} />
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
