"use client";

import Image from "next/image";
import Link from "next/link";
import { MapPinned, RotateCcw, Search, Skull, X } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { BossDifficultyControl } from "@/components/BossDifficultyControl";
import { BossCardHealth } from "@/components/BossHealth";
import { useBossDifficulty } from "@/components/BossDifficultyProvider";
import { getAssetPath } from "@/lib/path";
import { LC_MAPS } from "@/lib/lc-maps";
import type { Boss } from "@/types";

interface BossGroup {
  id: string;
  name: string;
  image: string | null;
  bosses: Boss[];
}

function getBossMaps(boss: Boss): string[] {
  return Array.isArray(boss.map) ? boss.map : [boss.map];
}

function BossCard({ boss, eager = false }: { boss: Boss; eager?: boolean }) {
  const { withDifficulty } = useBossDifficulty();

  return (
    <Link
      href={withDifficulty(`/bosses/${encodeURIComponent(boss.slug)}`)}
      className="group block touch-manipulation rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <article className="flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900/70 transition-[border-color,background-color,transform] duration-200 ease-out group-hover:-translate-y-0.5 group-hover:border-[#d1ac69]/70 group-hover:bg-zinc-800/90 group-active:translate-y-0 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
        <div className="relative aspect-square w-full overflow-hidden border-b border-zinc-700 bg-zinc-950/80">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(209,172,105,0.18),_transparent_68%)]"
          />
          <Image
            src={getAssetPath(`/icons/enemies/lc/boss/${boss.slug}.png`)}
            alt={boss.title}
            fill
            loading={eager ? "eager" : "lazy"}
            sizes="(max-width: 639px) 45vw, (max-width: 767px) 30vw, 200px"
            className="object-contain transition-transform duration-200 ease-out group-hover:scale-[1.025] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
          <span className="absolute left-2 top-2 inline-flex min-h-7 items-center gap-1 rounded border border-[#d1ac69]/40 bg-zinc-950/85 px-2 py-1 text-xs font-medium text-[#e1c58f] backdrop-blur-sm">
            <Skull aria-hidden="true" className="h-3.5 w-3.5" />
            Boss
          </span>
        </div>

        <div className="flex flex-1 flex-col px-3 py-3">
          <h3 className="min-h-12 break-words text-base font-semibold leading-6 text-zinc-100">
            {boss.title}
          </h3>
          {boss.nickname && (
            <p className="mt-1 break-words text-sm leading-5 text-zinc-400">
              {boss.nickname}
            </p>
          )}
          <div className="mt-auto flex h-14 flex-col items-start gap-1 border-t border-zinc-800 pt-3 text-sm">
            <span className="text-zinc-500">血量</span>
            <BossCardHealth boss={boss} />
          </div>
        </div>
      </article>
    </Link>
  );
}

function MapBanner({
  group,
  headingId,
  eager = false,
}: {
  group: BossGroup;
  headingId: string;
  eager?: boolean;
}) {
  return (
    <div className="relative isolate min-h-24 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900">
      {group.image && (
        <Image
          src={getAssetPath(group.image)}
          alt=""
          fill
          loading={eager ? "eager" : "lazy"}
          sizes="(max-width: 1279px) 100vw, 1280px"
          className="object-cover object-center"
        />
      )}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-r from-zinc-950/95 via-zinc-950/65 to-zinc-950/20"
      />
      <div className="relative z-10 flex min-h-24 items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-zinc-600 bg-zinc-950/65 text-zinc-300 backdrop-blur-sm">
            <MapPinned aria-hidden="true" className="h-5 w-5" />
          </span>
          <h2
            id={headingId}
            tabIndex={-1}
            className="scroll-mt-20 break-words text-xl font-semibold text-white outline-none sm:text-2xl"
          >
            {group.name}
          </h2>
        </div>
        <span className="shrink-0 rounded border border-zinc-600 bg-zinc-950/65 px-2.5 py-1 text-sm tabular-nums text-zinc-300 backdrop-blur-sm">
          {group.bosses.length} 位
        </span>
      </div>
    </div>
  );
}

