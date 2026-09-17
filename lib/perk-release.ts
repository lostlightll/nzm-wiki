import type { Perk } from "@/types";
import { isDateKeyWithinPastDays } from "@/lib/date-key";
import { isPreviewSeason } from "@/lib/content-preview";

export const RECENT_PERK_WINDOW_DAYS = 7;

export function getPerkAvailability(
  perk: Pick<Perk, "collectModItem" | "season">,
): "preview" | "online" | "offline" {
  if (isPreviewSeason(perk.season)) return "preview";
  return perk.collectModItem === 1 ? "online" : "offline";
}

export function isPerkRecent(
  perk: Pick<Perk, "collectModItem" | "releaseDate" | "season">,
  todayKey: string,
): boolean {
  return (
    getPerkAvailability(perk) === "online" &&
    isDateKeyWithinPastDays(
      perk.releaseDate,
      todayKey,
      RECENT_PERK_WINDOW_DAYS,
    )
  );
}
