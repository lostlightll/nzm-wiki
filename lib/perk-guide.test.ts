import assert from "node:assert/strict";
import test from "node:test";
import { PERK_GUIDE_STORAGE_KEY, recordPerkGuideVisit, setPerkGuideDismissed } from "./perk-guide";

function storage(initial: string | null = null) {
  const values = new Map<string, string>();
  if (initial !== null) values.set(PERK_GUIDE_STORAGE_KEY, initial);
  return {
    getItem: (key = PERK_GUIDE_STORAGE_KEY) => values.get(key) ?? null,
    setItem: (key: string, next: string) => { values.set(key, next); },
  };
}

test("guide displays three times across visits, then stops", () => {
  const saved = storage();
  assert.deepEqual(Array.from({ length: 5 }, () => recordPerkGuideVisit(saved, "s3.2")), [true, true, true, false, false]);
  assert.equal(JSON.parse(saved.getItem()!).views, 3);
});

test("S4 displays ten times independently of S3.2's limit", () => {
  const saved = storage();
  for (let visit = 0; visit < 12; visit++) {
    assert.equal(recordPerkGuideVisit(saved, "s4"), visit < 10);
    assert.equal(recordPerkGuideVisit(saved, "s3.2"), visit < 3);
  }
});

test("dismissing one version does not dismiss the other", () => {
  for (const version of ["s3.2", "s4"] as const) {
    const saved = storage();
    setPerkGuideDismissed(saved, version, true);
    assert.equal(recordPerkGuideVisit(saved, version), false);
    assert.equal(recordPerkGuideVisit(saved, version === "s4" ? "s3.2" : "s4"), true);
  }
});

test("do not remind stops future displays immediately and survives a new storage reader", () => {
  const saved = storage();
  assert.equal(recordPerkGuideVisit(saved, "s3.2"), true);
  setPerkGuideDismissed(saved, "s3.2", true);
  assert.equal(recordPerkGuideVisit(storage(saved.getItem()), "s3.2"), false);
  setPerkGuideDismissed(saved, "s3.2", false);
  assert.equal(recordPerkGuideVisit(saved, "s3.2"), true);
});

test("malformed state recovers without breaking the catalog", () => {
  for (const value of ["broken", '{"views":-1}', '{"views":"3"}']) {
    const saved = storage(value);
    assert.equal(recordPerkGuideVisit(saved, "s3.2"), true);
    assert.equal(JSON.parse(saved.getItem()!).views, 1);
  }
  assert.ok(PERK_GUIDE_STORAGE_KEY.includes(":v1"));
});
