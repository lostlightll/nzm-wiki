"use client";

import Image from "next/image";
import { RotateCcw, Search, X } from "lucide-react";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { OverlimitMapRotation } from "@/components/OverlimitMapRotation";
import { OverlimitLevelCatalog } from "@/components/OverlimitLevelCatalog";
import { OverlimitBondCatalog } from "@/components/OverlimitBondCatalog";
import {
  matchesWeaponApplicability,
  WeaponApplicabilityFilterSection,
  type WeaponApplicabilityFilter,
} from "@/components/WeaponApplicabilityFilter";
import {
  OVERLIMIT_QUALITY_STYLES,
  getOverlimitBondForegroundColor,
  getOverlimitBondSurfaceStyle,
  OverlimitBondIcon,
  OverlimitTagBadge,
} from "@/components/OverlimitCardMeta";
import { OverlimitHoverPreview } from "@/components/OverlimitHoverPreview";
import { MultiplierSourceBadges } from "@/components/MultiplierBadges";
import { WEAPON_TYPE_ID_MAP } from "@/constants/weapons";
import { restoreCatalogNavigation } from "@/lib/catalog-navigation";
import { getAssetPath } from "@/lib/path";
import type {
  OverlimitCard,
  OverlimitCardTag,
  OverlimitBondCatalog as OverlimitBondCatalogData,
  OverlimitBondName,
  OverlimitLevelCatalog as OverlimitLevelCatalogData,
  OverlimitMapRotationSchedule,
  PerkSlot,
} from "@/types";

interface OverlimitPageClientProps {
  initialCards: OverlimitCard[];
  bondCatalog: OverlimitBondCatalogData;
  levelCatalog: OverlimitLevelCatalogData;
  mapRotation: OverlimitMapRotationSchedule;
}

type OverlimitModule = "cards" | "bonds" | "levels" | "map-rotation";

const OVERLIMIT_MODULES: readonly {
  id: OverlimitModule;
  label: string;
}[] = [
  { id: "cards", label: "卡片图鉴" },
  { id: "map-rotation", label: "地图轮换" },
  { id: "levels", label: "等级图鉴" },
  { id: "bonds", label: "羁绊效果" },
];

const OVERLIMIT_MODULE_IDS = new Set<OverlimitModule>(
  OVERLIMIT_MODULES.map((module) => module.id),
);

const OVERLIMIT_MODULE_INDEX: Record<OverlimitModule, number> = {
  cards: 0,
  "map-rotation": 1,
  levels: 2,
  bonds: 3,
};

function getModuleFromHash(): OverlimitModule {
  const queryModule = new URLSearchParams(window.location.search).get("module");
  if (queryModule && OVERLIMIT_MODULE_IDS.has(queryModule as OverlimitModule)) {
    return queryModule as OverlimitModule;
  }
  const moduleId = window.location.hash.slice(1) as OverlimitModule;
  if (moduleId.startsWith("bond-")) return "bonds";
  return OVERLIMIT_MODULE_IDS.has(moduleId) ? moduleId : "cards";
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
    <div className="min-w-0">
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
      <MultiplierSourceBadges
        source={{ type: "overlimit-card", id: card.id }}
        className="mt-1.5 justify-center"
      />
    </div>
  );
}

