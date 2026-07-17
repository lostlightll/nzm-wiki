"use client";

import Image from "next/image";
import {
  Bomb,
  CircleDot,
  Crosshair,
  Dna,
  Flame,
  RadioTower,
  RotateCcw,
  Search,
  Shield,
  Swords,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { getAssetPath } from "@/lib/path";
import type { OverlimitCard, OverlimitCardTag, PerkSlot } from "@/types";

interface OverlimitPageClientProps {
  initialCards: OverlimitCard[];
}

const TAG_STYLES: Record<string, string> = {
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

const TAG_ICONS: Record<string, LucideIcon> = {
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

const QUALITY_STYLES: Record<
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

const QUALITY_OPTIONS = [5, 4, 3] as const;
const SLOT_OPTIONS: readonly PerkSlot[] = [1, 2, 3, 4];

function TagBadge({ tag }: { tag: OverlimitCardTag }) {
  const Icon = TAG_ICONS[tag.name] ?? CircleDot;

  return (
    <span
      className={`inline-flex h-6 items-center gap-1 border px-1.5 text-xs font-medium ${
        TAG_STYLES[tag.name] ?? TAG_STYLES.壁垒
      }`}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span>{tag.name}</span>
    </span>
  );
}

function OverlimitCardItem({
  card,
  eager,
}: {
  card: OverlimitCard;
  eager?: boolean;
}) {
  const qualityStyle = QUALITY_STYLES[card.quality] ?? QUALITY_STYLES[4];

  return (
    <article
      className={`relative flex min-h-[290px] flex-col overflow-hidden rounded-lg border-2 ${qualityStyle.border} ${qualityStyle.bg} sm:min-h-[340px]`}
    >
      <span className="sr-only">品质：{qualityStyle.label}</span>
      <div aria-hidden="true" className={`h-1 w-full ${qualityStyle.bar}`} />
      <div className="flex min-h-11 flex-wrap content-center gap-1 border-b border-zinc-700/80 px-2 py-2">
        {card.tags.map((tag) => (
          <TagBadge key={tag.id} tag={tag} />
        ))}
      </div>

      <div className="flex flex-1 flex-col items-center px-3 pb-4 pt-5 sm:px-4 sm:pt-6">
        <div className="flex h-24 w-24 items-center justify-center sm:h-32 sm:w-32">
          <Image
            src={getAssetPath(card.icon)}
            alt=""
            width={128}
            height={128}
            loading={eager ? "eager" : "lazy"}
            sizes="(max-width: 639px) 96px, 128px"
            className="h-full w-full object-contain"
            style={{ filter: qualityStyle.iconFilter }}
          />
        </div>

        <h3 className="mt-4 text-center text-base font-semibold leading-6 text-white sm:text-lg">
          {card.name}
        </h3>
        <p className="mt-2 break-words text-center text-[13px] leading-5 text-zinc-300 sm:text-sm sm:leading-6">
          {card.description}
        </p>
      </div>
    </article>
  );
}

export default function OverlimitPageClient({
  initialCards,
}: OverlimitPageClientProps) {
  const [query, setQuery] = useState("");
  const [selectedQualities, setSelectedQualities] = useState<Set<number>>(
    new Set(),
  );
  const [selectedSlots, setSelectedSlots] = useState<Set<PerkSlot>>(new Set());
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase("zh-CN"));

  const tagOptions = useMemo(() => {
    const tags = new Map<string, OverlimitCardTag>();
    for (const card of initialCards) {
      for (const tag of card.tags) {
        if (!tags.has(tag.id)) tags.set(tag.id, tag);
      }
    }
    return [...tags.values()].sort((a, b) => Number(a.id) - Number(b.id));
  }, [initialCards]);

  const filteredCards = useMemo(() => {
    return initialCards
      .filter((card) => {
        const matchesQuality =
          selectedQualities.size === 0 || selectedQualities.has(card.quality);
        if (!matchesQuality) return false;

        const matchesSlot =
          selectedSlots.size === 0 || selectedSlots.has(card.slot);
        if (!matchesSlot) return false;

        const matchesTags =
          selectedTags.size === 0 ||
          card.tags.some((tag) => selectedTags.has(tag.id));
        if (!matchesTags) return false;
        if (!deferredQuery) return true;

        const searchText = [
          card.name,
          card.description,
          ...card.tags.map((tag) => tag.name),
        ]
          .join(" ")
          .toLocaleLowerCase("zh-CN");
        return searchText.includes(deferredQuery);
      })
      .sort((a, b) => b.quality - a.quality);
  }, [
    deferredQuery,
    initialCards,
    selectedQualities,
    selectedSlots,
    selectedTags,
  ]);

  const hasFilters =
    query.length > 0 ||
    selectedQualities.size > 0 ||
    selectedSlots.size > 0 ||
    selectedTags.size > 0;
  const eagerIcons = new Set(
    filteredCards.slice(0, 5).map((card) => card.icon),
  );

  const toggleTag = (tagId: string) => {
    setSelectedTags((current) => {
      const next = new Set(current);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  };

  const toggleQuality = (quality: number) => {
    setSelectedQualities((current) => {
      const next = new Set(current);
      if (next.has(quality)) next.delete(quality);
      else next.add(quality);
      return next;
    });
  };

  const toggleSlot = (slot: PerkSlot) => {
    setSelectedSlots((current) => {
      const next = new Set(current);
      if (next.has(slot)) next.delete(slot);
      else next.add(slot);
      return next;
    });
  };

  const resetFilters = () => {
    setQuery("");
    setSelectedQualities(new Set());
    setSelectedSlots(new Set());
    setSelectedTags(new Set());
  };

  return (
    <>
      <h1 className="mb-8 text-3xl font-bold text-white">超限图鉴</h1>

      <section aria-labelledby="card-catalog-title">
        <h2
          id="card-catalog-title"
          className="mb-4 text-xl font-semibold text-zinc-200"
        >
          卡片图鉴
        </h2>

        <div className="mb-8 rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
          <div role="search" className="relative mb-6 max-w-xl">
            <label htmlFor="overlimit-search" className="sr-only">
              搜索超限卡片
            </label>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
            />
            <input
              id="overlimit-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索卡片名称、效果或词条"
              className="min-h-11 w-full rounded border border-zinc-700 bg-zinc-900/80 py-2 pl-10 pr-11 text-base text-zinc-100 outline-none transition-colors placeholder:text-zinc-500 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/30"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="清空搜索"
                title="清空搜索"
                className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            )}
          </div>

          <fieldset className="mb-6">
            <legend className="mb-3 text-lg font-semibold text-zinc-300">
              卡片品质
            </legend>
            <div className="grid max-w-md grid-cols-3 gap-2">
              {QUALITY_OPTIONS.map((quality) => {
                const style = QUALITY_STYLES[quality];
                const selected = selectedQualities.has(quality);
                return (
                  <button
                    key={quality}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleQuality(quality)}
                    className={`flex min-h-11 touch-manipulation items-center justify-center gap-2 rounded border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                      selected
                        ? style.selected
                        : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-700/70 hover:text-white"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`h-3 w-3 shrink-0 ${style.bar}`}
                    />
                    <span>{style.label}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="mb-6">
            <legend className="mb-3 text-lg font-semibold text-zinc-300">
              卡片槽位
            </legend>
            <div className="grid max-w-lg grid-cols-4 gap-2">
              {SLOT_OPTIONS.map((slot) => {
                const selected = selectedSlots.has(slot);
                return (
                  <button
                    key={slot}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleSlot(slot)}
                    className={`flex min-h-11 touch-manipulation items-center justify-center rounded border px-3 py-2 text-sm font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                      selected
                        ? "border-zinc-400 bg-zinc-600 text-white"
                        : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-700/70 hover:text-white"
                    }`}
                  >
                    {slot}插
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-3 text-lg font-semibold text-zinc-300">
              套装词条
            </legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
              {tagOptions.map((tag) => {
                const selected = selectedTags.has(tag.id);
                const Icon = TAG_ICONS[tag.name] ?? CircleDot;
                return (
                  <button
                    key={tag.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleTag(tag.id)}
                    className={`flex min-h-11 touch-manipulation items-center justify-center gap-1.5 rounded border px-2 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                      selected
                        ? TAG_STYLES[tag.name] ?? TAG_STYLES.壁垒
                        : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-700/70 hover:text-white"
                    }`}
                  >
                    <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                    <span>{tag.name}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>

        <div className="mb-4 flex min-h-11 items-center justify-between gap-4">
          <p aria-live="polite" className="text-sm text-zinc-500">
            共 {filteredCards.length} 张卡片
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="flex min-h-11 items-center gap-1.5 rounded px-3 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            >
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
              <span>重置筛选</span>
            </button>
          )}
        </div>

        {filteredCards.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filteredCards.map((card) => (
              <OverlimitCardItem
                key={card.id}
                card={card}
                eager={eagerIcons.has(card.icon)}
              />
            ))}
          </div>
        ) : (
          <div className="py-16 text-center text-zinc-500">
            没有符合条件的卡片
          </div>
        )}
      </section>
    </>
  );
}
