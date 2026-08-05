import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import {
  getWeaponDataLockRow,
  parseWeaponDataLock,
  serializeWeaponDataLock,
  WEAPON_DATA_LOCK_KINDS,
  type WeaponDataLock,
  type WeaponDataLockKind,
  type WeaponDataLockRow,
} from "../../lib/weapon-data-lock";
import {
  resolveDamageSourceReferences,
  validateWeaponSourceV2,
  type NumericalTable,
  type WeaponSourceV2,
} from "../../lib/weapon-source-v2";
import {
  createWeaponDataSourceReader,
  WEAPON_DATA_SOURCE_FILES,
  type WeaponDataSourceReader,
  type WeaponDataSourceRow,
} from "./source-reader";
import {
  auditActiveSkillReference,
  resolveActiveSkillCharge,
} from "./skill-charge";

const LOCK_SOURCE_KINDS = WEAPON_DATA_LOCK_KINDS;

export const DEFAULT_WEAPON_DATA_LOCK_PATH = path.join(
  process.cwd(),
  "data",
  "weapon-data-lock.json",
);

export interface WeaponRoot {
  readonly directory: string;
  readonly table: NumericalTable;
}

export interface WeaponReferenceOrigin {
  readonly mdxPath: string;
  readonly title: string;
  readonly sourceId?: string;
}

interface ReferenceRequest {
  readonly kind: WeaponDataLockKind;
  readonly key: string;
  readonly origins: WeaponReferenceOrigin[];
}

interface ScannedDamageSource {
  readonly sourceId: string;
  readonly effective: ReturnType<typeof resolveDamageSourceReferences> extends ReadonlyMap<
    string,
    infer Value
  >
    ? Value
    : never;
}

interface ScannedWeapon {
  readonly mdxPath: string;
  readonly weapon: WeaponSourceV2;
  readonly damageSources: readonly ScannedDamageSource[];
}

export interface WeaponReferenceManifest {
  readonly references: ReadonlyMap<
    WeaponDataLockKind,
    ReadonlyMap<string, ReferenceRequest>
  >;
  readonly activeSkills: ReadonlyMap<string, readonly WeaponReferenceOrigin[]>;
  readonly weapons: readonly ScannedWeapon[];
}

export interface ScanWeaponReferencesOptions {
  readonly weaponRoots?: readonly WeaponRoot[];
}

export interface GenerateWeaponDataLockOptions
  extends ScanWeaponReferencesOptions {
  readonly contentRoot?: string;
  readonly reader?: WeaponDataSourceReader;
}

export interface CheckWeaponDataLockOptions extends ScanWeaponReferencesOptions {
  readonly lock: WeaponDataLock;
}

export interface WeaponDataLockCheckResult {
  readonly ok: boolean;
  readonly issues: readonly string[];
  readonly warnings: readonly string[];
}

export interface WeaponDataLockGenerationResult {
  readonly lock: WeaponDataLock;
  readonly warnings: readonly string[];
}

export interface WeaponDataLockDiff {
  readonly added: readonly string[];
  readonly removed: readonly string[];
  readonly changed: readonly string[];
  readonly settlementChanges: readonly string[];
  readonly sourceHashChanges: readonly string[];
}

export interface RefreshWeaponDataLockOptions
  extends GenerateWeaponDataLockOptions {
  readonly lockPath?: string;
}

export interface RefreshWeaponDataLockResult
  extends WeaponDataLockGenerationResult {
  readonly lockPath: string;
  readonly diff: WeaponDataLockDiff;
  readonly serialized: string;
}

