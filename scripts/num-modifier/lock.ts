import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  parseNumModifierDataLock,
  serializeNumModifierDataLock,
  type NumModifierDataLock,
} from "../../lib/num-modifier-data-lock";
import { createNumModifierResolver } from "../../lib/num-modifier";

type JsonObject = Record<string, unknown>;

function diffValues(
  previous: unknown,
  next: unknown,
  currentPath = "lock",
): string[] {
  if (Object.is(previous, next)) return [];
  if (Array.isArray(previous) && Array.isArray(next)) {
    const differences: string[] = [];
    const length = Math.max(previous.length, next.length);
    for (let index = 0; index < length; index += 1) {
      if (index >= previous.length) differences.push(`${currentPath}[${index}]: added`);
      else if (index >= next.length) differences.push(`${currentPath}[${index}]: removed`);
      else differences.push(...diffValues(previous[index], next[index], `${currentPath}[${index}]`));
    }
    return differences;
  }
  if (
    previous &&
    next &&
    typeof previous === "object" &&
    typeof next === "object" &&
    !Array.isArray(previous) &&
    !Array.isArray(next)
  ) {
    const left = previous as JsonObject;
    const right = next as JsonObject;
    const differences: string[] = [];
    for (const key of [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()) {
      const childPath = `${currentPath}.${key}`;
      if (!Object.hasOwn(left, key)) differences.push(`${childPath}: added`);
      else if (!Object.hasOwn(right, key)) differences.push(`${childPath}: removed`);
      else differences.push(...diffValues(left[key], right[key], childPath));
    }
    return differences;
  }
  return [`${currentPath}: ${JSON.stringify(previous)} -> ${JSON.stringify(next)}`];
}

export const NUM_MODIFIER_SOURCE_PATH =
  "Attributes/AutoGenerate/numerical_modifier_config.json";
export const ATTRIBUTE_DESCRIPTION_SOURCE_PATH =
  "DataTables/AttributeDescMapTable.json";
const GAME_TOKEN_SOURCE_PATHS = [
  "DataTables/MGE/DT_GPMGESkillDesConfigTable_Main.json",
  "DataTables/HuntingGroundRoguelike/HuntingGroundRoguelikeWeaponModTable.json",
] as const;
const KNOWN_UNRESOLVED_GAME_TOKENS = new Set([
  "{GPModifier:111041026:BaseValue:0:2:1}",
]);
export const DEFAULT_NUM_MODIFIER_LOCK_PATH = path.join(
  process.cwd(),
  "data",
  "num-modifier-lock.json",
);

function defaultContentRoot(): string {
  return path.join(process.cwd(), "refs", "Exports", "NZM", "Content");
}

function sourceFilePath(contentRoot: string, sourcePath: string): string {
  return path.join(contentRoot, ...sourcePath.split("/"));
}

function readSourceRows(filePath: string): Record<string, JsonObject> {
  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
  if (
    !Array.isArray(parsed) ||
    !parsed[0] ||
    typeof parsed[0] !== "object" ||
    Array.isArray(parsed[0])
  ) {
    throw new Error(`Num Modifier DataTable structure is invalid: ${filePath}`);
  }
  const rows = (parsed[0] as JsonObject).Rows;
  if (!rows || typeof rows !== "object" || Array.isArray(rows)) {
    throw new Error(`Num Modifier DataTable has no Rows object: ${filePath}`);
  }
  return rows as Record<string, JsonObject>;
}

function collectGameModifierTokens(value: unknown, tokens: Set<string>): void {
  if (typeof value === "string") {
    for (const match of value.matchAll(/\{GPModifier:[^}]+\}/gi)) {
      tokens.add(match[0]);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectGameModifierTokens(item, tokens);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value as JsonObject)) {
      collectGameModifierTokens(item, tokens);
    }
  }
}

