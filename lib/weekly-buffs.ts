import rawWeeklyBuffs from "@/data/guides/weekly-buffs.json";
import { MODIFIER_TYPES, type MultiplierFactorId } from "@/lib/multiplier-data";

export type WeeklyBuffIndexKind = "direct" | "critical" | "extra" | "utility";
export type WeeklyBuffDifficulty = "torment" | "inferno";
export type WeeklyBuffDamageChannel = {
  row: `lc:${string}`;
  modifierTypeId: string;
};

export type WeeklyBuff = {
  id: number;
  name: string;
  description: string;
  icon: string;
  indexKind: WeeklyBuffIndexKind;
  indexLabel?: string;
  damageChannels?: readonly WeeklyBuffDamageChannel[];
};

export type WeeklyBuffPool = {
  id: "a" | "b";
  label: string;
  maps: Readonly<Record<WeeklyBuffDifficulty, readonly string[]>>;
  rotations: readonly (readonly number[])[];
};

type RawWeeklyBuffData = {
  schemaVersion: 3;
  rotationAnchor: string;
  rotationDays: number;
  pools: WeeklyBuffPool[];
  buffs: Record<string, Omit<WeeklyBuff, "id">>;
};

function assertWeeklyBuffData(value: unknown): asserts value is RawWeeklyBuffData {
  if (!value || typeof value !== "object") throw new Error("周 Buff 数据无效");
  const data = value as Partial<RawWeeklyBuffData>;
  if (
    data.schemaVersion !== 3 ||
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
  const modifierTypeIds = new Set(MODIFIER_TYPES.map((type) => type.id));

  for (const buffValue of Object.values(data.buffs)) {
    const buff = buffValue as Partial<Omit<WeeklyBuff, "id">> &
      Record<string, unknown>;
    const channels = buff.damageChannels;
    const validChannels = Array.isArray(channels) && channels.length > 0 &&
      channels.every((channel) =>
        /^lc:\d+_\d+_\d+$/.test(channel.row) &&
        modifierTypeIds.has(channel.modifierTypeId),
      ) && new Set(channels.map((channel) => channel.row)).size === channels.length;
    const hasIndexLabel =
      typeof buff.indexLabel === "string" && buff.indexLabel.length > 0;

    if (
      typeof buff.name !== "string" ||
      typeof buff.description !== "string" ||
      typeof buff.icon !== "string" ||
      !["direct", "critical", "extra", "utility"].includes(
        buff.indexKind ?? "",
      ) ||
      Object.hasOwn(buff, "factorId") ||
      (channels !== undefined && !validChannels) ||
      (buff.indexKind === "direct" && (!validChannels || hasIndexLabel)) ||
      (buff.indexKind === "critical" && (channels !== undefined || !hasIndexLabel)) ||
      (buff.indexKind === "extra" && !hasIndexLabel) ||
      (buff.indexKind === "utility" && (channels !== undefined || hasIndexLabel))
    ) {
      throw new Error("周 Buff 索引数据无效");
    }
  }

  for (const pool of data.pools) {
    if (
      (pool.id !== "a" && pool.id !== "b") ||
      poolIds.has(pool.id) ||
      typeof pool.label !== "string" ||
      !pool.maps ||
      !["torment", "inferno"].every((difficulty) => {
        const maps = pool.maps[difficulty as WeeklyBuffDifficulty];
        return Array.isArray(maps) && maps.length > 0 &&
          maps.every((map) => typeof map === "string" && map.length > 0);
      }) ||
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

const modifierTypeById = new Map(MODIFIER_TYPES.map((type) => [type.id, type]));

export function getWeeklyBuffFactors(buff: WeeklyBuff): readonly {
  factorId: MultiplierFactorId;
  channels: readonly WeeklyBuffDamageChannel[];
}[] {
  const groups = new Map<MultiplierFactorId, WeeklyBuffDamageChannel[]>();
  for (const channel of buff.damageChannels ?? []) {
    const factorId = modifierTypeById.get(channel.modifierTypeId)!.factorId;
    groups.set(factorId, [...(groups.get(factorId) ?? []), channel]);
  }
  return [...groups].map(([factorId, channels]) => ({ factorId, channels }));
}