export class WeaponDataLockOperationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`weapon data lock operation failed:\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
    this.name = "WeaponDataLockOperationError";
    this.issues = Object.freeze([...issues]);
  }
}

function defaultWeaponRoots(): readonly WeaponRoot[] {
  return Object.freeze([
    Object.freeze({
      directory: path.join(process.cwd(), "data", "weapons"),
      table: "lc" as const,
    }),
    Object.freeze({
      directory: path.join(process.cwd(), "data", "weapons_td"),
      table: "td" as const,
    }),
  ]);
}

function normalizePath(filePath: string): string {
  const relative = path.relative(process.cwd(), filePath);
  return (relative || path.basename(filePath)).replaceAll(path.sep, "/");
}

function listMdxFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  const files: string[] = [];
  const visit = (current: string): void => {
    for (const name of readdirSync(current).sort((a, b) => a.localeCompare(b, "zh-CN"))) {
      const filePath = path.join(current, name);
      const stats = statSync(filePath);
      if (stats.isDirectory()) visit(filePath);
      else if (stats.isFile() && name.endsWith(".mdx")) files.push(filePath);
    }
  };
  visit(directory);
  return files.sort((a, b) => normalizePath(a).localeCompare(normalizePath(b), "en"));
}

function createRequestMaps(): Map<
  WeaponDataLockKind,
  Map<string, ReferenceRequest>
> {
  return new Map(
    LOCK_SOURCE_KINDS.map((kind) => [kind, new Map<string, ReferenceRequest>()]),
  );
}

function addReference(
  references: Map<WeaponDataLockKind, Map<string, ReferenceRequest>>,
  kind: WeaponDataLockKind,
  key: string,
  origin: WeaponReferenceOrigin,
): void {
  const byKey = references.get(kind)!;
  const existing = byKey.get(key);
  if (existing) {
    existing.origins.push(origin);
  } else {
    byKey.set(key, { kind, key, origins: [origin] });
  }
}

function addActiveSkill(
  activeSkills: Map<string, WeaponReferenceOrigin[]>,
  key: string,
  origin: WeaponReferenceOrigin,
): void {
  const existing = activeSkills.get(key);
  if (existing) existing.push(origin);
  else activeSkills.set(key, [origin]);
}

export function scanWeaponV2References(
  options: ScanWeaponReferencesOptions = {},
): WeaponReferenceManifest {
  const references = createRequestMaps();
  const activeSkills = new Map<string, WeaponReferenceOrigin[]>();
  const weapons: ScannedWeapon[] = [];
  const issues: string[] = [];

  for (const root of options.weaponRoots ?? defaultWeaponRoots()) {
    for (const filePath of listMdxFiles(path.resolve(root.directory))) {
      const mdxPath = normalizePath(filePath);
      let data: Record<string, unknown>;
      try {
        data = matter(readFileSync(filePath, "utf8")).data;
      } catch (error) {
        issues.push(`${mdxPath}: cannot parse frontmatter: ${String(error)}`);
        continue;
      }

      if (data.schema_version === undefined) continue;
      if (data.schema_version !== 2) {
        issues.push(`${mdxPath}: unsupported schema_version ${String(data.schema_version)}`);
        continue;
      }

      let weapon: WeaponSourceV2;
      try {
        weapon = validateWeaponSourceV2(data, { expectedTable: root.table });
      } catch (error) {
        issues.push(`${mdxPath}: invalid V2 frontmatter: ${String(error)}`);
        continue;
      }

      const resolved = resolveDamageSourceReferences(weapon);
      const damageSources: ScannedDamageSource[] = [];
      for (const source of weapon.damage_sources) {
        const effective = resolved.get(source.id)!;
        damageSources.push({ sourceId: source.id, effective });
        const origin = Object.freeze({
          mdxPath,
          title: weapon.title,
          sourceId: source.id,
        });
        const numerical = effective.source?.numerical;
        if (numerical) {
          addReference(
            references,
            numerical.table === "lc" ? "numerical-lc" : "numerical-td",
            `${numerical.table}:${numerical.id}_${numerical.level}`,
            origin,
          );
        }
        const ascTypeId = effective.source?.asc_type_id;
        if (ascTypeId) {
          addReference(references, "asc", ascTypeId, origin);
          addReference(
            references,
            "feel",
            effective.source?.feel_param_id ?? ascTypeId,
            origin,
          );
        }
      }

      const weaponOrigin = Object.freeze({ mdxPath, title: weapon.title });
      if (weapon.item_id) {
        addReference(references, "item", weapon.item_id, weaponOrigin);
      }
      if (weapon.active_skill_id && weapon.active_skill_id > 0) {
        addActiveSkill(activeSkills, `${weapon.active_skill_id}_1`, weaponOrigin);
      }
      weapons.push(Object.freeze({
        mdxPath,
        weapon,
        damageSources: Object.freeze(damageSources),
      }));
    }
  }

  if (issues.length > 0) throw new WeaponDataLockOperationError(issues);

  return Object.freeze({
    references,
    activeSkills,
    weapons: Object.freeze(weapons),
  });
}

function createEmptyRows(): WeaponDataLock["rows"] {
  return {
    "numerical-lc": {},
    "numerical-td": {},
    asc: {},
    feel: {},
    item: {},
    "skill-pve": {},
    "gp-active-skill": {},
  };
}

function lockRow(row: WeaponDataSourceRow): WeaponDataLockRow {
  return {
    row_name: row.rowName,
    raw: row.raw as WeaponDataLockRow["raw"],
  };
}

function referenceDescription(request: ReferenceRequest): string {
  return request.origins
    .map((origin) =>
      origin.sourceId
        ? `${origin.mdxPath}#${origin.sourceId}`
        : origin.mdxPath,
    )
    .join(", ");
}

