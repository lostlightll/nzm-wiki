import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { assertReleaseReady, git, prepareRelease, readRelease, releaseSchema } from "./release";

test("release blocks old overlimit data and same-season unreviewed perks", () => {
  const release = releaseSchema.parse({ schemaVersion: 1, season: "s4", version: "s4", phase: "candidate" });
  assert.throws(() => assertReleaseReady(release, { season: { id: "s3.2", status: "current" } }, []));
  assert.throws(() => assertReleaseReady(release, { season: { id: "s4", status: "preload" } }, []));
  assert.throws(() => assertReleaseReady(release, { season: { id: "s4", status: "current" } }, [{ season: "s4-preview" }]));
  assert.doesNotThrow(() => assertReleaseReady(release, { season: { id: "s4", status: "current" } }, [{ season: "s5-preview" }]));
  assert.throws(() => assertReleaseReady({ ...release, preview: { season: "s4", version: "s4-preview", label: "S4 Preview" } },
    { season: { id: "s4", status: "current" } }, []), /Remove the released season/);
});

test("candidate worktree preserves current files and refuses dirty or duplicate preparations", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "content-release-"));
  try {
    fs.mkdirSync(path.join(root, "config"));
    const preview = { season: "s4", version: "s4-preview", label: "S4 Preview" };
    fs.writeFileSync(path.join(root, "config/content-version.json"), JSON.stringify({ schemaVersion: 1, season: "s3", version: "s3.2", phase: "current", preview }));
    fs.writeFileSync(path.join(root, ".gitignore"), "MD/\n");
    fs.writeFileSync(path.join(root, "content.txt"), "current");
    git(root, ["init"]);
    git(root, ["add", "."]);
    git(root, ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-m", "fixture"]);
    fs.writeFileSync(path.join(root, "content.txt"), "dirty");
    assert.throws(() => prepareRelease(root, "s4", "s4"), /Commit current work/);
    fs.writeFileSync(path.join(root, "content.txt"), "current");
    const target = prepareRelease(root, "s4", "s4");
    assert.equal(readRelease(root).version, "s3.2");
    assert.equal(readRelease(target).phase, "candidate");
    assert.equal(readRelease(target).basedOn, "s3.2");
    assert.deepEqual(readRelease(target).preview, preview);
    fs.writeFileSync(path.join(target, "content.txt"), "next");
    assert.equal(fs.readFileSync(path.join(root, "content.txt"), "utf8"), "current");
    assert.throws(() => prepareRelease(root, "s4", "s4"), /already exists/);
    assert.throws(() => prepareRelease(root, "s4", "../escape"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
