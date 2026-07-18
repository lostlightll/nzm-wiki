const OVERLIMIT_MAP_IMAGE_PATHS: Readonly<Record<string, string>> = {
  大都会: "/webp/images/overlimit/maps/T_Bg_Loading_07.webp",
  昆仑神宫: "/webp/images/overlimit/maps/T_Bg_Loading_38.webp",
  精绝古城: "/webp/images/overlimit/maps/T_Bg_Loading_37.webp",
  丛林魅影: "/webp/images/overlimit/maps/T_Bg_Loading_29.webp",
  销金之城: "/webp/images/overlimit/maps/T_Bg_Loading_59.webp",
  樱之渊: "/webp/images/overlimit/maps/T_Bg_Loading_49.webp",
  樱之城: "/webp/images/overlimit/maps/T_Bg_Loading_21.webp",
  黑暗复活节: "/webp/images/overlimit/maps/T_Bg_Loading_13.webp",
  冰点源起: "/webp/images/overlimit/maps/T_Bg_Loading_26.webp",
};

export function getOverlimitMapImagePath(mapName: string): string | null {
  return OVERLIMIT_MAP_IMAGE_PATHS[mapName] ?? null;
}