function readReferencedRow(
  reader: WeaponDataSourceReader,
  request: ReferenceRequest,
): WeaponDataSourceRow {
  switch (request.kind) {
    case "numerical-lc":
    case "numerical-td": {
      const match = /^(lc|td):(\d+)_(\d+)$/.exec(request.key);
      if (!match) throw new Error(`invalid numerical key ${request.key}`);
      return reader.getNumerical({
        table: match[1] as NumericalTable,
        id: Number(match[2]),
        level: Number(match[3]),
      });
    }
    case "asc":
      return reader.getAsc(request.key);
    case "feel":
      return reader.getFeel(request.key);
    case "item":
      return reader.getItem(request.key);
    case "skill-pve": {
      const match = /^(\d+)_(\d+)$/.exec(request.key);
      if (!match) throw new Error(`invalid PVE skill key ${request.key}`);
      return reader.getWeaponPveSkill({
        skillId: Number(match[1]),
        level: Number(match[2]),
      });
    }
    case "gp-active-skill":
      return reader.getGpActiveSkill(Number(request.key));
  }
}

function defaultContentRoot(): string {
  return path.join(process.cwd(), "refs", "Exports", "NZM", "Content");
}

function buildSourceMetadata(
  contentRoot: string,
): WeaponDataLock["sources"] {
  return Object.fromEntries(
    LOCK_SOURCE_KINDS.map((kind) => {
      const sourcePath = WEAPON_DATA_SOURCE_FILES[kind];
      const absolutePath = path.join(contentRoot, ...sourcePath.split("/"));
      const bytes = readFileSync(absolutePath);
      return [
        kind,
        {
          source_path: sourcePath,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        },
      ];
    }),
  ) as WeaponDataLock["sources"];
}

export function selectWeaponPrototypeRowName(
  reader: WeaponDataSourceReader,
  prototypeId: string,
  mode: number,
  title: string,
): string | undefined {
  const candidates = reader.getPrototypeCandidates(prototypeId, mode);
  if (candidates.length <= 1) return undefined;
  const allowed = new Set([title, `${title}_${mode}`]);
  const matches = candidates.filter((candidate) => allowed.has(candidate.rowName));
  if (matches.length !== 1) {
    throw new Error(
      `Prototype ${prototypeId}:${mode} is ambiguous for ${title}; candidates=${candidates
        .map((candidate) => candidate.rowName)
        .join(",")}`,
    );
  }
  return matches[0].rowName;
}

