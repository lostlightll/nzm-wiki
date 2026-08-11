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
          className={`flex min-w-0 flex-col overflow-hidden rounded-lg border bg-emerald-400/[0.07] transition-colors motion-reduce:transition-none ${CARD_STYLES[card.type]}`}
        >
          <div className="relative aspect-[960/1266] overflow-hidden bg-emerald-400/[0.04]">
            <Link
              href={`/cards/${card.slug}`}
              aria-label={`查看${card.title}详情`}
              className="absolute inset-0 focus-visible:outline-none focus-visible:underline"
            >
              <Image
                src={getAssetPath(card.icon)}
                alt={card.title}
                fill
                sizes="(max-width: 639px) 50vw, (max-width: 767px) 33vw, (max-width: 1023px) 25vw, 20vw"
                className="object-cover"
              />
            </Link>
          </div>
          <div className="flex flex-1 flex-col p-2.5 sm:p-3">
            <div className="flex items-start justify-between gap-2">
              <Link
                href={`/cards/${card.slug}`}
                className="min-w-0 text-sm font-semibold leading-6 text-zinc-100 no-underline hover:text-white focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-4"
              >
                {card.title}
              </Link>
              <MultiplierSourceBadges
                source={{ type: "card", slug: card.slug }}
                variant="catalog-compact"
                className="shrink-0"
              />
            </div>
            <p className="mt-1.5 text-xs leading-5 text-zinc-300">
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
