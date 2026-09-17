import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { activateCatalog, archiveCatalog, CURRENT_FILE, sha256, verifyArchive } from "./catalog";

function fixtureCatalog(season: string, icon = "/icons/card.png") {
  return {
    schemaVersion: 1,
    season: { id: season, label: season.toUpperCase(), status: "current", updatedAt: "2026-09-17" },
    provenance: { contentRoot: "fixture/Content", note: "Synthetic reviewed fixture", files: [{ path: "cards.json", sha256: "a".repeat(64) }] },
    cards: [{ id: "100", name: "Fixture card", description: `Reviewed ${season} effect`, icon, quality: 4, weaponType: [], weaponItems: [], weaponNames: [], tags: [{ id: "9", name: "Fixture bond", icon: "/icons/bond.svg", tone: "blue" }] }],
    independentDamage: {}, bonds: null, levels: null, mapRotation: null,
  };
}

function write(root: string, relative: string, bytes: string | Buffer) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes);
  return target;
}

function setup() {
  const root = fs.mkdtempSync(path.join(tmpdir(), "overlimit-catalog-"));
  const original = Buffer.from(JSON.stringify(fixtureCatalog("s3.2"), null, 2) + "\n");
  write(root, CURRENT_FILE, original);
  write(root, "public/icons/card.png", "original png fixture");
  write(root, "public/webp/icons/card.webp", "original webp fixture");
  write(root, "public/icons/bond.svg", "<svg />");
  return {
    root, original,
    archive: path.join(root, "MD/_local/overlimit/archives/s3.2"),
    dispose: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

function prepareCandidate(root: string, icon?: string) {
  const bytes = Buffer.from(JSON.stringify(fixtureCatalog("s4", icon), null, 2) + "\n");
  const candidate = write(root, "MD/_local/overlimit/candidate.json", bytes);
  const review = write(root, "MD/_local/overlimit/review.json", JSON.stringify({ status: "approved", catalogSha256: sha256(bytes), basis: "Fixture identity and execution evidence verified" }));
  return { candidate, review, bytes };
}

test("archive preserves exact catalog, assets and evidence with verified byte hashes", () => {
  const f = setup();
  try {
    const evidence = { resolved: [{ cardId: "100", value: "frozen S3 value" }] };
    archiveCatalog(f.root, f.archive, evidence);
    verifyArchive(f.archive);
    const manifest = JSON.parse(fs.readFileSync(path.join(f.archive, "manifest.json"), "utf8")) as { season: { id: string }; files: { path: string; bytes: number; sha256: string }[] };
    assert.equal(manifest.season.id, "s3.2");
    assert.deepEqual(manifest.files.map((file) => file.path).sort(), ["catalog.json", "public/icons/bond.svg", "public/icons/card.png", "public/webp/icons/card.webp", "relations.json"]);
    for (const file of manifest.files) {
      const bytes = fs.readFileSync(path.join(f.archive, file.path));
      assert.equal(file.bytes, bytes.length);
      assert.equal(file.sha256, sha256(bytes));
    }
    assert.deepEqual(fs.readFileSync(path.join(f.archive, "catalog.json")), f.original);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.archive, "relations.json"), "utf8")), evidence);
    assert.deepEqual(fs.readFileSync(path.join(f.root, CURRENT_FILE)), f.original);
    // Keep the byte length unchanged so verification must check content, not only size.
    write(f.archive, "public/icons/card.png", "modified png fixture");
    assert.throws(() => verifyArchive(f.archive), /Archive checksum mismatch/);
  } finally { f.dispose(); }
});

