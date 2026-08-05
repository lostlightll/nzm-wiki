import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { scanStaticWeaponBoundary } from "./static-boundary";

function temporaryDirectory(context: TestContext): string {
  const root = mkdtempSync(path.join(tmpdir(), "weapon-static-boundary-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function write(root: string, relativePath: string, content: string): void {
  const filePath = path.join(root, ...relativePath.split("/"));
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, "utf8");
}

test("static boundary reports deploy sizes without flagging page-level values", (context) => {
  const out = temporaryDirectory(context);
  write(out, "_next/static/chunks/app.js", "const damage = 120100240;");
  write(out, "weapons/example.html", "<main>weapon</main>");
  write(out, "ignored.css", "weapon-data-lock");

  assert.deepEqual(scanStaticWeaponBoundary(out), {
    scanned_files: 2,
    static_js_bytes: 25,
    largest_weapon_payload: { path: "weapons/example.html", bytes: 19 },
  });
});

test("static boundary rejects complete Lock markers in deployable files", (context) => {
  const out = temporaryDirectory(context);
  write(out, "weapons/example.txt", "source=lc:120100240_1");
  assert.throws(
    () => scanStaticWeaponBoundary(out),
    /Weapon Data Lock leaked.*lc:120100240_1/s,
  );
});
