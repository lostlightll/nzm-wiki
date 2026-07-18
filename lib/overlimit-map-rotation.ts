import type {
  OverlimitBondName,
  OverlimitMapRotationPeriod,
  OverlimitMapRotationSchedule,
} from "@/types";

export const OVERLIMIT_BOND_NAMES = [
  "弹药",
  "技战",
  "异化",
  "游击",
  "壁垒",
  "狙击",
  "爆韧",
  "共振",
  "狂战",
] as const satisfies readonly OverlimitBondName[];

export type RotationPeriodState = "past" | "current" | "upcoming";

export interface RotationTiming {
  phase: "loading" | "upcoming" | "current" | "ended";
  featuredPeriod: OverlimitMapRotationPeriod | null;
}

const SHANGHAI_OFFSET = "+08:00";
const MINUTES_PER_DAY = 24 * 60;

export function getShanghaiDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));

  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

export function resolveRotationTiming(
  schedule: OverlimitMapRotationSchedule,
  today: string,
): RotationTiming {
  if (!today) return { phase: "loading", featuredPeriod: null };

  const firstPeriod = schedule.periods[0] ?? null;
  if (!firstPeriod) return { phase: "ended", featuredPeriod: null };

  const todayYear = Number(today.slice(0, 4));
  if (todayYear < schedule.season || today < firstPeriod.startDate) {
    return { phase: "upcoming", featuredPeriod: firstPeriod };
  }
  if (todayYear > schedule.season) {
    return { phase: "ended", featuredPeriod: null };
  }

  for (const period of schedule.periods) {
    const effectiveEndDate =
      period.endDate ?? `${schedule.season}-12-31`;
    if (today >= period.startDate && today <= effectiveEndDate) {
      return { phase: "current", featuredPeriod: period };
    }
    if (today < period.startDate) {
      return { phase: "upcoming", featuredPeriod: period };
    }
  }

  return { phase: "ended", featuredPeriod: null };
}

export function getRotationPeriodState(
  period: OverlimitMapRotationPeriod,
  schedule: OverlimitMapRotationSchedule,
  today: string,
): RotationPeriodState {
  if (!today || today < period.startDate) return "upcoming";

  const todayYear = Number(today.slice(0, 4));
  const effectiveEndDate = period.endDate ?? `${schedule.season}-12-31`;

  if (todayYear > schedule.season || today > effectiveEndDate) return "past";
  return "current";
}

function formatMonthDay(dateKey: string): string {
  const [, month, day] = dateKey.split("-").map(Number);
  return `${month}月${day}日`;
}

export function formatRotationPeriod(
  period: OverlimitMapRotationPeriod,
): string {
  return `${formatMonthDay(period.startDate)} - ${
    period.endDate
      ? formatMonthDay(period.endDate)
      : (period.endLabel ?? "赛季结束")
  }`;
}

export function getRotationPeriodStartTimestamp(
  period: OverlimitMapRotationPeriod,
): number {
  return Date.parse(`${period.startDate}T00:00:00${SHANGHAI_OFFSET}`);
}

export function getRotationPeriodEndTimestamp(
  period: OverlimitMapRotationPeriod,
): number | null {
  if (!period.endDate) return null;
  return Date.parse(`${period.endDate}T23:59:59${SHANGHAI_OFFSET}`);
}

export function formatRotationCountdown(
  targetTimestamp: number,
  nowTimestamp: number,
): string {
  const remainingMinutes = Math.max(
    0,
    Math.ceil((targetTimestamp - nowTimestamp) / 60_000),
  );
  const days = Math.floor(remainingMinutes / MINUTES_PER_DAY);
  const hours = Math.floor((remainingMinutes % MINUTES_PER_DAY) / 60);
  const minutes = remainingMinutes % 60;

  if (days > 0) return `${days}天${hours}小时`;
  if (hours > 0) return `${hours}小时${minutes}分钟`;
  if (minutes > 0) return `${minutes}分钟`;
  return "即将切换";
}

export function getRotationWindowStart(
  periodCount: number,
  featuredIndex: number,
  windowSize = 6,
): number {
  if (periodCount <= windowSize) return 0;
  const lastStart = periodCount - windowSize;

  if (featuredIndex < 0) return lastStart;
  return Math.min(Math.max(featuredIndex - 1, 0), lastStart);
}
