import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const tsxCli = require.resolve("tsx/cli");
const nextCli = require.resolve("next/dist/bin/next");

function run(script: string, args: string[] = []): void {
  const result = spawnSync(process.execPath, [script, ...args], {
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(tsxCli, ["scripts/validate-content.ts"]);
run(tsxCli, ["scripts/generate-search-index.ts"]);
run(tsxCli, ["scripts/generate-sitemap.ts"]);
run(nextCli, ["build"]);
run(tsxCli, ["scripts/prune-static-assets.ts"]);
