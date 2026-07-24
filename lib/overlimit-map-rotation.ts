import type {
  OverlimitBondName,
  OverlimitMapRotationPeriod,
  OverlimitMapRotationSchedule,
} from "@/types";

export { getShanghaiDateKey } from "@/lib/date-key";

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
