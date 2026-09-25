import data from "@/data/enemies/lc/boss/origin-health.json";
import type { BossDifficulty } from "@/types";

export type OriginDifficulty = Exclude<BossDifficulty, "overlimit">;

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