export function generateNumModifierDataLock(
  contentRoot = defaultContentRoot(),
): NumModifierDataLock {
  const modifierFilePath = sourceFilePath(contentRoot, NUM_MODIFIER_SOURCE_PATH);
  const attributeDescriptionFilePath = sourceFilePath(
    contentRoot,
    ATTRIBUTE_DESCRIPTION_SOURCE_PATH,
  );
  const modifierBytes = readFileSync(modifierFilePath);
  const attributeDescriptionBytes = readFileSync(attributeDescriptionFilePath);
  const sourceRows = readSourceRows(modifierFilePath);
  const sourceAttributeDescriptions = readSourceRows(
    attributeDescriptionFilePath,
  );
  const rows = Object.fromEntries(
    Object.entries(sourceRows).map(([rowName, raw]) => [
      rowName,
      { row_name: rowName, raw },
    ]),
  );
  const attributeDescriptions = Object.fromEntries(
    Object.entries(sourceAttributeDescriptions).map(([rowName, raw]) => [
      rowName,
      { row_name: rowName, raw },
    ]),
  );
  const attributeRealNames = new Set<string>();
  for (const [rowName, row] of Object.entries(sourceAttributeDescriptions)) {
    const attributeRealName = row.attr_realname;
    if (typeof attributeRealName !== "string" || attributeRealName.trim() === "") {
      throw new Error(`AttributeDescMapTable row ${rowName} has no attr_realname`);
    }
    if (attributeRealNames.has(attributeRealName)) {
      throw new Error(
        `AttributeDescMapTable attr_realname is duplicated: ${attributeRealName}`,
      );
    }
    attributeRealNames.add(attributeRealName);
  }
  const lock = parseNumModifierDataLock({
    schema_version: 2,
    sources: {
      lc: {
        modifiers: {
          source_path: NUM_MODIFIER_SOURCE_PATH,
          sha256: createHash("sha256").update(modifierBytes).digest("hex"),
          row_count: Object.keys(rows).length,
        },
        attribute_descriptions: {
          source_path: ATTRIBUTE_DESCRIPTION_SOURCE_PATH,
          sha256: createHash("sha256")
            .update(attributeDescriptionBytes)
            .digest("hex"),
          row_count: Object.keys(attributeDescriptions).length,
        },
      },
    },
    rows: { lc: rows },
    attribute_descriptions: { lc: attributeDescriptions },
  });
  createNumModifierResolver(lock);
  return lock;
}

export function readNumModifierDataLock(
  lockPath = DEFAULT_NUM_MODIFIER_LOCK_PATH,
): NumModifierDataLock {
  return parseNumModifierDataLock(JSON.parse(readFileSync(lockPath, "utf8")));
}

export function refreshNumModifierDataLock(options: {
  contentRoot?: string;
  lockPath?: string;
} = {}): {
  lock: NumModifierDataLock;
  changed: boolean;
  serialized: string;
  differences: readonly string[];
} {
  const lockPath = path.resolve(options.lockPath ?? DEFAULT_NUM_MODIFIER_LOCK_PATH);
  const lock = generateNumModifierDataLock(options.contentRoot);
  const serialized = serializeNumModifierDataLock(lock);
  const previous = existsSync(lockPath) ? readFileSync(lockPath, "utf8") : "";
  let differences: readonly string[] = ["lock: added"];
  if (previous) {
    try {
      differences = diffValues(JSON.parse(previous), lock);
    } catch {
      differences = ["lock: replaced invalid previous JSON"];
    }
  }
  writeFileSync(lockPath, serialized, "utf8");
  return {
    lock,
    changed: previous !== serialized,
    serialized,
    differences,
  };
}

