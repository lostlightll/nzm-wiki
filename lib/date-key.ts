const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const SHANGHAI_OFFSET_MILLISECONDS = 8 * 60 * 60 * 1000;

export function getShanghaiDateKey(date = new Date()): string {
  return new Date(date.getTime() + SHANGHAI_OFFSET_MILLISECONDS)
    .toISOString()
    .slice(0, 10);
}

export function isValidDateKey(value: unknown): value is string {
  if (typeof value !== "string") return false;

  const match = DATE_KEY_PATTERN.exec(value);
  if (!match) return false;

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.toISOString().slice(0, 10) === value;
}

export function isDateKeyWithinPastDays(
  dateKey: string | undefined,
  todayKey: string,
  windowDays: number,
): boolean {
  if (
    !isValidDateKey(dateKey) ||
    !isValidDateKey(todayKey) ||
    !Number.isInteger(windowDays) ||
    windowDays <= 0
  ) {
    return false;
  }

  const dateTimestamp = Date.parse(`${dateKey}T00:00:00Z`);
  const todayTimestamp = Date.parse(`${todayKey}T00:00:00Z`);
  const differenceInDays =
    (todayTimestamp - dateTimestamp) / MILLISECONDS_PER_DAY;

  return differenceInDays >= 0 && differenceInDays < windowDays;
}
