import {
  parseNumModifierDataLock,
  type NumModifierDataLock,
  type NumModifierMode,
} from "@/lib/num-modifier-data-lock";
import {
  parseNumModifierSemantics,
  type ModifierEffectDirection,
  type ModifierFacet,
  type ModifierOperationModel,
  type ModifierRecipient,
  type NumModifierSemantics,
} from "@/lib/num-modifier-semantics";

export type NumModifierRowKey = `${NumModifierMode}:${string}`;
export type NumModifierValueField = "base" | "coefficient";
export type NumModifierValueFormat =
  | "number"
  | "percent"
  | "signed-number"
  | "signed-percent";

export type NumModifierValueExpression = {
  row: NumModifierRowKey;
  field: NumModifierValueField;
  scale?: number;
};

export type NumModifierValueBindings = Readonly<
  Record<string, NumModifierValueExpression>
>;

export type ResolvedNumModifierRow = {
  key: NumModifierRowKey;
  mode: NumModifierMode;
  rowName: string;
  id: number;
  level: number;
  index?: number;
  attributeName: string;
  operation: string;
  baseValue: number;
  coefficient: number;
  description: string;
  raw: Readonly<Record<string, unknown>>;
};

export type ResolvedNumModifierValue = {
  row: ResolvedNumModifierRow;
  value: number;
  text: string;
};

export type ResolvedAttribute = {
  attributeName: string;
  typeId?: string;
  label: string;
  family?: string;
  quantity?: string;
  scope?: string;
  disposition: "indexed" | "known-unindexed" | "unmapped" | "invalid";
  descriptor?: Readonly<Record<string, unknown>>;
};

export type ModifierEffectContext = {
  recipient?: ModifierRecipient;
};

export type ResolvedModifierEffect = {
  value: ResolvedNumModifierValue;
  attribute: ResolvedAttribute;
  operation: {
    code: string;
    model: ModifierOperationModel;
  };
  direction: ModifierEffectDirection;
  context: { recipient: ModifierRecipient };
  facets: readonly ModifierFacet[];
  factor?: number;
  reviewed: boolean;
};

export type GameModifierTokenResolution = {
  text: string;
  unresolvedTokens: readonly string[];
};

export type NumModifierDiagnostic = {
  code:
    | "NON_STANDARD_ROW_NAME"
    | "ROW_IDENTITY_MISMATCH"
    | "EMPTY_ATTRIBUTE_NAME";
  key: NumModifierRowKey;
  detail: string;
};

export type NumModifierErrorCode =
  | "INVALID_ROW"
  | "MISSING_ROW"
  | "INVALID_EXPRESSION"
  | "INVALID_TEMPLATE"
  | "INVALID_SEMANTICS";

export class NumModifierError extends Error {
  readonly code: NumModifierErrorCode;
  readonly referencePath?: string;

  constructor(
    code: NumModifierErrorCode,
    detail: string,
    referencePath?: string,
  ) {
    super(
      `[${code}] num-modifier${referencePath ? ` reference=${referencePath}` : ""}: ${detail}`,
    );
    this.name = "NumModifierError";
    this.code = code;
    this.referencePath = referencePath;
  }
}

export type NumModifierResolver = {
  getRow(key: NumModifierRowKey, referencePath?: string): ResolvedNumModifierRow;
  getRowsById(mode: NumModifierMode, modifierId: number): readonly ResolvedNumModifierRow[];
  resolveValue(
    expression: NumModifierValueExpression,
    format: NumModifierValueFormat,
    referencePath?: string,
  ): ResolvedNumModifierValue;
  resolveTemplate(
    description: string,
    bindings: NumModifierValueBindings,
    referencePath?: string,
  ): string;
  resolveGameModifierTokens(
    description: string,
    referencePath?: string,
  ): GameModifierTokenResolution;
  describeAttribute(
    attributeName: string,
    referencePath?: string,
  ): ResolvedAttribute;
  resolveEffect(
    expression: NumModifierValueExpression,
    context?: ModifierEffectContext,
    referencePath?: string,
  ): ResolvedModifierEffect;
  diagnostics: readonly NumModifierDiagnostic[];
};

