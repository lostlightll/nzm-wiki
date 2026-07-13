import fs from "node:fs";
import path from "node:path";

interface Options {
  outDir: string;
  dryRun: boolean;
  verbose: boolean;
}

// Only add paths here after every runtime display site has moved to
// getOptimizedImagePath. This keeps pruning explicit and reviewable.
const OPTIMIZED_ONLY_PATHS = [
  /^icons\//,
  /^images\/jjgc-puzzle\.png$/,
];

// Originals in these paths are used by downloads, browser metadata, or canvas
// workflows and must remain available even when a WebP mirror exists.
const PROTECTED_PATHS = [
  /^(?:favicon(?:-[^/]*)?|apple-touch-icon)\.png$/,
  /^icon\.png$/,
  /^logo\.png$/,
  /^spritesheets\//,
  /^icons\/peekaboo\//,
  /^images\/jjgc-puzzle-(?:vertical|watermark)\.png$/,
];

function parseArgs(): Options {
  const options: Options = {
    outDir: "out",
    dryRun: false,
    verbose: false,
  };

  for (const arg of process.argv.slice(2)) {
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--verbose") options.verbose = true;
    else if (arg.startsWith("--out-dir=")) options.outDir = arg.slice(10);
    else if (!arg.startsWith("--")) options.outDir = arg;
    else throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

function getPngFiles(directory: string): string[] {
  const files: string[] = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...getPngFiles(fullPath));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".png")) {
      files.push(fullPath);
    }
  }

  return files;
}

function normalizeRelativePath(root: string, filePath: string): string {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

function main() {
  const options = parseArgs();
  const outDir = path.resolve(process.cwd(), options.outDir);

  if (!fs.existsSync(outDir) || !fs.statSync(outDir).isDirectory()) {
    throw new Error(`Static output directory not found: ${outDir}`);
  }

  let removedCount = 0;
  let removedBytes = 0;
  let missingWebpCount = 0;

  for (const pngPath of getPngFiles(outDir)) {
    const relativePath = normalizeRelativePath(outDir, pngPath);
    if (!OPTIMIZED_ONLY_PATHS.some((pattern) => pattern.test(relativePath))) {
      continue;
    }
    if (PROTECTED_PATHS.some((pattern) => pattern.test(relativePath))) {
      continue;
    }

    const webpRelativePath = `webp/${relativePath.replace(/\.png$/i, ".webp")}`;
    const webpPath = path.join(outDir, ...webpRelativePath.split("/"));
    if (!fs.existsSync(webpPath)) {
      missingWebpCount++;
      if (options.verbose) console.warn(`[skip:no-webp] ${relativePath}`);
      continue;
    }

    const bytes = fs.statSync(pngPath).size;
    removedCount++;
    removedBytes += bytes;

    if (options.verbose) {
      console.log(`[${options.dryRun ? "would-remove" : "removed"}] ${relativePath}`);
    }
    if (!options.dryRun) fs.unlinkSync(pngPath);
  }

  console.log(
    `${options.dryRun ? "Would remove" : "Removed"} ${removedCount} PNG files ` +
      `(${formatBytes(removedBytes)}); skipped ${missingWebpCount} without WebP mirrors.`,
  );
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
