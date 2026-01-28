"use client";

import Image from "next/image";

export function FilterCheckbox({
  label,
  icon,
  iconSrc,
  checked,
  onChange,
  colorClass,
}: {
  label: string;
  icon?: string;
  iconSrc?: string;
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
        {iconSrc && <Image src={iconSrc} alt={label} width={20} height={20} />}
        {icon && !iconSrc && <span>{icon}</span>}
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

interface FilterSectionProps<T> {
  title: string;
  items: { type: T; icon?: string; iconSrc?: string; color?: string; label?: string }[];
  selected: Set<T>;
  onToggle: (item: T) => void;
  gridClass?: string;
}

export function FilterSection<T>({
  title,
  items,
  selected,
  onToggle,
  gridClass = "grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6",
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
            checked={selected.has(item.type)}
            onChange={() => onToggle(item.type)}
            colorClass={item.color}
          />
        ))}
      </div>
    </div>
  );
}
