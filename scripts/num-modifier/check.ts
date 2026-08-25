import fs from "node:fs";
import path from "node:path";

import matter from "gray-matter";

import statusEffects from "../../data/status-effects.json";
import { getAllPerks } from "../../lib/perks";
import { createNumModifierResolver } from "../../lib/num-modifier";
import { parseNumModifierSemantics } from "../../lib/num-modifier-semantics";
import { checkNumModifierDataLock, readNumModifierDataLock } from "./lock";
import { checkModifierRuntimeProjections } from "./project";
import { loadModifierProviderRegistry } from "./provider-registry";

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
  const rawAttributeDescriptionPath = "DataTables/AttributeDescMapTable.json";
  const rawSourceAllowlist = new Set([
    path.join(root, "data", "num-modifier-lock.json"),
    path.join(root, "scripts", "num-modifier", "lock.ts"),
  ]);
  const directLockImport = /(?:from\s+|require\s*\(\s*)["'][^"']*num-modifier-lock\.json["']/;
  const directLockAllowlist = new Set([
    path.join(root, "lib", "num-modifier-data.ts"),
  ]);
  const directRuntimeImport =
    /(?:from\s+|require\s*\(\s*)["'][^"']*modifier-index-runtime\.json["']/;
  const directRuntimeAllowlist = new Set([
    path.join(root, "lib", "modifier-index.ts"),
  ]);
  const thisFile = path.resolve(__filename);
  const searchIndexFile = path.join(root, "scripts", "generate-search-index.ts");

  for (const filePath of files) {
    if (path.resolve(filePath) === thisFile) continue;
    const source = fs.readFileSync(filePath, "utf8");
    if (source.includes(rawSourcePath) && !rawSourceAllowlist.has(filePath)) {
      addError(
        `${path.relative(root, filePath)} directly references the raw Num Modifier table`,
      );
    }
    if (
      source.includes(rawAttributeDescriptionPath) &&
      !rawSourceAllowlist.has(filePath)
    ) {
      addError(
        `${path.relative(root, filePath)} directly references AttributeDescMapTable`,
      );
    }
    if (
      source.includes("data/guides/multiplier-providers.json") &&
      !filePath.endsWith("migrate-provider-registry.ts")
    ) {
      addError(`${path.relative(root, filePath)} references the retired provider registry`);
    }
    if (directLockImport.test(source) && !directLockAllowlist.has(filePath)) {
      addError(
        `${path.relative(root, filePath)} directly imports num-modifier-lock.json`,
      );
    }
    if (
      directRuntimeImport.test(source) &&
      !directRuntimeAllowlist.has(filePath)
    ) {
      addError(
        `${path.relative(root, filePath)} bypasses the modifier-index interface`,
      );
    }
    if (
      filePath === searchIndexFile &&
      source.includes('overlimit-cards.json')
    ) {
      addError(
        "generate-search-index.ts bypasses the composed overlimit card projection",
      );
    }
  }

  const multiplierData = JSON.parse(
    fs.readFileSync(path.join(root, "data", "guides", "multiplier.json"), "utf8"),
  ) as { factorDetails?: Record<string, unknown> };
  for (const [factorId, detail] of Object.entries(
    multiplierData.factorDetails ?? {},
  )) {
    if (
      detail &&
      typeof detail === "object" &&
      Object.hasOwn(detail, "attributeFields")
    ) {
      addError(
        `multiplier factorDetails.${factorId} copies Num Modifier attributeFields`,
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
  let manualSemanticFields = 0;

  for (const filePath of walkFiles(path.join(root, "data", "perks")).filter(
    (candidate) => candidate.endsWith(".mdx"),
  )) {
    const { data } = matter(fs.readFileSync(filePath, "utf8"));
    for (const effect of Array.isArray(data.effect_values)
      ? (data.effect_values as Array<Record<string, unknown>>)
      : []) {
      if (
        Object.hasOwn(effect, "kind") ||
        Object.hasOwn(effect, "statId") ||
        Object.hasOwn(effect, "modifierTypeId")
      ) {
        manualSemanticFields += 1;
      }
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
  if (manualSemanticFields > 0) {
    addError(`${manualSemanticFields} perk effects still copy semantic classification fields`);
  }
  if (referencedEffects !== 97) {
    addError(`expected 97 Num-derived perk effect_values, found ${referencedEffects}`);
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
    { name: "紫奖掉物", values: ["16%", "18%"] },
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
  const semantics = parseNumModifierSemantics(
    JSON.parse(
      fs.readFileSync(path.join(root, "data", "num-modifier-semantics.json"), "utf8"),
    ),
  );
  const lockCheck = checkNumModifierDataLock(lock);
  errors.push(...lockCheck.issues);
  const resolver = createNumModifierResolver(lock, semantics);
  const registry = loadModifierProviderRegistry();

  const lockedAttributeNames = new Set(
    Object.values(lock.rows.lc).map((row) => String(row.raw.AttributeName ?? "")),
  );
  for (const attributeName of lockedAttributeNames) {
    if (!Object.hasOwn(semantics.attributes, attributeName)) {
      addError(`attribute ${attributeName || "<empty>"} has no semantic disposition`);
    }
  }
  const descriptorNames = new Set(
    Object.values(lock.attribute_descriptions.lc).map((row) =>
      String(row.raw.attr_realname ?? ""),
    ),
  );
  const joined = [...lockedAttributeNames].filter(
    (attributeName) => attributeName && descriptorNames.has(attributeName),
  ).length;
  const missing = [...lockedAttributeNames].filter(
    (attributeName) => attributeName && !descriptorNames.has(attributeName),
  ).length;
  if (lockedAttributeNames.size !== 155 || joined !== 138 || missing !== 16) {
    addError(
      `attribute connection baseline changed: total=${lockedAttributeNames.size}, joined=${joined}, missing=${missing}`,
    );
  }

  for (const entry of registry.providers) {
    for (const [index, application] of (entry.applications ?? []).entries()) {
      resolver.resolveEffect(
        application.expression,
        application.context,
        `data/modifier-providers.json#${entry.id}.applications[${index}]`,
      );
    }
  }
  for (const entry of registry.exclusions) {
    for (const [index, application] of (entry.evidence?.applications ?? []).entries()) {
      resolver.resolveEffect(
        application.expression,
        application.context,
        `data/modifier-providers.json#${entry.id}.evidence.applications[${index}]`,
      );
    }
  }
  const samples = [
    ["lc:111010083_1_0", "base", "toughness-efficiency", "increase"],
    ["lc:111010076_1_0", "coefficient", "critical-rate", "increase"],
    ["lc:100200001_1_0", "base", "slow", "decrease"],
    ["lc:100300001_1_0", "base", "vulnerability", "decrease"],
    ["lc:110003101_1_1", "base", "damage-reduction", "increase"],
  ] as const;
  for (const [row, field, facetId, direction] of samples) {
    const effect = resolver.resolveEffect(
      { row, field },
      { recipient: facetId === "slow" || facetId === "vulnerability" ? "enemy" : "self" },
      `semantic-sample:${row}`,
    );
    if (
      effect.direction !== direction ||
      !effect.facets.some((facet) => facet.id === facetId)
    ) {
      addError(`${row} does not resolve to ${facetId}:${direction}`);
    }
  }
  const unknownOverride = resolver.resolveEffect(
    { row: "lc:100000002_1_0", field: "base" },
    { recipient: "enemy" },
  );
  if (unknownOverride.direction !== "unknown" || unknownOverride.facets.length > 0) {
    addError("lc:100000002_1_0 must remain directionally unknown");
  }
  const slug = resolver.resolveEffect(
    { row: "lc:111031014_1_0", field: "base" },
    { recipient: "damage-event" },
  );
  if (!slug.reviewed || slug.factor !== 7 || slug.facets[0]?.id !== "correction") {
    addError("independent slug B2 reviewed semantics drifted");
  }
  errors.push(...checkModifierRuntimeProjections());
  checkPerkConsumers();
  checkStatusEffects();
  checkStaticBoundaries();

  if (errors.length > 0) {
    throw new Error(
      `Num Modifier V2 check failed:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
  }
  console.log(
    `Num Modifier V2 check passed: ${lock.sources.lc.modifiers.row_count} locked rows, ` +
      `${lock.sources.lc.attribute_descriptions.row_count} attribute descriptions, ` +
      `${registry.providers.length} providers, ${registry.exclusions.length} exclusions.`,
  );
}

try {
  run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
