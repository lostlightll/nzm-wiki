import { readFileSync } from "node:fs";
import path from "node:path";
import type {
  NumericalReference,
  NumericalTable,
} from "../../lib/weapon-source-v2";

export const WEAPON_DATA_SOURCE_FILES = Object.freeze({
  "numerical-lc": "DataTables/numerical_config_composite.json",
  "numerical-td": "DataTables/TD_numerical_config_composite.json",
  asc: "Attributes/AutoGenerate/attr_weapon_asc.json",
  feel: "DataTables/WeaponFeelParamTable.json",
  item: "DataTables/LuaDataTable/WeaponItemConfigTable.json",
  prototype: "DataTables/WeaponPrototypeConfig.json",
  "skill-pve": "DataTables/SkillConfigTable_Weapon_PVE.json",
  "gp-active-skill": "DataTables/GPActiveSkillDataTable.json",
} as const);

export type WeaponDataSourceKind = keyof typeof WEAPON_DATA_SOURCE_FILES;

export type WeaponDataSourceErrorCode =
  | "FILE_NOT_FOUND"
  | "INVALID_JSON"
  | "INVALID_WRAPPER"
  | "INVALID_ROW"
  | "DUPLICATE_KEY"
  | "KEY_MISMATCH"
  | "NOT_FOUND"
  | "TABLE_MISMATCH"
  | "AMBIGUOUS_KEY"
  | "PROTOTYPE_LINK_MISMATCH";

export interface WeaponDataSourceErrorContext {
  kind: WeaponDataSourceKind;
  sourcePath: string;
  key?: string;
  candidates?: readonly string[];
}

export class WeaponDataSourceError extends Error {
  readonly code: WeaponDataSourceErrorCode;
  readonly kind: WeaponDataSourceKind;
  readonly sourcePath: string;
  readonly key?: string;
  readonly candidates?: readonly string[];

  constructor(
    code: WeaponDataSourceErrorCode,
    context: WeaponDataSourceErrorContext,
    detail: string,
    options?: ErrorOptions,
  ) {
    const keyText = context.key === undefined ? "" : ` key=${context.key}`;
    const candidateText = context.candidates?.length
      ? ` candidates=${context.candidates.join(",")}`
      : "";
    super(
      `[${code}] ${context.kind} ${context.sourcePath}${keyText}${candidateText}: ${detail}`,
      options,
    );
    this.name = "WeaponDataSourceError";
    this.code = code;
    this.kind = context.kind;
    this.sourcePath = context.sourcePath;
    this.key = context.key;
    this.candidates = context.candidates;
  }
}

export interface WeaponDataSourceRow<
  Kind extends WeaponDataSourceKind = WeaponDataSourceKind,
> {
  readonly kind: Kind;
  readonly sourcePath: string;
  readonly rowName: string;
  readonly key: string;
  readonly raw: Readonly<Record<string, unknown>>;
}

export type NumericalSourceRow = WeaponDataSourceRow<
  "numerical-lc" | "numerical-td"
> & {
  readonly table: NumericalTable;
};
export type AscSourceRow = WeaponDataSourceRow<"asc">;
export type FeelSourceRow = WeaponDataSourceRow<"feel">;
export type ItemSourceRow = WeaponDataSourceRow<"item">;
export type PrototypeSourceRow = WeaponDataSourceRow<"prototype">;
export type WeaponPveSkillSourceRow = WeaponDataSourceRow<"skill-pve">;
export type GpActiveSkillSourceRow = WeaponDataSourceRow<"gp-active-skill">;

export interface NumericalSourceDiagnostic {
  readonly code: "NUMERICAL_IDENTITY_MISMATCH";
  readonly kind: "numerical-lc" | "numerical-td";
  readonly sourcePath: string;
  readonly rowName: string;
  readonly expectedRowName: string | undefined;
  readonly rawId: unknown;
  readonly rawLevel: unknown;
}

export interface GpActiveSkillSourceDiagnostic {
  readonly code: "GP_ACTIVE_SKILL_IDENTITY_MISMATCH";
  readonly kind: "gp-active-skill";
  readonly sourcePath: string;
  readonly rowName: string;
  readonly rawAbilityId: unknown;
}

export interface PrototypeLookup {
  prototypeId: string;
  mode: number;
  rowName?: string;
}

