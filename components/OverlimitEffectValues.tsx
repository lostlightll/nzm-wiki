import {
  EffectValuesCatalog,
  EffectValuesPanel,
} from "@/components/EffectValues";
import type { OverlimitCard } from "@/types";
import { getProviderRelationsForSource } from "@/lib/multiplier-data";

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
    const previewEffects = effects.length > 2
      ? effects.filter(effect => effect.kind !== "stat" || effect.statId !== "movement-speed")
      : effects;
    return <EffectValuesCatalog effects={previewEffects} />;
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
