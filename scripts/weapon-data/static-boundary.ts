import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEPLOY_EXTENSIONS = new Set([".html", ".js", ".json", ".txt"]);
const LOCK_MARKERS = [
  "lc:120100240_1",
  '"rows":{"numerical-lc"',
  "weapon-data-lock",
] as const;

export interface StaticBoundaryReport {
  scanned_files: number;
  static_js_bytes: number;
  largest_weapon_payload: {
    path: string;
    bytes: number;
  } | null;
}

function walkFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(filePath) : [filePath];
  });
}

export function scanStaticWeaponBoundary(outDirectory: string): StaticBoundaryReport {
  const absoluteOut = path.resolve(outDirectory);
  if (!existsSync(absoluteOut)) {
    throw new Error(`static output directory does not exist: ${absoluteOut}`);
  }

  const files = walkFiles(absoluteOut).filter((filePath) =>
    DEPLOY_EXTENSIONS.has(path.extname(filePath)),
  );
  const markerHits = new Map<string, string[]>();
  let staticJsBytes = 0;
  let largestWeaponPayload: StaticBoundaryReport["largest_weapon_payload"] = null;
  const staticRoot = path.join(absoluteOut, "_next", "static") + path.sep;
  const weaponRoot = path.join(absoluteOut, "weapons") + path.sep;

  for (const filePath of files) {
    const bytes = readFileSync(filePath);
    const relativePath = path.relative(absoluteOut, filePath).replaceAll(path.sep, "/");
    for (const marker of LOCK_MARKERS) {
      if (!bytes.includes(Buffer.from(marker))) continue;
      const hits = markerHits.get(marker) ?? [];
      hits.push(relativePath);
      markerHits.set(marker, hits);
    }
    if (filePath.startsWith(staticRoot) && path.extname(filePath) === ".js") {
      staticJsBytes += bytes.length;
    }
    if (
      filePath.startsWith(weaponRoot) &&
      (!largestWeaponPayload || bytes.length > largestWeaponPayload.bytes)
    ) {
      largestWeaponPayload = { path: relativePath, bytes: bytes.length };
    }
  }

  if (markerHits.size > 0) {
    const details = [...markerHits].map(
      ([marker, paths]) => `${JSON.stringify(marker)}: ${paths.join(", ")}`,
    );
    throw new Error(`Weapon Data Lock leaked into static output:\n${details.join("\n")}`);
  }

  return {
    scanned_files: files.length,
    static_js_bytes: staticJsBytes,
    largest_weapon_payload: largestWeaponPayload,
  };
}

function main(): void {
  const report = scanStaticWeaponBoundary(path.join(process.cwd(), "out"));
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

const entryPath = process.argv[1];
if (entryPath && pathToFileURL(path.resolve(entryPath)).href === import.meta.url) {
  main();
}
