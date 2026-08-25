import assert from "node:assert/strict";
import test from "node:test";
import { matchPinyin } from "./pinyin";

test("matches Chinese text, full pinyin, and pinyin initials", () => {
  const label = "1 · 加弹抽奖";

  assert.equal(matchPinyin(label, "抽奖"), true);
  assert.equal(matchPinyin(label, "jiadanchoujiang"), true);
  assert.equal(matchPinyin(label, "jdcj"), true);
  assert.equal(matchPinyin(label, "nengliang"), false);
});
