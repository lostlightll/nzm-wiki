import Image from "next/image";
import { Crosshair, Layers3, Scale, Sparkles } from "lucide-react";
import {
  OVERLIMIT_QUALITY_STYLES,
  OVERLIMIT_SLOT_LABELS,
  OverlimitTagBadge,
  OverlimitWeaponApplicability,
} from "@/components/OverlimitCardMeta";
import { getAssetPath } from "@/lib/path";
import type { OverlimitCard } from "@/types";

export function OverlimitCardDetail({ card }: { card: OverlimitCard }) {
  const qualityStyle =
    OVERLIMIT_QUALITY_STYLES[card.quality] ?? OVERLIMIT_QUALITY_STYLES[4];

  return (
    <article
      className={`overflow-hidden rounded-lg border-2 ${qualityStyle.border} ${qualityStyle.bg}`}
    >
      <div aria-hidden="true" className={`h-1 w-full ${qualityStyle.bar}`} />
      <header className="flex items-start gap-4 p-4 sm:items-center sm:gap-6 sm:p-6">
        <Image
          src={getAssetPath(card.icon)}
          alt={card.name}
          width={128}
          height={128}
          priority
          className="h-24 w-24 shrink-0 object-contain sm:h-32 sm:w-32"
          style={{ filter: qualityStyle.iconFilter }}
        />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-white sm:text-2xl">{card.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex min-h-8 items-center rounded border border-current/25 bg-black/10 px-2.5 py-1 text-sm font-medium ${qualityStyle.text}`}
            >
              {qualityStyle.label}
            </span>
            <span className="inline-flex min-h-8 items-center gap-1.5 rounded border border-white/10 bg-black/15 px-2.5 py-1 text-sm text-zinc-300">
              <Layers3 aria-hidden="true" className="h-4 w-4 text-zinc-500" />
              {OVERLIMIT_SLOT_LABELS[card.slot]}
            </span>
            {card.tags.map((tag) => (
              <OverlimitTagBadge key={tag.id} tag={tag} />
            ))}
          </div>
        </div>
      </header>

      <section className="border-t border-white/10 px-4 py-5 sm:px-6">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-400">
          <Sparkles aria-hidden="true" className="h-4 w-4 text-[#d1ac69]" />
          卡片效果
        </h2>
        <p className="text-base leading-7 text-zinc-200">{card.description}</p>
      </section>

      <div className="grid border-t border-white/10 md:grid-cols-[minmax(0,1fr)_14rem]">
        <section className="px-4 py-5 sm:px-6 md:border-r md:border-white/10">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-400">
            <Crosshair aria-hidden="true" className="h-4 w-4 text-[#d1ac69]" />
            适用武器
          </h2>
          <OverlimitWeaponApplicability
            weaponType={card.weaponType}
            weaponNames={card.weaponNames}
          />
        </section>

        <section className="border-t border-white/10 px-4 py-5 sm:px-6 md:border-t-0">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-400">
            <Scale aria-hidden="true" className="h-4 w-4 text-[#d1ac69]" />
            抽取权重
          </h2>
          <p className="text-3xl font-bold tabular-nums text-[#e2c38b]">
            {card.weight}
          </p>
          <p className="mt-2 text-xs leading-5 text-zinc-500">
            随机池内的相对权重；实际概率还受品质、等级和候选池影响。
          </p>
        </section>
      </div>
    </article>
  );
}