function auditPrototypeLinks(
  reader: WeaponDataSourceReader,
  manifest: WeaponReferenceManifest,
): { issues: string[]; warnings: string[] } {
  const issues: string[] = [];
  const warnings: string[] = [];

  for (const scanned of manifest.weapons) {
    const { weapon, mdxPath } = scanned;
    for (const source of scanned.damageSources) {
      const effective = source.effective;
      const mode = effective.source?.prototype_mode;
      if (mode === undefined) continue;
      const numerical = effective.source?.numerical;
      if (!numerical) {
        warnings.push(
          `${mdxPath}#${source.sourceId}: pending Prototype Mode ${mode} has no Numerical candidate to audit`,
        );
        continue;
      }
      try {
        const rowName = selectWeaponPrototypeRowName(
          reader,
          weapon.prototype_id,
          mode,
          weapon.title,
        );
        reader.validatePrototypeLink({
          prototypeId: weapon.prototype_id,
          mode,
          rowName,
          numerical,
          ascTypeId: effective.source?.asc_type_id,
          feelParamId: effective.source?.feel_param_id,
        });
      } catch (error) {
        issues.push(`${mdxPath}#${source.sourceId}: ${String(error)}`);
      }
    }

    try {
      const itemCandidates = reader.findItemsByPrototypeId(weapon.prototype_id);
      if (!weapon.item_id && itemCandidates.length > 1) {
        warnings.push(
          `${mdxPath}: item_id is not selected; candidates=${itemCandidates
            .map((candidate) => candidate.rowName)
            .join(",")}`,
        );
      }
      if (weapon.item_id) {
        const item = reader.getItem(weapon.item_id);
        if (String(item.raw.ModelID) !== weapon.prototype_id) {
          warnings.push(
            `${mdxPath}: item ${weapon.item_id} ModelID=${String(item.raw.ModelID)} does not match prototype_id=${weapon.prototype_id}`,
          );
        }
      }
    } catch (error) {
      issues.push(`${mdxPath}: item audit failed: ${String(error)}`);
    }

    if (weapon.active_skill_id !== undefined) {
      try {
        const prototypeRowName = selectWeaponPrototypeRowName(
          reader,
          weapon.prototype_id,
          0,
          weapon.title,
        );
        const audit = auditActiveSkillReference(reader, {
          prototypeId: weapon.prototype_id,
          prototypeRowName,
          mdxActiveSkillId: weapon.active_skill_id,
          itemId: weapon.item_id,
        });
        for (const issue of audit.issues) {
          const message = `${mdxPath}: ${issue.code} ${JSON.stringify(issue)}`;
          if (issue.severity === "error") issues.push(message);
          else warnings.push(message);
        }
      } catch (error) {
        issues.push(`${mdxPath}: active skill audit failed: ${String(error)}`);
      }
    }
  }
  return { issues, warnings };
}

function collectSelectedDiagnostics(
  reader: WeaponDataSourceReader,
  rows: WeaponDataLock["rows"],
): string[] {
  const warnings: string[] = [];
  if (
    Object.keys(rows["numerical-lc"]).length > 0 ||
    Object.keys(rows["numerical-td"]).length > 0
  ) {
    for (const diagnostic of reader.getNumericalDiagnostics()) {
      if (rows[diagnostic.kind][`${diagnostic.kind === "numerical-lc" ? "lc" : "td"}:${diagnostic.rowName}`]) {
        warnings.push(`${diagnostic.code} ${diagnostic.kind} key=${diagnostic.rowName}`);
      }
    }
  }
  if (Object.keys(rows["gp-active-skill"]).length > 0) {
    for (const diagnostic of reader.getGpActiveSkillDiagnostics()) {
      if (rows["gp-active-skill"][diagnostic.rowName]) {
        warnings.push(
          `${diagnostic.code} gp-active-skill key=${diagnostic.rowName} AbilityID=${String(diagnostic.rawAbilityId)}`,
        );
      }
    }
  }
  return warnings;
}

