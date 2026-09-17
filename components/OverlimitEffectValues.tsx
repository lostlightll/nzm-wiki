import {
  EffectValuesCatalog,
  EffectValuesPanel,
} from "@/components/EffectValues";
import type { OverlimitCard } from "@/types";

export function OverlimitEffectValues({
  card,
  variant,
}: {
  card: OverlimitCard;
  variant: "catalog" | "detail";
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
      flush
    />
  );
}
