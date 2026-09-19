import assert from "node:assert/strict";
import test from "node:test";
import rawPreview from "../data/perk-preview/preview.json";
import { getAllPerks, getAllPublishedPerks, getPerkByItemId, getPerkDocument } from "./perks";
import { parseRegisteredPerkPreview } from "./perk-preview";
import { parsePerkPreviewCatalog } from "./perk-preview-catalog";
import { getProviderRelationsForSource, resolveMultiplierSourceHref } from "./multiplier-data";

const active = { season: "s4", version: "s4-preview", label: "S4 Preview" };

test("published active variants keep audited effective parameters and exclude 狂热龙炎", () => {
  const catalog = parsePerkPreviewCatalog(rawPreview);
  const expected: [string, number, number, boolean][] = [
    ["雷霆增幅", 40, 10, false], ["极寒领域", 30, 12, true],
    ["火神爆发", 30, 7, true], ["寒霜之怒", 30, 12, false],
    ["寒霜协同", 30, 6, false], ["闪身", 15, 0, false], ["出其不意", 25, 0, false],
  ];
  for (const [name, cooldown, duration, blocking] of expected) {
    const variants = catalog.entries.find(entry => entry.perk.name === name)?.perk.skillVariants;
    assert.equal(variants?.length, 1, name);
    const skill = variants![0].skill;
    assert.deepEqual(skill.parameters, { cooldown, count: 1, duration, blocking }, name);
    assert.equal(skill.durationIsBase, name === "火神爆发" ? true : undefined);
  }
  assert.equal(catalog.entries.find(entry => entry.perk.name === "狂热龙炎")?.perk.skillVariants, undefined);
  for (const itemId of ["20703040015", "20703040086"]) {
    assert.deepEqual(getPerkByItemId(itemId)?.skillVariants?.[0].skill.parameters,
      getPerkByItemId(itemId, "preview")?.skillVariants?.[0].skill.parameters);
  }
});

test("frozen runtime skill provenance accepts its season and rejects channel leakage", () => {
  const catalog = parsePerkPreviewCatalog(structuredClone(rawPreview));
  const variant = catalog.entries.flatMap(entry => entry.perk.skillVariants ?? [])[0];
  assert.ok(variant);
  variant.skill.provenance.duration = { runtime: `s4-preview:${variant.skill.gameSkillId}:duration` };
  assert.doesNotThrow(() => parsePerkPreviewCatalog(catalog));
  variant.skill.provenance.duration = { runtime: `weapons:${variant.skill.gameSkillId}:duration` };
  assert.throws(() => parsePerkPreviewCatalog(catalog), /cross-channel/);
});

test("same ItemID has isolated current and preview descriptions, documents and relations", () => {
  const current = getPerkByItemId("20703040346")!;
  const preview = getPerkByItemId("20703040346", "preview")!;
  assert.ok(current && preview);
  assert.equal(current.slug, "slot-4/贯长虹");
  assert.equal(preview.slug, "preview/slot-4/贯长虹");
  assert.ok(!current.description!.includes("衰减"));
  assert.ok(preview.description!.includes("衰减"));
  assert.ok(getPerkDocument(preview.slug).content.includes("待") || getPerkDocument(preview.slug).content.includes("确认"));
  assert.ok(!getPerkDocument(current.slug).content.includes("衰减"));
  assert.equal(getAllPerks().filter(perk => perk.itemId === current.itemId).length, 1);
  assert.equal(getAllPublishedPerks().filter(perk => perk.itemId === current.itemId).length, 2);
  const currentSource = { type: "perk" as const, slot: 4 as const, slug: "贯长虹" };
  const previewSource = { ...currentSource, season: "s4-preview" };
  const currentRelations = getProviderRelationsForSource(currentSource);
  const previewRelations = getProviderRelationsForSource(previewSource);
  assert.ok(currentRelations.length && previewRelations.length);
  assert.ok(currentRelations.every(relation => !previewRelations.includes(relation)));
  assert.notEqual(resolveMultiplierSourceHref(currentSource), resolveMultiplierSourceHref(previewSource));
});

test("preview rejects duplicate identities, cross-season data and unresolved numerical tokens", () => {
  const duplicate = structuredClone(rawPreview);
  duplicate.entries.push(duplicate.entries[0]);
  assert.throws(() => parsePerkPreviewCatalog(duplicate), /Duplicate preview identity/);
  const mismatch = structuredClone(rawPreview);
  mismatch.entries[0].perk.season = "s5-preview";
  assert.throws(() => parsePerkPreviewCatalog(mismatch), /channel mismatch/);
  const unresolved = structuredClone(rawPreview);
  unresolved.entries[0].perk.description = "{{num:unknown|percent}}";
  assert.throws(() => parsePerkPreviewCatalog(unresolved), /unresolved numbers/);
  assert.throws(() => parseRegisteredPerkPreview(rawPreview, undefined), /registered/);
  assert.throws(() => parseRegisteredPerkPreview(rawPreview, { ...active, version: "s4-preview.1" }), /registered/);
  assert.equal(parseRegisteredPerkPreview(null, undefined), null);
});

test("published preview validation preserves stored values without recalculating from source metadata", () => {
  const value = structuredClone(rawPreview);
  const entry = value.entries.find(item => item.perk.itemId === "20703040346")!;
  entry.metadata.description = "未发布的下一次改动";
  const catalog = parsePerkPreviewCatalog(value);
  assert.equal(catalog.entries.find(item => item.perk.itemId === entry.perk.itemId)!.perk.description, entry.perk.description);
});

test("S4 retains old perks with target availability and separates change classes", () => {
  const entries = rawPreview.entries;
  const ids = new Set(entries.map(entry => entry.perk.itemId));
  const current = getAllPerks();
  assert.equal(current.filter(perk => !ids.has(perk.itemId)).length, 0);
  assert.equal(current.filter(perk => perk.collectModItem === 1 &&
    getPerkByItemId(perk.itemId, "preview")?.collectModItem === 0).length, 121);
  assert.equal(entries.filter(entry => entry.perk.previewChange === "new").length, 81);
  assert.equal(getPerkByItemId("20703040104", "preview")?.previewChange, "changed");
  assert.ok(entries.filter(entry => entry.perk.previewChange === "new").every(entry => !current.some(perk => perk.itemId === entry.perk.itemId)));
  for (const id of ["20703040217", "20703040425"]) {
    assert.ok(ids.has(id));
    assert.equal(getPerkByItemId(id, "preview")?.collectModItem, 0);
    assert.equal(getPerkByItemId(id, "preview")?.makeModItem, 0);
    assert.equal(getPerkByItemId(id)?.collectModItem, 1);
  }
  for (const id of ["20703040432", "20703040354", "20703040333", "20704040480", "20703040423"]) {
    assert.equal(getPerkByItemId(id, "preview")?.previewChange, "changed");
  }
  assert.ok(getPerkByItemId("20703040432", "preview")?.description?.includes("84%"));
  assert.ok(getPerkByItemId("20703040432")?.description?.includes("126%"));
  assert.ok(getPerkByItemId("20703040354", "preview")?.description?.includes("全伤害"));
  assert.ok(getPerkByItemId("20703040354")?.description?.includes("射击伤害"));
  assert.ok(getPerkByItemId("20703040423", "preview")?.weaponNames?.includes("最佳拍档"));
  const invalid = structuredClone(rawPreview);
  invalid.entries[0].metadata.preview_change = invalid.entries[0].perk.previewChange === "new" ? "existing" : "new";
  assert.throws(() => parsePerkPreviewCatalog(invalid), /classification mismatch/);
});
