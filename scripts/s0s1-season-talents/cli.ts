import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

type Step = { script: string; args: string[] };

export function planLegacyTalentRun(args: readonly string[]): { project: boolean; steps: Step[] } {
  const [command, ...flags] = args;
  if (!["project", "refresh", "check"].includes(command)) throw new Error("Usage: cli.ts <project|refresh|check> [--s1-taboo-script=<ReadScriptData export>] [--assets=<evidence.json>|--prepare-assets] [--sources]");
  for (const flag of flags) if (!/^--(?:s1-taboo-script|assets)=.+$/.test(flag) && !["--prepare-assets", "--sources"].includes(flag)) throw new Error(`Unknown option: ${flag}`);
  const script = flags.find(flag => flag.startsWith("--s1-taboo-script="));
  const assets = flags.find(flag => flag.startsWith("--assets="));
  const prepareAssets = flags.includes("--prepare-assets");
  const sources = command === "refresh" || flags.includes("--sources");
  if (command === "project" && flags.length) throw new Error("project replays committed evidence offline and accepts no source options.");
  if (command === "check" && (assets || prepareAssets)) throw new Error("check does not export assets.");
  if (sources && !script) throw new Error("S1_BLUEPRINT_REQUIRED: source refresh/check requires --s1-taboo-script=<ReadScriptData export>; use project for offline regeneration.");
  if (assets && prepareAssets) throw new Error("Choose --assets or --prepare-assets, not both.");
  if (command === "refresh" && !assets && !prepareAssets) throw new Error("refresh requires --assets=<evidence.json> or --prepare-assets to retain explicit icon evidence.");
  const steps: Step[] = [];
  if (command === "refresh") {
    if (prepareAssets) steps.push({ script: "scripts/prepare-s0s1-talent-assets.ts", args: [] });
    steps.push({ script: "scripts/s0s1-season-talents/extract.ts", args: [script!, assets ?? "--assets=MD/_local/s0s1Talent/asset-evidence.json"] });
  }
  if (command !== "check") {
    steps.push({ script: "scripts/s0s1-season-talents/providers.ts", args: ["--write"] });
    steps.push({ script: "scripts/num-modifier/project-cli.ts", args: ["write"] });
  }
  steps.push({ script: "scripts/s0s1-season-talents/check.ts", args: sources ? ["--sources", script!] : [] });
  steps.push({ script: "scripts/s0s1-season-talents/providers.ts", args: [] });
  steps.push({ script: "scripts/num-modifier/project-cli.ts", args: ["check"] });
  steps.push({ script: "scripts/check-multiplier-index.ts", args: [] });
  return { project: command === "project", steps };
}

export async function runLegacyTalentCli(args = process.argv.slice(2)) {
  if (args[0] === "refresh") {
    args = [...args];
    if (!args.some(arg => arg.startsWith("--s1-taboo-script="))) {
      // The helper uses the installed local CLI/profile; it never installs tools or prints credentials.
      const result = spawnSync("pwsh", ["-NoProfile", "-File", "scripts/s0s1-season-talents/export-taboo-script.ps1"], { encoding: "utf8" });
      if (result.error || result.status !== 0) throw new Error("Could not export S1 execution evidence with the installed FModel CLI. Export with export-taboo-script.ps1 using your installation paths, then pass --s1-taboo-script=<export.json>.");
      const exported: unknown = JSON.parse(result.stdout);
      if (!exported || typeof exported !== "object" || !("output" in exported) || typeof exported.output !== "string") throw new Error("S1 blueprint export did not return an output file.");
      args.push(`--s1-taboo-script=${exported.output}`);
    }
    if (!args.some(arg => arg.startsWith("--assets=") || arg === "--prepare-assets")) args.push("--prepare-assets");
  }
  const plan = planLegacyTalentRun(args);
  if (plan.project) {
    const { projectLegacyTalents } = await import("./extract");
    projectLegacyTalents();
  }
  // Each consumer imports generated JSON. Fresh processes prevent stale module caches.
  for (const step of plan.steps) {
    const result = spawnSync(process.execPath, ["--import", "tsx", step.script, ...step.args], { stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${step.script} failed (${result.signal ?? result.status}); fix the reported evidence and rerun.`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runLegacyTalentCli().catch(error => { console.error(error); process.exitCode = 1; });
}
