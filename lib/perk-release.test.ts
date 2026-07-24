import assert from "node:assert/strict";
import test from "node:test";
import { getShanghaiDateKey, isValidDateKey } from "./date-key";
import { isPerkRecent } from "./perk-release";

const ONLINE_PERK = {
  collectModItem: 1 as const,
  releaseDate: "2026-07-24",
};

test("上线当天属于近期上新", () => {
  assert.equal(isPerkRecent(ONLINE_PERK, "2026-07-24"), true);
});

test("上线后的第 7 个自然日仍属于近期上新", () => {
  assert.equal(isPerkRecent(ONLINE_PERK, "2026-07-30"), true);
});

test("上线后的第 8 个自然日起失效", () => {
  assert.equal(isPerkRecent(ONLINE_PERK, "2026-07-31"), false);
});

test("未来日期、缺失日期和未上线插件不属于近期上新", () => {
  assert.equal(isPerkRecent(ONLINE_PERK, "2026-07-23"), false);
  assert.equal(
    isPerkRecent({ collectModItem: 1, releaseDate: undefined }, "2026-07-24"),
    false,
  );
  assert.equal(
    isPerkRecent({ collectModItem: 0, releaseDate: "2026-07-24" }, "2026-07-24"),
    false,
  );
});

test("日期键必须是有效的 YYYY-MM-DD 日历日期", () => {
  assert.equal(isValidDateKey("2026-07-24"), true);
  assert.equal(isValidDateKey("2026-02-29"), false);
  assert.equal(isValidDateKey("2026-7-24"), false);
  assert.equal(isValidDateKey("invalid"), false);
});

test("北京时间日期键正确处理 UTC 日期边界", () => {
  assert.equal(
    getShanghaiDateKey(new Date("2026-07-23T15:59:59Z")),
    "2026-07-23",
  );
  assert.equal(
    getShanghaiDateKey(new Date("2026-07-23T16:00:00Z")),
    "2026-07-24",
  );
});