export function generateWeaponDataLock(
  options: GenerateWeaponDataLockOptions = {},
): WeaponDataLockGenerationResult {
  const manifest = scanWeaponV2References(options);
  const contentRoot = path.resolve(options.contentRoot ?? defaultContentRoot());
  const reader = options.reader ?? createWeaponDataSourceReader({ contentRoot });
  const rows = createEmptyRows();
  const activeSkills: WeaponDataLock["active_skills"] = {};
  const issues: string[] = [];
  const warnings: string[] = [];

  let sources: WeaponDataLock["sources"];
  try {
    sources = buildSourceMetadata(contentRoot);
  } catch (error) {
    throw new WeaponDataLockOperationError([
      `cannot hash registered source files under ${contentRoot}: ${String(error)}`,
    ]);
  }

  for (const kind of LOCK_SOURCE_KINDS) {
    if (kind === "skill-pve" || kind === "gp-active-skill") continue;
    for (const request of manifest.references.get(kind)!.values()) {
      try {
        rows[kind][request.key] = lockRow(readReferencedRow(reader, request));
      } catch (error) {
        issues.push(
          `${request.kind} ${request.key} referenced by ${referenceDescription(request)}: ${String(error)}`,
        );
      }
    }
  }

  for (const [skillKey, origins] of manifest.activeSkills) {
    const skillId = Number(skillKey.slice(0, -2));
    try {
      const resolution = resolveActiveSkillCharge(reader, { skillId, level: 1 });
      const kind = resolution.source === "weapon_pve" ? "skill-pve" : "gp-active-skill";
      rows[kind][resolution.sourceKey] = lockRow(resolution.row);
      activeSkills[skillKey] = {
        source: resolution.source,
        source_key: resolution.sourceKey,
      };
    } catch (error) {
      issues.push(
        `active skill ${skillKey} referenced by ${origins.map((origin) => origin.mdxPath).join(", ")}: ${String(error)}`,
      );
    }
  }

  const audit = auditPrototypeLinks(reader, manifest);
  issues.push(...audit.issues);
  warnings.push(...audit.warnings);

  if (issues.length > 0) throw new WeaponDataLockOperationError(issues);
  warnings.push(...collectSelectedDiagnostics(reader, rows));

  return Object.freeze({
    lock: parseWeaponDataLock({
      schema_version: 1,
      sources,
      rows,
      active_skills: activeSkills,
    }),
    warnings: Object.freeze(warnings.sort((a, b) => a.localeCompare(b, "en"))),
  });
}

function normalizePositiveId(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
    return String(value);
  }
  if (typeof value === "string" && /^[1-9]\d*$/.test(value)) return value;
  return undefined;
}

function validateLockedIdentity(
  kind: WeaponDataLockKind,
  key: string,
  row: WeaponDataLockRow,
): string[] {
  const issues: string[] = [];
  const fail = (detail: string): void => {
    issues.push(`${kind} ${key}: ${detail}`);
  };
  if (kind === "numerical-lc" || kind === "numerical-td") {
    const prefix = kind === "numerical-lc" ? "lc:" : "td:";
    if (key !== `${prefix}${row.row_name}`) fail(`row_name ${row.row_name} does not match key`);
  } else if (kind === "asc") {
    if (key !== row.row_name || normalizePositiveId(row.raw.ASCTypeID) !== key) {
      fail("ASCTypeID, row_name and key must match");
    }
    for (const field of [
      "DistanceBeginAttenuationBase",
      "DistanceEndAttenuationBase",
      "AttenuationMinScale",
    ]) {
      if (!Object.hasOwn(row.raw, field)) fail(`missing required raw field ${field}`);
    }
  } else if (kind === "feel") {
    if (key !== row.row_name || normalizePositiveId(row.raw.WeaponFeelParamID) !== key) {
      fail("WeaponFeelParamID, row_name and key must match");
    }
  } else if (kind === "item") {
    if (key !== row.row_name || normalizePositiveId(row.raw.ItemID) !== key) {
      fail("ItemID, row_name and key must match");
    }
  } else if (kind === "skill-pve") {
    const derived = `${normalizePositiveId(row.raw.SkillID) ?? "<invalid>"}_${String(row.raw.Level)}`;
    if (key !== row.row_name || derived !== key) {
      fail("SkillID/Level, row_name and key must match");
    }
  } else if (kind === "gp-active-skill") {
    if (key !== row.row_name || normalizePositiveId(row.row_name) !== key) {
      fail("GP row_name and key must be the same positive ID");
    }
  }
  return issues;
}

