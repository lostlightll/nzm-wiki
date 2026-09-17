import { getOverlimitCatalog } from "@/lib/overlimit";
import type { OverlimitCard } from "@/types";

export function getAllOverlimitCards(): OverlimitCard[] {
  return getOverlimitCatalog().cards;
}

export function getOverlimitCardById(id: string): OverlimitCard | undefined {
  return getAllOverlimitCards().find((card) => card.id === id);
}
