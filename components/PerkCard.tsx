import Image from "next/image";
import { Crosshair, Layers3, Sparkles } from "lucide-react";
import { getAssetPath } from "@/lib/path";
import { SpriteIcon } from "@/components/SpriteIcon";
import type { Rarity, PerkSlot, WeaponType } from "@/types";
import { RARITY_KEY_MAP, RARITY_CARD_STYLES } from "@/constants/common";
import { WEAPON_TYPE_ID_MAP } from "@/constants/weapons";
import { WEAPON_TYPE_SPRITES } from "@/constants/sprites";

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
  weaponNames?: string[];
}

export function PerkDetailCard({
  name,
  icon,
  slot,
  rarity,
  description,
  weaponType,
  weaponNames,
}: PerkDetailCardProps) {
  const rarityKey = rarity ? RARITY_KEY_MAP[rarity] : "common";
  const rarityStyle = RARITY_CARD_STYLES[rarityKey];
  const weaponTypeIds = weaponType ?? [];
  const applicableWeaponTypes = Array.from(
    new Set(
      weaponTypeIds
        .map((id) => WEAPON_TYPE_ID_MAP[id])
        .filter((type): type is WeaponType => type !== undefined),
    ),
  );
  const hasUnknownWeaponTypes =
    applicableWeaponTypes.length < weaponTypeIds.length;
  const exclusiveWeaponNames = Array.from(
    new Set(
      (weaponNames ?? [])
        .map((weaponName) => weaponName.trim())
        .filter(Boolean),
    ),
  );
  const appliesToAllWeapons =
    weaponTypeIds.length === 0 && exclusiveWeaponNames.length === 0;

  return (
    <section
      className={`overflow-hidden rounded-lg border-2 ${rarityStyle.border} ${rarityStyle.bg}`}
    >
      <div className="flex items-start gap-4 p-4 sm:items-center sm:gap-6 sm:p-6">
        {icon ? (
          <Image
            src={getAssetPath(`/webp/icons/perks/${icon}.webp`)}
            alt={name}
            width={96}
            height={96}
            className="h-20 w-20 shrink-0 object-contain sm:h-24 sm:w-24"
          />
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md border border-white/10 bg-black/20 text-zinc-500 sm:h-24 sm:w-24">
            ?
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-white sm:text-2xl">{name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex min-h-8 items-center gap-1.5 rounded border border-white/10 bg-black/15 px-2.5 py-1 text-zinc-300">
              <Layers3 aria-hidden="true" className="h-4 w-4 text-zinc-500" />
              {SLOT_LABELS[slot]}
            </span>
            {rarity && (
              <span
                className={`inline-flex min-h-8 items-center rounded border border-current/25 bg-black/10 px-2.5 py-1 font-medium ${rarityStyle.text}`}
              >
                {rarity}
              </span>
            )}
          </div>
        </div>
      </div>

      {description && (
        <div className="border-t border-white/10 px-4 py-5 sm:px-6">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-400">
            <Sparkles aria-hidden="true" className="h-4 w-4 text-[#d1ac69]" />
            插件效果
          </h2>
          <div className="text-base leading-7 text-zinc-200 [&_p]:m-0 [&_strong]:font-semibold [&_strong]:text-[#e2bd75]">
            {description}
          </div>
        </div>
      )}

      <div className="border-t border-white/10 px-4 py-5 sm:px-6">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-400">
          <Crosshair aria-hidden="true" className="h-4 w-4 text-[#d1ac69]" />
          适用武器
        </h2>
        <div>
          {appliesToAllWeapons ? (
            <span className="inline-flex min-h-9 items-center gap-2 rounded border border-[#d1ac69]/30 bg-[#d1ac69]/10 px-3 py-1.5 text-sm font-medium text-[#e2c38b]">
              <Crosshair aria-hidden="true" className="h-4 w-4" />
              全部武器类型
            </span>
          ) : (
            <div className="space-y-3">
              {(applicableWeaponTypes.length > 0 || hasUnknownWeaponTypes) && (
                <div className="flex flex-wrap gap-2">
                  {applicableWeaponTypes.map((type) => (
                    <span
                      key={type}
                      className="inline-flex min-h-9 items-center gap-2 rounded border border-[#d1ac69]/40 bg-black/15 px-3 py-1.5 text-sm text-zinc-200"
                    >
                      <SpriteIcon
                        sprite={WEAPON_TYPE_SPRITES[type]}
                        size={44}
                        className="shrink-0"
                      />
                      {type}
                    </span>
                  ))}
                  {hasUnknownWeaponTypes && (
                    <span className="inline-flex min-h-9 items-center rounded border border-[#d1ac69]/40 bg-black/15 px-3 py-1.5 text-sm text-zinc-400">
                      其他武器类型
                    </span>
                  )}
                </div>
              )}

              {exclusiveWeaponNames.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {exclusiveWeaponNames.map((weaponName) => (
                    <span
                      key={weaponName}
                      className="inline-flex min-h-9 items-center gap-2 rounded border border-[#d1ac69]/25 bg-[#d1ac69]/8 px-3 py-1.5 text-sm font-medium text-[#e2c38b]"
                    >
                      <Crosshair aria-hidden="true" className="h-4 w-4" />
                      {weaponName}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
