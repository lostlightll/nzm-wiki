import type { Perk } from "@/types";
import { isDateKeyWithinPastDays } from "@/lib/date-key";

export const RECENT_PERK_WINDOW_DAYS = 7;

export function isPerkRecent(
  perk: Pick<Perk, "collectModItem" | "releaseDate">,
  todayKey: string,
): boolean {
  return (
    perk.collectModItem === 1 &&
    isDateKeyWithinPastDays(
      perk.releaseDate,
      todayKey,
      RECENT_PERK_WINDOW_DAYS,
    )
  );
}
