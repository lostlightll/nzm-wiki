import type { Perk, PerkSlot, Rarity } from "@/types";
import { getMDXDetail } from "@/lib/mdx";
import { getPerkSourceEntries, type PerkChannel } from "@/lib/perk-source";
import { getPerkPreviewCatalog, getPerkPreviewEntry } from "@/lib/perk-preview";

/** Unqualified lookups always use the current release. */
export function getAllPerks(): Perk[] {
  return getPerkSourceEntries("current").map(entry => entry.perk);
}

export function getAllPublishedPerks(): Perk[] {
  return [...getAllPerks(), ...(getPerkPreviewCatalog()?.entries.map(entry => entry.perk) ?? [])];
}

export function getPerkBySlug(slug: string): Perk | undefined {
  return slug.startsWith("preview/")
    ? getPerkPreviewEntry(slug)?.perk
    : getAllPerks().find(perk => perk.slug === slug);
}

export function getPerkByItemId(itemId: string, channel: PerkChannel = "current"): Perk | undefined {
  const perks = channel === "preview"
    ? getPerkPreviewCatalog()?.entries.map(entry => entry.perk) ?? []
    : getAllPerks();
  return perks.find(perk => perk.itemId === itemId);
}

export function getPerkDocument(slug: string) {
  if (!slug.startsWith("preview/")) return getMDXDetail("perks", slug);
  const entry = getPerkPreviewEntry(slug);
  if (!entry) throw new Error(`Missing published preview perk: ${slug}`);
  return { slug, content: entry.content, metadata: entry.metadata };
}

export function getPerkByName(name: string, channel: PerkChannel = "current"): Perk | null {
  const perks = channel === "preview"
    ? getPerkPreviewCatalog()?.entries.map(entry => entry.perk) ?? []
    : getAllPerks();
  return perks.find(perk => perk.id === name) ?? null;
}

export function getPerksByCategory(category: string): Perk[] {
  return getAllPerks().filter(perk => perk.category === category);
}

export function getPerksBySlot(slot: PerkSlot): Perk[] {
  return getAllPerks().filter(perk => perk.slot === slot);
}

export function getPerksByRarity(rarity: Rarity): Perk[] {
  return getAllPerks().filter(perk => perk.rarity === rarity);
}
