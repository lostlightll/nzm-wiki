"use client";

import Image from "next/image";
import Link from "next/link";
import { getAssetPath } from "@/lib/path";
import cardsData from "@/data/cards-data.json";

interface BuffCardProps {
  name: string;
  slug: string;
  icon: string;
  type: "buff" | "debuff";
  effect?: string;
}

interface CardRefProps {
  slug: string;
}

const TYPE_STYLES = {
  buff: {
    border: "border-green-500/40",
    hoverBorder: "hover:border-green-500/70",
    bg: "bg-green-900/30",
  },
  debuff: {
    border: "border-red-500/40",
    hoverBorder: "hover:border-red-500/70",
    bg: "bg-red-900/30",
  },
};

function Card({ name, slug, icon, type, effect }: BuffCardProps) {
  const styles = TYPE_STYLES[type];

  return (
    <Link
      href={`/cards/${slug}`}
      className={`group block relative overflow-hidden rounded-lg border-2 ${styles.border} ${styles.hoverBorder} ${styles.bg} transition-all hover:scale-105 hover:shadow-lg hover:shadow-black/20 no-underline`}
      style={{ width: "var(--card-width, 240px)", aspectRatio: "960/1266" }}
    >
      <Image
        src={getAssetPath(icon)}
        alt={name}
        fill
        sizes="var(--card-width, 240px)"
        className="object-cover"
      />
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
        <div className="text-sm text-zinc-100 font-semibold mb-1">{name}</div>
        {effect && (
          <div className="card-effect text-xs text-zinc-300 line-clamp-2">
            {effect}
          </div>
        )}
      </div>
    </Link>
  );
}

// CardRef: 只需要 slug，自动从 cardsData 读取其他数据
export function CardRef({ slug }: CardRefProps) {
  const card = cardsData[slug as keyof typeof cardsData];
  if (!card) {
    return <div className="text-red-500">Card not found: {slug}</div>;
  }
  return (
    <Card
      name={card.title}
      slug={card.slug}
      icon={card.icon}
      type={card.type as "buff" | "debuff"}
      effect={card.effect}
    />
  );
}

interface BuffCardGridProps {
  children: React.ReactNode;
  defaultSize?: number;
  showSlider?: boolean;
}

export function BuffCardGrid({
  children,
  defaultSize = 240,
  showSlider = true,
}: BuffCardGridProps) {
  const handleSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    document.documentElement.style.setProperty(
      "--card-width",
      `${e.target.value}px`,
    );
  };

  const handleEffectToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    document.documentElement.style.setProperty(
      "--card-effect-display",
      e.target.checked ? "block" : "none",
    );
  };

  return (
    <div className="my-4">
      {showSlider && (
        <div className="flex items-center gap-6 mb-4 flex-wrap">
          <div className="flex items-center gap-3">
            <label
              htmlFor="card-size"
              className="text-sm font-medium text-zinc-300"
            >
              卡片大小
            </label>
            <input
              id="card-size"
              type="range"
              min={120}
              max={300}
              defaultValue={defaultSize}
              onChange={handleSizeChange}
              className="w-28 h-1.5 rounded-full appearance-none bg-zinc-700 cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:w-4
                [&::-webkit-slider-thumb]:h-4
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-white
                [&::-webkit-slider-thumb]:shadow-md
                [&::-webkit-slider-thumb]:cursor-pointer
                [&::-webkit-slider-thumb]:transition-transform
                [&::-webkit-slider-thumb]:hover:scale-110
                [&::-moz-range-thumb]:w-4
                [&::-moz-range-thumb]:h-4
                [&::-moz-range-thumb]:rounded-full
                [&::-moz-range-thumb]:bg-white
                [&::-moz-range-thumb]:border-0
                [&::-moz-range-thumb]:shadow-md
                [&::-moz-range-thumb]:cursor-pointer"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none group">
            <div className="relative">
              <input
                type="checkbox"
                defaultChecked
                onChange={handleEffectToggle}
                className="peer sr-only"
              />
              <div className="w-9 h-5 rounded-full bg-zinc-700 peer-checked:bg-zinc-500 transition-colors" />
              <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4" />
            </div>
            <span className="text-sm font-medium text-zinc-300 group-hover:text-zinc-200 transition-colors">
              显示详细描述
            </span>
          </label>
        </div>
      )}
      <div className="flex flex-wrap gap-4 justify-center not-prose">
        {children}
      </div>
    </div>
  );
}

// 导出 BuffCard 作为别名
export { Card as BuffCard };

interface BuffDetailProps {
  name: string;
  icon: string;
  type: "buff" | "debuff";
  effect: string;
  children?: React.ReactNode;
}

export function BuffDetail({
  name,
  icon,
  type,
  effect,
  children,
}: BuffDetailProps) {
  const typeLabel = type === "buff" ? "增益卡片" : "减益卡片";
  const badgeStyle =
    type === "buff"
      ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
      : "border-rose-400/40 bg-rose-400/10 text-rose-200";

  return (
    <section className="not-prose grid max-w-5xl overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900/70 md:grid-cols-[280px_minmax(0,1fr)]">
      <div className="flex items-center justify-center border-b border-zinc-700 bg-zinc-950/55 p-5 md:border-r md:border-b-0">
        <div className="relative aspect-[960/1266] w-full max-w-60 overflow-hidden rounded-md shadow-xl shadow-black/30">
          <Image
            src={getAssetPath(icon)}
            alt={name}
            fill
            sizes="240px"
            className="object-contain"
          />
        </div>
      </div>
      <div className="min-w-0 p-5 sm:p-7">
        <span className={`inline-flex rounded border px-2.5 py-1 text-sm font-medium ${badgeStyle}`}>
          {typeLabel}
        </span>
        <h2 className="mt-4 text-2xl font-bold text-zinc-50">{name}</h2>
        <p className="mt-5 border-t border-zinc-700 pt-5 text-base leading-7 text-zinc-100">
          {effect}
        </p>
        {children}
      </div>
    </section>
  );
}
