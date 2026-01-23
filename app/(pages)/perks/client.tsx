"use client";

import { useState, useMemo } from "react";
import type { Perk, PerkSlot, Rarity } from "@/types";

const RARITY_COLORS: Record<
  string,
  { border: string; bg: string; text: string }
> = {
  rare: {
    border: "border-blue-500",
    bg: "bg-blue-900/50",
    text: "text-blue-300",
  },
  epic: {
    border: "border-purple-500",
    bg: "bg-purple-900/50",
    text: "text-purple-300",
  },
  legendary: {
    border: "border-amber-400",
    bg: "bg-amber-900/50",
    text: "text-amber-300",
  },
};

const RARITY_MAP: Record<string, string> = {
  稀有: "rare",
  史诗: "epic",
  传说: "legendary",
};

const SLOT_OPTIONS: { slot: PerkSlot; label: string }[] = [
  { slot: 1, label: "1号槽位" },
  { slot: 2, label: "2号槽位" },
  { slot: 3, label: "3号槽位" },
  { slot: 4, label: "4号槽位" },
];

const RARITY_OPTIONS: { type: Rarity; color: string; label: string }[] = [
  { type: "稀有", color: "text-[#578caf]", label: "稀有" },
  { type: "史诗", color: "text-[#ac69b6]", label: "史诗" },
  { type: "传说", color: "text-[#d0ab67]", label: "传说" },
];

function FilterCheckbox({
  label,
  checked,
  onChange,
  colorClass,
}: {
  label: string;
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

function PerkCard({ perk }: { perk: Perk }) {
  const rarityKey = RARITY_MAP[perk.rarity] || "rare";
  const rarityStyle = RARITY_COLORS[rarityKey];

  return (
    <div
      className={`rounded-lg border-2 ${rarityStyle.border} ${rarityStyle.bg} p-3`}
    >
      {/* Icon placeholder */}
      <img
        src="https://placehold.co/64x64/374151/9ca3af?text=icon"
        alt={perk.name}
        className="mx-auto mb-2 h-16 w-16 rounded-lg border border-zinc-600"
      />

      {/* Name */}
      <h3 className="text-center text-sm font-medium text-white leading-tight">
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
  const [selectedSlots, setSelectedSlots] = useState<Set<PerkSlot>>(new Set());
  const [selectedRarities, setSelectedRarities] = useState<Set<Rarity>>(
    new Set(),
  );

  const toggleSlot = (slot: PerkSlot) => {
    setSelectedSlots((prev) => {
      const next = new Set(prev);
      if (next.has(slot)) {
        next.delete(slot);
      } else {
        next.add(slot);
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

  const filteredPerks = useMemo(() => {
    return initialPerks.filter((perk) => {
      const slotMatch =
        selectedSlots.size === 0 || selectedSlots.has(perk.slot);
      const rarityMatch =
        selectedRarities.size === 0 || selectedRarities.has(perk.rarity);
      return slotMatch && rarityMatch;
    });
  }, [initialPerks, selectedSlots, selectedRarities]);

  const groupedBySlot = useMemo(() => {
    const groups: Record<PerkSlot, Perk[]> = { 1: [], 2: [], 3: [], 4: [] };
    for (const perk of filteredPerks) {
      groups[perk.slot].push(perk);
    }
    return groups;
  }, [filteredPerks]);

  const showGrouped = selectedSlots.size === 0;

  return (
    <>
      <h1 className="mb-8 text-3xl font-bold text-white">插件图鉴</h1>

      {/* Filter section */}
      <div className="mb-8 rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
          <div className="mb-6">
            <h2 className="mb-3 text-lg font-semibold text-zinc-300">稀有度</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {RARITY_OPTIONS.map(({ type, color, label }) => (
                <FilterCheckbox
                  key={type}
                  label={label}
                  checked={selectedRarities.has(type)}
                  onChange={() => toggleRarity(type)}
                  colorClass={color}
                />
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold text-zinc-300">
              插件槽位
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SLOT_OPTIONS.map(({ slot, label }) => (
                <FilterCheckbox
                  key={slot}
                  label={label}
                  checked={selectedSlots.has(slot)}
                  onChange={() => toggleSlot(slot)}
                />
              ))}
            </div>
          </div>
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
                <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(128px, 128px))" }}>
                  {slotPerks.map((perk) => (
                    <PerkCard key={perk.id} perk={perk} />
                  ))}
                </div>
              </section>
            );
          })
        ) : (
          <section>
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(128px, 128px))" }}>
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
