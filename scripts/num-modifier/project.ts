import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createNumModifierResolver, type NumModifierRowKey } from "../../lib/num-modifier";
import { readNumModifierDataLock } from "./lock";
import {
  loadMultiplierProviderRegistry,
  MULTIPLIER_PROVIDER_REGISTRY_PATH,
} from "./provider-registry";

type JsonObject = Record<string, unknown>;

const root = process.cwd();
export const MULTIPLIER_PROVIDER_RUNTIME_PATH = path.join(
  root,
  "data",
  "guides",
  "multiplier-providers-runtime.json",
);
const MULTIPLIER_DATA_PATH = path.join(root, "data", "guides", "multiplier.json");

function readJson(filePath: string): JsonObject {
  const value = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Expected JSON object: ${filePath}`);
  }
  return value as JsonObject;
}

function asObjects(value: unknown, field: string): JsonObject[] {
  if (!Array.isArray(value) || value.some((item) => !item || typeof item !== "object" || Array.isArray(item))) {
    throw new Error(`${field} must be an object array`);
  }
  return value as JsonObject[];
}

function asStrings(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${field} must be a string array`);
  }
  return value as string[];
}

function unique<T>(values: Iterable<T>): T[] {
  return [...new Set(values)];
}

function attributeTypeMap(multiplierData: JsonObject): Map<string, string> {
  const matrix = multiplierData.damageChannelMatrix as JsonObject | undefined;
  const channels = asObjects(matrix?.channels, "damageChannelMatrix.channels");
  const result = new Map<string, string>();
  for (const channel of channels) {
    const id = String(channel.id ?? "");
    for (const attribute of asStrings(channel.attributeFields, `${id}.attributeFields`)) {
      const previous = result.get(attribute);
      if (previous && previous !== id) {
        throw new Error(`Attribute ${attribute} maps to both ${previous} and ${id}`);
      }
      result.set(attribute, id);
    }
  }
  return result;
}

