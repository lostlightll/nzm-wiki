import data from "@/data/enemies/lc/boss/origin-health.json";
import routes from "@/data/enemies/lc/boss/origin-routes.json";
import type { BossDifficulty } from "@/types";

export type OriginDifficulty = Exclude<BossDifficulty, "overlimit">;
export type OriginRouteBoss = { slug: string; roomIndices: number[] | null };
export type OriginRoute = {
  id: string;
  name: string;
  difficulties: Partial<Record<OriginDifficulty, OriginRouteBoss[]>>;
};
export const ORIGIN_ROUTES: readonly OriginRoute[] = routes;

const originData = data as {
  rooms: Record<OriginDifficulty, number[]>;
  bosses: Record<string, Partial<Record<OriginDifficulty, number[]>>>;
};

export function getOriginRooms(difficulty: OriginDifficulty): readonly number[] {
  return originData.rooms[difficulty];
}

export function getOriginBossHealth(
  slug: string,
  difficulty: OriginDifficulty,
  roomIndex: number | null,
): number[] | undefined {
  const base = originData.bosses[slug]?.[difficulty];
  if (!base) return undefined;
  if (roomIndex === null) return base;
  const multiplier = getOriginRooms(difficulty)[roomIndex];
  return multiplier === undefined ? undefined : base.map((value) => Math.round(value * multiplier));
}

export function getOriginBossRoomIndices(slug: string, difficulty: OriginDifficulty): readonly number[] | null {
  for (const route of ORIGIN_ROUTES) {
    const entry = route.difficulties[difficulty]?.find((boss) => boss.slug === slug);
    if (entry) return entry.roomIndices;
  }
  return null;
}

export function getOriginBossDisplayHealth(
  slug: string,
  difficulty: OriginDifficulty,
  roomIndex: number | null,
): number[] | undefined {
  if (roomIndex !== null) return getOriginBossHealth(slug, difficulty, roomIndex);
  const base = getOriginBossHealth(slug, difficulty, null);
  const indices = getOriginBossRoomIndices(slug, difficulty);
  if (!base || !indices) return base;
  return base.map((value, index) => Math.round(value * getOriginRooms(difficulty)[indices[index]]));
}
