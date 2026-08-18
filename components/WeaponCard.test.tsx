import assert from "node:assert/strict";
import test from "node:test";
import {
  formatBurstCycle,
  formatFireRate,
  formatLimitedBurstDuration,
} from "./WeaponCard";

test("formatFireRate averages each burst over its complete firing cycle", () => {
  assert.equal(formatFireRate(400, 0.15, 3, 0.045), "750");
  assert.equal(formatFireRate(181.818, 0.33, 4, 0.2), "258");
  assert.equal(formatFireRate(120, 0.5, 4, 0.4), "141");
});

test("formatFireRate preserves base RPM without valid burst data", () => {
  assert.equal(formatFireRate(400.4, 0.15, 1, 0), "400");
  assert.equal(formatFireRate(400.6, 0.15, undefined, undefined), "401");
  assert.equal(formatFireRate(undefined, undefined, undefined, undefined), "-");
});

test("formatBurstCycle spans from one burst start to the next", () => {
  assert.equal(formatBurstCycle(3, 0.15, 0.045), "3 发 / 0.24s");
  assert.equal(formatBurstCycle(4, 0.33, 0.2), "4 发 / 0.93s");
  assert.equal(formatBurstCycle(4, 0.5, 0.4), "4 发 / 1.7s");
});

test("formatBurstCycle hides non-burst and unavailable data", () => {
  assert.equal(formatBurstCycle(1, 0.15, 0), "-");
  assert.equal(formatBurstCycle(undefined, undefined, undefined), "-");
  assert.equal(formatBurstCycle(3, 0.15, undefined), "-");
});

test("formatLimitedBurstDuration spans from the first shot to the last", () => {
  assert.equal(formatLimitedBurstDuration(6, 0.12), "0.6s");
  assert.equal(formatLimitedBurstDuration(3, 0.045), "0.09s");
  assert.equal(formatLimitedBurstDuration(1, 0.12), "-");
  assert.equal(formatLimitedBurstDuration(6, undefined), "-");
});
