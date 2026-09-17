import type {
  OverlimitMapRotationPeriod,
  OverlimitMapRotationSchedule,
} from "@/types";

export { getShanghaiDateKey } from "@/lib/date-key";

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

  if (today < firstPeriod.startDate) {
    return { phase: "upcoming", featuredPeriod: firstPeriod };
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

  const effectiveEndDate = period.endDate ?? `${schedule.season}-12-31`;

  if (today > effectiveEndDate) return "past";
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
