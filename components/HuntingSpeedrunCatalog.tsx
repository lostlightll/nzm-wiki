import Image from "next/image";
import Link from "next/link";
import { MultiplierSourceBadges } from "@/components/MultiplierBadges";
import {
  HUNTING_SPEEDRUN_CARDS,
  HUNTING_SPEEDRUN_TACTICAL_PROPS,
} from "@/lib/hunting-speedrun";
import { getAssetPath } from "@/lib/path";

const CARD_STYLES = {
  buff: "border-green-500/40 hover:border-green-500/70",
  debuff: "border-red-500/40 hover:border-red-500/70",
};

export function HuntingSpeedrunCardCatalog() {
  return (
    <div className="not-prose grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 lg:gap-4">
      {HUNTING_SPEEDRUN_CARDS.map((card) => (
        <article
          key={card.cardId}
          className={`group/card relative aspect-[960/1266] min-w-0 overflow-hidden rounded-lg border bg-zinc-950 transition-colors motion-reduce:transition-none ${CARD_STYLES[card.type]}`}
        >
          <Image
            src={getAssetPath(card.icon)}
            alt={card.title}
            fill
            sizes="(max-width: 639px) 50vw, (max-width: 767px) 33vw, (max-width: 1023px) 25vw, 20vw"
            className="scale-[1.2] object-cover"
          />
          <Link
            href={`/cards/${card.slug}`}
            aria-label={`查看${card.title}详情`}
            className="peer absolute inset-0 z-10 focus-visible:outline-none"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-linear-to-t from-zinc-950 via-zinc-950/90 to-transparent px-2.5 pb-2.5 pt-14 sm:px-3 sm:pb-3 sm:pt-16">
            <div className="flex items-start justify-between gap-2">
              <h3
                className="min-w-0 text-xs font-semibold leading-5 text-zinc-100 group-hover/card:text-white peer-focus-visible:underline peer-focus-visible:decoration-2 peer-focus-visible:underline-offset-4 sm:text-sm"
              >
                {card.title}
              </h3>
              <MultiplierSourceBadges
                source={{ type: "card", slug: card.slug }}
                variant="catalog-compact"
                className="pointer-events-auto shrink-0"
              />
            </div>
            <p className="mt-1 line-clamp-2 text-[11px] leading-[18px] text-zinc-300 sm:text-xs sm:leading-5">
              {card.effect}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}

export function HuntingSpeedrunTacticalPropCatalog() {
  return (
    <div className="not-prose grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {HUNTING_SPEEDRUN_TACTICAL_PROPS.map((prop) => (
        <article
          key={prop.id}
          className="flex min-h-40 gap-4 rounded-lg border border-zinc-700 bg-zinc-900/70 p-4 sm:p-5"
        >
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-zinc-600 bg-zinc-950">
            <Image
              src={getAssetPath(prop.icon)}
              alt=""
              fill
              sizes="64px"
              className="object-contain p-1"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold leading-7 text-zinc-100">
              {prop.name}
            </h3>
            <p className="mt-3 text-sm leading-6 text-zinc-300">
              {prop.description}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}
