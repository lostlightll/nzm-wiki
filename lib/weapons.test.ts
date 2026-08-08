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

function writeWeapon(
  directory: string,
  name: string,
  gameModes: readonly ("lc" | "td")[],
  draft = false,
): void {
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    path.join(directory, `${name}.mdx`),
    `---\ntitle: ${name}\ngame_modes: [${gameModes.join(", ")}]\ndraft: ${String(draft)}\n---\n`,
    "utf8",
  );
}

test("slug scan uses ordinal order and filters drafts without resolving weapons", (context) => {
  const root = temporaryDirectory(context);
  const weapons = path.join(root, "weapons");
  writeWeapon(weapons, "b", ["lc", "td"]);
  writeWeapon(weapons, "2", ["lc"]);
  writeWeapon(weapons, "10", ["lc", "td"]);
  writeWeapon(weapons, "draft", ["lc", "td"], true);
  writeFileSync(path.join(weapons, "ignored.txt"), "ignored", "utf8");

  assert.deepEqual(scanWeaponSlugs(weapons, "lc", false), ["10", "2", "b"]);
  assert.deepEqual(scanWeaponSlugs(weapons, "td", false), ["10", "b"]);
  assert.deepEqual(scanWeaponSlugs(weapons, "td", true), ["10", "b", "draft"]);
});

test("slug scan filters undeclared modes and tolerates a missing directory", (context) => {
  const root = temporaryDirectory(context);
  const weapons = path.join(root, "weapons");
  writeWeapon(weapons, "lc-only", ["lc"]);
  writeWeapon(weapons, "td-only", ["td"]);

  assert.deepEqual(scanWeaponSlugs(weapons, "lc", false), ["lc-only"]);
  assert.deepEqual(scanWeaponSlugs(weapons, "td", false), ["td-only"]);
  assert.deepEqual(scanWeaponSlugs(path.join(root, "missing"), "lc", false), []);
});