const TEMPLATE_TOKEN =
  /\{\{num:([a-z][a-z0-9-]*)\|(number|percent|signed-number|signed-percent)\}\}/g;
const GAME_MODIFIER_TOKEN =
  /\{GPModifier:(\d+):([^:}]+):(\d+):([^:}]+)(?::(\d+))?\}/gi;

function asFiniteNumber(
  value: unknown,
  field: string,
  key: NumModifierRowKey,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new NumModifierError("INVALID_ROW", `${key} has invalid ${field}`);
  }
  return value;
}

function asPositiveInteger(
  value: unknown,
  field: string,
  key: NumModifierRowKey,
): number {
  const result = asFiniteNumber(value, field, key);
  if (!Number.isSafeInteger(result) || result <= 0) {
    throw new NumModifierError("INVALID_ROW", `${key} has invalid ${field}`);
  }
  return result;
}

function asNonEmptyString(
  value: unknown,
  field: string,
  key: NumModifierRowKey,
): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new NumModifierError("INVALID_ROW", `${key} has invalid ${field}`);
  }
  return value.trim();
}

function asString(value: unknown, field: string, key: NumModifierRowKey): string {
  if (typeof value !== "string") {
    throw new NumModifierError("INVALID_ROW", `${key} has invalid ${field}`);
  }
  return value.trim();
}

function parseResolvedRow(
  mode: NumModifierMode,
  rowName: string,
  raw: Readonly<Record<string, unknown>>,
): ResolvedNumModifierRow {
  const key = `${mode}:${rowName}` as NumModifierRowKey;
  const identity = /^(\d+)_(\d+)_(\d+)$/.exec(rowName);
  const rawId = asPositiveInteger(raw.ID, "ID", key);
  const rawLevel = asPositiveInteger(raw.Level, "Level", key);
  const numericRowName = /^\d+$/.test(rowName) ? Number(rowName) : undefined;
  return Object.freeze({
    key,
    mode,
    rowName,
    id: identity
      ? asPositiveInteger(Number(identity[1]), "row_name ID", key)
      : numericRowName !== undefined
        ? asPositiveInteger(numericRowName, "row_name ID", key)
        : rawId,
    level: identity
      ? asPositiveInteger(Number(identity[2]), "row_name Level", key)
      : rawLevel,
    ...(identity ? { index: Number(identity[3]) } : {}),
    attributeName: asString(raw.AttributeName, "AttributeName", key),
    operation: asNonEmptyString(raw.GPModifierOp, "GPModifierOp", key),
    baseValue: asFiniteNumber(raw.BaseValue, "BaseValue", key),
    coefficient: asFiniteNumber(raw.CoefValue, "CoefValue", key),
    description: typeof raw.Description === "string" ? raw.Description : "",
    raw: Object.freeze({ ...raw }),
  });
}

function formatDecimal(value: number): string {
  const normalized = Math.abs(value) < 1e-12 ? 0 : value;
  return normalized
    .toFixed(10)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*?)0+$/, "$1");
}

export function formatNumModifierValue(
  value: number,
  format: NumModifierValueFormat,
): string {
  const percent = format === "percent" || format === "signed-percent";
  const signed = format === "signed-number" || format === "signed-percent";
  const formattedValue = percent ? value * 100 : value;
  const sign = signed && formattedValue > 0 ? "+" : "";
  return `${sign}${formatDecimal(formattedValue)}${percent ? "%" : ""}`;
}

function getCaseInsensitive(
  row: Readonly<Record<string, unknown>>,
  field: string,
): unknown {
  const matched = Object.keys(row).find(
    (candidate) => candidate.toLowerCase() === field.toLowerCase(),
  );
  return matched ? row[matched] : undefined;
}

function formatGameModifierValue(
  value: number,
  format: string,
  row: ResolvedNumModifierRow,
): string {
  if (format === "2" && row.attributeName.endsWith("AddPoint")) {
    return formatDecimal(value);
  }
  if (format === "10" && row.attributeName.endsWith("DamageBearRatio")) {
    return `${formatDecimal(Math.abs(value) * 100)}%`;
  }
  if (["2", "10", "13", "15"].includes(format)) {
    return `${formatDecimal(value * 100)}%`;
  }
  return formatDecimal(value);
}

