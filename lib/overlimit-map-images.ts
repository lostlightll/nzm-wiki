import { getLcMapImagePath } from "@/lib/lc-maps";

export function getOverlimitMapImagePath(mapName: string): string | null {
  return getLcMapImagePath(mapName);
}
