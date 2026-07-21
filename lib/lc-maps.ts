export interface LcMapMeta {
  id: string;
  name: string;
  image: string;
}

export const LC_MAPS: readonly LcMapMeta[] = [
  {
    id: "metropolis",
    name: "大都会",
    image: "/webp/images/overlimit/maps/T_Bg_Loading_07.webp",
  },
  {
    id: "dark-easter",
    name: "黑暗复活节",
    image: "/webp/images/overlimit/maps/T_Bg_Loading_13.webp",
  },
  {
    id: "ice-origin",
    name: "冰点源起",
    image: "/webp/images/overlimit/maps/T_Bg_Loading_26.webp",
  },
  {
    id: "kunlun-palace",
    name: "昆仑神宫",
    image: "/webp/images/overlimit/maps/T_Bg_Loading_38.webp",
  },
  {
    id: "jingjue-city",
    name: "精绝古城",
    image: "/webp/images/overlimit/maps/T_Bg_Loading_37.webp",
  },
  {
    id: "sakura-abyss",
    name: "樱之渊",
    image: "/webp/images/overlimit/maps/T_Bg_Loading_49.webp",
  },
  {
    id: "sakura-city",
    name: "樱之城",
    image: "/webp/images/overlimit/maps/T_Bg_Loading_21.webp",
  },
  {
    id: "gilded-city",
    name: "销金之城",
    image: "/webp/images/overlimit/maps/T_Bg_Loading_59.webp",
  },
  {
    id: "jungle-shadow",
    name: "丛林魅影",
    image: "/webp/images/overlimit/maps/T_Bg_Loading_29.webp",
  },
] as const;

const LC_MAP_BY_NAME = new Map(LC_MAPS.map((map) => [map.name, map]));

export function getLcMapMeta(mapName: string): LcMapMeta | null {
  return LC_MAP_BY_NAME.get(mapName) ?? null;
}

export function getLcMapImagePath(mapName: string): string | null {
  return getLcMapMeta(mapName)?.image ?? null;
}
