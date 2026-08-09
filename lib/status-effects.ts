import statusEffectData from "@/data/status-effects.json";
import type {
  StatusEffectCatalogEntry,
  StatusEffectDataLock,
  StatusEffectModifierReference,
  StatusEffectNumericalReference,
  StatusEffectTarget,
} from "@/types";

const data = statusEffectData as unknown as StatusEffectDataLock;

function pickReferences<T>(
  source: Record<string, T[]>,
  ids: Set<number>,
): Record<string, T[]> {
  return Object.fromEntries(
    [...ids]
      .sort((left, right) => left - right)
      .flatMap((id) => {
        const value = source[String(id)];
        return value ? [[String(id), value] as const] : [];
      }),
  );
}

export function getStatusEffectCatalog(target: StatusEffectTarget): {
  entries: StatusEffectCatalogEntry[];
  modifiers: Record<string, StatusEffectModifierReference[]>;
  numericals: Record<string, StatusEffectNumericalReference[]>;
} {
  const entries = data.effects.filter((entry) => entry.targets.includes(target));
  const modifierIds = new Set(
    entries.flatMap((entry) =>
      entry.variants.flatMap((variant) => variant.modifierIds),
    ),
  );
  const numericalIds = new Set(
    entries.flatMap((entry) =>
      entry.variants.flatMap((variant) =>
        variant.numericalId === null ? [] : [variant.numericalId],
      ),
    ),
  );

  return {
    entries,
    modifiers: pickReferences(data.references.modifiers, modifierIds),
    numericals: pickReferences(data.references.numericals, numericalIds),
  };
}

export function getElementStatusSummaries() {
  return data.elements;
}

