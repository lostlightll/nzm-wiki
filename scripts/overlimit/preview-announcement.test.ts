import assert from "node:assert/strict";
import test from "node:test";
import published from "../../data/overlimit/preview.json";
import { parseOverlimitCatalog } from "../../lib/overlimit-catalog";
import { applyPreviewAnnouncement } from "./preview-announcement";

test("official availability preserves card effects and map affixes and survives republishing", () => {
  const original = parseOverlimitCatalog(structuredClone(published));
  const result = applyPreviewAnnouncement(structuredClone(original));
  const periods = result.mapRotation!.periods;
  assert.equal(periods.length, 17);
  assert.equal(periods[0].startDate, "2026-09-22");
  assert.deepEqual(periods.slice(0, 4).map(period => period.maps.map(map => map.name)), [
    ["大都会", "樱之城"], ["大都会", "樱之渊"], ["大都会", "朔望计划"], ["大都会", "禁魔岛"],
  ]);
  assert.equal(periods.at(-1)!.endDate, null);
  assert.equal(periods.at(-1)!.maps.length, 5);
  for (const card of result.cards) {
    assert.deepEqual(card.effectValues, original.cards.find(entry => entry.id === card.id)!.effectValues);
  }
  assert.deepEqual(result.independentDamage, original.independentDamage);
  for (const period of periods) for (const map of period.maps) {
    const source = original.mapRotation!.periods.find(entry => entry.startDate <= period.startDate && (!entry.endDate || entry.endDate >= period.startDate));
    assert.deepEqual(map.activeBonds, source!.maps.find(entry => entry.name === map.name)!.activeBonds);
  }
  assert.deepEqual(applyPreviewAnnouncement(structuredClone(result)), result);
});
