import {
  EffectValuesCatalog,
  EffectValuesPanel,
} from "@/components/EffectValues";
import type { OverlimitCard } from "@/types";
import { getProviderRelationsForSource } from "@/lib/multiplier-data";

export function getOverlimitCatalogEffects(card: OverlimitCard) {
  const effects = card.effectValues ?? [];
  return effects.length > 2
    ? effects.filter(effect => effect.kind !== "stat" || effect.statId !== "movement-speed")
    : effects;
}

export function OverlimitEffectValues({
  card,
  variant,
  sourceSeason,
}: {
  card: OverlimitCard;
  variant: "catalog" | "detail";
  sourceSeason?: string;
}) {
  const effects = card.effectValues ?? [];
  if (variant === "catalog") {
    const catalogEffects = getOverlimitCatalogEffects(card).map(effect =>
      effect.kind === "stat" && effect.statId === "element-debuff-chance"
        ? { ...effect, label: "元素概率" }
        : effect,
    );
    return <EffectValuesCatalog effects={catalogEffects} columns={catalogEffects.length >= 4 ? 2 : 1} />;
  }

  return (
    <EffectValuesPanel
      id="multiplier-provider"
      effects={effects}
      relations={getProviderRelationsForSource({ type: "overlimit-card", id: card.id, ...(sourceSeason ? { season: sourceSeason } : {}) })}
      flush
    />
  );
}
