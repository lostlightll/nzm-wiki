import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { getResolvedFieldValue, toWeaponDetailData } from "@/lib/weapon-consumers";
import { getResolvedWeaponBySlug } from "@/lib/weapons";
import {
  formatBurstCycle,
  formatBurstCycleDuration,
  formatFireRate,
  formatLimitedBurstDuration,
  ModeStats,
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

test("formatBurstCycleDuration shows the exact full cycle", () => {
  assert.equal(formatBurstCycleDuration(2, 0.5, 0.35), "0.85s");
  assert.equal(formatBurstCycleDuration(1, 0.5, 0.35), "-");
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

test("burst timing only source renders cadence without inherited damage", async () => {
  const weapon = await getResolvedWeaponBySlug("精绝兽神", "lc");
  assert.ok(weapon);
  const detail = toWeaponDetailData(weapon);
  const source = detail.damageSources.find(
    (item) => item.id === "mi-fa-liu-dan-shou-qu-shuang-yan",
  );
  assert.ok(source);
  assert.equal(source.cadenceDisplay, "burst_timing_only");
  assert.equal(getResolvedFieldValue(source.fire.interval), 0.5);

  const markup = renderToStaticMarkup(
    <ModeStats mode={source} showName hpMultiplier={500} />,
  );
  assert.match(markup, />兽躯双衍</);
  assert.match(markup, />连发间隔</);
  assert.match(markup, />0\.35s</);
  assert.match(markup, />连发冷却</);
  assert.match(markup, />0\.5s</);
  assert.match(markup, />连发周期</);
  assert.match(markup, />0\.85s</);
  assert.doesNotMatch(markup, /伤害|破韧|弱点|暴击|元素/);
});
