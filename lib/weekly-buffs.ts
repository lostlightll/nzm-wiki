import rawWeeklyBuffs from "@/data/guides/weekly-buffs.json";
import type { MultiplierFactorId } from "@/lib/multiplier-data";

export type WeeklyBuffIndexKind = "direct" | "critical" | "extra" | "utility";

export type WeeklyBuff = {
  id: number;
  name: string;
  description: string;
  icon: string;
  indexKind: WeeklyBuffIndexKind;
  indexLabel?: string;
  factorId?: MultiplierFactorId;
  modifierTypeId?: string;
};

export type WeeklyBuffPool = {
  id: "a" | "b";
  label: string;
  maps: readonly string[];
  rotations: readonly (readonly number[])[];
};

type RawWeeklyBuffData = {
  schemaVersion: 1;
  rotationAnchor: string;
  rotationDays: number;
  pools: WeeklyBuffPool[];
  buffs: Record<string, Omit<WeeklyBuff, "id">>;
};

function assertWeeklyBuffData(value: unknown): asserts value is RawWeeklyBuffData {
  if (!value || typeof value !== "object") throw new Error("周 Buff 数据无效");
  const data = value as Partial<RawWeeklyBuffData>;
  if (
    data.schemaVersion !== 1 ||
    typeof data.rotationAnchor !== "string" ||
    !Number.isFinite(Date.parse(data.rotationAnchor)) ||
    !Number.isInteger(data.rotationDays) ||
    (data.rotationDays ?? 0) <= 0 ||
    !Array.isArray(data.pools) ||
    !data.buffs ||
    typeof data.buffs !== "object"
  ) {
    throw new Error("周 Buff 顶层数据无效");
  }

  const poolIds = new Set<string>();
  for (const pool of data.pools) {
    if (
      (pool.id !== "a" && pool.id !== "b") ||
      poolIds.has(pool.id) ||
      typeof pool.label !== "string" ||
      !Array.isArray(pool.maps) ||
      !Array.isArray(pool.rotations) ||
      pool.rotations.length !== 3 ||
      pool.rotations.some(
        (rotation) =>
          !Array.isArray(rotation) ||
          rotation.length !== 3 ||
          rotation.some((id) => !data.buffs?.[String(id)]),
      )
    ) {
      throw new Error("周 Buff 地图池或轮换数据无效");
    }
    poolIds.add(pool.id);
  }
}

assertWeeklyBuffData(rawWeeklyBuffs);
const data = rawWeeklyBuffs as unknown as RawWeeklyBuffData;

export const WEEKLY_BUFF_ROTATION_ANCHOR = data.rotationAnchor;
export const WEEKLY_BUFF_ROTATION_DAYS = data.rotationDays;
export const WEEKLY_BUFF_POOLS: readonly WeeklyBuffPool[] = data.pools;
export const WEEKLY_BUFFS: Readonly<Record<number, WeeklyBuff>> = Object.fromEntries(
  Object.entries(data.buffs).map(([id, buff]) => [
    Number(id),
    { id: Number(id), ...buff },
  ]),
);

const ROTATION_COUNT = WEEKLY_BUFF_POOLS[0]?.rotations.length ?? 3;
const ROTATION_MS = WEEKLY_BUFF_ROTATION_DAYS * 24 * 60 * 60 * 1000;
const ANCHOR_MS = Date.parse(WEEKLY_BUFF_ROTATION_ANCHOR);

function positiveModulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

export type WeeklyBuffRotationWindow = {
  rotationIndex: number;
  nextRotationIndex: number;
  startsAt: Date;
  endsAt: Date;
};

export function getWeeklyBuffRotationWindow(
  input: Date | number = Date.now(),
): WeeklyBuffRotationWindow {
  const timestamp = input instanceof Date ? input.getTime() : input;
  const elapsedRotations = Math.floor((timestamp - ANCHOR_MS) / ROTATION_MS);
  const rotationIndex = positiveModulo(elapsedRotations, ROTATION_COUNT) + 1;
  const startsAt = new Date(ANCHOR_MS + elapsedRotations * ROTATION_MS);

  return {
    rotationIndex,
    nextRotationIndex: (rotationIndex % ROTATION_COUNT) + 1,
    startsAt,
    endsAt: new Date(startsAt.getTime() + ROTATION_MS),
  };
}

export function getWeeklyBuffsForRotation(
  pool: WeeklyBuffPool,
  rotationIndex: number,
): readonly WeeklyBuff[] {
  const ids = pool.rotations[rotationIndex - 1] ?? [];
  return ids.map((id) => WEEKLY_BUFFS[id]).filter(Boolean);
}

export const WEEKLY_BUFF_DAMAGE_INDEX = Object.values(WEEKLY_BUFFS).filter(
  (buff) => buff.indexKind !== "utility",
);
