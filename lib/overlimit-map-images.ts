import { getLcMapImagePath } from "@/lib/lc-maps";

// Rotation maps may arrive before their full hunting-ground catalog entries.
const ROTATION_MAP_IMAGES: Readonly<Record<string, string>> = {
  "朔望计划": "/webp/images/overlimit/maps/T_Bg_Loading_72.webp",
  "禁魔岛": "/webp/images/overlimit/maps/T_Bg_Loading_73.webp",
};

export function getOverlimitMapImagePath(mapName: string): string | null {
  return getLcMapImagePath(mapName) ?? ROTATION_MAP_IMAGES[mapName] ?? null;
}
