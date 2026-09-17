import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import type { Perk } from "../../types";
import { parseOverlimitCatalog } from "../../lib/overlimit-catalog";
import { catalogAssets } from "../overlimit/catalog";
import { assembleCapture, captureCurrent, type CaptureInput } from "./capture";

function setup() {
  const base = path.resolve("MD/_local/content-versions-tests");
  fs.mkdirSync(base, { recursive: true });
  const root = fs.mkdtempSync(path.join(base, "capture-"));
  const write = (file: string, value: string) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), value);
  };
  const catalog = parseOverlimitCatalog({
    schemaVersion: 1,
    season: { id: "s3.2", label: "S3.2", status: "current", updatedAt: "2026-09-17" },
    provenance: { contentRoot: "fixture", note: "Fixture", files: [{ path: "table", sha256: "a".repeat(64) }] },
    cards: [{ id: "100", name: "Card", description: "Frozen effect", icon: "/icons/card.png", quality: 4,
      weaponType: [], weaponItems: [], weaponNames: [], tags: [] }],
    independentDamage: {}, levels: null,
    bonds: [{ name: "Bond", effects: [{ count: 8, description: "Frozen bond effect", mergeType: "Replace", overrides: [1, 2] }] }],
    mapRotation: { season: 3, timezone: "Asia/Shanghai", periods: [{ startDate: "2026-09-01", endDate: null,
      maps: [{ name: "大都会", activeBonds: ["Bond"] }] }] },
  });
  const original = JSON.stringify(catalog, null, 2) + "\n";
  write("data/overlimit/current.json", original);
  write("data/overlimit/links.json", "{}");
  for (const asset of catalogAssets(catalog)) write(asset, "fixture image");
  const perks: Perk[] = [
    { id: "old", itemId: "1", slug: "slot-1/old", name: "Old", slot: 1, rarity: "史诗", category: "其他", icon: "old", effects: [] },
    { id: "new", itemId: "2", slug: "slot-1/new", name: "New", season: "s5-preview", slot: 1, rarity: "史诗", category: "其他", icon: "new", effects: [] },
  ];
  for (const perk of perks) {
    write(`data/perks/${perk.slug}.mdx`, `---\nid: "${perk.itemId}"\n${perk.season ? `season: ${perk.season}\n` : ""}---\nRaw body`);
    write(`public/icons/perks/${perk.icon}.png`, "original");
    write(`public/webp/icons/perks/${perk.icon}.webp`, "optimized");
  }
  for (const file of ["data/num-modifier-lock.json", "data/num-modifier-semantics.json", "data/perk-preview-modifiers.json", "scripts/s4-preview-perks-review.json"]) write(file, "{}");
  const input: CaptureInput = { perks, independentDamage: {}, relations: [] };
  return { root, input, original, dispose: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test("capture keeps exact complete overlimit catalog, bond replacement and map assets while excluding any preview season", () => {
  const f = setup();
  try {
    const result = assembleCapture(f.root, f.input);
    assert.equal(result.files["data/overlimit/current.json"].toString(), f.original);
    assert.ok(result.files["public/webp/images/overlimit/maps/T_Bg_Loading_07.webp"]);
    assert.ok(result.files["data/perks/slot-1/old.mdx"]);
    assert.equal(result.files["data/perks/slot-1/new.mdx"], undefined);
    assert.equal(result.files["public/icons/perks/new.png"], undefined);
    assert.equal(result.files["evidence/data/perk-preview-modifiers.json"], undefined);
    assert.equal(result.summary.excludedPreviewPerks, 1);
    assert.deepEqual(JSON.parse(result.files["frozen/perks.json"].toString()).perks, [f.input.perks[0]]);
    assert.ok(Object.keys(result.files).every(file => !file.startsWith("refs/") && !file.includes("data/weapons/")));
    const preview = assembleCapture(f.root, f.input, { includePreview: true });
    assert.equal(preview.summary.previewPerks, 1);
    assert.ok(preview.files["data/perks/slot-1/new.mdx"]);
    assert.ok(preview.files["evidence/data/perk-preview-modifiers.json"]);
  } finally { f.dispose(); }
});

test("capture refuses duplicate identities and missing optimized assets before returning an archive", () => {
  const f = setup();
  try {
    assert.throws(() => assembleCapture(f.root, { ...f.input, perks: [...f.input.perks, f.input.perks[0]] }), /Duplicate.*ItemID/);
    fs.unlinkSync(path.join(f.root, "public/webp/icons/perks/old.webp"));
    assert.throws(() => assembleCapture(f.root, f.input), /ENOENT/);
  } finally { f.dispose(); }
});

test("runtime capture refuses a different root before loading project-bound resolvers", async () => {
  const f = setup();
  try { await assert.rejects(captureCurrent(f.root), /project's root/); }
  finally { f.dispose(); }
});

test("preview archive preserves separate same-ID cards, bonds, rotation and evidence without leaking into official archive", () => {
  const f = setup();
  try {
    const preview = parseOverlimitCatalog(JSON.parse(f.original));
    preview.season = { id: "s5-preview.1", label: "S5 Preview", status: "preload", updatedAt: "2026-09-17" };
    preview.cards[0].description = "Next season effect";
    preview.bonds![0].effects[0].description = "Next season bond";
    preview.mapRotation!.periods[0].startDate = "2026-10-01";
    fs.writeFileSync(path.join(f.root, "data/overlimit/preview.json"), JSON.stringify(preview));
    fs.writeFileSync(path.join(f.root, "data/overlimit/preview-links.json"), JSON.stringify({ season: "s5-preview" }));
    fs.writeFileSync(path.join(f.root, "data/overlimit/preview-evidence.json"), "{}");
    const official = assembleCapture(f.root, f.input);
    assert.equal(official.files["data/overlimit/preview.json"], undefined);
    const result = assembleCapture(f.root, { ...f.input, perks: [] }, { includePreview: true });
    assert.equal(result.files["data/overlimit/current.json"].toString(), f.original);
    assert.deepEqual(JSON.parse(result.files["data/overlimit/preview.json"].toString()), preview);
    assert.deepEqual(result.summary.overlimitPreview, { version: "s5-preview.1", cards: 1, bonds: 1, mapPeriods: 1 });
    assert.ok(result.files["evidence/data/perk-preview-modifiers.json"]);
    assert.ok(result.files["evidence/data/overlimit/preview-evidence.json"]);
  } finally { f.dispose(); }
});
