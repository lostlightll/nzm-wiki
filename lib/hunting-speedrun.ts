import rawHuntingSpeedrun from "@/data/guides/hunting-speedrun.json";
import cardsData from "@/data/cards-data.json";

export type HuntingSpeedrunCard = {
  cardId: number;
  slug: keyof typeof cardsData;
  functionIds: readonly number[];
  title: string;
  type: "buff" | "debuff";
  icon: string;
  effect: string;
};

export type HuntingSpeedrunTacticalProp = {
  id: number;
  name: string;
  description: string;
  icon: string;
};

type RawHuntingSpeedrunData = {
  schemaVersion: 1;
  cards: {
    cardId: number;
    slug: keyof typeof cardsData;
    functionIds: number[];
  }[];
  tacticalProps: HuntingSpeedrunTacticalProp[];
};

function assertHuntingSpeedrunData(
  value: unknown,
): asserts value is RawHuntingSpeedrunData {
  if (!value || typeof value !== "object") {
    throw new Error("猎场竞速数据无效");
  }

  const data = value as Partial<RawHuntingSpeedrunData>;
  if (
    data.schemaVersion !== 1 ||
    !Array.isArray(data.cards) ||
    !Array.isArray(data.tacticalProps)
  ) {
    throw new Error("猎场竞速顶层数据无效");
  }

  const cardIds = new Set<number>();
  const slugs = new Set<string>();
  for (const card of data.cards) {
    if (
      !Number.isInteger(card.cardId) ||
      cardIds.has(card.cardId) ||
      typeof card.slug !== "string" ||
      slugs.has(card.slug) ||
      !(card.slug in cardsData) ||
      !Array.isArray(card.functionIds) ||
      card.functionIds.some((id) => !Number.isInteger(id))
    ) {
      throw new Error("猎场竞速卡片数据无效");
    }
    cardIds.add(card.cardId);
    slugs.add(card.slug);
  }

  const propIds = new Set<number>();
  const propNames = new Set<string>();
  for (const prop of data.tacticalProps) {
    if (
      !Number.isInteger(prop.id) ||
      propIds.has(prop.id) ||
      typeof prop.name !== "string" ||
      prop.name.length === 0 ||
      propNames.has(prop.name) ||
      typeof prop.description !== "string" ||
      prop.description.length === 0 ||
      typeof prop.icon !== "string" ||
      !prop.icon.startsWith("/")
    ) {
      throw new Error("猎场竞速战术道具数据无效");
    }
    propIds.add(prop.id);
    propNames.add(prop.name);
  }
}

assertHuntingSpeedrunData(rawHuntingSpeedrun);

export const HUNTING_SPEEDRUN_CARDS: readonly HuntingSpeedrunCard[] =
  rawHuntingSpeedrun.cards.map((entry) => {
    const card = cardsData[entry.slug];
    return {
      ...entry,
      title: card.title,
      type: card.type as "buff" | "debuff",
      icon: card.icon,
      effect: card.effect,
    };
  });

export const HUNTING_SPEEDRUN_TACTICAL_PROPS: readonly HuntingSpeedrunTacticalProp[] =
  rawHuntingSpeedrun.tacticalProps;
