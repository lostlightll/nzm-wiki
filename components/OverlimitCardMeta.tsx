import {
  CircleDot,
  Crosshair,
} from "lucide-react";
import type { CSSProperties } from "react";
import { SpriteIcon } from "@/components/SpriteIcon";
import { WEAPON_TYPE_SPRITES } from "@/constants/sprites";
import { getPerkWeaponApplicability } from "@/lib/perk-applicability";
import { getAssetPath } from "@/lib/path";
import type { OverlimitBondName, OverlimitCardTag, PerkSlot } from "@/types";

export const OVERLIMIT_BOND_COLORS = {
  弹药: { active: "#1CAD69", inactive: "#030E09" },
  技战: { active: "#2DBCFF", inactive: "#040F14" },
  异化: { active: "#B53CFF", inactive: "#0F0614" },
  游击: { active: "#3737FF", inactive: "#050514" },
  壁垒: { active: "#5DE926", inactive: "#070F03" },
  狙击: { active: "#FFC62C", inactive: "#0B0904" },
  爆韧: { active: "#FF4F25", inactive: "#0E0502" },
  共振: { active: "#3D69FF", inactive: "#05091B" },
  狂战: { active: "#FA2929", inactive: "#140404" },
} as const satisfies Record<
  OverlimitBondName,
  { active: string; inactive: string }
>;

export function getOverlimitBondForegroundColor(name: string): string {
  const colors =
    OVERLIMIT_BOND_COLORS[name as OverlimitBondName] ??
    OVERLIMIT_BOND_COLORS.壁垒;

  return `color-mix(in srgb, ${colors.active} 45%, white)`;
}

export function getOverlimitBondSurfaceStyle(name: string): CSSProperties {
  const colors =
    OVERLIMIT_BOND_COLORS[name as OverlimitBondName] ??
    OVERLIMIT_BOND_COLORS.壁垒;

  return {
    backgroundColor: `color-mix(in srgb, ${colors.active} 14%, #18181b)`,
    borderColor: `color-mix(in srgb, ${colors.active} 45%, #3f3f46)`,
    color: getOverlimitBondForegroundColor(name),
  };
}

export function getOverlimitBondInactiveSurfaceStyle(
  name: string,
): CSSProperties {
  const colors =
    OVERLIMIT_BOND_COLORS[name as OverlimitBondName] ??
    OVERLIMIT_BOND_COLORS.壁垒;

  return { backgroundColor: colors.inactive };
}

export const OVERLIMIT_BOND_ICON_PATHS = {
  弹药: "/icons/overlimit/sets/T_Icons_Rogue_Munition.png",
  技战: "/icons/overlimit/sets/T_Icons_Rogue_Skill.png",
  异化: "/icons/overlimit/sets/T_Icons_Rogue_Anomaly.png",
  游击: "/icons/overlimit/sets/T_Icons_Rogue_Guerrilla.png",
  壁垒: "/icons/overlimit/sets/T_Icons_Rogue_Survival.png",
  狙击: "/icons/overlimit/sets/T_Icons_Rogue_Precision.png",
  爆韧: "/icons/overlimit/sets/T_Icons_Rogue_Demolition.png",
  共振: "/icons/overlimit/sets/T_Icons_Rogue_Support.png",
  狂战: "/icons/overlimit/sets/T_Icons_Rogue_Frenzy.png",
} as const satisfies Record<OverlimitBondName, string>;

export function OverlimitBondIcon({
  name,
  active = true,
  className = "h-3.5 w-3.5",
}: {
  name: string;
  active?: boolean;
  className?: string;
}) {
  const bondName = name as OverlimitBondName;
  const iconPath = OVERLIMIT_BOND_ICON_PATHS[bondName];
  const colors = OVERLIMIT_BOND_COLORS[bondName];

  if (!iconPath || !colors) {
    return <CircleDot aria-hidden="true" className={className} />;
  }

  const maskImage = `url("${getAssetPath(iconPath)}")`;
  const style: CSSProperties = {
    backgroundColor: active
      ? getOverlimitBondForegroundColor(name)
      : "currentColor",
    WebkitMaskImage: maskImage,
    maskImage,
    WebkitMaskPosition: "center",
    maskPosition: "center",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskSize: "contain",
    maskSize: "contain",
  };

  return (
    <span
      aria-hidden="true"
      className={`${className} block shrink-0`}
      style={style}
    />
  );
}

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
  return (
    <span
      className="inline-flex min-h-6 items-center gap-1 border px-1.5 py-0.5 text-xs font-medium"
      style={getOverlimitBondSurfaceStyle(tag.name)}
    >
      <OverlimitBondIcon name={tag.name} />
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
