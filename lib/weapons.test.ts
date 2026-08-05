import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { scanWeaponSlugs } from "./weapons";

function temporaryDirectory(context: TestContext): string {
  const root = mkdtempSync(path.join(tmpdir(), "weapon-slugs-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function writeWeapon(directory: string, name: string, draft = false): void {
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    path.join(directory, `${name}.mdx`),
    `---\ntitle: ${name}\ndraft: ${String(draft)}\n---\n`,
    "utf8",
  );
}

test("slug scan uses ordinal order and filters drafts without resolving weapons", (context) => {
  const root = temporaryDirectory(context);
  const lc = path.join(root, "weapons");
  writeWeapon(lc, "b");
  writeWeapon(lc, "2");
  writeWeapon(lc, "10");
  writeWeapon(lc, "draft", true);
  writeFileSync(path.join(lc, "ignored.txt"), "ignored", "utf8");

  assert.deepEqual(scanWeaponSlugs(lc, false), ["10", "2", "b"]);
  assert.deepEqual(scanWeaponSlugs(lc, true), ["10", "2", "b", "draft"]);
});

test("slug scan isolates directories and tolerates a missing directory", (context) => {
  const root = temporaryDirectory(context);
  const lc = path.join(root, "weapons");
  const td = path.join(root, "weapons_td");
  writeWeapon(lc, "lc-only");
  writeWeapon(td, "td-only");

  assert.deepEqual(scanWeaponSlugs(lc, false), ["lc-only"]);
  assert.deepEqual(scanWeaponSlugs(td, false), ["td-only"]);
  assert.deepEqual(scanWeaponSlugs(path.join(root, "missing"), false), []);
});
