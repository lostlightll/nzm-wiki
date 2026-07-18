import {
  Bomb,
  CircleDot,
  Crosshair,
  Dna,
  Flame,
  RadioTower,
  Shield,
  Swords,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { SpriteIcon } from "@/components/SpriteIcon";
import { WEAPON_TYPE_SPRITES } from "@/constants/sprites";
import { getPerkWeaponApplicability } from "@/lib/perk-applicability";
import type { OverlimitCardTag, PerkSlot } from "@/types";

export const OVERLIMIT_TAG_STYLES: Record<string, string> = {
  弹药: "border-orange-700/70 bg-orange-950/70 text-orange-200",
  技战: "border-teal-700/70 bg-teal-950/70 text-teal-200",
  异化: "border-purple-700/70 bg-purple-950/70 text-purple-200",
  游击: "border-blue-700/70 bg-blue-950/70 text-blue-200",
  壁垒: "border-zinc-600 bg-zinc-800 text-zinc-200",
  狙击: "border-lime-700/70 bg-lime-950/70 text-lime-200",
  爆韧: "border-amber-700/70 bg-amber-950/70 text-amber-200",
  共振: "border-sky-700/70 bg-sky-950/70 text-sky-200",
  狂战: "border-rose-700/70 bg-rose-950/70 text-rose-200",
};

export const OVERLIMIT_TAG_ICONS: Record<string, LucideIcon> = {
  弹药: CircleDot,
  技战: Wrench,
  异化: Dna,
  游击: Swords,
  壁垒: Shield,
  狙击: Crosshair,
  爆韧: Bomb,
  共振: RadioTower,
  狂战: Flame,
};

export const OVERLIMIT_QUALITY_STYLES: Record<
  number,
  {
    label: string;
    border: string;
    bg: string;
    text: string;
    bar: string;
    selected: string;
    iconFilter: string;
  }
> = {
  3: {
    label: "紫卡",
    border: "border-[#a65aae]/60",
    bg: "bg-[#a65aae]/10",
    text: "text-[#c57acc]",
    bar: "bg-[#a65aae]",
    selected: "border-[#a65aae]/70 bg-[#a65aae]/15 text-[#d28ad8]",
    iconFilter:
      "brightness(0) saturate(100%) invert(46%) sepia(20%) saturate(1514%) hue-rotate(248deg) brightness(92%) contrast(84%)",
  },
  4: {
    label: "金卡",
    border: "border-[#d1ac69]/60",
    bg: "bg-[#d1ac69]/10",
    text: "text-[#d1ac69]",
    bar: "bg-[#d1ac69]",
    selected: "border-[#d1ac69]/70 bg-[#d1ac69]/15 text-[#e2c58d]",
    iconFilter:
      "brightness(0) saturate(100%) invert(77%) sepia(29%) saturate(791%) hue-rotate(357deg) brightness(89%) contrast(88%)",
  },
  5: {
    label: "橙卡",
    border: "border-[#d86b32]/65",
    bg: "bg-[#d86b32]/10",
    text: "text-[#ef8d4f]",
    bar: "bg-[#d86b32]",
    selected: "border-[#d86b32]/75 bg-[#d86b32]/15 text-[#f29b63]",
    iconFilter:
      "brightness(0) saturate(100%) invert(63%) sepia(73%) saturate(2128%) hue-rotate(338deg) brightness(101%) contrast(89%)",
  },
};

export const OVERLIMIT_SLOT_LABELS: Record<PerkSlot, string> = {
  1: "1号槽位",
  2: "2号槽位",
  3: "3号槽位",
  4: "4号槽位",
};

export function OverlimitTagBadge({ tag }: { tag: OverlimitCardTag }) {
  const Icon = OVERLIMIT_TAG_ICONS[tag.name] ?? CircleDot;

  return (
    <span
      className={`inline-flex min-h-6 items-center gap-1 border px-1.5 py-0.5 text-xs font-medium ${
        OVERLIMIT_TAG_STYLES[tag.name] ?? OVERLIMIT_TAG_STYLES.壁垒
      }`}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span>{tag.name}</span>
    </span>
  );
}

export function OverlimitWeaponApplicability({
  weaponType,
  weaponNames,
  compact = false,
}: {
  weaponType: number[];
  weaponNames: string[];
  compact?: boolean;
}) {
  const {
    applicableWeaponTypes,
    exclusiveWeaponNames,
    hasUnknownWeaponTypes,
    appliesToAllWeapons,
  } = getPerkWeaponApplicability(weaponType, weaponNames);
  const itemClass = compact
    ? "min-h-7 px-2 py-1.5 text-xs"
    : "min-h-9 px-3 py-1.5 text-sm";
  const typeLengths = applicableWeaponTypes
    .map((type) => [...type].length)
    .sort((a, b) => a - b);
  const typeLengthTarget = typeLengths[Math.floor(typeLengths.length / 2)] ?? 0;
  const displayWeaponTypes = compact
    ? [...applicableWeaponTypes].sort((a, b) => {
        const lengthA = [...a].length;
        const lengthB = [...b].length;
        return (
          Number(lengthB === typeLengthTarget) -
            Number(lengthA === typeLengthTarget) ||
          lengthA - lengthB
        );
      })
    : applicableWeaponTypes;
  const typeItemClass = compact
    ? "min-h-7 shrink-0 whitespace-nowrap px-1.5 py-1.5 text-xs"
    : itemClass;

  if (appliesToAllWeapons) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded border border-[#d1ac69]/30 bg-[#d1ac69]/10 font-medium text-[#e2c38b] ${itemClass}`}
      >
        <Crosshair aria-hidden="true" className="h-3.5 w-3.5" />
        全部武器类型
      </span>
    );
  }

  return (
    <div className={compact ? "flex flex-col gap-1.5" : "flex flex-wrap gap-2"}>
      <div className={compact ? "flex w-full flex-wrap gap-1.5" : "contents"}>
        {displayWeaponTypes.map((type) => {
          return (
            <span
              key={type}
              className={`inline-flex items-center ${compact ? "gap-0.5" : "gap-1.5"} rounded border border-white/10 bg-white/5 text-zinc-200 ${typeItemClass}`}
            >
              <SpriteIcon
                sprite={WEAPON_TYPE_SPRITES[type]}
                size={compact ? 28 : 44}
                className="shrink-0"
              />
              {type}
            </span>
          );
        })}
        {hasUnknownWeaponTypes && (
          <span
            className={`inline-flex items-center rounded border border-white/10 bg-white/5 text-zinc-400 ${typeItemClass}`}
          >
            其他武器类型
          </span>
        )}
      </div>
      {compact ? (
        <div className="flex w-full flex-wrap gap-1.5">
          {exclusiveWeaponNames.map((weaponName) => (
            <span
              key={weaponName}
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded border border-[#d1ac69]/25 bg-[#d1ac69]/10 font-medium text-[#e2c38b] ${itemClass}`}
            >
              <Crosshair aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              {weaponName}
            </span>
          ))}
        </div>
      ) : (
        exclusiveWeaponNames.map((weaponName) => (
          <span
            key={weaponName}
            className={`inline-flex items-center gap-1.5 rounded border border-[#d1ac69]/25 bg-[#d1ac69]/10 font-medium text-[#e2c38b] ${itemClass}`}
          >
            <Crosshair aria-hidden="true" className="h-3.5 w-3.5" />
            {weaponName}
          </span>
        ))
      )}
    </div>
  );
}