export function auditNumModifierDataLock(options: {
  contentRoot?: string;
  lockPath?: string;
} = {}): {
  ok: boolean;
  issues: readonly string[];
  warnings: readonly string[];
  tokenCount: number;
  resolvedTokenCount: number;
  attributeNameCount: number;
  connectedAttributeNameCount: number;
  missingAttributeNameCount: number;
  unresolvedOperationRowCount: number;
} {
  const lockPath = path.resolve(options.lockPath ?? DEFAULT_NUM_MODIFIER_LOCK_PATH);
  const issues: string[] = [];
  const warnings: string[] = [];
  if (!existsSync(lockPath)) {
    return {
      ok: false,
      issues: [`missing ${lockPath}`],
      warnings,
      tokenCount: 0,
      resolvedTokenCount: 0,
      attributeNameCount: 0,
      connectedAttributeNameCount: 0,
      missingAttributeNameCount: 0,
      unresolvedOperationRowCount: 0,
    };
  }
  const contentRoot = options.contentRoot ?? defaultContentRoot();
  const expected = serializeNumModifierDataLock(
    generateNumModifierDataLock(contentRoot),
  );
  if (readFileSync(lockPath, "utf8") !== expected) {
    issues.push("data/num-modifier-lock.json differs from the current LC source table");
  }
  const lock = readNumModifierDataLock(lockPath);
  const resolver = createNumModifierResolver(lock);
  const attributeNames = new Set(
    Object.values(lock.rows.lc)
      .map((row) => String(row.raw.AttributeName ?? ""))
      .filter(Boolean),
  );
  const descriptorNames = new Set(
    Object.values(lock.attribute_descriptions.lc).map((row) =>
      String(row.raw.attr_realname ?? ""),
    ),
  );
  const connectedAttributeNameCount = [...attributeNames].filter((name) =>
    descriptorNames.has(name),
  ).length;
  const unresolvedOperationRowCount = Object.values(lock.rows.lc).filter(
    (row) => String(row.raw.GPModifierOp ?? "") !== "B1",
  ).length;
  const tokens = new Set<string>();
  for (const sourcePath of GAME_TOKEN_SOURCE_PATHS) {
    const filePath = path.join(contentRoot, ...sourcePath.split("/"));
    collectGameModifierTokens(JSON.parse(readFileSync(filePath, "utf8")), tokens);
  }
  const unresolved = [...tokens].filter(
    (token) => resolver.resolveGameModifierTokens(token).unresolvedTokens.length > 0,
  );
  const unexpectedUnresolved = unresolved.filter(
    (token) => !KNOWN_UNRESOLVED_GAME_TOKENS.has(token),
  );
  const resolvedAllowlistEntries = [...KNOWN_UNRESOLVED_GAME_TOKENS].filter(
    (token) => !unresolved.includes(token),
  );
  if (unexpectedUnresolved.length > 0) {
    issues.push(
      `unresolved game GPModifier tokens: ${unexpectedUnresolved.join(", ")}`,
    );
  }
  if (resolvedAllowlistEntries.length > 0) {
    issues.push(
      `known unresolved GPModifier tokens now resolve; update the allowlist: ${resolvedAllowlistEntries.join(", ")}`,
    );
  }
  for (const token of unresolved.filter((item) => KNOWN_UNRESOLVED_GAME_TOKENS.has(item))) {
    warnings.push(`known source token has no exact row: ${token}`);
  }
  return {
    ok: issues.length === 0,
    issues,
    warnings,
    tokenCount: tokens.size,
    resolvedTokenCount: tokens.size - unresolved.length,
    attributeNameCount: attributeNames.size,
    connectedAttributeNameCount,
    missingAttributeNameCount:
      attributeNames.size - connectedAttributeNameCount,
    unresolvedOperationRowCount,
  };
}

export function checkNumModifierDataLock(
  lock = readNumModifierDataLock(),
): { ok: boolean; issues: readonly string[]; warnings: readonly string[] } {
  const issues: string[] = [];
  if (lock.sources.lc.modifiers.source_path !== NUM_MODIFIER_SOURCE_PATH) {
    issues.push(`lc modifiers source_path must be ${NUM_MODIFIER_SOURCE_PATH}`);
  }
  if (
    lock.sources.lc.attribute_descriptions.source_path !==
    ATTRIBUTE_DESCRIPTION_SOURCE_PATH
  ) {
    issues.push(
      `lc attribute descriptions source_path must be ${ATTRIBUTE_DESCRIPTION_SOURCE_PATH}`,
    );
  }
  if (lock.sources.lc.modifiers.row_count !== Object.keys(lock.rows.lc).length) {
    issues.push("lc row_count does not match locked rows");
  }
  if (
    lock.sources.lc.attribute_descriptions.row_count !==
    Object.keys(lock.attribute_descriptions.lc).length
  ) {
    issues.push("lc attribute description row_count does not match locked rows");
  }
  const resolver = createNumModifierResolver(lock);
  return {
    ok: issues.length === 0,
    issues,
    warnings: resolver.diagnostics.map(
      (diagnostic) => `${diagnostic.code} ${diagnostic.key}: ${diagnostic.detail}`,
    ),
  };
}
