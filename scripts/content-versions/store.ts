import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";

export interface VersionIdentity { season: string; version: string }
export interface SnapshotInput { files: Record<string, Buffer>; summary?: unknown }
export const VERSION_ROOT = "archives/content-versions";

const identifier = z.string().regex(/^[a-z0-9][a-z0-9._-]*$/).refine(value => !value.endsWith(".") && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value));
const manifestSchema = z.object({
  schemaVersion: z.literal(1),
  identity: z.object({ season: identifier, version: identifier }),
  createdAt: z.string().datetime(),
  summary: z.unknown().optional(),
  files: z.array(z.object({ path: z.string(), bytes: z.number().int().nonnegative(), sha256: z.string().regex(/^[a-f0-9]{64}$/) })).min(1),
});
export type VersionManifest = z.infer<typeof manifestSchema>;
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

function validatePaths(paths: string[]) {
  const seen = new Set<string>();
  for (const file of paths) {
    if (!file || file.includes("\\") || file.split("/").some(part => !part || part === "." || part === ".." || /[<>:"|?*\x00-\x1f]/.test(part) || /[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) {
      throw new Error(`Unsafe snapshot path: ${file}`);
    }
    const key = file.toLowerCase();
    if (seen.has(key)) throw new Error(`Duplicate snapshot path: ${file}`);
    seen.add(key);
  }
  for (const file of seen) {
    const parts = file.split("/");
    while (parts.length > 1) {
      parts.pop();
      if (seen.has(parts.join("/"))) throw new Error(`Snapshot file/directory conflict: ${file}`);
    }
  }
}

/** Check every existing ancestor too, including Windows directory junctions. */
function rejectSymlinks(target: string) {
  let current = path.resolve(target);
  while (true) {
    try {
      if (fs.lstatSync(current).isSymbolicLink()) throw new Error(`Symlink not allowed: ${current}`);
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
    const parent = path.dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

function existing(target: string) {
  try { fs.lstatSync(target); return true; }
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}

function writeFile(root: string, relative: string, bytes: Buffer | string) {
  const destination = path.join(root, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, bytes, { flag: "wx" });
}

function createDirectory(destination: string, write: (stage: string) => void) {
  rejectSymlinks(destination);
  if (existing(destination)) throw new Error(`Destination already exists: ${destination}`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const stage = fs.mkdtempSync(path.join(path.dirname(destination), ".content-version-stage-"));
  try {
    write(stage);
    rejectSymlinks(destination);
    if (existing(destination)) throw new Error(`Destination already exists: ${destination}`);
    fs.renameSync(stage, destination);
  } catch (error) {
    fs.rmSync(stage, { recursive: true, force: true });
    throw error;
  }
  return destination;
}

export function saveVersion(root: string, identity: VersionIdentity, input: SnapshotInput): string {
  manifestSchema.shape.identity.parse(identity);
  const names = Object.keys(input.files).sort();
  validatePaths(names);
  const manifest = manifestSchema.parse({
    schemaVersion: 1, identity, createdAt: new Date().toISOString(), summary: input.summary,
    files: names.map(name => {
      const bytes = input.files[name];
      if (!Buffer.isBuffer(bytes)) throw new Error(`Snapshot must contain Buffer bytes: ${name}`);
      return { path: name, bytes: bytes.length, sha256: digest(bytes) };
    }),
  });
  const serialized = JSON.stringify(manifest, null, 2) + "\n";
  const destination = path.resolve(root, VERSION_ROOT, identity.season, identity.version);
  return createDirectory(destination, stage => {
    for (const name of names) writeFile(stage, `files/${name}`, input.files[name]);
    writeFile(stage, "manifest.json", serialized);
    verifyVersion(stage);
  });
}

function inventory(directory: string, relative = ""): string[] {
  return fs.readdirSync(path.join(directory, relative), { withFileTypes: true }).flatMap(entry => {
    const name = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Symlink not allowed: ${name}`);
    if (entry.isDirectory()) return inventory(directory, name);
    if (!entry.isFile()) throw new Error(`Not a regular file: ${name}`);
    return [name];
  });
}

export function verifyVersion(directory: string): VersionManifest {
  rejectSymlinks(directory);
  const actual = inventory(directory).sort();
  const manifest = manifestSchema.parse(JSON.parse(fs.readFileSync(path.join(directory, "manifest.json"), "utf8")));
  validatePaths(manifest.files.map(file => file.path));
  const expected = ["manifest.json", ...manifest.files.map(file => `files/${file.path}`)].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("Snapshot file inventory mismatch");
  for (const file of manifest.files) {
    const bytes = fs.readFileSync(path.join(directory, "files", file.path));
    if (bytes.length !== file.bytes || digest(bytes) !== file.sha256) throw new Error(`Snapshot checksum mismatch: ${file.path}`);
  }
  return manifest;
}

export function listVersions(root: string): { directory: string; manifest: VersionManifest }[] {
  const base = path.resolve(root, VERSION_ROOT);
  rejectSymlinks(base);
  if (!existing(base)) return [];
  const result: { directory: string; manifest: VersionManifest }[] = [];
  for (const season of fs.readdirSync(base).sort()) {
    identifier.parse(season);
    const seasonDirectory = path.join(base, season);
    rejectSymlinks(seasonDirectory);
    for (const version of fs.readdirSync(seasonDirectory).sort()) {
      if (version.startsWith(".content-version-stage-")) continue;
      identifier.parse(version);
      const directory = path.join(seasonDirectory, version);
      const manifest = verifyVersion(directory);
      if (manifest.identity.season !== season || manifest.identity.version !== version) throw new Error(`Snapshot identity mismatch: ${directory}`);
      result.push({ directory, manifest });
    }
  }
  return result;
}

export function diffVersions(leftDirectory: string, rightDirectory: string) {
  const left = new Map(verifyVersion(leftDirectory).files.map(file => [file.path, file.sha256]));
  const right = new Map(verifyVersion(rightDirectory).files.map(file => [file.path, file.sha256]));
  return {
    added: [...right.keys()].filter(name => !left.has(name)).sort(),
    removed: [...left.keys()].filter(name => !right.has(name)).sort(),
    changed: [...left.keys()].filter(name => right.has(name) && left.get(name) !== right.get(name)).sort(),
  };
}

/** Export into a new review directory; never restore directly over active content. */
export function exportVersion(directory: string, outputDirectory: string): string {
  const manifest = verifyVersion(directory);
  const destination = path.resolve(outputDirectory);
  const relative = path.relative(path.resolve(directory), destination);
  if (!relative || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))) {
    throw new Error("Export destination must be outside the immutable snapshot");
  }
  return createDirectory(destination, stage => {
    for (const file of manifest.files) {
      const bytes = fs.readFileSync(path.join(directory, "files", file.path));
      if (digest(bytes) !== file.sha256) throw new Error(`Snapshot checksum mismatch: ${file.path}`);
      writeFile(stage, file.path, bytes);
    }
  });
}
