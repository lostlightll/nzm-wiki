import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { ResolvedWeapon } from "../../lib/weapon-resolver";
import type { NumericalTable } from "../../lib/weapon-source-v2";

const RUN_COUNT = 3;
const WORKER_FLAG = "--worker";
const scriptPath = fileURLToPath(import.meta.url);

interface MemorySample {
  heap_used_mib: number;
  rss_mib: number;
}

interface BenchmarkRun {
  module_initialization_ms: number;
  resolution_ms: number;
  weapons: Record<NumericalTable, number>;
  v2_weapons: Record<NumericalTable, number>;
  memory: {
    before_import: MemorySample;
    after_import: MemorySample;
    after_resolution: MemorySample;
  };
}

interface WeaponsModule {
  getAllResolvedWeapons(table: NumericalTable): Promise<ResolvedWeapon[]>;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function memorySample(): MemorySample {
  const usage = process.memoryUsage();
  return {
    heap_used_mib: round(usage.heapUsed / 1024 / 1024),
    rss_mib: round(usage.rss / 1024 / 1024),
  };
}

function collectGarbage(): void {
  const gc = (globalThis as typeof globalThis & { gc?: () => void }).gc;
  gc?.();
}

async function runWorker(): Promise<void> {
  collectGarbage();
  const beforeImport = memorySample();
  const moduleStartedAt = performance.now();
  const imported = await import(
    pathToFileURL(path.join(process.cwd(), "lib", "weapons.ts")).href
  );
  const weaponsModule = (
    "getAllResolvedWeapons" in imported ? imported : imported.default
  ) as WeaponsModule;
  const moduleInitializationMs = performance.now() - moduleStartedAt;

  collectGarbage();
  const afterImport = memorySample();
  const resolutionStartedAt = performance.now();
  const [lc, td] = await Promise.all([
    weaponsModule.getAllResolvedWeapons("lc"),
    weaponsModule.getAllResolvedWeapons("td"),
  ]);
  const resolutionMs = performance.now() - resolutionStartedAt;
  collectGarbage();

  const result: BenchmarkRun = {
    module_initialization_ms: round(moduleInitializationMs),
    resolution_ms: round(resolutionMs),
    weapons: { lc: lc.length, td: td.length },
    v2_weapons: {
      lc: lc.filter((weapon) => weapon.schemaVersion === 2).length,
      td: td.filter((weapon) => weapon.schemaVersion === 2).length,
    },
    memory: {
      before_import: beforeImport,
      after_import: afterImport,
      after_resolution: memorySample(),
    },
  };
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function runParent(): void {
  const packageJson = JSON.parse(
    readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
  ) as { dependencies?: { next?: string } };
  const runs: BenchmarkRun[] = [];
  for (let run = 0; run < RUN_COUNT; run += 1) {
    const result = spawnSync(
      process.execPath,
      ["--expose-gc", "--import", "tsx", scriptPath, WORKER_FLAG],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: { ...process.env, NODE_ENV: "production" },
        maxBuffer: 10 * 1024 * 1024,
      },
    );
    if (result.status !== 0) {
      throw new Error(
        `benchmark worker ${run + 1} failed: ${result.stderr || result.stdout}`,
      );
    }
    runs.push(JSON.parse(result.stdout.trim()) as BenchmarkRun);
  }

  const report = {
    runtime: {
      node: process.version,
      next: packageJson.dependencies?.next,
      runs: RUN_COUNT,
    },
    runs,
    median: {
      module_initialization_ms: median(
        runs.map((run) => run.module_initialization_ms),
      ),
      resolution_ms: median(runs.map((run) => run.resolution_ms)),
      after_resolution_heap_used_mib: median(
        runs.map((run) => run.memory.after_resolution.heap_used_mib),
      ),
      after_resolution_rss_mib: median(
        runs.map((run) => run.memory.after_resolution.rss_mib),
      ),
    },
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

async function main(): Promise<void> {
  if (process.argv.includes(WORKER_FLAG)) {
    await runWorker();
  } else {
    runParent();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