export const PROTOTYPE_NUMERICAL_FIELDS = [
  "NumericalID",
  "ExplosionNumericalID",
  "LaserNumericalID",
  "LightHitNumericalID",
  "HeavyHitNumericalID",
  "KnockUpNumericalID",
  "ExplosionNumericalIDToTeammate",
  "ExplosionNumericalIDToSelf",
] as const;

export type PrototypeNumericalField =
  (typeof PROTOTYPE_NUMERICAL_FIELDS)[number];

export interface ValidatePrototypeLinkInput extends PrototypeLookup {
  numerical: NumericalReference;
  ascTypeId?: string;
  feelParamId?: string;
}

export interface PrototypeLinkValidation {
  readonly prototype: PrototypeSourceRow;
  readonly numerical: NumericalSourceRow;
  readonly numericalField: PrototypeNumericalField;
  readonly asc?: AscSourceRow;
  readonly feel?: FeelSourceRow;
}

export interface CreateWeaponDataSourceReaderOptions {
  contentRoot?: string;
}

export interface WeaponDataSourceReader {
  getNumerical(reference: NumericalReference): NumericalSourceRow;
  getNumericalDiagnostics(
    table?: NumericalTable,
  ): readonly NumericalSourceDiagnostic[];
  getAsc(ascTypeId: string): AscSourceRow;
  getFeel(feelParamId: string): FeelSourceRow;
  getItem(itemId: string): ItemSourceRow;
  findItemsByPrototypeId(prototypeId: string): readonly ItemSourceRow[];
  getPrototypeCandidates(
    prototypeId: string,
    mode: number,
  ): readonly PrototypeSourceRow[];
  getPrototype(lookup: PrototypeLookup): PrototypeSourceRow;
  getWeaponPveSkill(reference: {
    skillId: number;
    level: number;
  }): WeaponPveSkillSourceRow;
  getGpActiveSkill(skillId: number): GpActiveSkillSourceRow;
  getGpActiveSkillDiagnostics(): readonly GpActiveSkillSourceDiagnostic[];
  validatePrototypeLink(
    input: ValidatePrototypeLinkInput,
  ): PrototypeLinkValidation;
}

interface LoadedRows<Kind extends WeaponDataSourceKind> {
  readonly byRowName: ReadonlyMap<string, WeaponDataSourceRow<Kind>>;
}

interface LoadedIdentityRows<Kind extends "asc" | "feel" | "item"> {
  readonly byIdentity: ReadonlyMap<string, WeaponDataSourceRow<Kind>>;
}

interface LoadedItems extends LoadedIdentityRows<"item"> {
  readonly byPrototypeId: ReadonlyMap<string, readonly ItemSourceRow[]>;
}

interface LoadedPrototypes {
  readonly byKey: ReadonlyMap<string, readonly PrototypeSourceRow[]>;
}

interface LoadedWeaponPveSkills {
  readonly byKey: ReadonlyMap<string, WeaponPveSkillSourceRow>;
}

