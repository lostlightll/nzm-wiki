"use client";

import Image from "next/image";
import {
  CircleDot,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import {
  matchesWeaponApplicability,
  WeaponApplicabilityFilterSection,
  type WeaponApplicabilityFilter,
} from "@/components/WeaponApplicabilityFilter";
import {
  OVERLIMIT_QUALITY_STYLES,
  OVERLIMIT_TAG_ICONS,
  OVERLIMIT_TAG_STYLES,
  OverlimitTagBadge,
} from "@/components/OverlimitCardMeta";
import { OverlimitHoverPreview } from "@/components/OverlimitHoverPreview";
import { WEAPON_TYPE_ID_MAP } from "@/constants/weapons";
import { getAssetPath } from "@/lib/path";
import type { OverlimitCard, OverlimitCardTag, PerkSlot } from "@/types";

interface OverlimitPageClientProps {
  initialCards: OverlimitCard[];
}

const QUALITY_OPTIONS = [5, 4, 3] as const;
const SLOT_OPTIONS: readonly PerkSlot[] = [1, 2, 3, 4];
const WEIGHT_OPTIONS = [1, 2, 4, 6, 8] as const;

function OverlimitCardItem({
  card,
  eager,
}: {
  card: OverlimitCard;
  eager?: boolean;
}) {
  const qualityStyle =
    OVERLIMIT_QUALITY_STYLES[card.quality] ?? OVERLIMIT_QUALITY_STYLES[4];

  return (
    <OverlimitHoverPreview card={card} href={`/overlimit/${card.id}`}>
      <article
        className={`relative flex min-h-[290px] flex-col overflow-hidden rounded-lg border-2 ${qualityStyle.border} ${qualityStyle.bg} transition-transform duration-200 group-hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0 sm:min-h-[328px]`}
      >
        <span className="sr-only">品质：{qualityStyle.label}</span>
        <div aria-hidden="true" className={`h-1 w-full ${qualityStyle.bar}`} />
        <div className="flex min-h-11 flex-wrap content-center gap-1 border-b border-zinc-700/80 px-2 py-2">
          {card.tags.map((tag) => (
            <OverlimitTagBadge key={tag.id} tag={tag} />
          ))}
        </div>

        <div className="flex flex-1 flex-col items-center px-3 pb-4 pt-5 sm:px-2">
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
          <p className="mt-2 break-words text-center text-[13px] leading-5 text-zinc-300">
            {card.description}
          </p>
        </div>
      </article>
    </OverlimitHoverPreview>
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
  const [selectedWeights, setSelectedWeights] = useState<Set<number>>(
    new Set(),
  );
  const [selectedWeaponApplicability, setSelectedWeaponApplicability] = useState<
    Set<WeaponApplicabilityFilter>
  >(new Set());
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

  const availableWeaponApplicability = useMemo(() => {
    const available = new Set<WeaponApplicabilityFilter>();

    for (const card of initialCards) {
      if (card.weaponItems.length > 0) {
        available.add("专属插件");
      } else if (card.weaponType.length === 0) {
        available.add("全部武器类型");
      }

      for (const weaponTypeId of card.weaponType) {
        const weaponType = WEAPON_TYPE_ID_MAP[weaponTypeId];
        if (weaponType) available.add(weaponType);
      }
    }

    return available;
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

        const matchesWeight =
          selectedWeights.size === 0 || selectedWeights.has(card.weight);
        if (!matchesWeight) return false;

        const matchesWeaponType = matchesWeaponApplicability(
          selectedWeaponApplicability,
          card.weaponType,
          card.weaponItems.length > 0,
        );
        if (!matchesWeaponType) return false;

        const matchesTags =
          selectedTags.size === 0 ||
          card.tags.some((tag) => selectedTags.has(tag.id));
        if (!matchesTags) return false;
        if (!deferredQuery) return true;

        const searchText = [
          card.name,
          card.description,
          ...card.weaponNames,
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
    selectedWeights,
    selectedTags,
    selectedWeaponApplicability,
  ]);

  const hasFilters =
    query.length > 0 ||
    selectedQualities.size > 0 ||
    selectedSlots.size > 0 ||
    selectedWeights.size > 0 ||
    selectedWeaponApplicability.size > 0 ||
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

  const toggleWeight = (weight: number) => {
    setSelectedWeights((current) => {
      const next = new Set(current);
      if (next.has(weight)) next.delete(weight);
      else next.add(weight);
      return next;
    });
  };

  const toggleWeaponApplicability = (filter: WeaponApplicabilityFilter) => {
    setSelectedWeaponApplicability((current) => {
      const next = new Set(current);
      if (next.has(filter)) next.delete(filter);
      else next.add(filter);
      return next;
    });
  };

  const resetFilters = () => {
    setQuery("");
    setSelectedQualities(new Set());
    setSelectedSlots(new Set());
    setSelectedWeights(new Set());
    setSelectedWeaponApplicability(new Set());
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
                const style = OVERLIMIT_QUALITY_STYLES[quality];
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

          <fieldset className="mb-6">
            <legend className="mb-3 text-lg font-semibold text-zinc-300">
              抽取权重
            </legend>
            <div className="grid max-w-sm grid-cols-5 gap-1.5">
              {WEIGHT_OPTIONS.map((weight) => {
                const selected = selectedWeights.has(weight);
                return (
                  <button
                    key={weight}
                    type="button"
                    aria-label={`抽取权重 ${weight}`}
                    aria-pressed={selected}
                    onClick={() => toggleWeight(weight)}
                    className={`flex min-h-10 touch-manipulation items-center justify-center rounded border px-1 py-1.5 text-xs font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                      selected
                        ? "border-zinc-400 bg-zinc-600 text-white"
                        : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-700/70 hover:text-white"
                    }`}
                  >
                    {weight}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <WeaponApplicabilityFilterSection
            selected={selectedWeaponApplicability}
            onToggle={toggleWeaponApplicability}
            available={availableWeaponApplicability}
          />

          <fieldset>
            <legend className="mb-3 text-lg font-semibold text-zinc-300">
              套装词条
            </legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
              {tagOptions.map((tag) => {
                const selected = selectedTags.has(tag.id);
                const Icon = OVERLIMIT_TAG_ICONS[tag.name] ?? CircleDot;
                return (
                  <button
                    key={tag.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleTag(tag.id)}
                    className={`flex min-h-11 touch-manipulation items-center justify-center gap-1.5 rounded border px-2 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                      selected
                        ? OVERLIMIT_TAG_STYLES[tag.name] ??
                          OVERLIMIT_TAG_STYLES.壁垒
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

        <div className="mb-4 flex min-h-11 flex-wrap items-center justify-between gap-3">
          <p aria-live="polite" className="text-sm text-zinc-500">
            共 {filteredCards.length} 张卡片
          </p>
          <div className="flex flex-wrap items-center justify-end gap-2">
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
