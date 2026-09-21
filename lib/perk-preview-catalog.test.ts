import assert from "node:assert/strict";
import test from "node:test";
import { getAllPerks, getAllPublishedPerks, getPerkByItemId, getPerkByName } from "./perks";
import { getPerkPreviewCatalog, parseRegisteredPerkPreview } from "./perk-preview";
import { parsePerkPreviewCatalog, type PerkPreviewCatalog } from "./perk-preview-catalog";
import { resolveMultiplierSourceHref } from "./multiplier-data";
import s3Archive from "../archives/content-versions/s3/s3.2-final-20260922/files/frozen/perks.json";
import s4PreviewArchive from "../archives/content-versions/s4/s4-preview-final-20260922/files/frozen/perks.json";

const active = { season: "s4", version: "s4-preview", label: "S4 Preview" };

// Frozen protocol evidence does not depend on whether a live preview is registered.
function previewFixture(): PerkPreviewCatalog {
  const reference = { scope: "all-weapons-active" as const, variant: "fixture", operation: "replace" as const };
  return {
    schemaVersion: 1,
    season: { id: active.version, key: active.version, label: active.label, status: "preload" },
    provenance: { files: [{ path: "fixture/perk.mdx", sha256: "a".repeat(64) }] },
    entries: [{
      perk: {
        id: "2001", itemId: "2001", slug: "preview/slot-4/通道样例", name: "通道样例",
        season: active.version, slot: 4, rarity: "传说", category: "辅助类", previewChange: "changed",
        effects: [{ slot: 4, description: "提升50%" }], description: "提升50%",
        skillVariants: [{
          reference, original: { scope: "all-weapons-active", name: "武器主动技能" },
          skill: { id: "active", kind: "active", name: "样例技能", gameSkillId: 1002,
            display: true, parameters: { duration: 7 },
            modifierSources: [], provenance: { duration: { runtime: "s4-preview:1002:duration" } } },
        }],
      },
      content: "预览独立正文", source: "fixture/perk.mdx", independentDamage: [],
      metadata: { title: "通道样例", id: "2001", season: active.version, slot: 4, rarity: "传说", preview_change: "changed", skill_variants: [reference] },
    }],
  };
}

test("released active variants retain audited effective parameters", () => {
  for (const [name, cooldown, duration, blocking] of [
    ["雷霆增幅", 40, 10, false], ["极寒领域", 30, 12, true],
    ["火神爆发", 30, 7, true], ["寒霜之怒", 30, 12, false],
    ["寒霜协同", 30, 6, false], ["闪身", 15, 0, false], ["出其不意", 25, 0, false],
  ] as const) {
    const variants = getPerkByName(name)?.skillVariants;
    assert.equal(variants?.length, 1, name);
    assert.deepEqual(variants![0].skill.parameters, { cooldown, count: 1, duration, blocking }, name);
    assert.equal(variants![0].skill.durationIsBase, name === "火神爆发" ? true : undefined);
  }
  assert.equal(getPerkByName("狂热龙炎")?.skillVariants, undefined);
});

test("frozen preview provenance rejects official runtime channel leakage", () => {
  const catalog = previewFixture();
  assert.doesNotThrow(() => parsePerkPreviewCatalog(catalog));
  catalog.entries[0].perk.skillVariants![0].skill.provenance.duration = { runtime: "current:1002:duration" };
  assert.throws(() => parsePerkPreviewCatalog(catalog), /cross-channel/);
});

test("inactive preview has no duplicate published identities or official fallback", () => {
  assert.equal(getPerkPreviewCatalog(), null);
  const current = getAllPerks();
  assert.deepEqual(getAllPublishedPerks(), current);
  assert.equal(new Set(current.map((perk) => perk.itemId)).size, current.length);
  assert.ok(getPerkByItemId("20703040346"));
  assert.equal(getPerkByItemId("20703040346", "preview"), undefined);
  const source = { type: "perk" as const, slot: 4 as const, slug: "贯长虹" };
  assert.notEqual(resolveMultiplierSourceHref(source), resolveMultiplierSourceHref({ ...source, season: "s4-preview" }));
});

test("preview rejects duplicates, cross-season identities and unresolved tokens", () => {
  const duplicate = previewFixture();
  duplicate.entries.push(duplicate.entries[0]);
  assert.throws(() => parsePerkPreviewCatalog(duplicate), /Duplicate preview identity/);
  const mismatch = previewFixture();
  mismatch.entries[0].perk.season = "s5-preview";
  assert.throws(() => parsePerkPreviewCatalog(mismatch), /channel mismatch/);
  const unresolved = previewFixture();
  unresolved.entries[0].perk.description = "{{num:unknown|percent}}";
  assert.throws(() => parsePerkPreviewCatalog(unresolved), /unresolved numbers/);
  assert.throws(() => parseRegisteredPerkPreview(previewFixture(), undefined), /registered/);
  assert.throws(() => parseRegisteredPerkPreview(previewFixture(), { ...active, version: "s4-preview.1" }), /registered/);
  assert.equal(parseRegisteredPerkPreview(null, undefined), null);
  assert.ok(parseRegisteredPerkPreview(previewFixture(), active));
});

test("frozen published values ignore metadata changes and validate classification", () => {
  const value = previewFixture();
  value.entries[0].metadata.description = "未发布的下一次改动";
  assert.equal(parsePerkPreviewCatalog(value).entries[0].perk.description, "提升50%");
  value.entries[0].metadata.preview_change = "new";
  assert.throws(() => parsePerkPreviewCatalog(value), /classification mismatch/);
});

test("S4 formal catalog retains reviewed unavailable identities and descriptions", () => {
  for (const id of ["20703040217", "20703040425"]) {
    const perk = getPerkByItemId(id);
    assert.ok(perk, id);
    assert.equal(perk.collectModItem, 0);
    assert.equal(perk.makeModItem, 0);
  }
  assert.ok(getPerkByItemId("20703040432")?.description?.includes("84%"));
  assert.ok(getPerkByItemId("20703040354")?.description?.includes("全伤害"));
  assert.ok(getPerkByItemId("20703040423")?.weaponNames?.includes("最佳拍档"));
});

test("archived S3 and S4 preview keep independent identities, changes and availability", () => {
  const old = s3Archive.perks;
  const preview = s4PreviewArchive.perks;
  assert.equal(old.length, 467);
  assert.equal(preview.length, 549);
  assert.equal(preview.filter((perk) => perk.previewChange === "new").length, 81);
  assert.equal(old.filter((perk) => perk.collectModItem === 1 &&
    preview.find((candidate) => candidate.itemId === perk.itemId)?.collectModItem === 0).length, 121);
  assert.ok(preview.filter((perk) => perk.previewChange === "new").every((perk) => !old.some((candidate) => candidate.itemId === perk.itemId)));
  const before = old.find((perk) => perk.itemId === "20703040346")!;
  const after = preview.find((perk) => perk.itemId === before.itemId)!;
  assert.equal(before.slug, "slot-4/贯长虹");
  assert.equal(after.slug, "preview/slot-4/贯长虹");
  assert.ok(!before.description?.includes("衰减"));
  assert.ok(after.description?.includes("衰减"));
  assert.ok(old.find((perk) => perk.itemId === "20703040432")?.description?.includes("126%"));
  assert.ok(preview.find((perk) => perk.itemId === "20703040432")?.description?.includes("84%"));
});
