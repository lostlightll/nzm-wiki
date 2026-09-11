import type { BossDifficulty } from "@/types";

export const MONSTER_KINDS = { normal: "普通", captain: "队长", elite: "精英" } as const;
export type MonsterKind = keyof typeof MONSTER_KINDS;
export interface MonsterAppearance {
  map: string;
  area: string;
  health: Partial<Record<BossDifficulty, number>>;
  source_plans: Partial<Record<BossDifficulty, number>>;
}
export interface HunterMonster {
  slug: string;
  title: string;
  monster_id: number;
  kind: MonsterKind;
  image?: string;
  description: string;
  appearances: MonsterAppearance[];
}

export function summarizeMonsterHealth(rows: MonsterAppearance[], difficulty: BossDifficulty) {
  const values = rows.flatMap(row => {
    const value = row.health[difficulty];
    return typeof value === "number" && Number.isFinite(value) ? [value] : [];
  });
  if (!values.length) return { label: "待核实", partial: false };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const format = (n: number) => n.toLocaleString("zh-CN");
  return { label: min === max ? format(min) : `${format(min)}–${format(max)}`, partial: values.length < rows.length };
}
