"use client";

import Image from "next/image";
import type { ReactNode } from "react";
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
  highlighted,
  iconOnlyOnMobile,
  centerClass,
}: {
  label: string;
  icon?: ReactNode;
  iconSrc?: string;
  sprite?: SpriteConfig;
  checked: boolean;
  onChange: () => void;
  colorClass?: string;
  highlighted?: boolean;
  iconOnlyOnMobile?: boolean;
  centerClass?: string;
}) {
  // iconOnlyOnMobile: 移动端居中（只有图标），PC左对齐（图标+文字）
  const alignClass = iconOnlyOnMobile
    ? "justify-center"
    : centerClass || "";

  return (
    <label
      className={`flex min-h-11 touch-manipulation cursor-pointer items-center ${alignClass} rounded border px-3 py-2 transition-[color,background-color,border-color,box-shadow] duration-200 ${
        highlighted && checked
          ? "border-cyan-300 bg-[linear-gradient(180deg,rgba(14,165,233,0.72)_0%,rgba(2,132,199,0.58)_52%,rgba(30,64,175,0.72)_100%)] shadow-[0_0_8px_rgba(34,211,238,0.75),0_0_22px_rgba(59,130,246,0.38)]"
          : highlighted
            ? "border-cyan-200/60 bg-[linear-gradient(135deg,rgba(14,165,233,0.08)_0%,rgba(24,24,27,0.96)_65%)] hover:border-cyan-200/80"
          : checked
          ? "border-zinc-500 bg-zinc-700"
          : "border-zinc-700 bg-zinc-800 hover:border-zinc-600"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="peer sr-only"
      />
      <span
        className={`flex min-w-0 items-center gap-1.5 peer-focus-visible:underline peer-focus-visible:decoration-2 peer-focus-visible:underline-offset-4 ${colorClass || (highlighted ? "font-bold text-white" : "text-zinc-300")}`}
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
    icon?: ReactNode;
    iconSrc?: string;
    color?: string;
    label?: string;
    sprite?: SpriteConfig;
    highlighted?: boolean;
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
    <fieldset className="mb-6 min-w-0">
      <legend className="mb-3 text-lg font-semibold text-zinc-300">
        {title}
      </legend>
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
            highlighted={item.highlighted}
            iconOnlyOnMobile={iconOnlyOnMobile}
            centerClass={centerClass}
          />
        ))}
      </div>
    </fieldset>
  );
}