test("archive refuses overwrite and paths outside its dedicated archive directory", () => {
  const f = setup();
  try {
    const base = path.join(f.root, "MD/_local/overlimit/archives");
    for (const destination of [base, path.join(f.root, "data/archive"), path.join(base, "../elsewhere"), path.join(f.root, "MD/_local/overlimit/archives-sibling/s3")]) {
      assert.throws(() => archiveCatalog(f.root, destination), /inside MD\/_local\/overlimit\/archives/);
      assert.equal(fs.existsSync(destination), false);
    }
    archiveCatalog(f.root, f.archive);
    const manifest = fs.readFileSync(path.join(f.archive, "manifest.json"));
    assert.throws(() => archiveCatalog(f.root, f.archive), /already exists/);
    assert.deepEqual(fs.readFileSync(path.join(f.archive, "manifest.json")), manifest);
    assert.deepEqual(fs.readFileSync(path.join(f.root, CURRENT_FILE)), f.original);
  } finally { f.dispose(); }
});

test("activation requires an approved exact-byte digest and evidence, leaving current untouched on refusal", () => {
  const f = setup();
  try {
    const c = prepareCandidate(f.root);
    for (const review of [
      { status: "pending", catalogSha256: sha256(c.bytes), basis: "Evidence" },
      { status: "approved", catalogSha256: "0".repeat(64), basis: "Evidence" },
      { status: "approved", catalogSha256: sha256(c.bytes), basis: " " },
      { status: "approved", basis: "Evidence" },
    ]) {
      fs.writeFileSync(c.review, JSON.stringify(review));
      assert.throws(() => activateCatalog(f.root, c.candidate, c.review, f.archive), /reviewed projection requires/);
      assert.deepEqual(fs.readFileSync(path.join(f.root, CURRENT_FILE)), f.original);
      assert.equal(fs.existsSync(f.archive), false);
    }
    fs.writeFileSync(c.review, JSON.stringify({ status: "approved", catalogSha256: sha256(c.bytes), basis: "Evidence" }));
    fs.appendFileSync(c.candidate, "\n");
    assert.throws(() => activateCatalog(f.root, c.candidate, c.review, f.archive), /exact catalogSha256/);
    assert.deepEqual(fs.readFileSync(path.join(f.root, CURRENT_FILE)), f.original);
  } finally { f.dispose(); }
});

test("approved local activation archives the old projection before switching exact current bytes", () => {
  const f = setup();
  try {
    const c = prepareCandidate(f.root);
    activateCatalog(f.root, c.candidate, c.review, f.archive);
    assert.deepEqual(fs.readFileSync(path.join(f.root, CURRENT_FILE)), c.bytes);
    assert.deepEqual(fs.readFileSync(path.join(f.archive, "catalog.json")), f.original);
    assert.equal(fs.existsSync(path.join(f.root, `${CURRENT_FILE}.pending`)), false);
    verifyArchive(f.archive);
    write(f.root, "public/icons/card.png", "later S4 icon revision");
    verifyArchive(f.archive);
    assert.equal(fs.readFileSync(path.join(f.archive, "public/icons/card.png"), "utf8"), "original png fixture");
  } finally { f.dispose(); }
});

test("missing candidate or current assets prevent activation without changing current", () => {
  const f = setup();
  try {
    const c = prepareCandidate(f.root, "/icons/new-card.png");
    assert.throws(() => activateCatalog(f.root, c.candidate, c.review, f.archive), /Missing published assets/);
    assert.equal(fs.existsSync(f.archive), false);
    assert.deepEqual(fs.readFileSync(path.join(f.root, CURRENT_FILE)), f.original);
    write(f.root, "public/icons/new-card.png", "new png");
    // The browser's derived WebP asset is also required.
    assert.throws(() => activateCatalog(f.root, c.candidate, c.review, f.archive), /public\/webp\/icons\/new-card.webp/);
    write(f.root, "public/webp/icons/new-card.webp", "new webp");
    fs.rmSync(path.join(f.root, "public/icons/card.png"));
    assert.throws(() => activateCatalog(f.root, c.candidate, c.review, f.archive), /Missing published assets/);
    assert.equal(fs.existsSync(f.archive), false);
    assert.deepEqual(fs.readFileSync(path.join(f.root, CURRENT_FILE)), f.original);
  } finally { f.dispose(); }
});