export function BossCatalog({ bosses }: { bosses: Boss[] }) {
  const [query, setQuery] = useState("");
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(
    query.trim().toLocaleLowerCase("zh-CN"),
  );

  const allGroups = useMemo<BossGroup[]>(() => {
    const knownMaps = new Set(LC_MAPS.map((map) => map.name));
    const groups: BossGroup[] = LC_MAPS.map((map) => ({
      id: map.id,
      name: map.name,
      image: map.image,
      bosses: bosses.filter((boss) => getBossMaps(boss).includes(map.name)),
    }));
    const otherBosses = bosses.filter((boss) =>
      getBossMaps(boss).some((map) => !knownMaps.has(map)),
    );

    if (otherBosses.length > 0) {
      groups.push({
        id: "other",
        name: "其他地图",
        image: null,
        bosses: otherBosses,
      });
    }

    return groups;
  }, [bosses]);

  const searchedGroups = useMemo(() => {
    if (!deferredQuery) return allGroups;

    return allGroups
      .map((group) => ({
        ...group,
        bosses: group.bosses.filter((boss) => {
          const searchText = [
            boss.title,
            boss.nickname,
            boss.description,
            ...getBossMaps(boss),
          ]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase("zh-CN");
          return searchText.includes(deferredQuery);
        }),
      }))
      .filter((group) => group.bosses.length > 0);
  }, [allGroups, deferredQuery]);

  const visibleGroups = useMemo(
    () =>
      selectedMapId
        ? searchedGroups.filter((group) => group.id === selectedMapId)
        : searchedGroups,
    [searchedGroups, selectedMapId],
  );

  const resultCount = visibleGroups.reduce(
    (total, group) => total + group.bosses.length,
    0,
  );
  const mapOptions = allGroups.filter((group) => group.bosses.length > 0);

  const resetFilters = () => {
    setQuery("");
    setSelectedMapId(null);
  };

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold text-white">首领图鉴</h1>

      <nav aria-label="首领图鉴模块" className="mb-6 flex items-center gap-2">
        <button
          type="button"
          aria-pressed="true"
          className="min-h-11 cursor-default rounded border border-zinc-400 bg-zinc-600 px-4 py-2 text-base font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300"
        >
          Boss 首领
        </button>
      </nav>

      <section
        aria-label="首领检索、地图筛选与血量难度"
        className="mb-8 rounded-lg border border-zinc-700 bg-zinc-800/50 p-4"
      >
        <div role="search" className="relative max-w-xl">
          <label htmlFor="boss-search" className="sr-only">
            搜索 Boss 首领
          </label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
          />
          <input
            id="boss-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索首领名称、简介或地图"
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

        <div className="mt-5 border-t border-zinc-700/80 pt-5">
          <div className="mb-3 flex min-h-8 flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-zinc-300">地图筛选</h2>
            <p aria-live="polite" className="text-sm text-zinc-500">
              共 {resultCount} 位首领
            </p>
          </div>
          <div aria-label="按地图筛选" className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={selectedMapId === null}
              onClick={() => setSelectedMapId(null)}
              className={`min-h-11 touch-manipulation rounded border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 ${
                selectedMapId === null
                  ? "border-[#d1ac69]/70 bg-[#d1ac69]/15 text-[#e1c58f]"
                  : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-700 hover:text-white"
              }`}
            >
              全部地图
            </button>
            {mapOptions.map((map) => {
              const selected = selectedMapId === map.id;
              return (
                <button
                  key={map.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSelectedMapId(map.id)}
                  className={`min-h-11 touch-manipulation rounded border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 ${
                    selected
                      ? "border-[#d1ac69]/70 bg-[#d1ac69]/15 text-[#e1c58f]"
                      : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-700 hover:text-white"
                  }`}
                >
                  {map.name}
                </button>
              );
            })}
          </div>
        </div>
        <BossDifficultyControl className="mt-5 border-t border-zinc-700/80 pt-5" />
      </section>

      {visibleGroups.length > 0 ? (
        <div className="space-y-12">
          {visibleGroups.map((group, groupIndex) => {
            const headingId = `boss-map-${group.id}`;
            return (
              <section key={group.id} aria-labelledby={headingId}>
                <MapBanner
                  group={group}
                  headingId={headingId}
                  eager={groupIndex === 0}
                />
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] sm:gap-4">
                  {group.bosses.map((boss, bossIndex) => (
                    <BossCard
                      key={boss.slug}
                      boss={boss}
                      eager={groupIndex === 0 && bossIndex < 6}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/30 px-4 text-center">
          <p className="text-zinc-400">没有符合条件的首领</p>
          <button
            type="button"
            onClick={resetFilters}
            className="flex min-h-11 items-center gap-2 rounded px-3 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
            重置筛选
          </button>
        </div>
      )}
    </div>
  );
}
