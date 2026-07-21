import type {
  Boss,
  BossDifficulty,
  BossHealthValue,
} from "@/types";

export const BOSS_DIFFICULTIES: readonly {
  value: BossDifficulty;
  label: string;
}[] = [
  { value: "overlimit", label: "超限" },
  { value: "torment", label: "折磨" },
  { value: "inferno", label: "炼狱" },
  { value: "heroic", label: "英雄" },
];

export const DEFAULT_BOSS_DIFFICULTY: BossDifficulty = "torment";
export const BOSS_DIFFICULTY_STORAGE_KEY = "nzm-wiki:boss-difficulty";

const MULTI_PHASE_BOSS_SLUGS = new Set([
  "幽魂骑士",
  "芮文",
  "精绝女王",
  "终蔫之樱",
  "鬼面将军",
]);

export function isBossDifficulty(value: unknown): value is BossDifficulty {
  return (
    value === "overlimit" ||
    value === "torment" ||
    value === "inferno" ||
    value === "heroic"
  );
}

export function getBossPhaseCount(boss: Pick<Boss, "slug">): number {
  return MULTI_PHASE_BOSS_SLUGS.has(boss.slug) ? 2 : 1;
}

function parseLegacyHealth(value: Boss["hp"]): number | null {
  if (value === undefined || value === null) return null;

  const normalized = String(value).trim().replaceAll(",", "");
  if (!normalized || normalized === "?" || normalized === "？") return null;

  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

export function getBossHealth(
  boss: Boss,
  difficulty: BossDifficulty,
): BossHealthValue | undefined {
  const configured = boss.health?.[difficulty];
  if (configured !== undefined) return configured;

  if (difficulty !== "torment") return undefined;

  const legacy = [parseLegacyHealth(boss.hp)];
  if (getBossPhaseCount(boss) === 2) {
    legacy.push(parseLegacyHealth(boss.hp2));
  }

  return legacy.some((value) => value !== null)
    ? legacy.map((value) => value ?? Number.NaN)
    : undefined;
}

export function formatBossHealthValue(value: number | undefined): string {
  return value !== undefined && Number.isFinite(value)
    ? Math.round(value).toLocaleString("zh-CN")
    : "待补";
}

export function formatBossHealthSummary(
  boss: Boss,
  difficulty: BossDifficulty,
): string {
  const health = getBossHealth(boss, difficulty);
  if (health === "unsupported") return "超限不适用";

  return Array.from({ length: getBossPhaseCount(boss) }, (_, index) =>
    formatBossHealthValue(health?.[index]),
  ).join(" / ");
}
