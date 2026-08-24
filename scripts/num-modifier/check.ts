import fs from "node:fs";
import path from "node:path";

import matter from "gray-matter";

import statusEffects from "../../data/status-effects.json";
import { getAllPerks } from "../../lib/perks";
import { createNumModifierResolver } from "../../lib/num-modifier";
import { checkNumModifierDataLock, readNumModifierDataLock } from "./lock";
import { checkMultiplierProviderRuntime } from "./project";
import { loadMultiplierProviderRegistry } from "./provider-registry";

const root = process.cwd();
const errors: string[] = [];

function addError(message: string): void {
  errors.push(message);
}

function walkFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(filePath) : [filePath];
  });
}

function checkStaticBoundaries(): void {
  const sourceRoots = ["app", "components", "data", "lib", "scripts", "types"];
  const files = sourceRoots
    .flatMap((directory) => walkFiles(path.join(root, directory)))
    .filter((filePath) => /\.(?:json|mdx?|[cm]?[jt]sx?)$/.test(filePath));
  const rawSourcePath = "Attributes/AutoGenerate/numerical_modifier_config.json";
  const rawSourceAllowlist = new Set([
    path.join(root, "data", "num-modifier-lock.json"),
    path.join(root, "scripts", "num-modifier", "lock.ts"),
  ]);
  const directLockImport = /(?:from\s+|require\s*\(\s*)["'][^"']*num-modifier-lock\.json["']/;
  const directLockAllowlist = new Set([
    path.join(root, "lib", "num-modifier-data.ts"),
  ]);
  const thisFile = path.resolve(__filename);

  for (const filePath of files) {
    if (path.resolve(filePath) === thisFile) continue;
    const source = fs.readFileSync(filePath, "utf8");
    if (source.includes(rawSourcePath) && !rawSourceAllowlist.has(filePath)) {
      addError(
        `${path.relative(root, filePath)} directly references the raw Num Modifier table`,
      );
    }
    if (directLockImport.test(source) && !directLockAllowlist.has(filePath)) {
      addError(
        `${path.relative(root, filePath)} directly imports num-modifier-lock.json`,
      );
    }
  }
}

function checkPerkConsumers(): void {
  const perks = getAllPerks();
  const perksByName = new Map(perks.map((perk) => [perk.name, perk]));
  let referencedEffects = 0;
  let referencedStages = 0;
  let literalStages = 0;
  let legacyStages = 0;

  for (const filePath of walkFiles(path.join(root, "data", "perks")).filter(
    (candidate) => candidate.endsWith(".mdx"),
  )) {
    const { data } = matter(fs.readFileSync(filePath, "utf8"));
    for (const effect of Array.isArray(data.effect_values)
      ? (data.effect_values as Array<Record<string, unknown>>)
      : []) {
      let hasNumReference = false;
      for (const stage of Array.isArray(effect.stages)
        ? (effect.stages as Array<Record<string, unknown>>)
        : []) {
        if (typeof stage.value === "string") legacyStages += 1;
        else if (
          stage.value &&
          typeof stage.value === "object" &&
          "ref" in stage.value
        ) {
          referencedStages += 1;
          hasNumReference = true;
        } else if (
          stage.value &&
          typeof stage.value === "object" &&
          "literal" in stage.value
        ) {
          literalStages += 1;
        }
      }
      if (hasNumReference) referencedEffects += 1;
    }
  }

  if (legacyStages > 0) {
    addError(`${legacyStages} perk effect stages still use legacy string values`);
  }
  if (referencedEffects !== 96) {
    addError(`expected 96 Num-derived perk effect_values, found ${referencedEffects}`);
  }

  const samples: ReadonlyArray<{
    name: string;
    values: readonly string[];
    forbidden?: readonly string[];
  }> = [
    { name: "递进膛压", values: ["2.5%"] },
    { name: "川流不息", values: ["0.8%", "80%"] },
    { name: "精密追击", values: ["7%", "42%"], forbidden: ["10%"] },
    { name: "致命节拍", values: ["0.4%", "32%"] },
    { name: "近距增幅", values: ["5%", "35%"] },
    { name: "裁决充能", values: ["2%", "8%", "100%", "400%"] },
  ];
  for (const sample of samples) {
    const description = perksByName.get(sample.name)?.description;
    if (description === undefined) {
      addError(`${sample.name} is missing from the resolved perk catalog`);
      continue;
    }
    for (const expected of sample.values) {
      if (!description.includes(expected)) {
        addError(`${sample.name} resolved description is missing ${expected}`);
      }
    }
    for (const forbidden of sample.forbidden ?? []) {
      if (description.includes(forbidden)) {
        addError(`${sample.name} resolved description still contains ${forbidden}`);
      }
    }
  }

  console.log(
    `Perk Num effects: ${referencedEffects}; referenced stages: ${referencedStages}; ` +
      `justified literals: ${literalStages}; perks loaded: ${perks.length}.`,
  );
}

function checkStatusEffects(): void {
  const data = statusEffects as unknown as {
    schemaVersion?: number;
    source?: Record<string, unknown>;
    effects?: Array<{ variants?: Array<{ modifierIds?: number[] }> }>;
    references?: Record<string, unknown>;
  };
  if (data.schemaVersion !== 2) addError("status-effects.json must use schemaVersion 2");
  if (data.source && "modifierTable" in data.source) {
    addError("status-effects.json still copies source.modifierTable");
  }
  if (data.references && "modifiers" in data.references) {
    addError("status-effects.json still copies references.modifiers");
  }
}

function run(): void {
  const lock = readNumModifierDataLock();
  const lockCheck = checkNumModifierDataLock(lock);
  errors.push(...lockCheck.issues);
  const resolver = createNumModifierResolver(lock);
  const registry = loadMultiplierProviderRegistry();

  for (const entry of [...registry.providers, ...registry.exclusions]) {
    for (const key of entry.evidence?.numModifierRows ?? []) {
      resolver.getRow(
        key,
        `data/guides/multiplier-providers.json#${entry.id}`,
      );
    }
  }
  errors.push(...checkMultiplierProviderRuntime());
  checkPerkConsumers();
  checkStatusEffects();
  checkStaticBoundaries();

  if (errors.length > 0) {
    throw new Error(
      `Num Modifier V2 check failed:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
  }
  console.log(
    `Num Modifier V2 check passed: ${lock.sources.lc.row_count} locked rows, ` +
      `${registry.providers.length} providers, ${registry.exclusions.length} exclusions.`,
  );
}

try {
  run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