function sourceHash(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

export function generateMultiplierProviderRuntime(): JsonObject {
  const registry = loadMultiplierProviderRegistry();
  const numModifierLock = readNumModifierDataLock();
  const numModifierResolver = createNumModifierResolver(numModifierLock);
  const multiplierData = readJson(MULTIPLIER_DATA_PATH);
  const typeByAttribute = attributeTypeMap(multiplierData);
  const providers = registry.providers.map((provider) => {
    const { id, evidence } = provider;
    const { kind } = evidence;
    let modifierTypeIds: string[];
    if (kind === "gp-modifier") {
      modifierTypeIds = unique(
        evidence.numModifierRows.map((key) => {
          const row = numModifierResolver.getRow(
            key,
            `data/guides/multiplier-providers.json#${id}`,
          );
          const modifierTypeId = typeByAttribute.get(row.attributeName);
          if (!modifierTypeId) {
            throw new Error(
              `${id} row ${key} attribute ${row.attributeName || "<empty>"} has no modifier type`,
            );
          }
          return modifierTypeId;
        }),
      );
    } else if (kind === "reviewed-override") {
      modifierTypeIds = unique(provider.modifierTypeIds ?? []);
      for (const key of evidence.numModifierRows ?? []) {
        numModifierResolver.getRow(
          key,
          `data/guides/multiplier-providers.json#${id}`,
        );
      }
    } else {
      throw new Error(`${id} uses unknown evidence kind ${kind}`);
    }
    return {
      id,
      label: provider.label,
      source: provider.source,
      modifierTypeIds,
    };
  });

  const exclusions = registry.exclusions.map((exclusion) => ({
    id: exclusion.id,
    label: exclusion.label,
    source: exclusion.source,
    reasonCode: exclusion.reasonCode,
    reason: exclusion.reason,
  }));

  return {
    schemaVersion: 1,
    source: {
      registrySha256: sourceHash(MULTIPLIER_PROVIDER_REGISTRY_PATH),
      numModifierSourceSha256: numModifierLock.sources.lc.sha256,
      multiplierSchemaVersion: multiplierData.schemaVersion,
    },
    providers,
    exclusions,
  };
}

export function serializeMultiplierProviderRuntime(value: JsonObject): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function writeMultiplierProviderRuntime(): void {
  writeFileSync(
    MULTIPLIER_PROVIDER_RUNTIME_PATH,
    serializeMultiplierProviderRuntime(generateMultiplierProviderRuntime()),
    "utf8",
  );
}

export function checkMultiplierProviderRuntime(): string[] {
  if (!existsSync(MULTIPLIER_PROVIDER_RUNTIME_PATH)) {
    return ["missing data/guides/multiplier-providers-runtime.json"];
  }
  const expected = serializeMultiplierProviderRuntime(generateMultiplierProviderRuntime());
  return readFileSync(MULTIPLIER_PROVIDER_RUNTIME_PATH, "utf8") === expected
    ? []
    : ["multiplier-providers-runtime.json is stale; run pnpm num-modifier:project"];
}

export function migrateMultiplierProviderRegistry(): void {
  const registry = readJson(MULTIPLIER_PROVIDER_REGISTRY_PATH);
  const numModifierResolver = createNumModifierResolver(readNumModifierDataLock());
  if (registry.schemaVersion === 2) {
    const typeByAttribute = attributeTypeMap(readJson(MULTIPLIER_DATA_PATH));
    const cleanEvidence = (rawEvidence: unknown): JsonObject | undefined => {
      if (!rawEvidence || typeof rawEvidence !== "object" || Array.isArray(rawEvidence)) {
        return undefined;
      }
      const evidence = { ...(rawEvidence as JsonObject) };
      for (const key of ["passiveSkillId", "descriptionRowKey"] as const) {
        if (evidence[key] === "") delete evidence[key];
      }
      for (const key of ["descriptionRowKeys", "staleGpModifierIds"] as const) {
        if (Array.isArray(evidence[key]) && evidence[key].length === 0) {
          delete evidence[key];
        }
      }
      return Object.keys(evidence).length > 0 ? evidence : undefined;
    };
    const providers = asObjects(registry.providers, "providers").map((rawProvider) => {
      const provider = { ...rawProvider };
      const evidence = cleanEvidence(provider.evidence);
      if (!evidence) throw new Error(`${String(provider.id)} has no evidence`);
      if (evidence.kind !== "gp-modifier") return { ...provider, evidence };
      const rowKeys = asStrings(
        evidence.numModifierRows,
        `${String(provider.id)}.numModifierRows`,
      );
      return {
        ...provider,
        evidence: {
          ...evidence,
          numModifierRows: rowKeys.filter((key) =>
            typeByAttribute.has(
              numModifierResolver.getRow(key as NumModifierRowKey).attributeName,
            ),
          ),
        },
      };
    });
    const exclusions = asObjects(registry.exclusions, "exclusions").map(
      (rawExclusion) => {
        const exclusion = { ...rawExclusion };
        const evidence = cleanEvidence(exclusion.evidence);
        if (evidence) return { ...exclusion, evidence };
        delete exclusion.evidence;
        return exclusion;
      },
    );
    writeFileSync(
      MULTIPLIER_PROVIDER_REGISTRY_PATH,
      `${JSON.stringify({ ...registry, providers, exclusions }, null, 2)}\n`,
      "utf8",
    );
    return;
  }
  if (registry.schemaVersion !== 1) throw new Error("Unsupported provider registry schema");

  const migrateEvidence = (rawEvidence: unknown): JsonObject | undefined => {
    if (!rawEvidence || typeof rawEvidence !== "object" || Array.isArray(rawEvidence)) {
      return undefined;
    }
    const evidence = { ...(rawEvidence as JsonObject) };
    const rowKeys = new Set<string>();
    for (const rawRow of (evidence.numericalRows as JsonObject[] | undefined) ?? []) {
      if (typeof rawRow.rowKey === "string") rowKeys.add(`lc:${rawRow.rowKey}`);
    }
    delete evidence.numericalRows;
    delete evidence.gpModifierIds;
    if (rowKeys.size > 0) evidence.numModifierRows = [...rowKeys];
    return evidence;
  };

  const providers = asObjects(registry.providers, "providers").map((rawProvider) => {
    const provider = { ...rawProvider, evidence: migrateEvidence(rawProvider.evidence) };
    const evidence = provider.evidence as JsonObject;
    if (evidence.kind === "gp-modifier") delete provider.modifierTypeIds;
    return provider;
  });
  const exclusions = asObjects(registry.exclusions, "exclusions").map((rawExclusion) => ({
    ...rawExclusion,
    ...(rawExclusion.evidence
      ? { evidence: migrateEvidence(rawExclusion.evidence) }
      : {}),
  }));
  const migrated = {
    ...registry,
    schemaVersion: 2,
    evidencePriority: [
      "CardID",
      "Card_Function",
      "ItemID",
      "PassiveSkill_ID",
      "MGE/Buff.GPModifier",
      "MGE.GPModifier",
      "numModifierRows",
      "AttributeName",
      "modifierType",
      "factor",
    ],
    providers,
    exclusions,
  };
  writeFileSync(
    MULTIPLIER_PROVIDER_REGISTRY_PATH,
    `${JSON.stringify(migrated, null, 2)}\n`,
    "utf8",
  );
}
