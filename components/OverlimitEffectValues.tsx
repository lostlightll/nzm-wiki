import {
  EffectValuesCatalog,
  EffectValuesPanel,
} from "@/components/EffectValues";
import { getProviderRelationsForSource } from "@/lib/multiplier-data";
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
    return <EffectValuesCatalog effects={effects} />;
  }

  return (
    <EffectValuesPanel
      id="multiplier-provider"
      effects={effects}
      relations={getProviderRelationsForSource({
        type: "overlimit-card",
        id: card.id,
      })}
      flush
    />
  );
}
