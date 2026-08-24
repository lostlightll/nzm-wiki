import overlimitCards from "@/data/overlimit-cards.json";
import { getAllPerks } from "@/lib/perks";
import type { OverlimitCard } from "@/types";

let cachedCards: OverlimitCard[] | undefined;

export function getAllOverlimitCards(): OverlimitCard[] {
  if (cachedCards) return cachedCards;

  const perksByItemId = new Map(
    getAllPerks().map((perk) => [perk.itemId, perk] as const),
  );
  cachedCards = (overlimitCards as OverlimitCard[]).map((card) => {
    const perk = perksByItemId.get(card.id);
    if (!perk) {
      throw new Error(`超限卡片 ${card.id} ${card.name} 没有同 ItemID 插件实体`);
    }
    return {
      ...card,
      description: perk.description || card.description,
      effectValues: perk.effectValues,
    };
  });
  return cachedCards;
}

export function getOverlimitCardById(id: string): OverlimitCard | undefined {
  return getAllOverlimitCards().find((card) => card.id === id);
}
