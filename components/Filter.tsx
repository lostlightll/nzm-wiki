"use client";

import Image from "next/image";
import { getAssetPath } from "@/lib/path";
import { SpriteIcon } from "@/components/SpriteIcon";
import type { SpriteConfig } from "@/constants/sprites";

export function FilterCheckbox({
  label,
  icon,
  iconSrc,
  sprite,
  checked,
  onChange,
  colorClass,
  iconOnlyOnMobile,
  centerClass,
}: {
  label: string;
  icon?: string;
  iconSrc?: string;
  sprite?: SpriteConfig;
  checked: boolean;
  onChange: () => void;
  colorClass?: string;
  iconOnlyOnMobile?: boolean;
  centerClass?: string;
}) {
  // iconOnlyOnMobile: 移动端居中（只有图标），PC左对齐（图标+文字）
  const alignClass = iconOnlyOnMobile
    ? "justify-center"
    : centerClass || "";

  return (
    <label
      className={`flex cursor-pointer items-center ${alignClass} rounded border px-3 py-2 transition-colors ${
        checked
          ? "border-zinc-500 bg-zinc-700"
          : "border-zinc-700 bg-zinc-800 hover:border-zinc-600"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="hidden"
      />
      <span
        className={`flex min-w-0 items-center gap-1.5 ${colorClass || "text-zinc-300"}`}
      >
        {sprite && <SpriteIcon sprite={sprite} size={60} className="shrink-0" />}
        {iconSrc && !sprite && (
          <Image
            src={getAssetPath(iconSrc)}
            alt={label}
            width={25}
            height={25}
            className="shrink-0"
          />
        )}
        {icon && !iconSrc && !sprite && <span className="shrink-0">{icon}</span>}
        <span className={`truncate ${iconOnlyOnMobile ? "hidden sm:inline" : ""}`}>{label}</span>
      </span>
    </label>
  );
}

interface FilterSectionProps<T> {
  title: string;
  items: {
    type: T;
    icon?: string;
    iconSrc?: string;
    color?: string;
    label?: string;
    sprite?: SpriteConfig;
  }[];
  selected: Set<T>;
  onToggle: (item: T) => void;
  gridClass?: string;
  iconOnlyOnMobile?: boolean;
  centerClass?: string;
}

export function FilterSection<T>({
  title,
  items,
  selected,
  onToggle,
  gridClass = "grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6",
  iconOnlyOnMobile,
  centerClass,
}: FilterSectionProps<T>) {
  return (
    <div className="mb-6">
      <h2 className="mb-3 text-lg font-semibold text-zinc-300">{title}</h2>
      <div className={gridClass}>
        {items.map((item, index) => (
          <FilterCheckbox
            key={String(item.type) || index}
            label={item.label ?? String(item.type)}
            icon={item.icon}
            iconSrc={item.iconSrc}
            sprite={item.sprite}
            checked={selected.has(item.type)}
            onChange={() => onToggle(item.type)}
            colorClass={item.color}
            iconOnlyOnMobile={iconOnlyOnMobile}
            centerClass={centerClass}
          />
        ))}
      </div>
    </div>
  );
}