export function createNumModifierResolver(
  input: NumModifierDataLock,
  semanticInput?: NumModifierSemantics,
): NumModifierResolver {
  const lock = parseNumModifierDataLock(input);
  const semantics = semanticInput
    ? parseNumModifierSemantics(semanticInput)
    : undefined;
  const rows = new Map<NumModifierRowKey, ResolvedNumModifierRow>();
  const rowsById = new Map<string, ResolvedNumModifierRow[]>();
  const diagnostics: NumModifierDiagnostic[] = [];
  const descriptors = new Map<string, Readonly<Record<string, unknown>>>();

  for (const lockedRow of Object.values(lock.attribute_descriptions.lc)) {
    const attributeName = lockedRow.raw.attr_realname;
    if (typeof attributeName !== "string" || attributeName.trim() === "") {
      throw new NumModifierError(
        "INVALID_ROW",
        `attribute description ${lockedRow.row_name} has invalid attr_realname`,
      );
    }
    if (descriptors.has(attributeName)) {
      throw new NumModifierError(
        "INVALID_ROW",
        `attribute description duplicates attr_realname ${attributeName}`,
      );
    }
    descriptors.set(attributeName, Object.freeze({ ...lockedRow.raw }));
  }

  for (const [rowName, lockedRow] of Object.entries(lock.rows.lc)) {
    const key = `lc:${rowName}` as NumModifierRowKey;
    if (lockedRow.row_name !== rowName) {
      throw new NumModifierError(
        "INVALID_ROW",
        `${key} row_name=${lockedRow.row_name} does not match its Lock key`,
      );
    }
    const row = parseResolvedRow("lc", rowName, lockedRow.raw);
    rows.set(key, row);
    const idKey = `lc:${row.id}`;
    const matches = rowsById.get(idKey) ?? [];
    matches.push(row);
    rowsById.set(idKey, matches);

    const identity = /^(\d+)_(\d+)_(\d+)$/.exec(rowName);
    if (!identity) {
      diagnostics.push({
        code: "NON_STANDARD_ROW_NAME",
        key,
        detail: `row_name ${rowName} does not use ID_Level_Index`,
      });
    } else if (
      Number(identity[1]) !== row.raw.ID ||
      Number(identity[2]) !== row.raw.Level
    ) {
      diagnostics.push({
        code: "ROW_IDENTITY_MISMATCH",
        key,
        detail: `row_name identity ${identity[1]}_${identity[2]} differs from raw ${String(row.raw.ID)}_${String(row.raw.Level)}`,
      });
    }
    if (!row.attributeName) {
      diagnostics.push({
        code: "EMPTY_ATTRIBUTE_NAME",
        key,
        detail: "raw AttributeName is empty",
      });
    }
  }

  for (const matches of rowsById.values()) {
    matches.sort(
      (left, right) =>
        left.level - right.level || left.rowName.localeCompare(right.rowName, "en"),
    );
  }

  const getRow = (
    key: NumModifierRowKey,
    referencePath?: string,
  ): ResolvedNumModifierRow => {
    const row = rows.get(key);
    if (!row) {
      throw new NumModifierError("MISSING_ROW", `referenced row ${key} is not locked`, referencePath);
    }
    return row;
  };

  const getRowsById = (
    mode: NumModifierMode,
    modifierId: number,
  ): readonly ResolvedNumModifierRow[] =>
    Object.freeze([...(rowsById.get(`${mode}:${modifierId}`) ?? [])]);

  const resolveValue = (
    expression: NumModifierValueExpression,
    format: NumModifierValueFormat,
    referencePath?: string,
  ): ResolvedNumModifierValue => {
    const row = getRow(expression.row, referencePath);
    if (expression.field !== "base" && expression.field !== "coefficient") {
      throw new NumModifierError(
        "INVALID_EXPRESSION",
        `${expression.row} uses invalid field ${String(expression.field)}`,
        referencePath,
      );
    }
    const scale = expression.scale ?? 1;
    if (!Number.isFinite(scale) || scale <= 0) {
      throw new NumModifierError(
        "INVALID_EXPRESSION",
        `${expression.row} uses invalid scale ${String(scale)}`,
        referencePath,
      );
    }
    if (
      semantics &&
      (format === "percent" || format === "signed-percent")
    ) {
      const attribute = describeAttribute(row.attributeName, referencePath);
      if (
        attribute.quantity &&
        attribute.quantity !== "ratio" &&
        attribute.quantity !== "rate" &&
        attribute.quantity !== "opaque"
      ) {
        throw new NumModifierError(
          "INVALID_EXPRESSION",
          `${expression.row} quantity ${attribute.quantity} is incompatible with ${format}`,
          referencePath,
        );
      }
    }
    const source = expression.field === "base" ? row.baseValue : row.coefficient;
    const value = source * scale;
    return Object.freeze({ row, value, text: formatNumModifierValue(value, format) });
  };

  const localizedLabel = (value: unknown): string | undefined => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return undefined;
    }
    const record = value as Readonly<Record<string, unknown>>;
    for (const key of ["LocalizedString", "SourceString"] as const) {
      const candidate = record[key];
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }
    return undefined;
  };

  const requireSemantics = (referencePath?: string): NumModifierSemantics => {
    if (!semantics) {
      throw new NumModifierError(
        "INVALID_SEMANTICS",
        "resolver was created without the semantic catalog",
        referencePath,
      );
    }
    return semantics;
  };

  const describeAttribute = (
    attributeName: string,
    referencePath?: string,
  ): ResolvedAttribute => {
    const catalog = requireSemantics(referencePath);
    const entry = catalog.attributes[attributeName];
    if (!entry) {
      throw new NumModifierError(
        "INVALID_SEMANTICS",
        `attribute ${attributeName || "<empty>"} has no disposition`,
        referencePath,
      );
    }
    const descriptor = descriptors.get(attributeName);
    if (entry.status !== "indexed") {
      return Object.freeze({
        attributeName,
        label: entry.label,
        disposition: entry.status,
        ...(descriptor ? { descriptor } : {}),
      });
    }
    const attributeType = catalog.attribute_types[entry.attribute_type];
    if (!attributeType) {
      throw new NumModifierError(
        "INVALID_SEMANTICS",
        `${attributeName} references missing type ${entry.attribute_type}`,
        referencePath,
      );
    }
    return Object.freeze({
      attributeName,
      typeId: entry.attribute_type,
      label:
        entry.label ??
        localizedLabel(descriptor?.attr_name) ??
        attributeType.label,
      family: attributeType.family,
      quantity: attributeType.quantity,
      scope: entry.scope,
      disposition: entry.status,
      ...(descriptor ? { descriptor } : {}),
    });
  };

  const directionFromSign = (
    value: number,
    rule: "same-sign" | "inverse-sign" | "unknown" | undefined,
  ): ModifierEffectDirection => {
    if (rule === undefined || rule === "unknown") return "unknown";
    if (value === 0) return "neutral";
    const positive = value > 0;
    if (rule === "same-sign") return positive ? "increase" : "decrease";
    return positive ? "decrease" : "increase";
  };

  const resolveEffect = (
    expression: NumModifierValueExpression,
    context: ModifierEffectContext = {},
    referencePath?: string,
  ): ResolvedModifierEffect => {
    const catalog = requireSemantics(referencePath);
    const value = resolveValue(expression, "number", referencePath);
    const attribute = describeAttribute(value.row.attributeName, referencePath);
    const reviewed = catalog.reviewed_semantics[expression.row];
    if (reviewed) {
      const expected = reviewed.expected;
      const actual = value.row;
      if (
        actual.attributeName !== expected.attribute_name ||
        actual.operation !== expected.operation ||
        actual.level !== expected.level ||
        actual.baseValue !== expected.base ||
        actual.coefficient !== expected.coefficient
      ) {
        throw new NumModifierError(
          "INVALID_SEMANTICS",
          `${expression.row} no longer matches its reviewed semantic signature`,
          referencePath,
        );
      }
      if (context.recipient && context.recipient !== reviewed.recipient) {
        throw new NumModifierError(
          "INVALID_SEMANTICS",
          `${expression.row} requires recipient ${reviewed.recipient}`,
          referencePath,
        );
      }
      const facets = reviewed.facet_ids.map((facetId) => {
        for (const type of Object.values(catalog.attribute_types)) {
          const facet = Object.values(type.facets).find(
            (candidate) => candidate?.id === facetId,
          );
          if (facet) return facet;
        }
        throw new NumModifierError(
          "INVALID_SEMANTICS",
          `${expression.row} references missing facet ${facetId}`,
          referencePath,
        );
      });
      return Object.freeze({
        value,
        attribute,
        operation: { code: actual.operation, model: reviewed.model },
        direction: reviewed.direction,
        context: { recipient: reviewed.recipient },
        facets: Object.freeze(facets),
        ...(reviewed.factor_base === undefined
          ? {}
          : { factor: reviewed.factor_base + value.value }),
        reviewed: true,
      });
    }

    const entry = catalog.attributes[value.row.attributeName];
    const rule =
      entry?.status === "indexed"
        ? entry.operations?.[value.row.operation] ??
          catalog.operation_families[value.row.operation]
        : catalog.operation_families[value.row.operation];
    const model = rule?.model ?? "unknown";
    const direction =
      model === "delta"
        ? directionFromSign(value.value, rule?.direction)
        : "unknown";
    const recipient = context.recipient ?? "unknown";
    let facets: ModifierFacet[] = [];
    if (
      attribute.typeId &&
      !(attribute.scope === "damage-event" && recipient !== "damage-event")
    ) {
      const facet = catalog.attribute_types[attribute.typeId].facets[direction];
      if (facet) facets = [facet];
    }
    return Object.freeze({
      value,
      attribute,
      operation: { code: value.row.operation, model },
      direction,
      context: { recipient },
      facets: Object.freeze(facets),
      reviewed: false,
    });
  };

  const resolveTemplate = (
    description: string,
    bindings: NumModifierValueBindings,
    referencePath?: string,
  ): string => {
    const resolved = description.replace(
      TEMPLATE_TOKEN,
      (_token, alias: string, format: NumModifierValueFormat) => {
        const expression = bindings[alias];
        if (!expression) {
          throw new NumModifierError(
            "INVALID_TEMPLATE",
            `template references unknown binding ${alias}`,
            referencePath,
          );
        }
        return resolveValue(expression, format, referencePath).text;
      },
    );
    if (resolved.includes("{{num:")) {
      throw new NumModifierError(
        "INVALID_TEMPLATE",
        "description contains an invalid Num Modifier template token",
        referencePath,
      );
    }
    return resolved;
  };

  const resolveGameModifierTokens = (
    description: string,
  ): GameModifierTokenResolution => {
    const unresolved = new Set<string>();
    const text = description.replace(
      GAME_MODIFIER_TOKEN,
      (
        token,
        idText: string,
        field: string,
        indexText: string,
        format: string,
        levelText?: string,
      ) => {
        const id = Number(idText);
        const level = levelText === undefined ? 1 : Number(levelText);
        const index = Number(indexText);
        const matches = getRowsById("lc", id).filter(
          (row) => row.level === level && row.index === index,
        );
        if (matches.length !== 1) {
          unresolved.add(token);
          return token;
        }
        const row = matches[0];
        const value = getCaseInsensitive(row.raw, field);
        if (typeof value !== "number" || !Number.isFinite(value)) {
          unresolved.add(token);
          return token;
        }
        return formatGameModifierValue(value, format, row);
      },
    );
    for (const token of text.match(/\{GPModifier:[^}]+\}/gi) ?? []) {
      unresolved.add(token);
    }
    return Object.freeze({
      text,
      unresolvedTokens: Object.freeze([...unresolved]),
    });
  };

  return Object.freeze({
    getRow,
    getRowsById,
    resolveValue,
    resolveTemplate,
    resolveGameModifierTokens,
    describeAttribute,
    resolveEffect,
    diagnostics: Object.freeze(diagnostics),
  });
}
