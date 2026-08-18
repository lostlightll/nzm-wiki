import assert from "node:assert/strict";
import test from "node:test";
import { formatBurstParameters, formatFireRate } from "./WeaponCard";

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

test("formatBurstParameters includes the interval after the final sub-fire", () => {
  assert.equal(formatBurstParameters(3, 0.045), "3 发 / 0.135s");
  assert.equal(formatBurstParameters(4, 0.2), "4 发 / 0.8s");
  assert.equal(formatBurstParameters(4, 0.4), "4 发 / 1.6s");
});

test("formatBurstParameters hides non-burst and unavailable data", () => {
  assert.equal(formatBurstParameters(1, 0), "-");
  assert.equal(formatBurstParameters(undefined, undefined), "-");
  assert.equal(formatBurstParameters(3, undefined), "-");
});