export function checkWeaponDataLock(
  options: CheckWeaponDataLockOptions,
): WeaponDataLockCheckResult {
  const lock = parseWeaponDataLock(options.lock);
  let manifest: WeaponReferenceManifest;
  try {
    manifest = scanWeaponV2References(options);
  } catch (error) {
    return Object.freeze({
      ok: false,
      issues: Object.freeze(
        error instanceof WeaponDataLockOperationError
          ? [...error.issues]
          : [String(error)],
      ),
      warnings: Object.freeze([]),
    });
  }

  const issues: string[] = [];
  const expected = new Map<WeaponDataLockKind, Set<string>>(
    LOCK_SOURCE_KINDS.map((kind) => [
      kind,
      new Set(manifest.references.get(kind)!.keys()),
    ]),
  );

  for (const kind of LOCK_SOURCE_KINDS) {
    const expectedPath = WEAPON_DATA_SOURCE_FILES[kind];
    if (lock.sources[kind].source_path !== expectedPath) {
      issues.push(
        `${kind}: source_path ${lock.sources[kind].source_path} must be ${expectedPath}`,
      );
    }
  }

  for (const [skillKey, origins] of manifest.activeSkills) {
    const selection = lock.active_skills[skillKey];
    if (!selection) {
      issues.push(
        `active skill ${skillKey} referenced by ${origins.map((origin) => origin.mdxPath).join(", ")} has no locked source selection`,
      );
      continue;
    }
    const skillId = skillKey.slice(0, -2);
    const expectedKind = selection.source === "weapon_pve" ? "skill-pve" : "gp-active-skill";
    const expectedKey = selection.source === "weapon_pve" ? skillKey : skillId;
    if (selection.source_key !== expectedKey) {
      issues.push(
        `active skill ${skillKey}: ${selection.source} source_key must be ${expectedKey}, got ${selection.source_key}`,
      );
    }
    expected.get(expectedKind)!.add(selection.source_key);
  }

  for (const skillKey of Object.keys(lock.active_skills)) {
    if (!manifest.activeSkills.has(skillKey)) {
      issues.push(`active skill ${skillKey}: unused locked source selection`);
    }
  }

  for (const kind of LOCK_SOURCE_KINDS) {
    const expectedKeys = expected.get(kind)!;
    const actualKeys = Object.keys(lock.rows[kind]);
    for (const key of expectedKeys) {
      const request = manifest.references.get(kind)!.get(key);
      const referencePath = request ? referenceDescription(request) : undefined;
      try {
        getWeaponDataLockRow(lock, kind, key, referencePath);
      } catch (error) {
        issues.push(String(error));
      }
    }
    for (const key of actualKeys) {
      if (!expectedKeys.has(key)) issues.push(`${kind} ${key}: unused Lock row`);
      issues.push(...validateLockedIdentity(kind, key, lock.rows[kind][key]));
    }
  }

  return Object.freeze({
    ok: issues.length === 0,
    issues: Object.freeze(issues.sort((a, b) => a.localeCompare(b, "en"))),
    warnings: Object.freeze([]),
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function escapeJsonPointer(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function collectChangedPaths(
  previous: unknown,
  next: unknown,
  pointer = "",
  output: string[] = [],
): string[] {
  if (Object.is(previous, next)) return output;
  if (Array.isArray(previous) && Array.isArray(next)) {
    const length = Math.max(previous.length, next.length);
    for (let index = 0; index < length; index += 1) {
      collectChangedPaths(previous[index], next[index], `${pointer}/${index}`, output);
    }
    return output;
  }
  if (isObject(previous) && isObject(next)) {
    const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
    for (const key of [...keys].sort((a, b) => a.localeCompare(b, "en"))) {
      collectChangedPaths(
        previous[key],
        next[key],
        `${pointer}/${escapeJsonPointer(key)}`,
        output,
      );
    }
    return output;
  }
  output.push(pointer || "/");
  return output;
}

function settlementTags(row: WeaponDataLockRow): readonly unknown[] {
  const settlements = row.raw.Settlements;
  if (!Array.isArray(settlements)) return [];
  return settlements.map((entry) =>
    isObject(entry) ? entry.TagName : undefined,
  );
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function diffWeaponDataLocks(
  previous: WeaponDataLock | undefined,
  next: WeaponDataLock,
): WeaponDataLockDiff {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];
  const settlementChanges: string[] = [];
  const sourceHashChanges: string[] = [];

  for (const kind of LOCK_SOURCE_KINDS) {
    if (!previous || previous.sources[kind].sha256 !== next.sources[kind].sha256) {
      sourceHashChanges.push(
        `${kind}: ${previous?.sources[kind].sha256 ?? "<none>"} -> ${next.sources[kind].sha256}`,
      );
    }
    const previousRows = previous?.rows[kind] ?? {};
    const nextRows = next.rows[kind];
    const keys = new Set([...Object.keys(previousRows), ...Object.keys(nextRows)]);
    for (const key of [...keys].sort((a, b) => a.localeCompare(b, "en"))) {
      const before = previousRows[key];
      const after = nextRows[key];
      if (!before) added.push(`${kind} ${key}`);
      else if (!after) removed.push(`${kind} ${key}`);
      else if (!sameJson(before, after)) {
        for (const pointer of collectChangedPaths(before, after)) {
          changed.push(`${kind} ${key}${pointer}`);
        }
        const beforeTags = settlementTags(before);
        const afterTags = settlementTags(after);
        if (!sameJson(beforeTags, afterTags)) {
          settlementChanges.push(
            `${kind} ${key}: ${JSON.stringify(beforeTags)} -> ${JSON.stringify(afterTags)}`,
          );
        }
      }
    }
  }

  const previousSkills = previous?.active_skills ?? {};
  const skillKeys = new Set([
    ...Object.keys(previousSkills),
    ...Object.keys(next.active_skills),
  ]);
  for (const key of [...skillKeys].sort((a, b) => a.localeCompare(b, "en"))) {
    const before = previousSkills[key];
    const after = next.active_skills[key];
    if (!before) added.push(`active-skills ${key}`);
    else if (!after) removed.push(`active-skills ${key}`);
    else if (!sameJson(before, after)) changed.push(`active-skills ${key}`);
  }

  return Object.freeze({
    added: Object.freeze(added),
    removed: Object.freeze(removed),
    changed: Object.freeze(changed),
    settlementChanges: Object.freeze(settlementChanges),
    sourceHashChanges: Object.freeze(sourceHashChanges),
  });
}

export function readWeaponDataLock(lockPath = DEFAULT_WEAPON_DATA_LOCK_PATH): WeaponDataLock {
  try {
    return parseWeaponDataLock(JSON.parse(readFileSync(lockPath, "utf8")));
  } catch (error) {
    throw new WeaponDataLockOperationError([
      `${normalizePath(lockPath)}: cannot read valid Lock: ${String(error)}`,
    ]);
  }
}

export function refreshWeaponDataLock(
  options: RefreshWeaponDataLockOptions = {},
): RefreshWeaponDataLockResult {
  const lockPath = path.resolve(options.lockPath ?? DEFAULT_WEAPON_DATA_LOCK_PATH);
  const previous = existsSync(lockPath) ? readWeaponDataLock(lockPath) : undefined;
  const generated = generateWeaponDataLock(options);
  const serialized = serializeWeaponDataLock(generated.lock);
  const diff = diffWeaponDataLocks(previous, generated.lock);
  writeFileSync(lockPath, serialized, "utf8");
  return Object.freeze({
    ...generated,
    lockPath,
    diff,
    serialized,
  });
}
