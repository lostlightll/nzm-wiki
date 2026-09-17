import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { diffVersions, exportVersion, listVersions, saveVersion, verifyVersion } from "./store";

function fixture(t: { after: (fn: () => void) => void }) {
  const root = fs.mkdtempSync(path.join(tmpdir(), "content-versions-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
const identity = { season: "s3", version: "s3.2" };
const input = { files: { "data/perks/example.mdx": Buffer.from("original") }, summary: { perks: 1 } };

test("immutable snapshots preserve exact bytes and export without replacing existing data", t => {
  const root = fixture(t);
  assert.deepEqual(listVersions(root), []);
  const directory = saveVersion(root, identity, input);
  assert.deepEqual(verifyVersion(directory).identity, identity);
  assert.deepEqual(listVersions(root).map(entry => entry.directory), [directory]);
  assert.throws(() => saveVersion(root, identity, input), /already exists/);
  assert.throws(() => exportVersion(directory, path.join(directory, "review")), /outside the immutable snapshot/);
  const output = exportVersion(directory, path.join(root, "review"));
  assert.deepEqual(fs.readFileSync(path.join(output, "data/perks/example.mdx")), input.files["data/perks/example.mdx"]);
  assert.throws(() => exportVersion(directory, output), /already exists/);
});

test("diff distinguishes additions, removals and exact-byte changes", t => {
  const root = fixture(t);
  const left = saveVersion(root, identity, { files: { same: Buffer.from("x"), changed: Buffer.from("a"), removed: Buffer.from("y") } });
  const right = saveVersion(root, { season: "s4", version: "s4" }, { files: { same: Buffer.from("x"), changed: Buffer.from("b"), added: Buffer.from("z") } });
  assert.deepEqual(diffVersions(left, right), { added: ["added"], removed: ["removed"], changed: ["changed"] });
});

test("verification rejects corruption, extra files and malicious manifest paths", t => {
  const root = fixture(t);
  const directory = saveVersion(root, identity, input);
  const payload = path.join(directory, "files/data/perks/example.mdx");
  fs.writeFileSync(payload, "modified");
  assert.throws(() => verifyVersion(directory), /checksum mismatch/);
  assert.throws(() => exportVersion(directory, path.join(root, "review")), /checksum mismatch/);
  assert.equal(fs.existsSync(path.join(root, "review")), false);
  fs.writeFileSync(payload, "original");
  const extra = path.join(directory, "extra");
  fs.writeFileSync(extra, "x");
  assert.throws(() => verifyVersion(directory), /inventory mismatch/);
  fs.unlinkSync(extra);
  const manifestPath = path.join(directory, "manifest.json");
  const manifest = verifyVersion(directory);
  manifest.files[0].path = "../../outside";
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  assert.throws(() => verifyVersion(directory), /Unsafe snapshot path/);
});

test("unsafe identities and platform-ambiguous payload paths cannot create an archive", t => {
  const root = fixture(t);
  for (const version of ["../escape", "CON", "s4.", "s4/next"]) {
    assert.throws(() => saveVersion(root, { season: "s4", version }, input));
  }
  for (const name of ["../escape", "/absolute", "C:/absolute", "folder\\file", "x/../file", "NUL", "x.", "a//b"]) {
    assert.throws(() => saveVersion(root, identity, { files: { [name]: Buffer.from("x") } }), /Unsafe snapshot path/);
  }
  assert.throws(() => saveVersion(root, identity, { files: { a: Buffer.from("x"), A: Buffer.from("y") } }), /Duplicate/);
  assert.throws(() => saveVersion(root, identity, { files: { a: Buffer.from("x"), "a/b": Buffer.from("y") } }), /conflict/);
  assert.deepEqual(listVersions(root), []);
});

test("directory junctions are rejected in snapshot storage and payloads", t => {
  const root = fixture(t);
  const other = path.join(root, "outside");
  fs.mkdirSync(other);
  fs.symlinkSync(other, path.join(root, "archives"), "junction");
  assert.throws(() => saveVersion(root, identity, input), /Symlink not allowed/);
  fs.unlinkSync(path.join(root, "archives"));
  const directory = saveVersion(root, identity, input);
  fs.symlinkSync(other, path.join(directory, "files/link"), "junction");
  assert.throws(() => verifyVersion(directory), /Symlink not allowed/);
});