interface LoadedGpActiveSkills {
  readonly byKey: ReadonlyMap<string, GpActiveSkillSourceRow>;
  readonly diagnostics: readonly GpActiveSkillSourceDiagnostic[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function normalizePositiveId(value: unknown): string | undefined {
  if (typeof value === "string" && /^[1-9]\d*$/.test(value)) return value;
  if (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0
  ) {
    return String(value);
  }
  return undefined;
}

function normalizeNonNegativeInteger(value: unknown): number | undefined {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
    ? value
    : undefined;
}

function numericalKind(table: NumericalTable): "numerical-lc" | "numerical-td" {
  return table === "lc" ? "numerical-lc" : "numerical-td";
}

function prototypeKey(prototypeId: string, mode: number): string {
  return `${prototypeId}:${mode}`;
}

export function createWeaponDataSourceReader(
  options: CreateWeaponDataSourceReaderOptions = {},
): WeaponDataSourceReader {
  const contentRoot = path.resolve(
    options.contentRoot ??
      path.join(process.cwd(), "refs", "Exports", "NZM", "Content"),
  );
  const rowCache = new Map<WeaponDataSourceKind, LoadedRows<WeaponDataSourceKind>>();
  const identityCache = new Map<
    "asc" | "feel",
    LoadedIdentityRows<"asc" | "feel">
  >();
  let itemCache: LoadedItems | undefined;
  let prototypeCache: LoadedPrototypes | undefined;
  let weaponPveSkillCache: LoadedWeaponPveSkills | undefined;
  let gpActiveSkillCache: LoadedGpActiveSkills | undefined;
  const numericalDiagnostics = new Map<
    "numerical-lc" | "numerical-td",
    readonly NumericalSourceDiagnostic[]
  >();

  function sourcePath(kind: WeaponDataSourceKind): string {
    return WEAPON_DATA_SOURCE_FILES[kind];
  }

  function context(
    kind: WeaponDataSourceKind,
    key?: string,
  ): WeaponDataSourceErrorContext {
    return { kind, sourcePath: sourcePath(kind), key };
  }

  function loadRows<Kind extends WeaponDataSourceKind>(
    kind: Kind,
  ): LoadedRows<Kind> {
    const cached = rowCache.get(kind);
    if (cached) return cached as LoadedRows<Kind>;

    const relativePath = sourcePath(kind);
    const absolutePath = path.join(contentRoot, ...relativePath.split("/"));
    let text: string;
    try {
      text = readFileSync(absolutePath, "utf8");
    } catch (cause) {
      throw new WeaponDataSourceError(
        "FILE_NOT_FOUND",
        context(kind),
        "cannot read source file",
        { cause },
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (cause) {
      throw new WeaponDataSourceError(
        "INVALID_JSON",
        context(kind),
        "source file is not valid JSON",
        { cause },
      );
    }

    if (
      !Array.isArray(parsed) ||
      parsed.length !== 1 ||
      !isPlainObject(parsed[0]) ||
      !isPlainObject(parsed[0].Rows)
    ) {
      throw new WeaponDataSourceError(
        "INVALID_WRAPPER",
        context(kind),
        "expected a single-element Unreal export array containing a Rows object",
      );
    }

    const byRowName = new Map<string, WeaponDataSourceRow<Kind>>();
    for (const [rowName, rawValue] of Object.entries(parsed[0].Rows)) {
      if (!isPlainObject(rawValue)) {
        throw new WeaponDataSourceError(
          "INVALID_ROW",
          context(kind, rowName),
          "row must be a plain object",
        );
      }

      const row: WeaponDataSourceRow<Kind> = Object.freeze({
        kind,
        sourcePath: relativePath,
        rowName,
        key: rowName,
        raw: deepFreeze(rawValue),
      });
      byRowName.set(rowName, row);
    }

    const loaded = Object.freeze({ byRowName });
    rowCache.set(kind, loaded as LoadedRows<WeaponDataSourceKind>);
    return loaded;
  }

  function loadNumerical(
    table: NumericalTable,
  ): LoadedRows<"numerical-lc" | "numerical-td"> {
    const kind = numericalKind(table);
    const loaded = loadRows(kind);
    if (!numericalDiagnostics.has(kind)) {
      const diagnostics: NumericalSourceDiagnostic[] = [];
      for (const row of loaded.byRowName.values()) {
        const id = normalizePositiveId(row.raw.id);
        const level = normalizePositiveId(row.raw.Level);
        const expectedRowName = id && level ? `${id}_${level}` : undefined;
        if (expectedRowName !== row.rowName) {
          diagnostics.push(
            Object.freeze({
              code: "NUMERICAL_IDENTITY_MISMATCH",
              kind,
              sourcePath: row.sourcePath,
              rowName: row.rowName,
              expectedRowName,
              rawId: row.raw.id,
              rawLevel: row.raw.Level,
            }),
          );
        }
      }
      numericalDiagnostics.set(kind, Object.freeze(diagnostics));
    }
    return loaded;
  }

  function loadIdentityRows<Kind extends "asc" | "feel">(
    kind: Kind,
    identityField: "ASCTypeID" | "WeaponFeelParamID",
  ): LoadedIdentityRows<Kind> {
    const cached = identityCache.get(kind);
    if (cached) return cached as LoadedIdentityRows<Kind>;

    const rows = loadRows(kind);
    const byIdentity = new Map<string, WeaponDataSourceRow<Kind>>();
    for (const row of rows.byRowName.values()) {
      const identity = normalizePositiveId(row.raw[identityField]);
      if (!identity) {
        throw new WeaponDataSourceError(
          "INVALID_ROW",
          context(kind, row.rowName),
          `${identityField} must be a positive integer ID`,
        );
      }
      const previous = byIdentity.get(identity);
      if (previous) {
        throw new WeaponDataSourceError(
          "DUPLICATE_KEY",
          context(kind, identity),
          `identity is shared by rows ${previous.rowName} and ${row.rowName}`,
        );
      }
      if (identity !== row.rowName) {
        throw new WeaponDataSourceError(
          "KEY_MISMATCH",
          context(kind, identity),
          `${identityField} does not match Unreal row name ${row.rowName}`,
        );
      }
      byIdentity.set(identity, row);
    }

    const loaded = Object.freeze({ byIdentity });
    identityCache.set(
      kind,
      loaded as LoadedIdentityRows<"asc" | "feel">,
    );
    return loaded;
  }

  function loadItems(): LoadedItems {
    if (itemCache) return itemCache;

    const rows = loadRows("item");
    const byIdentity = new Map<string, ItemSourceRow>();
    const mutableByPrototypeId = new Map<string, ItemSourceRow[]>();
    for (const row of rows.byRowName.values()) {
      const identity = normalizePositiveId(row.raw.ItemID);
      if (!identity) {
        throw new WeaponDataSourceError(
          "INVALID_ROW",
          context("item", row.rowName),
          "ItemID must be a positive integer ID",
        );
      }
      const previous = byIdentity.get(identity);
      if (previous) {
        throw new WeaponDataSourceError(
          "DUPLICATE_KEY",
          context("item", identity),
          `identity is shared by rows ${previous.rowName} and ${row.rowName}`,
        );
      }
      if (identity !== row.rowName) {
        throw new WeaponDataSourceError(
          "KEY_MISMATCH",
          context("item", identity),
          `ItemID does not match Unreal row name ${row.rowName}`,
        );
      }
      byIdentity.set(identity, row);

      const prototypeId = normalizePositiveId(row.raw.ModelID);
      if (prototypeId) {
        const candidates = mutableByPrototypeId.get(prototypeId) ?? [];
        candidates.push(row);
        mutableByPrototypeId.set(prototypeId, candidates);
      }
    }

    const byPrototypeId = new Map<string, readonly ItemSourceRow[]>();
    for (const [prototypeId, candidates] of mutableByPrototypeId) {
      byPrototypeId.set(prototypeId, Object.freeze(candidates));
    }
    itemCache = Object.freeze({ byIdentity, byPrototypeId });
    return itemCache;
  }

  function loadPrototypes(): LoadedPrototypes {
    if (prototypeCache) return prototypeCache;

    const rows = loadRows("prototype");
    const mutableByKey = new Map<string, PrototypeSourceRow[]>();
    for (const row of rows.byRowName.values()) {
      const prototypeId = normalizePositiveId(row.raw.PrototypeID);
      const mode = normalizeNonNegativeInteger(row.raw.Mode);
      if (!prototypeId || mode === undefined) {
        throw new WeaponDataSourceError(
          "INVALID_ROW",
          context("prototype", row.rowName),
          "PrototypeID must be a positive ID and Mode must be a non-negative integer",
        );
      }
      const key = prototypeKey(prototypeId, mode);
      const indexedRow = Object.freeze({ ...row, key });
      const candidates = mutableByKey.get(key) ?? [];
      candidates.push(indexedRow);
      mutableByKey.set(key, candidates);
    }

    const byKey = new Map<string, readonly PrototypeSourceRow[]>();
    for (const [key, candidates] of mutableByKey) {
      byKey.set(key, Object.freeze(candidates));
    }
    prototypeCache = Object.freeze({ byKey });
    return prototypeCache;
  }

  function loadWeaponPveSkills(): LoadedWeaponPveSkills {
    if (weaponPveSkillCache) return weaponPveSkillCache;

    const rows = loadRows("skill-pve");
    const byKey = new Map<string, WeaponPveSkillSourceRow>();
    for (const row of rows.byRowName.values()) {
      const skillId = normalizePositiveId(row.raw.SkillID);
      const level = normalizePositiveId(row.raw.Level);
      if (!skillId || !level) {
        throw new WeaponDataSourceError(
          "INVALID_ROW",
          context("skill-pve", row.rowName),
          "SkillID and Level must be positive integer IDs",
        );
      }

      const key = `${skillId}_${level}`;
      const previous = byKey.get(key);
      if (previous) {
        throw new WeaponDataSourceError(
          "DUPLICATE_KEY",
          context("skill-pve", key),
          `identity is shared by rows ${previous.rowName} and ${row.rowName}`,
        );
      }
      if (key !== row.rowName) {
        throw new WeaponDataSourceError(
          "KEY_MISMATCH",
          context("skill-pve", key),
          `SkillID and Level do not match Unreal row name ${row.rowName}`,
        );
      }
      byKey.set(key, row);
    }

    weaponPveSkillCache = Object.freeze({ byKey });
    return weaponPveSkillCache;
  }

  function loadGpActiveSkills(): LoadedGpActiveSkills {
    if (gpActiveSkillCache) return gpActiveSkillCache;

    const rows = loadRows("gp-active-skill");
    const byKey = new Map<string, GpActiveSkillSourceRow>();
    const diagnostics: GpActiveSkillSourceDiagnostic[] = [];
    for (const row of rows.byRowName.values()) {
      if (!normalizePositiveId(row.rowName)) {
        throw new WeaponDataSourceError(
          "INVALID_ROW",
          context("gp-active-skill", row.rowName),
          "Unreal row name must be a positive integer skill ID",
        );
      }
      byKey.set(row.rowName, row);

      const abilityId = normalizePositiveId(row.raw.AbilityID);
      if (abilityId !== row.rowName) {
        diagnostics.push(
          Object.freeze({
            code: "GP_ACTIVE_SKILL_IDENTITY_MISMATCH",
            kind: "gp-active-skill",
            sourcePath: row.sourcePath,
            rowName: row.rowName,
            rawAbilityId: row.raw.AbilityID,
          }),
        );
      }
    }

    gpActiveSkillCache = Object.freeze({
      byKey,
      diagnostics: Object.freeze(diagnostics),
    });
    return gpActiveSkillCache;
  }

  function getIdentityRow<Kind extends "asc" | "feel">(
    kind: Kind,
    id: string,
    field: "ASCTypeID" | "WeaponFeelParamID",
  ): WeaponDataSourceRow<Kind> {
    const row = loadIdentityRows(kind, field).byIdentity.get(id);
    if (!row) {
      throw new WeaponDataSourceError(
        "NOT_FOUND",
        context(kind, id),
        "referenced row does not exist",
      );
    }
    return row;
  }

  function getNumerical(reference: NumericalReference): NumericalSourceRow {
    const requestedKind = numericalKind(reference.table);
    const rowName = `${reference.id}_${reference.level}`;
    const row = loadNumerical(reference.table).byRowName.get(rowName);
    if (row) {
      return Object.freeze({
        ...row,
        key: `${reference.table}:${rowName}`,
        table: reference.table,
      });
    }

    const otherTable: NumericalTable = reference.table === "lc" ? "td" : "lc";
    if (loadNumerical(otherTable).byRowName.has(rowName)) {
      throw new WeaponDataSourceError(
        "TABLE_MISMATCH",
        context(requestedKind, `${reference.table}:${rowName}`),
        `row exists only in ${otherTable} numerical source; cross-table fallback is forbidden`,
      );
    }

    throw new WeaponDataSourceError(
      "NOT_FOUND",
      context(requestedKind, `${reference.table}:${rowName}`),
      "referenced row does not exist",
    );
  }

  function getPrototypeCandidates(
    prototypeId: string,
    mode: number,
  ): readonly PrototypeSourceRow[] {
    const key = prototypeKey(prototypeId, mode);
    return loadPrototypes().byKey.get(key) ?? Object.freeze([]);
  }

  function getPrototype(lookup: PrototypeLookup): PrototypeSourceRow {
    const key = prototypeKey(lookup.prototypeId, lookup.mode);
    const candidates = getPrototypeCandidates(lookup.prototypeId, lookup.mode);
    if (candidates.length === 0) {
      throw new WeaponDataSourceError(
        "NOT_FOUND",
        context("prototype", key),
        "referenced Prototype Mode does not exist",
      );
    }
    if (lookup.rowName !== undefined) {
      const selected = candidates.find(
        (candidate) => candidate.rowName === lookup.rowName,
      );
      if (selected) return selected;
      throw new WeaponDataSourceError(
        "AMBIGUOUS_KEY",
        {
          ...context("prototype", key),
          candidates: candidates.map((candidate) => candidate.rowName),
        },
        `rowName ${lookup.rowName} does not identify a candidate`,
      );
    }
    if (candidates.length > 1) {
      throw new WeaponDataSourceError(
        "AMBIGUOUS_KEY",
        {
          ...context("prototype", key),
          candidates: candidates.map((candidate) => candidate.rowName),
        },
        "Prototype ID and Mode require rowName disambiguation",
      );
    }
    return candidates[0];
  }

  function prototypeLinkError(
    prototype: PrototypeSourceRow,
    detail: string,
  ): WeaponDataSourceError {
    return new WeaponDataSourceError(
      "PROTOTYPE_LINK_MISMATCH",
      context("prototype", prototype.key),
      detail,
    );
  }

  function validatePrototypeLink(
    input: ValidatePrototypeLinkInput,
  ): PrototypeLinkValidation {
    const prototype = getPrototype(input);
    const numericalField = PROTOTYPE_NUMERICAL_FIELDS.find(
      (field) => normalizePositiveId(prototype.raw[field]) === String(input.numerical.id),
    );
    if (!numericalField) {
      throw prototypeLinkError(
        prototype,
        `Numerical ${input.numerical.id} is not referenced by this Prototype Mode`,
      );
    }
    const numerical = getNumerical(input.numerical);

    let asc: AscSourceRow | undefined;
    let feel: FeelSourceRow | undefined;
    if (input.feelParamId && !input.ascTypeId) {
      throw prototypeLinkError(
        prototype,
        "feelParamId cannot be validated without ascTypeId",
      );
    }
    if (input.ascTypeId) {
      const prototypeAscId = normalizePositiveId(prototype.raw.ASCTypeID);
      if (prototypeAscId !== input.ascTypeId) {
        throw prototypeLinkError(
          prototype,
          `ASC ${input.ascTypeId} does not match Prototype ASC ${prototypeAscId ?? "<invalid>"}`,
        );
      }
      asc = getIdentityRow("asc", input.ascTypeId, "ASCTypeID");
      feel = getIdentityRow(
        "feel",
        input.feelParamId ?? input.ascTypeId,
        "WeaponFeelParamID",
      );
    }

    return Object.freeze({ prototype, numerical, numericalField, asc, feel });
  }

  return Object.freeze({
    getNumerical,
    getNumericalDiagnostics(table?: NumericalTable) {
      if (table) {
        loadNumerical(table);
        return numericalDiagnostics.get(numericalKind(table)) ?? Object.freeze([]);
      }
      loadNumerical("lc");
      loadNumerical("td");
      return Object.freeze([
        ...(numericalDiagnostics.get("numerical-lc") ?? []),
        ...(numericalDiagnostics.get("numerical-td") ?? []),
      ]);
    },
    getAsc(ascTypeId: string) {
      return getIdentityRow("asc", ascTypeId, "ASCTypeID");
    },
    getFeel(feelParamId: string) {
      return getIdentityRow("feel", feelParamId, "WeaponFeelParamID");
    },
    getItem(itemId: string) {
      const row = loadItems().byIdentity.get(itemId);
      if (!row) {
        throw new WeaponDataSourceError(
          "NOT_FOUND",
          context("item", itemId),
          "referenced row does not exist",
        );
      }
      return row;
    },
    findItemsByPrototypeId(prototypeId: string) {
      return loadItems().byPrototypeId.get(prototypeId) ?? Object.freeze([]);
    },
    getPrototypeCandidates,
    getPrototype,
    getWeaponPveSkill({
      skillId,
      level,
    }: {
      skillId: number;
      level: number;
    }) {
      const key = `${skillId}_${level}`;
      const row = loadWeaponPveSkills().byKey.get(key);
      if (!row) {
        throw new WeaponDataSourceError(
          "NOT_FOUND",
          context("skill-pve", key),
          "referenced row does not exist",
        );
      }
      return row;
    },
    getGpActiveSkill(skillId: number) {
      const key = String(skillId);
      const row = loadGpActiveSkills().byKey.get(key);
      if (!row) {
        throw new WeaponDataSourceError(
          "NOT_FOUND",
          context("gp-active-skill", key),
          "referenced row does not exist",
        );
      }
      return row;
    },
    getGpActiveSkillDiagnostics() {
      return loadGpActiveSkills().diagnostics;
    },
    validatePrototypeLink,
  });
}
