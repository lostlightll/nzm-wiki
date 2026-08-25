import rawRuntime from "@/data/modifier-index-runtime.json";

export type RuntimeModifierFacet = {
  id: string;
  label: string;
  consumer: "damage" | "stat" | "index";
};

export type RuntimeModifierAttributeType = {
  id: string;
  label: string;
  family: string;
  quantity: string;
  default_format: string;
  facets: Partial<
    Record<"increase" | "decrease" | "neutral" | "unknown", RuntimeModifierFacet>
  >;
};

export type RuntimeModifierEffect = {
  row: string;
  attributeTypeId: string;
  attributeLabel: string;
  direction: "increase" | "decrease" | "neutral" | "unknown";
  recipient: "self" | "ally" | "enemy" | "damage-event" | "unknown";
  facetIds: readonly string[];
  reviewed: boolean;
};

export type RuntimeModifierProvider = {
  id: string;
  label: string;
  source: Readonly<Record<string, unknown>> & { type: string };
  facetIds: readonly string[];
  effects: readonly RuntimeModifierEffect[];
  reviewedOverride: boolean;
};

type RuntimeModifierIndex = {
  schemaVersion: 1;
  attributeTypes: readonly RuntimeModifierAttributeType[];
  providers: readonly RuntimeModifierProvider[];
};

const runtime = rawRuntime as unknown as RuntimeModifierIndex;
if (runtime.schemaVersion !== 1) {
  throw new Error("modifier-index-runtime.json uses an unsupported schema");
}

export const MODIFIER_ATTRIBUTE_TYPES = runtime.attributeTypes;
export const MODIFIER_INDEX_PROVIDERS = runtime.providers;

function sourceKey(source: Readonly<Record<string, unknown>>): string {
  return Object.entries(source)
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(([key, value]) => `${key}:${String(value)}`)
    .join("|");
}

export function getModifierProvider(
  id: string,
): RuntimeModifierProvider | undefined {
  return MODIFIER_INDEX_PROVIDERS.find((provider) => provider.id === id);
}

export function getModifierProvidersForSource(
  source: Readonly<Record<string, unknown>>,
): readonly RuntimeModifierProvider[] {
  const key = sourceKey(source);
  return MODIFIER_INDEX_PROVIDERS.filter(
    (provider) => sourceKey(provider.source) === key,
  );
}

export function getModifierProvidersForFacet(
  facetId: string,
): readonly RuntimeModifierProvider[] {
  return MODIFIER_INDEX_PROVIDERS.filter((provider) =>
    provider.facetIds.includes(facetId),
  );
}

export function getModifierProvidersForAttributeType(
  attributeTypeId: string,
): readonly RuntimeModifierProvider[] {
  return MODIFIER_INDEX_PROVIDERS.filter((provider) =>
    provider.effects.some((effect) => effect.attributeTypeId === attributeTypeId),
  );
}

export function getModifierProvidersForDirection(
  direction: RuntimeModifierEffect["direction"],
): readonly RuntimeModifierProvider[] {
  return MODIFIER_INDEX_PROVIDERS.filter((provider) =>
    provider.effects.some((effect) => effect.direction === direction),
  );
}

export function getModifierProvidersForRecipient(
  recipient: RuntimeModifierEffect["recipient"],
): readonly RuntimeModifierProvider[] {
  return MODIFIER_INDEX_PROVIDERS.filter((provider) =>
    provider.effects.some((effect) => effect.recipient === recipient),
  );
}
