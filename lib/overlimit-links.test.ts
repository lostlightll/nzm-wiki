import assert from "node:assert/strict";
import test from "node:test";
import { selectOverlimitLinkProjection } from "./overlimit-links";

const current = {
  cards: [{ id: "shared", perkItemId: "perk", damageFacets: ["weapon"] }],
  bonds: [{ name: "共用羁绊", count: 2 }],
};
const preview = {
  season: "s4-preview",
  cards: [{ id: "shared", perkItemId: "perk", damageFacets: ["critical"] }],
  bonds: [{ name: "共用羁绊", count: 5 }],
};
const active = { season: "s4", version: "s4-preview", label: "S4 Preview" };

test("same card and perk identities select only their own publication channel", () => {
  assert.equal(selectOverlimitLinkProjection(undefined, current, preview, active), current);
  assert.equal(selectOverlimitLinkProjection("s4-preview", current, preview, active), preview);
  assert.deepEqual(selectOverlimitLinkProjection("s5-preview", current, preview, active), { cards: [], bonds: [] });
});

test("retired or replaced preview links cannot leak from an old generated projection", () => {
  assert.deepEqual(selectOverlimitLinkProjection("s4-preview", current, preview, undefined), { cards: [], bonds: [] });
  const next = { season: "s5", version: "s5-preview", label: "S5 Preview" };
  assert.deepEqual(selectOverlimitLinkProjection("s4-preview", current, preview, next), { cards: [], bonds: [] });
  assert.equal(selectOverlimitLinkProjection(undefined, current, preview, undefined), current);
});