export default function OverlimitPageClient({
  initialCards,
  bondCatalog,
  levelCatalog,
  mapRotation,
}: OverlimitPageClientProps) {
  useEffect(() => {
    restoreCatalogNavigation();
  }, []);

  const [activeModule, setActiveModule] =
    useState<OverlimitModule>("cards");
  const activeModuleRef = useRef<OverlimitModule>("cards");
  const moduleTransitionIdRef = useRef(0);
  const [moduleTransitionDuration, setModuleTransitionDuration] = useState(0);
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

  useEffect(() => {
    const root = document.documentElement;
    const previousOverflowX = root.style.overflowX;
    root.style.overflowX = "clip";
    return () => {
      root.style.overflowX = previousOverflowX;
    };
  }, []);

  const switchModule = useCallback(
    (module: OverlimitModule, animate = true): Promise<void> => {
      if (activeModuleRef.current === module) return Promise.resolve();

      const distance = Math.abs(
        OVERLIMIT_MODULE_INDEX[module] -
          OVERLIMIT_MODULE_INDEX[activeModuleRef.current],
      );
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const duration = !animate || reduceMotion ? 0 : 280 + (distance - 1) * 140;

      activeModuleRef.current = module;
      const transitionId = ++moduleTransitionIdRef.current;
      setModuleTransitionDuration(duration);
      setActiveModule(module);

      if (duration === 0) return Promise.resolve();

      return new Promise((resolve) => {
        window.setTimeout(() => {
          if (transitionId === moduleTransitionIdRef.current) {
            setModuleTransitionDuration(0);
          }
          resolve();
        }, duration);
      });
    },
    [],
  );

  useEffect(() => {
    const initialSyncFrame = window.requestAnimationFrame(() => {
      void switchModule(getModuleFromHash(), false);
    });
    const syncModuleFromHash = () => void switchModule(getModuleFromHash());

    window.addEventListener("hashchange", syncModuleFromHash);
    window.addEventListener("popstate", syncModuleFromHash);
    return () => {
      window.cancelAnimationFrame(initialSyncFrame);
      window.removeEventListener("hashchange", syncModuleFromHash);
      window.removeEventListener("popstate", syncModuleFromHash);
    };
  }, [switchModule]);

  useEffect(() => {
    if (activeModule !== "bonds") return;
    const targetId = decodeURIComponent(window.location.hash.slice(1));
    if (!targetId.startsWith("bond-")) return;
    window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ block: "center" });
    });
  }, [activeModule]);

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

  const filteredCardsTotalWeight = useMemo(
    () => filteredCards.reduce((total, card) => total + card.weight, 0),
    [filteredCards],
  );

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

  const selectModule = (module: OverlimitModule): Promise<void> => {
    if (activeModuleRef.current === module) return Promise.resolve();

    const url = new URL(window.location.href);
    url.searchParams.delete("module");
    url.hash = module;
    window.history.pushState(null, "", url);
    return switchModule(module);
  };

  const searchCardsByBonds = (activeBonds: OverlimitBondName[]) => {
    const bondNames = new Set<string>(activeBonds);
    setSelectedTags(
      new Set(
        tagOptions
          .filter((tag) => bondNames.has(tag.name))
          .map((tag) => tag.id),
      ),
    );
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    void selectModule("cards").then(() => {
      const scrollToCatalog = () => {
        if (activeModuleRef.current !== "cards") return;

        window.requestAnimationFrame(() => {
          const cardCatalog = document.getElementById("overlimit-card-catalog");
          cardCatalog?.focus({ preventScroll: true });
          cardCatalog?.scrollIntoView({
            behavior: reduceMotion ? "auto" : "smooth",
            block: "start",
          });
        });
      };

      if (reduceMotion) {
        scrollToCatalog();
        return;
      }

      window.setTimeout(scrollToCatalog, 100);
    });
  };

  const searchCardsByBond = (bondName: OverlimitBondName) => {
    searchCardsByBonds([bondName]);
  };

  const activeModuleIndex = OVERLIMIT_MODULE_INDEX[activeModule];
  const getModulePanelStyle = (module: OverlimitModule) => ({
    transform: `translate3d(${(OVERLIMIT_MODULE_INDEX[module] - activeModuleIndex) * 100}vw, 0, 0)`,
    transitionDuration: `${moduleTransitionDuration}ms`,
    transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
  });
  const getModulePanelClassName = (module: OverlimitModule) =>
    `col-start-1 row-start-1 min-w-0 will-change-transform transition-transform motion-reduce:transition-none ${
      activeModule === module
        ? "relative h-auto"
        : "pointer-events-none h-0 overflow-visible"
    }`;

  return (
    <>
      <h1 className="mb-6 text-3xl font-bold text-white">超限图鉴</h1>

      <nav
        aria-label="超限图鉴模块"
        className="mb-6 flex flex-wrap items-center gap-2"
      >
        {OVERLIMIT_MODULES.map((module) => {
          const active = activeModule === module.id;

          return (
            <button
              key={module.id}
              type="button"
              aria-pressed={active}
              onClick={() => void selectModule(module.id)}
              className={`min-h-11 touch-manipulation rounded border px-4 py-2 text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                active
                  ? "border-zinc-400 bg-zinc-600 text-white"
                  : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-700 hover:text-white"
              }`}
            >
              {module.label}
            </button>
          );
        })}
      </nav>

      <div className="relative left-1/2 w-screen -translate-x-1/2 overflow-x-clip">
        <div className="mx-auto grid max-w-7xl px-4">
          <div
          aria-hidden={activeModule !== "cards"}
          inert={activeModule !== "cards"}
          className={getModulePanelClassName("cards")}
          style={getModulePanelStyle("cards")}
        >
          <section
            id="overlimit-card-catalog"
            aria-label="卡片图鉴"
            tabIndex={-1}
            className="outline-none"
          >
        <h2 className="sr-only">卡片图鉴</h2>
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
                return (
                  <button
                    key={tag.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleTag(tag.id)}
                    style={
                      selected
                        ? getOverlimitBondSurfaceStyle(tag.name)
                        : { color: getOverlimitBondForegroundColor(tag.name) }
                    }
                    className={`flex min-h-11 touch-manipulation items-center justify-center gap-1.5 rounded border px-2 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                      selected
                        ? "shadow-sm"
                        : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-700/70 hover:text-white"
                    }`}
                  >
                    <OverlimitBondIcon name={tag.name} className="h-4 w-4" />
                    <span>{tag.name}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>

        <div className="mb-4 flex min-h-11 flex-wrap items-center justify-between gap-3">
          <div aria-live="polite" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500">
            <p>共 {filteredCards.length} 张卡片</p>
            <p className="tabular-nums">
              当前筛选总权重：{filteredCardsTotalWeight}
            </p>
          </div>
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

          </div>

          <div
          aria-hidden={activeModule !== "bonds"}
          inert={activeModule !== "bonds"}
          className={getModulePanelClassName("bonds")}
          style={getModulePanelStyle("bonds")}
        >
            <OverlimitBondCatalog
              catalog={bondCatalog}
              onSearchBond={searchCardsByBond}
            />
          </div>

          <div
          aria-hidden={activeModule !== "levels"}
          inert={activeModule !== "levels"}
          className={getModulePanelClassName("levels")}
          style={getModulePanelStyle("levels")}
        >
          <OverlimitLevelCatalog catalog={levelCatalog} />
          </div>

          <div
          aria-hidden={activeModule !== "map-rotation"}
          inert={activeModule !== "map-rotation"}
          className={getModulePanelClassName("map-rotation")}
          style={getModulePanelStyle("map-rotation")}
        >
            <OverlimitMapRotation
              schedule={mapRotation}
              onSearchBonds={searchCardsByBonds}
            />
          </div>
        </div>
      </div>
    </>
  );
}
