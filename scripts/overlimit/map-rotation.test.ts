import assert from "node:assert/strict";
import test from "node:test";
import { getRotationPeriodState, resolveRotationTiming } from "../../lib/overlimit-map-rotation";
import type { OverlimitMapRotationSchedule } from "../../types";

test("explicit rotation periods remain active across the year boundary", () => {
  const schedule: OverlimitMapRotationSchedule = { season: 2026, timezone: "Asia/Shanghai", periods: [
    { startDate: "2026-12-28", endDate: "2027-01-03", maps: [] },
    { startDate: "2027-01-04", endDate: "2027-01-10", maps: [] },
  ] };
  assert.equal(resolveRotationTiming(schedule, "2027-01-01").featuredPeriod, schedule.periods[0]);
  assert.equal(getRotationPeriodState(schedule.periods[0], schedule, "2027-01-01"), "current");
  assert.equal(resolveRotationTiming(schedule, "2027-01-04").featuredPeriod, schedule.periods[1]);
  assert.equal(getRotationPeriodState(schedule.periods[0], schedule, "2027-01-04"), "past");
  assert.equal(resolveRotationTiming(schedule, "2027-01-11").phase, "ended");
});
