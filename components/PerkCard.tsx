import Image from "next/image";
import { getOptimizedImagePath } from "@/lib/path";
import type { Rarity, PerkSlot } from "@/types";
import { RARITY_KEY_MAP, RARITY_CARD_STYLES } from "@/constants/common";

const SLOT_LABELS: Record<PerkSlot, string> = {
  1: "1号槽位",
  2: "2号槽位",
  3: "3号槽位",
  4: "4号槽位",
};

interface PerkDetailCardProps {
  name: string;
  icon?: string;
  slot: PerkSlot;
  rarity?: Rarity;
  description?: React.ReactNode;
  weaponType?: number[];
}

export function PerkDetailCard({
  name,
  icon,
  slot,
  rarity,
  description,
  weaponType,
}: PerkDetailCardProps) {
  const rarityKey = rarity ? RARITY_KEY_MAP[rarity] : "common";
  const rarityStyle = RARITY_CARD_STYLES[rarityKey];

  return (
    <div className={`rounded-lg border-2 ${rarityStyle.border} ${rarityStyle.bg} p-6`}>
      <div className="flex items-center gap-5">
        {icon ? (
          <Image
            src={getOptimizedImagePath(`/icons/perks/${icon}.png`)}
            alt={name}
            width={96}
            height={96}
            className="h-24 w-24 object-contain"
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-lg bg-zinc-700 text-zinc-400">
            ?
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-white">{name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
            <span>{SLOT_LABELS[slot]}</span>
            {rarity && (
              <>
                <span>·</span>
                <span className={rarityStyle.text}>{rarity}</span>
              </>
            )}
            {weaponType && weaponType.length > 0 && (
              <>
                <span>·</span>
                <span>限定武器类型</span>
              </>
            )}
          </div>
        </div>
      </div>

      {description && (
        <div className="mt-4 text-base leading-relaxed text-zinc-300">
          {description}
        </div>
      )}
    </div>
  );
}
