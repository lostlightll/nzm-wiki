"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Weapon, ElementType } from "@/types";
import { getAssetPath } from "@/lib/path";
import { STAT_FIELDS } from "@/constants/weapons";
import { RARITY_KEY_MAP, RARITY_CARD_STYLES } from "@/constants/common";

const ELEMENT_ICONS: Record<ElementType, string> = {
  火焰: "/icons/elements/fire.png",
  寒冷: "/icons/elements/cryo.png",
  电弧: "/icons/elements/shock.png",
  腐蚀: "/icons/elements/corossive.png",
  物理: "/icons/elements/kinetic.png",
};

export function WeaponImage({ name }: { name: string }) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return null;
  }

  return (
    <div className="relative mb-3 h-32 w-full">
      <Image
        src={getAssetPath(`/icons/weapons/normal/${name}.png`)}
        alt={name}
        width={320}
        height={160}
        className="mx-auto object-contain"
        onError={() => setHasError(true)}
      />
    </div>
  );
}

// 武器卡片内部内容（不含 Link）
function WeaponCardContent({ weapon }: { weapon: Weapon }) {
  const rarityKey = RARITY_KEY_MAP[weapon.rarity] || "common";
  const rarityStyle = RARITY_CARD_STYLES[rarityKey];
  const elementIcon = ELEMENT_ICONS[weapon.elementType];

  return (
    <div
      className={`relative rounded-lg border-2 ${rarityStyle.border} ${rarityStyle.bg} p-4`}
    >
      {elementIcon && (
        <div className="absolute right-3 top-3 z-10">
          <Image
            src={getAssetPath(elementIcon)}
            alt={weapon.elementType}
            width={24}
            height={24}
          />
        </div>
      )}

      <div className="mb-2">
        <h3 className="text-lg font-semibold text-white">{weapon.name}</h3>
      </div>

      <div className="mb-3 text-sm">
        <span className="text-zinc-400">
          {[weapon.type, weapon.scope, ...weapon.tags]
            .filter(Boolean)
            .join(" | ")}
        </span>
      </div>

      {weapon.name && <WeaponImage name={weapon.name} />}

      <div className="grid grid-cols-2 gap-2 text-sm">
        {STAT_FIELDS.map(({ label, key, suffix }) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-zinc-400">{label}</span>
            <span className="text-white">
              {weapon.stats[key]}
              {suffix}
            </span>
          </div>
        ))}
      </div>

      {weapon.description && (
        <p className="mt-3 text-sm text-zinc-500">{weapon.description}</p>
      )}
    </div>
  );
}

// 列表页用的卡片（带 Link）
export function WeaponCard({ weapon }: { weapon: Weapon }) {
  return (
    <Link href={`/weapons/${encodeURIComponent(weapon.name)}`}>
      <div className="transition-transform hover:scale-[1.02]">
        <WeaponCardContent weapon={weapon} />
      </div>
    </Link>
  );
}

// 详情页用的卡片（不带 Link）
export function WeaponDetailCard({ weapon }: { weapon: Weapon }) {
  return <WeaponCardContent weapon={weapon} />;
}
