import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import matter from "gray-matter";
import { pinyin } from "pinyin-pro";
import { parseDocument } from "yaml";
import { z } from "zod";
import { WEAPON_TYPE_ID_MAP } from "../../constants/weapons";
import type { WeaponDataLock } from "../../lib/weapon-data-lock";
import {
  createResolvedWeaponSnapshot,
  resolveWeapon,
  type ResolvedDamageSource,
  type ResolvedWeapon,
  type ResolvedWeaponSnapshot,
} from "../../lib/weapon-resolver";
import {
  damageSectionSchema,
  numericalReferenceSchema,
  resolveDamageSourceReferences,
  validateWeaponSourceV2,
  weaponDataSourceRefSchema,
  type DamageSection,
  type NumericalReference,
  type NumericalTable,
  type WeaponDataSourceRef,
} from "../../lib/weapon-source-v2";
import {
  getResolvedFieldValue,
  toWeaponCatalogEntry,
  toWeaponDetailData,
} from "../../lib/weapon-consumers";
import {
  PROTOTYPE_NUMERICAL_FIELDS,
  WEAPON_DATA_SOURCE_FILES,
  createWeaponDataSourceReader,
  type NumericalSourceRow,
  type PrototypeNumericalField,
  type PrototypeSourceRow,
  type WeaponDataSourceReader,
} from "./source-reader";
import { auditActiveSkillReference, resolveActiveSkillCharge } from "./skill-charge";
import { readWeaponDataLock, selectWeaponPrototypeRowName } from "./lock";

const ROOT = process.cwd();
export const DEFAULT_MIGRATION_DECISIONS_PATH = path.join(
  ROOT,
  "data",
  "weapon-v2-migration-decisions.json",
);
export const DEFAULT_MIGRATION_REPORT_PATH = path.join(
  ROOT,
  "data",
  "weapon-v2-migration-report.json",
);
export const DEFAULT_MIGRATION_SNAPSHOT_PATH = path.join(
  ROOT,
  "data",
  "weapon-v2-migration-snapshots.json",
);

const ownerSchema = z.enum([
  "source_mapping",
  "wiki_semantics",
  "game_data",
  "skill_chain",
  "item_chain",
]);

const legacyLocatorSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("primary") }),
  z.strictObject({ kind: z.literal("damage_mode"), mode: z.number().int().nonnegative() }),
  z.strictObject({ kind: z.literal("extra_mode"), name: z.string().trim().min(1) }),
]);

const sourceIdentitySchema = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(1),
  section: damageSectionSchema,
  inherits: z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/).optional(),
  locator: legacyLocatorSchema,
  table_scope: z.array(z.enum(["lc", "td"])).min(1).refine(
    (tables) => new Set(tables).size === tables.length,
    "table_scope must not contain duplicates",
  ),
  reason: z.string().trim().min(1),
});

const legacyFieldDecisionSchema = z.strictObject({
  action: z.enum(["preserve_legacy", "accept_source"]),
  reason: z.string().trim().min(1),
  owner: ownerSchema,
});

const acceptedFieldDecisionSchema = z.strictObject({
  action: z.literal("accept_source"),
  reason: z.string().trim().min(1),
  owner: ownerSchema,
});

const confirmedOverrideDecisionSchema = z.strictObject({
  action: z.literal("confirmed_override"),
  reason: z.string().trim().min(1),
  owner: ownerSchema,
  value: z.json(),
  evidence_ids: z.array(z.string().regex(/^[a-z][a-z0-9-]*$/)).min(1),
});

export const reviewedFieldDecisionSchema = z.discriminatedUnion("action", [
  acceptedFieldDecisionSchema,
  confirmedOverrideDecisionSchema,
]);

const tableDecisionCommonShape = {
  exclude: z
    .strictObject({
      code: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
      reason: z.string().trim().min(1),
      owner: ownerSchema,
    })
    .optional(),
  item_id: z.string().regex(/^[1-9]\d*$/).optional(),
  active_skill_id: z.number().int().nonnegative().optional(),
  active_skill_correction: z
    .strictObject({
      from: z.number().int().nonnegative(),
      to: z.number().int().positive(),
      reason: z.string().trim().min(1),
      owner: z.literal("skill_chain"),
    })
    .optional(),
  sources: z.record(z.string(), weaponDataSourceRefSchema).default({}),
  snapshot_differences: z
    .array(
      z.strictObject({
        pointer: z.string().startsWith("/"),
        classification: z.enum(["source_difference", "accepted_correction"]),
        reason: z.string().trim().min(1),
      }),
    )
    .default([]),
};

const legacyTableDecisionSchema = z.strictObject({
  ...tableDecisionCommonShape,
  field_decisions: z
    .record(z.string(), z.record(z.string(), legacyFieldDecisionSchema))
    .default({}),
});

const evidenceIdSchema = z.string().regex(/^[a-z][a-z0-9-]*$/);
const fileEvidenceSchema = z.strictObject({
  kind: z.enum(["prototype_field", "asset_property", "numerical_row"]),
  path: z.string().trim().min(1),
  pointer: z.string().startsWith("/"),
  observed_value: z.json(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  note: z.string().trim().min(1),
});
const manualEvidenceSchema = z.strictObject({
  kind: z.literal("manual_verification"),
  note: z.string().trim().min(1),
});
export const reconciliationEvidenceSchema = z.discriminatedUnion("kind", [
  fileEvidenceSchema,
  manualEvidenceSchema,
]);

export const sourceReviewSchema = z.strictObject({
  previous_effective_source: weaponDataSourceRefSchema,
  resolution: z.enum(["confirmed", "corrected"]),
  reason: z.string().trim().min(1),
  evidence_ids: z.array(evidenceIdSchema).min(1),
});

const excludedTableDecisionV2Schema = z.strictObject({
  ...tableDecisionCommonShape,
  exclude: tableDecisionCommonShape.exclude.unwrap(),
  field_decisions: z
    .record(z.string(), z.record(z.string(), legacyFieldDecisionSchema))
    .default({}),
});

const migratedTableDecisionV2Schema = z.strictObject({
  ...tableDecisionCommonShape,
  exclude: z.undefined().optional(),
  field_decisions: z
    .record(z.string(), z.record(z.string(), reviewedFieldDecisionSchema))
    .default({}),
  source_reviews: z.record(z.string(), sourceReviewSchema).default({}),
});

const tableDecisionV2Schema = z.union([
  excludedTableDecisionV2Schema,
  migratedTableDecisionV2Schema,
]);

const legacyWeaponDecisionSchema = z
  .strictObject({
    sources: z.record(z.string(), sourceIdentitySchema),
    tables: z.strictObject({
      lc: legacyTableDecisionSchema.optional(),
      td: legacyTableDecisionSchema.optional(),
    }),
  })
  .superRefine((weapon, context) => {
    for (const table of ["lc", "td"] as const) {
      const tableDecision = weapon.tables[table];
      if (
        tableDecision?.active_skill_correction &&
        tableDecision.active_skill_correction.to !== tableDecision.active_skill_id
      ) {
        context.addIssue({
          code: "custom",
          path: ["tables", table, "active_skill_correction", "to"],
          message: "active_skill_correction.to must equal active_skill_id",
        });
      }
      const ids = new Map<string, string>();
      for (const [key, identity] of Object.entries(weapon.sources)) {
        if (!identity.table_scope.includes(table)) continue;
        const previous = ids.get(identity.id);
        if (previous) {
          context.addIssue({
            code: "custom",
            path: ["sources", key, "id"],
            message: `${table} source id duplicates ${previous}`,
          });
        } else {
          ids.set(identity.id, key);
        }
      }
    }
  });

const weaponDecisionV2Schema = z.strictObject({
  sources: z.record(z.string(), sourceIdentitySchema),
  tables: z.strictObject({
    lc: tableDecisionV2Schema.optional(),
    td: tableDecisionV2Schema.optional(),
  }),
});

export const migrationDecisionsV1Schema = z.strictObject({
  schema_version: z.literal(1),
  weapons: z.record(z.string(), legacyWeaponDecisionSchema),
});

export const migrationDecisionsV2Schema = z.strictObject({
  schema_version: z.literal(2),
  evidence: z.record(evidenceIdSchema, reconciliationEvidenceSchema),
  weapons: z.record(z.string(), weaponDecisionV2Schema),
});

export const migrationDecisionsSchema = z.union([
  migrationDecisionsV1Schema,
  migrationDecisionsV2Schema,
]);

export type MigrationDecisions = z.infer<typeof migrationDecisionsSchema>;
type LegacyLocator = z.infer<typeof legacyLocatorSchema>;
type TableDecision =
  | z.infer<typeof legacyTableDecisionSchema>
  | z.infer<typeof excludedTableDecisionV2Schema>
  | z.infer<typeof migratedTableDecisionV2Schema>;

interface WeaponFile {
  readonly table: NumericalTable;
  readonly relativePath: string;
  readonly absolutePath: string;
  readonly slug: string;
  readonly rawText: string;
  readonly data: Record<string, unknown>;
}

interface LegacySource {
  readonly locator: LegacyLocator;
  readonly locatorKey: string;
  readonly name: string;
  readonly resolved: ResolvedDamageSource;
  readonly raw: Record<string, unknown>;
  readonly proposedId: string;
  readonly proposedSection?: DamageSection;
}

interface SourceCandidate {
  readonly scope: "prototype_mode" | "prototype_weapon" | "table_signature";
  readonly prototypeRowName?: string;
  readonly numericalField?: PrototypeNumericalField;
  readonly signatureMatch: boolean;
  readonly titleMatch: boolean;
  readonly source: WeaponDataSourceRef;
}

interface SourceProposal {
  readonly locator: LegacyLocator;
  readonly locator_key: string;
  readonly name: string;
  readonly proposed_id: string;
  readonly proposed_section?: DamageSection;
  readonly candidates: readonly SourceCandidate[];
  readonly proposed?: SourceCandidate;
  readonly issue?: string;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right, "en"))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

function serialize(value: unknown): string {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

function weaponRoots(root = ROOT): readonly { table: NumericalTable; directory: string }[] {
  return [
    { table: "lc", directory: path.join(root, "data", "weapons") },
    { table: "td", directory: path.join(root, "data", "weapons_td") },
  ];
}

function splitMdxDocument(rawText: string): { frontmatterText: string; body: string } {
  const opening = /^---\r?\n/.exec(rawText);
  if (!opening) throw new Error("MDX document has no opening frontmatter delimiter");
  const closing = /\r?\n---(?:\r?\n|$)/g;
  closing.lastIndex = opening[0].length;
  const match = closing.exec(rawText);
  if (!match) throw new Error("MDX document has no closing frontmatter delimiter");
  return {
    frontmatterText: rawText.slice(opening[0].length, match.index),
    body: rawText.slice(match.index + match[0].length),
  };
}

export function extractMdxBody(rawText: string): string {
  return splitMdxDocument(rawText).body;
}

function scanWeaponFiles(root = ROOT): WeaponFile[] {
  const files: WeaponFile[] = [];
  for (const { table, directory } of weaponRoots(root)) {
    for (const name of readdirSync(directory).filter((value) => value.endsWith(".mdx")).sort()) {
      const absolutePath = path.join(directory, name);
      const rawText = readFileSync(absolutePath, "utf8");
      const parsed = matter(rawText);
      files.push({
        table,
        relativePath: path.relative(root, absolutePath).replaceAll("\\", "/"),
        absolutePath,
        slug: path.basename(name, ".mdx"),
        rawText,
        data: parsed.data,
      });
    }
  }
  return files;
}

function locatorKey(locator: LegacyLocator): string {
  if (locator.kind === "primary") return "primary";
  if (locator.kind === "damage_mode") return `damage-mode:${locator.mode}`;
  return `extra-mode:${locator.name}`;
}

function proposedId(name: string): string {
  const tokens = pinyin(name, { toneType: "none", type: "array" })
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return /^[a-z]/.test(tokens) ? tokens : `source-${tokens || "unnamed"}`;
}

function proposedExtraSection(name: string): DamageSection {
  if (/dot|持续|毒池|毒雾|燃烧|灼烧|腐蚀/i.test(name)) return "dot";
  if (/射速|连发|模式|被动/.test(name)) return "variant";
  if (/技能|召唤|插件/.test(name)) return "skill";
  return "special";
}

function modeMap(data: Record<string, unknown>): Map<number, { raw: Record<string, unknown>; index: number }> {
  const result = new Map<number, { raw: Record<string, unknown>; index: number }>();
  if (!Array.isArray(data.damage_modes)) return result;
  for (const [index, value] of data.damage_modes.entries()) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const raw = value as Record<string, unknown>;
    if (typeof raw.mode === "number" && Number.isSafeInteger(raw.mode) && raw.mode >= 0) {
      result.set(raw.mode, { raw, index });
    }
  }
  return result;
}

function legacySources(file: WeaponFile): LegacySource[] {
  const resolved = resolveWeapon(file.data, {
    slug: file.slug,
    expectedTable: file.table,
  });
  const modes = modeMap(file.data);
  const validModeZero =
    modes.has(0) && typeof modes.get(0)!.raw.name === "string" && modes.get(0)!.raw.name !== "";
  const descriptors: { locator: LegacyLocator; raw: Record<string, unknown> }[] = [
    validModeZero
      ? { locator: { kind: "damage_mode", mode: 0 }, raw: modes.get(0)!.raw }
      : { locator: { kind: "primary" }, raw: file.data },
  ];
  for (const [mode, entry] of modes) {
    if (mode === 0 || typeof entry.raw.name !== "string" || entry.raw.name === "") continue;
    descriptors.push({ locator: { kind: "damage_mode", mode }, raw: entry.raw });
  }
  if (Array.isArray(file.data.extra_modes)) {
    const names = new Set<string>();
    for (const value of file.data.extra_modes) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const raw = value as Record<string, unknown>;
      if (typeof raw.name !== "string" || !raw.name.trim()) continue;
      if (names.has(raw.name)) throw new Error(`${file.relativePath}: duplicate extra mode name ${raw.name}`);
      names.add(raw.name);
      descriptors.push({ locator: { kind: "extra_mode", name: raw.name }, raw });
    }
  }
  if (descriptors.length !== resolved.damageSources.length) {
    throw new Error(
      `${file.relativePath}: legacy locator count ${descriptors.length} does not match resolved source count ${resolved.damageSources.length}`,
    );
  }
  const melee = file.data.weapon_type === "近战武器";
  return descriptors.map((descriptor, index) => {
    const source = resolved.damageSources[index];
    return {
      ...descriptor,
      locatorKey: locatorKey(descriptor.locator),
      name: source.name,
      resolved: source,
      proposedId: proposedId(source.name),
      proposedSection:
        descriptor.locator.kind === "extra_mode"
          ? proposedExtraSection(source.name)
          : melee
            ? "melee"
            : "fire_mode",
    };
  });
}

const comparableFields = [
  "damage.base",
  "damage.impulse",
  "damage.toughness",
  "damage.flesh",
  "damage.hurtable",
  "element",
  "element_add_rate",
  "weakness_multiplier",
  "enable_weakness",
  "enable_critical",
  "toughness_type",
  "ignore_shield",
] as const;

type ComparableField = (typeof comparableFields)[number];

function explicitComparableFields(source: LegacySource): ComparableField[] {
  const raw = source.raw;
  const damage = raw.damage && typeof raw.damage === "object" && !Array.isArray(raw.damage)
    ? (raw.damage as Record<string, unknown>)
    : {};
  const fields: ComparableField[] = [];
  for (const key of ["base", "impulse", "toughness", "flesh", "hurtable"] as const) {
    if (damage[key] !== undefined && damage[key] !== null) fields.push(`damage.${key}`);
  }
  const aliases: [ComparableField, string[]][] = [
    ["element", ["element"]],
    ["element_add_rate", ["element_add_rate"]],
    ["weakness_multiplier", ["weakness_multiplier", "weekness_multiplier"]],
    ["enable_weakness", ["enable_weakness"]],
    ["enable_critical", ["enable_critical"]],
    ["toughness_type", ["toughness_type"]],
    ["ignore_shield", ["ignore_shield"]],
  ];
  for (const [field, keys] of aliases) {
    if (keys.some((key) => raw[key] !== undefined && raw[key] !== null)) fields.push(field);
  }
  return fields;
}

function comparableValue(source: ResolvedDamageSource, field: ComparableField): unknown {
  if (field.startsWith("damage.")) {
    const key = field.slice("damage.".length) as keyof ResolvedDamageSource["damage"];
    return getResolvedFieldValue(source.damage[key]);
  }
  if (field === "element") return getResolvedFieldValue(source.element);
  if (field === "element_add_rate") return getResolvedFieldValue(source.elementAddRate);
  if (field === "weakness_multiplier") return getResolvedFieldValue(source.weaknessMultiplier);
  if (field === "enable_weakness") return getResolvedFieldValue(source.enableWeakness);
  if (field === "enable_critical") return getResolvedFieldValue(source.enableCritical);
  if (field === "toughness_type") return getResolvedFieldValue(source.toughness);
  return getResolvedFieldValue(source.ignoreShield);
}

function emptyLock(): WeaponDataLock {
  const metadata = Object.fromEntries(
    Object.entries(WEAPON_DATA_SOURCE_FILES)
      .filter(([kind]) => kind !== "prototype")
      .map(([kind, source_path]) => [kind, { source_path, sha256: "0".repeat(64) }]),
  ) as WeaponDataLock["sources"];
  return {
    schema_version: 1,
    sources: metadata,
    rows: {
      "numerical-lc": {},
      "numerical-td": {},
      asc: {},
      feel: {},
      item: {},
      "skill-pve": {},
      "gp-active-skill": {},
    },
    active_skills: {},
  };
}

function numericalReference(row: NumericalSourceRow): NumericalReference | undefined {
  const match = /^(\d+)_(\d+)$/.exec(row.rowName);
  if (!match) return undefined;
  const id = Number(match[1]);
  const level = Number(match[2]);
  const parsed = numericalReferenceSchema.safeParse({ table: row.table, id, level });
  return parsed.success ? parsed.data : undefined;
}

function resolveNumericalRow(file: WeaponFile, row: NumericalSourceRow): ResolvedDamageSource | undefined {
  const numerical = numericalReference(row);
  if (!numerical) return undefined;
  const lock = emptyLock();
  lock.rows[row.kind][`${row.table}:${row.rowName}`] = {
    row_name: row.rowName,
    raw: row.raw as Record<string, never>,
  };
  try {
    return resolveWeapon(
      {
        schema_version: 2,
        title: String(file.data.title ?? file.slug),
        prototype_id: String(file.data.prototype_id),
        use_type: String(file.data.use_type),
        element: file.data.element,
        rarity: file.data.rarity,
        damage_sources: [
          {
            id: "candidate",
            name: "候选",
            section: "special",
            source: { numerical },
          },
        ],
      },
      { slug: file.slug, expectedTable: file.table, lock },
    ).damageSources[0];
  } catch {
    return undefined;
  }
}

function signatureMatches(source: LegacySource, candidate: ResolvedDamageSource | undefined): boolean {
  if (!candidate) return false;
  const fields = explicitComparableFields(source);
  if (fields.length === 0) return false;
  return fields.every((field) =>
    isDeepStrictEqual(comparableValue(source.resolved, field), comparableValue(candidate, field)),
  );
}

function positiveId(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return String(value);
  if (typeof value === "string" && /^[1-9]\d*$/.test(value)) return value;
  return undefined;
}

function localizedText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const raw = value as Record<string, unknown>;
  return typeof raw.LocalizedString === "string"
    ? raw.LocalizedString
    : typeof raw.SourceString === "string"
      ? raw.SourceString
      : "";
}

function prototypeCandidates(
  file: WeaponFile,
  source: LegacySource,
  reader: WeaponDataSourceReader,
  signatures: ReadonlyMap<string, ResolvedDamageSource | undefined>,
): SourceCandidate[] {
  const prototypeId = positiveId(file.data.prototype_id);
  if (!prototypeId) return [];
  const exactMode = source.locator.kind === "damage_mode" ? source.locator.mode : 0;
  const allRows = reader.getPrototypeRows(prototypeId);
  let exactRows: readonly PrototypeSourceRow[] = [];
  try {
    const rowName = selectWeaponPrototypeRowName(
      reader,
      prototypeId,
      exactMode,
      String(file.data.title ?? file.slug),
    );
    exactRows = [reader.getPrototype({ prototypeId, mode: exactMode, rowName })];
  } catch {
    exactRows = [];
  }
  const build = (
    rows: readonly PrototypeSourceRow[],
    scope: SourceCandidate["scope"],
  ): SourceCandidate[] => {
    const candidates: SourceCandidate[] = [];
    for (const prototype of rows) {
      for (const field of PROTOTYPE_NUMERICAL_FIELDS) {
        const id = positiveId(prototype.raw[field]);
        if (!id) continue;
        let row: NumericalSourceRow;
        try {
          row = reader.getNumerical({ table: file.table, id: Number(id), level: 1 });
        } catch {
          continue;
        }
        const reference = numericalReference(row);
        if (!reference) continue;
        const ascTypeId = positiveId(prototype.raw.ASCTypeID);
        const description = localizedText(row.raw.Description);
        candidates.push({
          scope,
          prototypeRowName: prototype.rowName,
          numericalField: field,
          signatureMatch: signatureMatches(source, signatures.get(row.key)),
          titleMatch:
            description.includes(String(file.data.title ?? file.slug)) ||
            description.includes(source.name),
          source: {
            ...(scope === "prototype_mode" ? { prototype_mode: exactMode } : {}),
            numerical: reference,
            ...(scope === "prototype_mode" && ascTypeId ? { asc_type_id: ascTypeId } : {}),
          },
        });
      }
    }
    return candidates;
  };
  const exact = build(exactRows, "prototype_mode");
  const exactMatches = exact.filter((candidate) => candidate.signatureMatch);
  if (exactMatches.length > 0) return dedupeCandidates(exactMatches);
  const semanticField: PrototypeNumericalField =
    source.name.includes("爆炸")
      ? "ExplosionNumericalID"
      : source.name.includes("激光")
        ? "LaserNumericalID"
        : source.name.includes("击飞")
          ? "KnockUpNumericalID"
          : file.data.weapon_type === "近战武器"
            ? source.name.includes("轻击")
              ? "LightHitNumericalID"
              : "HeavyHitNumericalID"
            : "NumericalID";
  const semanticMatches = exact.filter(
    (candidate) => candidate.numericalField === semanticField,
  );
  if (semanticMatches.length === 1) return semanticMatches;
  if (exact.length > 0) return dedupeCandidates(exact);
  const weaponMatches = build(allRows, "prototype_weapon").filter(
    (candidate) => candidate.signatureMatch,
  );
  return dedupeCandidates(weaponMatches);
}

function dedupeCandidates(candidates: readonly SourceCandidate[]): SourceCandidate[] {
  const result = new Map<string, SourceCandidate>();
  for (const candidate of candidates) {
    const numerical = candidate.source.numerical!;
    const key = `${numerical.table}:${numerical.id}_${numerical.level}:${candidate.source.prototype_mode ?? "-"}:${candidate.source.asc_type_id ?? "-"}`;
    if (!result.has(key)) result.set(key, candidate);
  }
  return [...result.values()].sort((left, right) => {
    const a = left.source.numerical!;
    const b = right.source.numerical!;
    return a.id - b.id || (left.prototypeRowName ?? "").localeCompare(right.prototypeRowName ?? "");
  });
}

function sourceProposal(
  file: WeaponFile,
  source: LegacySource,
  reader: WeaponDataSourceReader,
  numericalRows: readonly NumericalSourceRow[],
  signatures: ReadonlyMap<string, ResolvedDamageSource | undefined>,
): SourceProposal {
  let candidates = prototypeCandidates(file, source, reader, signatures);
  if (candidates.length === 0) {
    candidates = numericalRows
      .filter((row) => signatureMatches(source, signatures.get(row.key)))
      .map((row): SourceCandidate => ({
        scope: "table_signature",
        signatureMatch: true,
        titleMatch:
          localizedText(row.raw.Description).includes(String(file.data.title ?? file.slug)) ||
          localizedText(row.raw.Description).includes(source.name),
        source: { numerical: numericalReference(row)! },
      }));
    const titleMatches = candidates.filter((candidate) => candidate.titleMatch);
    if (titleMatches.length === 1) candidates = titleMatches;
    candidates = dedupeCandidates(candidates);
  }
  return {
    locator: source.locator,
    locator_key: source.locatorKey,
    name: source.name,
    proposed_id: source.proposedId,
    proposed_section: source.proposedSection,
    candidates,
    ...(candidates.length === 1
      ? { proposed: candidates[0] }
      : { issue: candidates.length === 0 ? "NO_CANDIDATE" : "AMBIGUOUS_CANDIDATE" }),
  };
}

function itemProposal(file: WeaponFile, reader: WeaponDataSourceReader) {
  const prototypeId = positiveId(file.data.prototype_id);
  if (!prototypeId) return { candidates: [], matches: [] };
  const candidates = reader.findItemsByPrototypeId(prototypeId);
  const rarityMap: Record<number, unknown> = { 2: "稀有", 3: "史诗", 4: "传说" };
  const matches = candidates.filter((item) => {
    const checks: boolean[] = [];
    if (typeof file.data.accuracy === "number") checks.push(item.raw.AccuracyInt === file.data.accuracy);
    if (typeof file.data.stability === "number") checks.push(item.raw.StabilityInt === file.data.stability);
    if (typeof file.data.rarity === "string") checks.push(rarityMap[Number(item.raw.Quality)] === file.data.rarity);
    if (typeof file.data.scope === "string") checks.push(localizedText(item.raw.Weapon_Scope) === file.data.scope);
    if (typeof file.data.weapon_type_id === "number") checks.push(item.raw.WeaponType === file.data.weapon_type_id);
    if (typeof file.data.weapon_type === "string" && typeof item.raw.WeaponType === "number") {
      checks.push(WEAPON_TYPE_ID_MAP[item.raw.WeaponType] === file.data.weapon_type);
    }
    return checks.length > 0 && checks.every(Boolean);
  });
  return {
    candidates: candidates.map((candidate) => candidate.rowName),
    matches: matches.map((candidate) => candidate.rowName),
    proposed: matches.length === 1 ? matches[0].rowName : undefined,
  };
}

function skillProposal(file: WeaponFile, reader: WeaponDataSourceReader) {
  const prototypeId = positiveId(file.data.prototype_id);
  const activeSkillId = file.data.active_skill_id;
  if (!prototypeId || typeof activeSkillId !== "number" || !Number.isSafeInteger(activeSkillId)) {
    return { issue: "INVALID_SKILL_ID" };
  }
  try {
    const rowName = selectWeaponPrototypeRowName(
      reader,
      prototypeId,
      0,
      String(file.data.title ?? file.slug),
    );
    const prototype = reader.getPrototype({ prototypeId, mode: 0, rowName });
    const prototypeSkillId = prototype.raw.ActiveSkillID;
    if (activeSkillId === 0) {
      return {
        active_skill_id: 0,
        prototype_active_skill_id: prototypeSkillId,
        issue: prototypeSkillId === 0 ? undefined : "SKILL_ID_MISMATCH",
      };
    }
    const charge = resolveActiveSkillCharge(reader, { skillId: activeSkillId });
    return {
      active_skill_id: activeSkillId,
      prototype_active_skill_id: prototypeSkillId,
      source: charge.source,
      source_key: charge.sourceKey,
      charge_time: charge.chargeTime,
      charge_count: charge.chargeCount,
      issue: prototypeSkillId === activeSkillId ? undefined : "SKILL_ID_MISMATCH",
    };
  } catch (error) {
    return { active_skill_id: activeSkillId, issue: String(error) };
  }
}

const v2TopLevelKeys = new Set([
  "title",
  "nickname",
  "keywords",
  "tag",
  "toc",
  "page-width",
  "draft",
  "prototype_id",
  "item_id",
  "use_type",
  "weapon_type",
  "element",
  "rarity",
  "tags",
  "scope",
  "game_mode",
  "magazine",
  "total_ammo",
  "accuracy",
  "stability",
  "changeClip",
  "range",
  "explosion_range",
  "attenuation_begin",
  "attenuation_end",
  "attenuation_scale",
  "skill_cooldown",
  "skill_duration",
  "skill_blocking",
  "show_duration",
  "shooting_energy",
  "shooting_energy_count",
  "weapon_type_id",
  "active_skill_id",
]);

const nonNegativeNumberKeys = new Set([
  "magazine",
  "total_ammo",
  "accuracy",
  "stability",
  "range",
  "explosion_range",
  "attenuation_begin",
  "attenuation_end",
  "attenuation_scale",
  "skill_cooldown",
  "skill_duration",
  "weapon_type_id",
  "active_skill_id",
]);

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function tableDecisionFor(
  decisions: MigrationDecisions,
  file: WeaponFile,
): { weapon: z.infer<typeof weaponDecisionSchema>; table: TableDecision } | undefined {
  const title = String(file.data.title ?? file.slug);
  const weapon = decisions.weapons[title];
  const table = weapon?.tables[file.table];
  return weapon && table ? { weapon, table } : undefined;
}

function sourceIdentityByLocator(
  weapon: z.infer<typeof weaponDecisionSchema>,
  source: LegacySource,
  table: NumericalTable,
) {
  const matches = Object.entries(weapon.sources).filter(([, identity]) =>
    identity.table_scope.includes(table) &&
    locatorKey(identity.locator) === source.locatorKey,
  );
  if (matches.length !== 1) {
    throw new Error(
      `${table}:${source.locatorKey} matched ${matches.length} source identities`,
    );
  }
  return { key: matches[0][0], identity: matches[0][1] };
}

function setNestedOverride(
  target: Record<string, unknown>,
  pathSegments: readonly string[],
  value: unknown,
): void {
  let current = target;
  for (const segment of pathSegments.slice(0, -1)) {
    const child = current[segment];
    if (!child || typeof child !== "object" || Array.isArray(child)) {
      current[segment] = {};
    }
    current = current[segment] as Record<string, unknown>;
  }
  current[pathSegments.at(-1)!] = value;
}

const PRESERVE_LEGACY_REASON_PATTERN =
  /^结构迁移保留旧 MDX 直接维护的 (.+)，原表差异待独立核验$/;

export function aggregateOverrideReasons(reasons: readonly string[]): string {
  const preservedFields: string[] = [];
  const otherReasons: string[] = [];

  for (const reason of reasons) {
    const match = PRESERVE_LEGACY_REASON_PATTERN.exec(reason);
    if (match) {
      preservedFields.push(match[1]);
    } else {
      otherReasons.push(reason);
    }
  }

  const uniquePreservedFields = [...new Set(preservedFields)];
  const aggregatedReasons = uniquePreservedFields.length
    ? [
        `结构迁移保留旧 MDX 直接维护的 ${uniquePreservedFields.join(",")}，原表差异待独立核验`,
      ]
    : [];

  return [...aggregatedReasons, ...new Set(otherReasons)].join("；");
}

function preserveValue(source: ResolvedDamageSource, field: string): unknown {
  if (comparableFields.includes(field as ComparableField)) {
    const value = comparableValue(source, field as ComparableField);
    if (field === "toughness_type") {
      const map = { impulse: "冲击", penetration: "贯穿", explosion: "爆炸" } as const;
      return value ? map[value as keyof typeof map] : value;
    }
    return value;
  }
  if (field === "fire.interval") return getResolvedFieldValue(source.fire.interval);
  if (field === "fire.pellets") return getResolvedFieldValue(source.fire.pellets);
  if (field === "attenuation") {
    if (source.attenuation.status === "applicable") {
      return {
        status: "applicable",
        begin_meters: source.attenuation.beginMeters,
        end_meters: source.attenuation.endMeters,
        min_scale: source.attenuation.minScale,
      };
    }
    if (source.attenuation.status === "not_applicable") {
      return { status: "not_applicable" };
    }
  }
  return undefined;
}

function isOverrideDecision(
  decision: { action: string },
): boolean {
  return decision.action === "preserve_legacy" || decision.action === "confirmed_override";
}

function buildDamageSource(
  legacy: LegacySource,
  identityKey: string,
  identity: z.infer<typeof sourceIdentitySchema>,
  table: TableDecision,
): Record<string, unknown> {
  const source = table.sources[identityKey];
  if (!source) throw new Error(`${identityKey}: missing table source reference`);
  const output: Record<string, unknown> = {
    id: identity.id,
    name: identity.name,
    section: identity.section,
    ...(identity.inherits ? { inherits: identity.inherits } : {}),
    source: cloneJson(source),
    ...(legacy.resolved.label ? { label: legacy.resolved.label } : {}),
  };
  const decisions = table.field_decisions[identityKey] ?? {};
  const overrides: Record<string, unknown> = {};
  const reasons: string[] = [];
  for (const [field, decision] of Object.entries(decisions)) {
    if (!isOverrideDecision(decision)) continue;
    const value = decision.action === "confirmed_override"
      ? decision.value
      : preserveValue(legacy.resolved, field);
    if (value === undefined) {
      throw new Error(`${identityKey}:${field}: legacy value is not preservable`);
    }
    if (field.startsWith("damage.")) {
      setNestedOverride(overrides, ["numerical", ...field.split(".")], value);
    } else if (comparableFields.includes(field as ComparableField)) {
      setNestedOverride(overrides, ["numerical", field], value);
    } else if (field === "fire.interval") {
      if (source.asc_type_id) {
        setNestedOverride(overrides, ["asc", "fire_interval"], value);
      } else {
        output.fire_interval = value;
      }
    } else if (field === "fire.pellets") {
      output.pellets = value;
    } else if (field === "attenuation") {
      if (!source.asc_type_id) {
        throw new Error(`${identityKey}: attenuation preserve requires ASC`);
      }
      setNestedOverride(overrides, ["asc", "attenuation"], value);
    } else {
      throw new Error(`${identityKey}:${field}: unsupported preserve field`);
    }
    reasons.push(decision.reason);
  }
  if (Object.keys(overrides).length > 0) {
    output.overrides = overrides;
    output.override_reason = aggregateOverrideReasons(reasons);
  }
  return output;
}

function buildV2Data(
  file: WeaponFile,
  decisions: MigrationDecisions,
): Record<string, unknown> | undefined {
  const selected = tableDecisionFor(decisions, file);
  if (!selected) throw new Error(`${file.relativePath}: missing migration decision`);
  if (selected.table.exclude) return undefined;
  const output: Record<string, unknown> = { schema_version: 2 };
  for (const [key, value] of Object.entries(file.data)) {
    if (!v2TopLevelKeys.has(key) || value === null || value === undefined) continue;
    if (key === "prototype_id") {
      output[key] = String(value);
      continue;
    }
    if (typeof value === "string" && !value.trim()) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (
      key === "shooting_energy_count" &&
      (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0)
    ) {
      continue;
    }
    if (
      nonNegativeNumberKeys.has(key) &&
      (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    ) {
      continue;
    }
    output[key] = cloneJson(value);
  }
  if (selected.table.item_id) output.item_id = selected.table.item_id;
  else delete output.item_id;
  if (selected.table.active_skill_id !== undefined) {
    output.active_skill_id = selected.table.active_skill_id;
  }
  const sources = legacySources(file);
  output.damage_sources = sources.map((legacy) => {
    const { key, identity } = sourceIdentityByLocator(selected.weapon, legacy, file.table);
    return buildDamageSource(legacy, key, identity, selected.table);
  });
  return validateWeaponSourceV2(output, { expectedTable: file.table }) as unknown as Record<
    string,
    unknown
  >;
}

function addReaderRow(
  lock: WeaponDataLock,
  kind: keyof WeaponDataLock["rows"],
  key: string,
  rowName: string,
  raw: Readonly<Record<string, unknown>>,
): void {
  lock.rows[kind][key] = { row_name: rowName, raw: raw as Record<string, never> };
}

function lockForV2Data(
  data: Record<string, unknown>,
  table: NumericalTable,
  reader: WeaponDataSourceReader,
): WeaponDataLock {
  const weapon = validateWeaponSourceV2(data, { expectedTable: table });
  const lock = emptyLock();
  const effectiveReferences = resolveDamageSourceReferences(weapon);
  for (const source of weapon.damage_sources) {
    const effective = effectiveReferences.get(source.id)?.source;
    if (effective?.numerical) {
      const row = reader.getNumerical(effective.numerical);
      addReaderRow(lock, row.kind, row.key, row.rowName, row.raw);
    }
    if (effective?.asc_type_id) {
      const asc = reader.getAsc(effective.asc_type_id);
      addReaderRow(lock, "asc", asc.key, asc.rowName, asc.raw);
      const feelId = effective.feel_param_id ?? effective.asc_type_id;
      const feel = reader.getFeel(feelId);
      addReaderRow(lock, "feel", feel.key, feel.rowName, feel.raw);
    }
  }
  if (weapon.item_id) {
    const item = reader.getItem(weapon.item_id);
    addReaderRow(lock, "item", item.key, item.rowName, item.raw);
  }
  if (weapon.active_skill_id && weapon.active_skill_id > 0) {
    const skill = resolveActiveSkillCharge(reader, { skillId: weapon.active_skill_id });
    addReaderRow(lock, skill.row.kind, skill.row.key, skill.row.rowName, skill.row.raw);
    lock.active_skills[`${weapon.active_skill_id}_1`] = {
      source: skill.source,
      source_key: skill.sourceKey,
    };
  }
  return lock;
}

function auditBuiltLinks(
  data: Record<string, unknown>,
  table: NumericalTable,
  reader: WeaponDataSourceReader,
): void {
  const weapon = validateWeaponSourceV2(data, { expectedTable: table });
  const effectiveReferences = resolveDamageSourceReferences(weapon);
  for (const source of weapon.damage_sources) {
    const effective = effectiveReferences.get(source.id)?.source;
    if (effective?.prototype_mode === undefined || !effective.numerical) continue;
    const rowName = selectWeaponPrototypeRowName(
      reader,
      weapon.prototype_id,
      effective.prototype_mode,
      weapon.title,
    );
    reader.validatePrototypeLink({
      prototypeId: weapon.prototype_id,
      mode: effective.prototype_mode,
      rowName,
      numerical: effective.numerical,
      ascTypeId: effective.asc_type_id,
      feelParamId: effective.feel_param_id,
    });
  }
  if (weapon.active_skill_id !== undefined) {
    const rowName = selectWeaponPrototypeRowName(
      reader,
      weapon.prototype_id,
      0,
      weapon.title,
    );
    const audit = auditActiveSkillReference(reader, {
      prototypeId: weapon.prototype_id,
      prototypeRowName: rowName,
      mdxActiveSkillId: weapon.active_skill_id,
      itemId: weapon.item_id,
    });
    const errors = audit.issues.filter((issue) => issue.severity === "error");
    if (errors.length > 0) {
      throw new Error(`active skill audit failed: ${JSON.stringify(errors)}`);
    }
  }
}

function sourceFact(source: ResolvedDamageSource, field: string): unknown {
  if (comparableFields.includes(field as ComparableField)) {
    const domain = field as ComparableField;
    if (domain.startsWith("damage.")) {
      const key = domain.slice("damage.".length) as keyof ResolvedDamageSource["damage"];
      const value = source.damage[key];
      return { state: value.state, value: getResolvedFieldValue(value) };
    }
    const value =
      domain === "element"
        ? source.element
        : domain === "element_add_rate"
          ? source.elementAddRate
          : domain === "weakness_multiplier"
            ? source.weaknessMultiplier
            : domain === "enable_weakness"
              ? source.enableWeakness
              : domain === "enable_critical"
                ? source.enableCritical
                : domain === "toughness_type"
                  ? source.toughness
                  : source.ignoreShield;
    return { state: value.state, value: getResolvedFieldValue(value) };
  }
  if (field === "fire.interval") {
    return { state: source.fire.interval.state, value: getResolvedFieldValue(source.fire.interval) };
  }
  if (field === "fire.pellets") {
    return { state: source.fire.pellets.state, value: getResolvedFieldValue(source.fire.pellets) };
  }
  if (field === "attenuation") {
    return source.attenuation.status === "applicable"
      ? {
          status: "applicable",
          begin_meters: source.attenuation.beginMeters,
          end_meters: source.attenuation.endMeters,
          min_scale: source.attenuation.minScale,
        }
      : { status: source.attenuation.status };
  }
  throw new Error(`unsupported source fact ${field}`);
}

const auditedSourceFields = [
  ...comparableFields,
  "fire.interval",
  "fire.pellets",
  "attenuation",
] as const;

interface FieldGap {
  readonly source: string;
  readonly field: string;
  readonly legacy: unknown;
  readonly candidate: unknown;
  readonly legacy_direct: boolean;
}

function isLegacyFieldDirect(file: WeaponFile, source: LegacySource, field: string): boolean {
  if (comparableFields.includes(field as ComparableField)) {
    return explicitComparableFields(source).includes(field as ComparableField);
  }
  if (field === "fire.interval") {
    return (
      (typeof source.raw.fire_interval === "number" && Number.isFinite(source.raw.fire_interval)) ||
      (typeof file.data.file_rate === "number" && Number.isFinite(file.data.file_rate))
    );
  }
  if (field === "fire.pellets") {
    return typeof source.raw.pellets === "number" && Number.isFinite(source.raw.pellets);
  }
  if (field === "attenuation") {
    return ["attenuation_begin", "attenuation_end", "attenuation_scale"].some(
      (key) => file.data[key] !== undefined && file.data[key] !== null,
    );
  }
  return false;
}

function fieldGaps(
  file: WeaponFile,
  decisions: MigrationDecisions,
  reader: WeaponDataSourceReader,
): FieldGap[] {
  const selected = tableDecisionFor(decisions, file);
  if (!selected || selected.table.exclude) return [];
  const preliminary = buildV2Data(file, {
    ...decisions,
    weapons: {
      ...decisions.weapons,
      [String(file.data.title ?? file.slug)]: {
        ...selected.weapon,
        tables: {
          ...selected.weapon.tables,
          [file.table]: { ...selected.table, field_decisions: {} },
        },
      },
    },
  });
  if (!preliminary) return [];
  const candidate = resolveWeapon(preliminary, {
    slug: file.slug,
    expectedTable: file.table,
    lock: lockForV2Data(preliminary, file.table, reader),
  });
  const legacyByLocator = new Map(legacySources(file).map((source) => [source.locatorKey, source]));
  const gaps: FieldGap[] = [];
  for (const [identityKey, identity] of Object.entries(selected.weapon.sources)) {
    if (!identity.table_scope.includes(file.table)) continue;
    const old = legacyByLocator.get(locatorKey(identity.locator));
    const current = candidate.damageSources.find((source) => source.id === identity.id);
    if (!old || !current) throw new Error(`${file.relativePath}:${identityKey}: source alignment failed`);
    for (const field of auditedSourceFields) {
      const before = sourceFact(old.resolved, field);
      const after = sourceFact(current, field);
      if (!isDeepStrictEqual(before, after)) {
        gaps.push({
          source: identityKey,
          field,
          legacy: before,
          candidate: after,
          legacy_direct: isLegacyFieldDirect(file, old, field),
        });
      }
    }
  }
  return gaps;
}

interface RawDifference {
  readonly pointer: string;
  readonly operation: "add" | "remove" | "replace";
  readonly before?: unknown;
  readonly after?: unknown;
}

function escapePointer(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function diffValues(before: unknown, after: unknown, pointer = ""): RawDifference[] {
  if (isDeepStrictEqual(before, after)) return [];
  if (Array.isArray(before) && Array.isArray(after)) {
    const result: RawDifference[] = [];
    const length = Math.max(before.length, after.length);
    for (let index = 0; index < length; index += 1) {
      const child = `${pointer}/${index}`;
      if (index >= before.length) result.push({ pointer: child, operation: "add", after: after[index] });
      else if (index >= after.length) result.push({ pointer: child, operation: "remove", before: before[index] });
      else result.push(...diffValues(before[index], after[index], child));
    }
    return result;
  }
  if (
    before &&
    after &&
    typeof before === "object" &&
    typeof after === "object" &&
    !Array.isArray(before) &&
    !Array.isArray(after)
  ) {
    const left = before as Record<string, unknown>;
    const right = after as Record<string, unknown>;
    const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
    const result: RawDifference[] = [];
    for (const key of keys) {
      const child = `${pointer}/${escapePointer(key)}`;
      if (!(key in left)) result.push({ pointer: child, operation: "add", after: right[key] });
      else if (!(key in right)) result.push({ pointer: child, operation: "remove", before: left[key] });
      else result.push(...diffValues(left[key], right[key], child));
    }
    return result;
  }
  return [{ pointer: pointer || "/", operation: "replace", before, after }];
}

function remapConsumerSourceIds<T>(value: T, sourceIdMap: Record<string, string>): T {
  const clone = cloneJson(value) as unknown as Record<string, unknown>;
  const rewriteSource = (source: unknown) => {
    if (!source || typeof source !== "object" || Array.isArray(source)) return;
    const object = source as Record<string, unknown>;
    if (typeof object.id === "string") object.id = sourceIdMap[object.id] ?? object.id;
  };
  if (Array.isArray(clone.damageSources)) clone.damageSources.forEach(rewriteSource);
  if (Array.isArray(clone.meleeSources)) clone.meleeSources.forEach(rewriteSource);
  rewriteSource(clone.mainSource);
  if (typeof clone.mainSourceId === "string") {
    clone.mainSourceId = sourceIdMap[clone.mainSourceId] ?? clone.mainSourceId;
  }
  return clone as T;
}

function baselineConsumerSourceIdMap(
  detail: unknown,
  weapon: z.infer<typeof weaponDecisionSchema>,
  table: NumericalTable,
): Record<string, string> {
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) return {};
  const sources = (detail as Record<string, unknown>).damageSources;
  if (!Array.isArray(sources)) return {};
  const identities = Object.values(weapon.sources).filter((identity) =>
    identity.table_scope.includes(table),
  );
  const result: Record<string, string> = {};
  for (const source of sources) {
    if (!source || typeof source !== "object" || Array.isArray(source)) continue;
    const { id, name } = source as Record<string, unknown>;
    if (typeof id !== "string" || typeof name !== "string") continue;
    const matches = identities.filter((identity) => identity.name === name);
    if (matches.length !== 1) {
      throw new Error(
        `${table}:${name}: baseline consumer source matched ${matches.length} frozen identities`,
      );
    }
    result[id] = matches[0].id;
  }
  return result;
}

function migrationConsumerProjection(resolved: ResolvedWeapon): {
  detail: unknown;
  catalog: unknown;
} {
  const detail = toWeaponDetailData(resolved);
  const detailFields = Object.fromEntries(
    Object.entries(detail).filter(([key]) => key !== "officialRadar"),
  );
  const omittedSourceFields = new Set([
    "ammo",
    "movement",
    "feel",
    "settlements",
    "unknownSettlements",
    "attenuation",
  ]);
  const projectedDetail = {
    ...detailFields,
    damageSources: detail.damageSources.map((source) => {
      const fields = Object.fromEntries(
        Object.entries(source).filter(([key]) => !omittedSourceFields.has(key)),
      );
      return {
        ...fields,
        fire: {
          interval: source.fire.interval,
          rpm: source.fire.rpm,
          pellets: source.fire.pellets,
        },
        ...(source.id === detail.mainSourceId ? { attenuation: source.attenuation } : {}),
      };
    }),
  };
  return cloneJson({
    detail: projectedDetail,
    catalog: toWeaponCatalogEntry(resolved),
  });
}

function consumerDifferences(
  file: WeaponFile,
  decisions: MigrationDecisions,
  resolvedV2: ResolvedWeapon,
): RawDifference[] {
  const legacy = resolveWeapon(file.data, { slug: file.slug, expectedTable: file.table });
  const sourceIdMap = snapshotSourceIdMap(file, decisions) ?? {};
  const legacyProjection = migrationConsumerProjection(legacy);
  const currentProjection = migrationConsumerProjection(resolvedV2);
  const before = canonicalize({
    detail: remapConsumerSourceIds(legacyProjection.detail, sourceIdMap),
    catalog: remapConsumerSourceIds(legacyProjection.catalog, sourceIdMap),
  });
  const after = canonicalize(currentProjection);
  return diffValues(before, after);
}

export function renderMigratedMdx(
  rawText: string,
  data: Record<string, unknown>,
  relativePath = "<memory>",
): string {
  const source = splitMdxDocument(rawText);
  const document = parseDocument(source.frontmatterText);
  if (!document.contents || typeof document.contents !== "object") {
    throw new Error(`${relativePath}: invalid YAML document`);
  }
  const current = document.toJS() as Record<string, unknown>;
  for (const key of Object.keys(current)) {
    if (!(key in data)) document.delete(key);
  }
  for (const [key, value] of Object.entries(data)) document.set(key, value);
  return `---\n${document.toString({ lineWidth: 0 })}---\n${source.body}`;
}

function renderV2Mdx(file: WeaponFile, data: Record<string, unknown>): string {
  return renderMigratedMdx(file.rawText, data, file.relativePath);
}

export function auditMigrationDecisions(options: {
  root?: string;
  contentRoot?: string;
  decisionsPath?: string;
} = {}): Record<string, unknown> {
  const root = path.resolve(options.root ?? ROOT);
  const contentRoot = path.resolve(
    options.contentRoot ?? path.join(root, "refs", "Exports", "NZM", "Content"),
  );
  const decisions = readMigrationDecisions(options.decisionsPath);
  const reader = createWeaponDataSourceReader({ contentRoot });
  const tables: Record<NumericalTable, unknown[]> = { lc: [], td: [] };
  for (const file of scanWeaponFiles(root)) {
    if (file.data.schema_version === 2) continue;
    const selected = tableDecisionFor(decisions, file);
    if (!selected) {
      tables[file.table].push({ title: file.data.title, status: "missing_decision" });
      continue;
    }
    if (selected.table.exclude) {
      tables[file.table].push({
        title: file.data.title,
        status: "excluded",
        exclusion: selected.table.exclude,
      });
      continue;
    }
    try {
      const gaps = fieldGaps(file, decisions, reader);
      const decided = selected.table.field_decisions;
      const unresolved = gaps.filter((gap) => !decided[gap.source]?.[gap.field]);
      const stale = Object.entries(decided).flatMap(([source, fields]) =>
        Object.keys(fields)
          .filter((field) => !gaps.some((gap) => gap.source === source && gap.field === field))
          .map((field) => `${source}:${field}`),
      );
      const data = buildV2Data(file, decisions)!;
      auditBuiltLinks(data, table, reader);
      const resolved = resolveWeapon(data, {
        slug: file.slug,
        expectedTable: file.table,
        lock: lockForV2Data(data, file.table, reader),
      });
      const snapshotGaps = consumerDifferences(file, decisions, resolved);
      const allowedPointers = new Set(
        selected.table.snapshot_differences.map((difference) => difference.pointer),
      );
      const unresolvedSnapshot = snapshotGaps.filter(
        (difference) => !allowedPointers.has(difference.pointer),
      );
      const staleSnapshot = selected.table.snapshot_differences
        .map((difference) => difference.pointer)
        .filter((pointer) => !snapshotGaps.some((difference) => difference.pointer === pointer));
      tables[file.table].push({
        title: file.data.title,
        status:
          unresolved.length === 0 &&
          stale.length === 0 &&
          unresolvedSnapshot.length === 0 &&
          staleSnapshot.length === 0
            ? "ready"
            : "decision_required",
        gaps,
        unresolved,
        stale_decisions: stale,
        snapshot_gaps: snapshotGaps,
        unresolved_snapshot: unresolvedSnapshot,
        stale_snapshot_decisions: staleSnapshot,
      });
    } catch (error) {
      tables[file.table].push({
        title: file.data.title,
        status: "decision_required",
        error: String(error),
      });
    }
  }
  return { schema_version: 1, tables };
}

function migratedDecisionIssues(
  file: WeaponFile,
  selected: { weapon: z.infer<typeof weaponDecisionSchema>; table: TableDecision },
): string[] {
  const issues: string[] = [];
  const weapon = validateWeaponSourceV2(file.data, { expectedTable: file.table });
  const expectedIds = new Set<string>();
  for (const [key, source] of Object.entries(selected.table.sources)) {
    const identity = selected.weapon.sources[key];
    if (!identity || !identity.table_scope.includes(file.table)) {
      issues.push(`${key}: table source has no matching frozen identity`);
      continue;
    }
    expectedIds.add(identity.id);
    const actual = weapon.damage_sources.find((candidate) => candidate.id === identity.id);
    if (!actual) {
      issues.push(`${key}: missing migrated source ${identity.id}`);
      continue;
    }
    if (actual.name !== identity.name) issues.push(`${key}: source name differs from decision`);
    if (actual.section !== identity.section) issues.push(`${key}: source section differs from decision`);
    if (actual.inherits !== identity.inherits) issues.push(`${key}: source inheritance differs from decision`);
    if (!isDeepStrictEqual(canonicalize(actual.source), canonicalize(source))) {
      issues.push(`${key}: explicit source reference differs from decision`);
    }
    const fieldDecisions = selected.table.field_decisions[key] ?? {};
    const expectedOverridePaths = new Set<string>();
    const preserveReasons: string[] = [];
    const overridePath = (field: string): readonly string[] | undefined => {
      if (field.startsWith("damage.")) return ["numerical", ...field.split(".")];
      if (comparableFields.includes(field as ComparableField)) return ["numerical", field];
      if (field === "fire.interval") return ["asc", "fire_interval"];
      if (field === "attenuation") return ["asc", "attenuation"];
      return undefined;
    };
    const hasPath = (value: unknown, pathSegments: readonly string[]): boolean => {
      let current = value;
      for (const segment of pathSegments) {
        if (!current || typeof current !== "object" || Array.isArray(current)) return false;
        const object = current as Record<string, unknown>;
        if (!(segment in object)) return false;
        current = object[segment];
      }
      return true;
    };
    for (const [field, decision] of Object.entries(fieldDecisions)) {
      if (isOverrideDecision(decision)) preserveReasons.push(decision.reason);
      const pathSegments = overridePath(field);
      if (pathSegments) {
        const pathKey = pathSegments.join(".");
        if (isOverrideDecision(decision)) expectedOverridePaths.add(pathKey);
        if (hasPath(actual.overrides, pathSegments) !== isOverrideDecision(decision)) {
          issues.push(`${key}:${field}: override presence differs from decision action`);
        }
      } else if (field === "fire.interval") {
        if ((actual.fire_interval !== undefined) !== isOverrideDecision(decision)) {
          issues.push(`${key}:${field}: compatibility field presence differs from decision action`);
        }
      } else if (field === "fire.pellets") {
        if ((actual.pellets !== undefined) !== isOverrideDecision(decision)) {
          issues.push(`${key}:${field}: compatibility field presence differs from decision action`);
        }
      }
    }
    for (const field of auditedSourceFields) {
      const pathSegments = overridePath(field);
      if (
        pathSegments &&
        hasPath(actual.overrides, pathSegments) &&
        !expectedOverridePaths.has(pathSegments.join("."))
      ) {
        issues.push(`${key}:${field}: override has no reviewed override decision`);
      }
    }
    if (
      actual.fire_interval !== undefined &&
      !fieldDecisions["fire.interval"]?.action?.match(/^(preserve_legacy|confirmed_override)$/)
    ) {
      issues.push(`${key}:fire.interval: compatibility field has no reviewed override decision`);
    }
    if (
      actual.pellets !== undefined &&
      !fieldDecisions["fire.pellets"]?.action?.match(/^(preserve_legacy|confirmed_override)$/)
    ) {
      issues.push(`${key}:fire.pellets: compatibility field has no reviewed override decision`);
    }
    const expectedReason =
      expectedOverridePaths.size > 0 ? aggregateOverrideReasons(preserveReasons) : undefined;
    if (actual.override_reason !== expectedReason) {
      issues.push(`${key}: override_reason differs from reviewed override decisions`);
    }
  }
  for (const source of weapon.damage_sources) {
    if (!expectedIds.has(source.id)) issues.push(`${source.id}: migrated source is absent from decision`);
  }
  if (weapon.item_id !== selected.table.item_id) issues.push("item_id differs from decision");
  if (weapon.active_skill_id !== selected.table.active_skill_id) {
    issues.push("active_skill_id differs from decision");
  }
  return issues;
}

export function checkMigrationCoverage(options: {
  root?: string;
  decisionsPath?: string;
} = {}): Record<NumericalTable, Readonly<Record<string, number>>> {
  const root = path.resolve(options.root ?? ROOT);
  const decisions = readMigrationDecisions(options.decisionsPath);
  const files = scanWeaponFiles(root);
  const fileKeys = new Set(
    files.map((file) => `${file.table}:${String(file.data.title ?? file.slug)}`),
  );
  const issues: string[] = [];
  const summary: Record<NumericalTable, Record<string, number>> = {
    lc: { total: 0, migrated: 0, preexisting_v2: 0, excluded: 0 },
    td: { total: 0, migrated: 0, preexisting_v2: 0, excluded: 0 },
  };
  for (const file of files) {
    const selected = tableDecisionFor(decisions, file);
    summary[file.table].total += 1;
    if (file.data.schema_version === 2) {
      if (selected?.table.exclude) {
        issues.push(`${file.relativePath}: migrated V2 file is still marked excluded`);
      } else if (selected) {
        summary[file.table].migrated += 1;
        for (const issue of migratedDecisionIssues(file, selected)) {
          issues.push(`${file.relativePath}: ${issue}`);
        }
      } else {
        summary[file.table].preexisting_v2 += 1;
      }
    } else if (selected?.table.exclude) {
      summary[file.table].excluded += 1;
    } else {
      issues.push(`${file.relativePath}: remaining V1 file has no exclusion decision`);
    }
  }
  for (const [title, weapon] of Object.entries(decisions.weapons)) {
    for (const table of ["lc", "td"] as const) {
      if (weapon.tables[table] && !fileKeys.has(`${table}:${title}`)) {
        issues.push(`${table}:${title}: decision has no matching MDX file`);
      }
    }
  }
  if (issues.length > 0) {
    throw new Error(`migration coverage check failed:\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
  }
  return summary;
}

export function applyMigrationTable(
  table: NumericalTable,
  options: { root?: string; contentRoot?: string; decisionsPath?: string } = {},
): void {
  const root = path.resolve(options.root ?? ROOT);
  const contentRoot = path.resolve(
    options.contentRoot ?? path.join(root, "refs", "Exports", "NZM", "Content"),
  );
  const decisions = readMigrationDecisions(options.decisionsPath);
  const reader = createWeaponDataSourceReader({ contentRoot });
  const rendered: { file: WeaponFile; text: string }[] = [];
  const issues: string[] = [];
  for (const file of scanWeaponFiles(root).filter((candidate) => candidate.table === table)) {
    const selected = tableDecisionFor(decisions, file);
    if (file.data.schema_version === 2) {
      if (selected && !selected.table.exclude) {
        for (const issue of migratedDecisionIssues(file, selected)) {
          issues.push(`${file.relativePath}: ${issue}`);
        }
      }
      continue;
    }
    if (!selected) {
      issues.push(`${file.relativePath}: missing decision`);
      continue;
    }
    if (selected.table.exclude) continue;
    try {
      const gaps = fieldGaps(file, decisions, reader);
      const unresolved = gaps.filter(
        (gap) => !selected.table.field_decisions[gap.source]?.[gap.field],
      );
      if (unresolved.length > 0) {
        issues.push(`${file.relativePath}: ${unresolved.length} unresolved field differences`);
        continue;
      }
      const data = buildV2Data(file, decisions)!;
      const resolved = resolveWeapon(data, {
        slug: file.slug,
        expectedTable: table,
        lock: lockForV2Data(data, table, reader),
      });
      const snapshotGaps = consumerDifferences(file, decisions, resolved);
      const allowed = new Set(
        selected.table.snapshot_differences.map((difference) => difference.pointer),
      );
      const unresolvedSnapshot = snapshotGaps.filter(
        (difference) => !allowed.has(difference.pointer),
      );
      const staleSnapshot = selected.table.snapshot_differences.filter(
        (difference) => !snapshotGaps.some((gap) => gap.pointer === difference.pointer),
      );
      if (unresolvedSnapshot.length > 0 || staleSnapshot.length > 0) {
        issues.push(
          `${file.relativePath}: ${unresolvedSnapshot.length} unresolved and ${staleSnapshot.length} stale consumer differences`,
        );
        continue;
      }
      rendered.push({ file, text: renderV2Mdx(file, data) });
    } catch (error) {
      issues.push(`${file.relativePath}: ${String(error)}`);
    }
  }
  if (issues.length > 0) {
    throw new Error(`migration apply failed:\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
  }
  for (const entry of rendered) {
    if (entry.text === entry.file.rawText) continue;
    const temporary = `${entry.file.absolutePath}.task7.tmp`;
    writeFileSync(temporary, entry.text, "utf8");
    renameSync(temporary, entry.file.absolutePath);
  }
}

interface MigrationSnapshotEntry {
  readonly resolver: ResolvedWeaponSnapshot;
  readonly detail: unknown;
  readonly catalog: unknown;
}

interface MigrationSnapshotFile {
  readonly schema_version: 1;
  readonly baseline: Readonly<Record<string, MigrationSnapshotEntry>>;
  readonly after?: Readonly<Record<string, MigrationSnapshotEntry>>;
  readonly differences?: Readonly<Record<string, readonly SnapshotDifference[]>>;
}

interface SnapshotDifference {
  readonly pointer: string;
  readonly operation: "add" | "remove" | "replace";
  readonly before?: unknown;
  readonly after?: unknown;
  readonly classification: "structural" | "source_difference" | "accepted_correction";
  readonly reason: string;
}

export interface MigrationConsumerDifference {
  readonly pointer: string;
  readonly operation: "add" | "remove" | "replace";
  readonly before?: unknown;
  readonly after?: unknown;
}

function snapshotSourceIdMap(
  file: WeaponFile,
  decisions: MigrationDecisions,
): Record<string, string> | undefined {
  if (file.data.schema_version === 2) return undefined;
  const selected = tableDecisionFor(decisions, file);
  if (!selected || selected.table.exclude) return undefined;
  return Object.fromEntries(
    legacySources(file).map((legacy) => {
      const { identity } = sourceIdentityByLocator(selected.weapon, legacy, file.table);
      return [legacy.resolved.id, identity.id];
    }),
  );
}

function captureCurrentSnapshots(
  root: string,
  decisions: MigrationDecisions,
): Record<string, MigrationSnapshotEntry> {
  const lock = readWeaponDataLock(path.join(root, "data", "weapon-data-lock.json"));
  const result: Record<string, MigrationSnapshotEntry> = {};
  for (const file of scanWeaponFiles(root)) {
    const v2 = file.data.schema_version === 2;
    const resolved = resolveWeapon(file.data, {
      slug: file.slug,
      expectedTable: file.table,
      ...(v2 ? { lock } : {}),
    });
    result[`${file.table}:${String(file.data.title ?? file.slug)}`] = {
      resolver: createResolvedWeaponSnapshot(resolved, {
        sourceIdMap: snapshotSourceIdMap(file, decisions),
      }),
      ...migrationConsumerProjection(resolved),
    };
  }
  return result;
}

export function captureMigrationBaseline(options: {
  root?: string;
  decisionsPath?: string;
  outputPath?: string;
} = {}): void {
  const root = path.resolve(options.root ?? ROOT);
  const outputPath = path.resolve(options.outputPath ?? DEFAULT_MIGRATION_SNAPSHOT_PATH);
  if (existsSync(outputPath)) {
    throw new Error(`migration baseline already exists and cannot be overwritten: ${outputPath}`);
  }
  const decisions = readMigrationDecisions(options.decisionsPath);
  const value: MigrationSnapshotFile = {
    schema_version: 1,
    baseline: captureCurrentSnapshots(root, decisions),
  };
  writeFileSync(outputPath, serialize(value), "utf8");
}

function collectResolverTrace(
  value: unknown,
  pointer = "",
  output: Record<string, unknown> = {},
): Record<string, unknown> {
  if (Array.isArray(value)) {
    value.forEach((child, index) => collectResolverTrace(child, `${pointer}/${index}`, output));
    return output;
  }
  if (!value || typeof value !== "object") return output;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const childPointer = `${pointer}/${escapePointer(key)}`;
    if (
      [
        "schemaVersion",
        "provenance",
        "overrideHistory",
        "settlements",
        "unknownSettlements",
        "diagnostics",
      ].includes(key)
    ) {
      output[childPointer] = canonicalize(child);
    } else {
      collectResolverTrace(child, childPointer, output);
    }
  }
  return output;
}

function traceDifferences(
  before: ResolvedWeaponSnapshot,
  after: ResolvedWeaponSnapshot,
): SnapshotDifference[] {
  const left = collectResolverTrace(before.weapon);
  const right = collectResolverTrace(after.weapon);
  const paths = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
  const differences: SnapshotDifference[] = [];
  for (const pointer of paths) {
    if (isDeepStrictEqual(left[pointer], right[pointer])) continue;
    differences.push({
      pointer: `/resolver-trace${pointer}`,
      operation: !(pointer in left) ? "add" : !(pointer in right) ? "remove" : "replace",
      ...(pointer in left ? { before: left[pointer] } : {}),
      ...(pointer in right ? { after: right[pointer] } : {}),
      classification: "structural",
      reason: "V1/V2 Resolver trace path explicitly limited to provenance, overrides, Settlements or diagnostics",
    });
  }
  return differences;
}

function collectConsumerSnapshotDifferences(
  baseline: Readonly<Record<string, MigrationSnapshotEntry>>,
  after: Readonly<Record<string, MigrationSnapshotEntry>>,
  decisions: MigrationDecisions,
): {
  readonly differences: Readonly<Record<string, readonly MigrationConsumerDifference[]>>;
  readonly issues: readonly string[];
} {
  const result: Record<string, readonly MigrationConsumerDifference[]> = {};
  const issues: string[] = [];
  for (const key of [...new Set([...Object.keys(baseline), ...Object.keys(after)])].sort()) {
    const before = baseline[key];
    const current = after[key];
    if (!before || !current) {
      issues.push(`${key}: weapon snapshot was added or removed`);
      continue;
    }
    const separator = key.indexOf(":");
    const table = key.slice(0, separator) as NumericalTable;
    const title = key.slice(separator + 1);
    const weaponDecision = decisions.weapons[title];
    const tableDecision = weaponDecision?.tables[table];
    const sourceIdMap =
      weaponDecision && tableDecision && !tableDecision.exclude
        ? baselineConsumerSourceIdMap(before.detail, weaponDecision, table)
        : {};
    result[key] = diffValues(
      {
        detail: remapConsumerSourceIds(before.detail, sourceIdMap),
        catalog: remapConsumerSourceIds(before.catalog, sourceIdMap),
      },
      { detail: current.detail, catalog: current.catalog },
    );
  }
  return { differences: result, issues };
}

export function currentMigrationConsumerDifferences(options: {
  root?: string;
  decisionsPath?: string;
  snapshotPath?: string;
} = {}): Readonly<Record<string, readonly MigrationConsumerDifference[]>> {
  const root = path.resolve(options.root ?? ROOT);
  const snapshotPath = path.resolve(options.snapshotPath ?? DEFAULT_MIGRATION_SNAPSHOT_PATH);
  const decisions = readMigrationDecisions(options.decisionsPath);
  const saved = JSON.parse(readFileSync(snapshotPath, "utf8")) as MigrationSnapshotFile;
  const collected = collectConsumerSnapshotDifferences(
    saved.baseline,
    captureCurrentSnapshots(root, decisions),
    decisions,
  );
  if (collected.issues.length > 0) {
    throw new Error(
      `migration snapshot comparison failed:\n${collected.issues.map((issue) => `- ${issue}`).join("\n")}`,
    );
  }
  return collected.differences;
}

export function reviewedSnapshotDifferences(
  baseline: Readonly<Record<string, MigrationSnapshotEntry>>,
  after: Readonly<Record<string, MigrationSnapshotEntry>>,
  decisions: MigrationDecisions,
): Record<string, readonly SnapshotDifference[]> {
  const result: Record<string, readonly SnapshotDifference[]> = {};
  const collected = collectConsumerSnapshotDifferences(baseline, after, decisions);
  const issues = [...collected.issues];
  for (const key of [...new Set([...Object.keys(baseline), ...Object.keys(after)])].sort()) {
    const before = baseline[key];
    const current = after[key];
    if (!before || !current) continue;
    const separator = key.indexOf(":");
    const table = key.slice(0, separator) as NumericalTable;
    const title = key.slice(separator + 1);
    const weaponDecision = decisions.weapons[title];
    const tableDecision = weaponDecision?.tables[table];
    const consumer = collected.differences[key] ?? [];
    const approved = new Map(
      (tableDecision?.snapshot_differences ?? []).map((difference) => [
        difference.pointer,
        difference,
      ]),
    );
    const consumerDifferences: SnapshotDifference[] = [];
    for (const difference of consumer) {
      const decision = approved.get(difference.pointer);
      if (!decision) {
        issues.push(`${key}: unapproved consumer difference ${difference.pointer}`);
        continue;
      }
      consumerDifferences.push({ ...difference, ...decision });
    }
    for (const pointer of approved.keys()) {
      if (!consumer.some((difference) => difference.pointer === pointer)) {
        issues.push(`${key}: stale consumer difference decision ${pointer}`);
      }
    }
    result[key] = Object.freeze([
      ...consumerDifferences,
      ...traceDifferences(before.resolver, current.resolver),
    ]);
  }
  if (issues.length > 0) {
    throw new Error(`migration snapshot review failed:\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
  }
  return result;
}

function calculateMigrationSnapshotFile(
  inputPath: string,
  root: string,
  decisions: MigrationDecisions,
): MigrationSnapshotFile {
  const saved = JSON.parse(readFileSync(inputPath, "utf8")) as MigrationSnapshotFile;
  const after = captureCurrentSnapshots(root, decisions);
  return {
    schema_version: 1,
    baseline: saved.baseline,
    after,
    differences: reviewedSnapshotDifferences(saved.baseline, after, decisions),
  };
}

export function refreshMigrationSnapshots(options: {
  root?: string;
  decisionsPath?: string;
  snapshotPath?: string;
} = {}): void {
  const root = path.resolve(options.root ?? ROOT);
  const snapshotPath = path.resolve(options.snapshotPath ?? DEFAULT_MIGRATION_SNAPSHOT_PATH);
  const decisions = readMigrationDecisions(options.decisionsPath);
  const value = calculateMigrationSnapshotFile(snapshotPath, root, decisions);
  writeFileSync(snapshotPath, serialize(value), "utf8");
}

export function checkMigrationSnapshots(options: {
  root?: string;
  decisionsPath?: string;
  snapshotPath?: string;
} = {}): void {
  const root = path.resolve(options.root ?? ROOT);
  const snapshotPath = path.resolve(options.snapshotPath ?? DEFAULT_MIGRATION_SNAPSHOT_PATH);
  const decisions = readMigrationDecisions(options.decisionsPath);
  const saved = JSON.parse(readFileSync(snapshotPath, "utf8")) as MigrationSnapshotFile;
  if (!saved.after || !saved.differences) {
    throw new Error("migration snapshot file has no reviewed after state");
  }
  const current = calculateMigrationSnapshotFile(snapshotPath, root, decisions);
  if (!isDeepStrictEqual(canonicalize(saved.after), canonicalize(current.after))) {
    throw new Error("current migration after snapshots differ from the reviewed snapshots");
  }
  if (!isDeepStrictEqual(canonicalize(saved.differences), canonicalize(current.differences))) {
    throw new Error("current migration differences differ from the reviewed classifications");
  }
}

function sourceHashes(contentRoot: string) {
  return Object.fromEntries(
    Object.entries(WEAPON_DATA_SOURCE_FILES).map(([kind, source_path]) => {
      const bytes = readFileSync(path.join(contentRoot, source_path));
      return [kind, { source_path, sha256: createHash("sha256").update(bytes).digest("hex") }];
    }),
  );
}

function normalizedTableSources(table: TableDecision | undefined): unknown {
  if (!table) return undefined;
  return canonicalize(
    Object.fromEntries(
      Object.entries(table.sources).map(([key, source]) => [
        key,
        {
          ...source,
          ...(source.numerical
            ? { numerical: { ...source.numerical, table: "<table>" } }
            : {}),
        },
      ]),
    ),
  );
}

export interface GenerateFinalMigrationReportOptions {
  readonly root?: string;
  readonly contentRoot?: string;
  readonly decisionsPath?: string;
  readonly outputPath?: string;
}

export interface CheckFinalMigrationReportOptions {
  readonly root?: string;
  readonly decisionsPath?: string;
  readonly reportPath?: string;
}

function reportRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`migration report ${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function reportArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`migration report ${label} must be an array`);
  return value;
}

function reportString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`migration report ${label} must be a nonempty string`);
  }
  return value;
}

function reportEntryKey(value: unknown, label: string): string {
  const entry = reportRecord(value, label);
  const table = reportString(entry.table, `${label}.table`);
  if (table !== "lc" && table !== "td") {
    throw new Error(`migration report ${label}.table must be lc or td`);
  }
  return `${table}:${reportString(entry.title, `${label}.title`)}`;
}

export function checkFinalMigrationReport(
  options: CheckFinalMigrationReportOptions = {},
): void {
  const root = path.resolve(options.root ?? ROOT);
  const decisionsPath = path.resolve(options.decisionsPath ?? DEFAULT_MIGRATION_DECISIONS_PATH);
  const reportPath = path.resolve(options.reportPath ?? DEFAULT_MIGRATION_REPORT_PATH);
  const decisions = readMigrationDecisions(decisionsPath);
  const report = reportRecord(JSON.parse(readFileSync(reportPath, "utf8")), "root");
  const issues: string[] = [];

  const manifest = reportRecord(report.decision_manifest, "decision_manifest");
  const expectedDecisionPath = path.relative(root, decisionsPath).replaceAll("\\", "/");
  const expectedDecisionHash = createHash("sha256")
    .update(readFileSync(decisionsPath))
    .digest("hex");
  if (manifest.path !== expectedDecisionPath) issues.push("decision manifest path is stale");
  if (manifest.sha256 !== expectedDecisionHash) issues.push("decision manifest SHA-256 is stale");

  const expectedCoverage = checkMigrationCoverage({ root, decisionsPath });
  if (!isDeepStrictEqual(canonicalize(report.coverage), canonicalize(expectedCoverage))) {
    issues.push("coverage differs from current MDX and decisions");
  }

  const files = scanWeaponFiles(root);
  const exclusions = reportRecord(report.exclusions, "exclusions");
  const expectedExclusions = new Map<string, NonNullable<TableDecision["exclude"]>>();
  for (const file of files) {
    const selected = tableDecisionFor(decisions, file);
    if (file.data.schema_version !== 2 && selected?.table.exclude) {
      expectedExclusions.set(
        `${file.table}:${String(file.data.title ?? file.slug)}`,
        selected.table.exclude,
      );
    }
  }
  const actualExclusions = new Map<string, Record<string, unknown>>();
  for (const table of ["lc", "td"] as const) {
    for (const [index, value] of reportArray(exclusions[table], `exclusions.${table}`).entries()) {
      const entry = reportRecord(value, `exclusions.${table}[${index}]`);
      const title = reportString(entry.title, `exclusions.${table}[${index}].title`);
      const key = `${table}:${title}`;
      if (actualExclusions.has(key)) issues.push(`${key}: duplicate exclusion report entry`);
      actualExclusions.set(key, entry);
    }
  }
  for (const [key, expected] of expectedExclusions) {
    const actual = actualExclusions.get(key);
    if (!actual) {
      issues.push(`${key}: missing exclusion report entry`);
      continue;
    }
    for (const field of ["code", "reason", "owner"] as const) {
      if (actual[field] !== expected[field]) issues.push(`${key}: exclusion ${field} is stale`);
    }
    if (expected.owner === "source_mapping") {
      try {
        const review = reportRecord(actual.review, `${key}.review`);
        const sources = reportArray(review.sources, `${key}.review.sources`);
        if (sources.length === 0) throw new Error(`${key}.review.sources must not be empty`);
        for (const [index, sourceValue] of sources.entries()) {
          const source = reportRecord(sourceValue, `${key}.review.sources[${index}]`);
          reportString(source.locator_key, `${key}.review.sources[${index}].locator_key`);
          reportString(source.name, `${key}.review.sources[${index}].name`);
          reportString(source.issue, `${key}.review.sources[${index}].issue`);
          const candidates = reportArray(
            source.candidates,
            `${key}.review.sources[${index}].candidates`,
          );
          if (source.candidate_count !== candidates.length) {
            throw new Error(`${key}.review.sources[${index}].candidate_count is stale`);
          }
        }
      } catch (error) {
        issues.push(error instanceof Error ? error.message : `${key}: invalid source review`);
      }
    }
  }
  for (const key of actualExclusions.keys()) {
    if (!expectedExclusions.has(key)) issues.push(`${key}: stale exclusion report entry`);
  }

  const itemReview = reportRecord(report.item_review, "item_review");
  const scannedValues = reportArray(itemReview.scanned_without_item_id, "item_review.scanned_without_item_id");
  const unselectedValues = reportArray(
    itemReview.unselected_candidates,
    "item_review.unselected_candidates",
  );
  const scanned = new Map<string, Record<string, unknown>>();
  for (const [index, value] of scannedValues.entries()) {
    const entry = reportRecord(value, `item_review.scanned_without_item_id[${index}]`);
    const key = reportEntryKey(entry, `item_review.scanned_without_item_id[${index}]`);
    if (scanned.has(key)) issues.push(`${key}: duplicate Item scan entry`);
    scanned.set(key, entry);
  }
  const expectedItemScans = new Map(
    files.flatMap((file) => {
      if (file.data.schema_version !== 2 || file.data.item_id) return [];
      const prototypeId = positiveId(file.data.prototype_id);
      return prototypeId
        ? [[`${file.table}:${String(file.data.title ?? file.slug)}`, prototypeId] as const]
        : [];
    }),
  );
  for (const [key, prototypeId] of expectedItemScans) {
    const entry = scanned.get(key);
    if (!entry) issues.push(`${key}: missing Item scan entry`);
    else if (entry.prototype_id !== prototypeId) issues.push(`${key}: Item scan prototype_id is stale`);
  }
  for (const key of scanned.keys()) {
    if (!expectedItemScans.has(key)) issues.push(`${key}: stale Item scan entry`);
  }

  const expectedUnselected = new Map<string, Record<string, unknown>>();
  for (const [key, entry] of scanned) {
    try {
      const candidates = reportArray(entry.candidates, `${key}.candidates`);
      reportString(entry.owner, `${key}.owner`);
      reportString(entry.reason, `${key}.reason`);
      if (candidates.length > 0) expectedUnselected.set(key, entry);
    } catch (error) {
      issues.push(error instanceof Error ? error.message : `${key}: invalid Item scan entry`);
    }
  }
  const actualUnselected = new Map<string, Record<string, unknown>>();
  for (const [index, value] of unselectedValues.entries()) {
    const entry = reportRecord(value, `item_review.unselected_candidates[${index}]`);
    const key = reportEntryKey(entry, `item_review.unselected_candidates[${index}]`);
    if (actualUnselected.has(key)) issues.push(`${key}: duplicate unselected Item entry`);
    actualUnselected.set(key, entry);
  }
  for (const [key, expected] of expectedUnselected) {
    const actual = actualUnselected.get(key);
    if (!actual) issues.push(`${key}: missing unselected Item review entry`);
    else if (!isDeepStrictEqual(canonicalize(actual), canonicalize(expected))) {
      issues.push(`${key}: unselected Item review entry is stale`);
    }
  }
  for (const key of actualUnselected.keys()) {
    if (!expectedUnselected.has(key)) issues.push(`${key}: stale unselected Item review entry`);
  }

  if (issues.length > 0) {
    throw new Error(`final migration report check failed:\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
  }
}

export function generateFinalMigrationReport(
  options: GenerateFinalMigrationReportOptions = {},
): Record<string, unknown> {
  const root = path.resolve(options.root ?? ROOT);
  const contentRoot = path.resolve(
    options.contentRoot ?? path.join(root, "refs", "Exports", "NZM", "Content"),
  );
  const decisionsPath = path.resolve(options.decisionsPath ?? DEFAULT_MIGRATION_DECISIONS_PATH);
  const decisions = readMigrationDecisions(decisionsPath);
  const coverage = checkMigrationCoverage({ root, decisionsPath });
  const files = scanWeaponFiles(root);
  const fileByKey = new Map(
    files.map((file) => [`${file.table}:${String(file.data.title ?? file.slug)}`, file]),
  );
  const exclusions: Record<NumericalTable, unknown[]> = { lc: [], td: [] };
  const skillCorrections: unknown[] = [];
  const exclusionOwners: Record<string, number> = {};
  const needsSourceReview = Object.values(decisions.weapons).some((weapon) =>
    (["lc", "td"] as const).some(
      (table) => weapon.tables[table]?.exclude?.owner === "source_mapping",
    ),
  );
  const discoveryTables = needsSourceReview
    ? ((generateMigrationReport({ root, contentRoot }).tables ?? {}) as Record<
        NumericalTable,
        Array<Record<string, unknown>>
      >)
    : { lc: [], td: [] };
  const sourceReview = (title: string, table: NumericalTable): Record<string, unknown> => {
    const row = discoveryTables[table].find((candidate) => candidate.title === title);
    if (!row) return { error: "candidate discovery row is missing" };
    if (row.error) return { path: row.path, status: row.status, error: row.error };
    const sources = Array.isArray(row.sources)
      ? (row.sources as Array<Record<string, unknown>>)
      : [];
    const unresolved = sources.filter((source) => source.issue);
    const reviewed = unresolved.length > 0 ? unresolved : sources;
    return {
      path: row.path,
      status: row.status,
      sources: reviewed.map((source) => ({
        locator_key: source.locator_key,
        name: source.name,
        issue: source.issue ?? "EXCLUDED_AFTER_REVIEW",
        candidate_count: Array.isArray(source.candidates) ? source.candidates.length : 0,
        candidates: Array.isArray(source.candidates)
          ? (source.candidates as Array<Record<string, unknown>>).map((candidate) => ({
              scope: candidate.scope,
              prototype_row_name: candidate.prototypeRowName,
              numerical_field: candidate.numericalField,
              source: candidate.source,
            }))
          : [],
      })),
    };
  };
  for (const [title, weapon] of Object.entries(decisions.weapons).sort(([a], [b]) =>
    a.localeCompare(b, "zh-CN"),
  )) {
    for (const table of ["lc", "td"] as const) {
      const tableDecision = weapon.tables[table];
      if (tableDecision?.exclude) {
        exclusions[table].push({
          title,
          ...tableDecision.exclude,
          ...(tableDecision.exclude.owner === "source_mapping"
            ? { review: sourceReview(title, table) }
            : {}),
        });
        exclusionOwners[tableDecision.exclude.owner] =
          (exclusionOwners[tableDecision.exclude.owner] ?? 0) + 1;
      }
      if (tableDecision?.active_skill_correction) {
        skillCorrections.push({ title, table, ...tableDecision.active_skill_correction });
      }
    }
  }
  const itemReader = createWeaponDataSourceReader({ contentRoot });
  const scannedWithoutItemId = files.flatMap((file) => {
    if (file.data.schema_version !== 2 || file.data.item_id) return [];
    const prototypeId = positiveId(file.data.prototype_id);
    if (!prototypeId) return [];
    const candidates = itemReader.findItemsByPrototypeId(prototypeId).map((row) => row.rowName);
    return [
      {
        title: String(file.data.title ?? file.slug),
        table: file.table,
        prototype_id: prototypeId,
        candidates,
        owner: "item_chain",
        reason: "旧 MDX 字段未形成已审核的 item_id；候选只供核验，禁止自动选择",
      },
    ];
  });
  const crossTableDifferences: unknown[] = [];
  let identical = 0;
  for (const title of [...new Set(files.map((file) => String(file.data.title ?? file.slug)))].sort(
    (a, b) => a.localeCompare(b, "zh-CN"),
  )) {
    const weapon = decisions.weapons[title];
    const lc = weapon?.tables.lc;
    const td = weapon?.tables.td;
    const lcFile = fileByKey.get(`lc:${title}`);
    const tdFile = fileByKey.get(`td:${title}`);
    const differences: string[] = [];
    const status = (file: WeaponFile | undefined, table: TableDecision | undefined) =>
      file?.data.schema_version === 2
        ? table
          ? "migrated"
          : "preexisting_v2"
        : table?.exclude
          ? `excluded:${table.exclude.code}`
          : "unaccounted";
    if (status(lcFile, lc) !== status(tdFile, td)) differences.push("migration_status");
    if (!isDeepStrictEqual(normalizedTableSources(lc), normalizedTableSources(td))) {
      differences.push("source_references");
    }
    if (lc?.item_id !== td?.item_id) differences.push("item_id");
    if (lc?.active_skill_id !== td?.active_skill_id) differences.push("active_skill_id");
    if (differences.length === 0) identical += 1;
    else crossTableDifferences.push({ title, differences });
  }
  return {
    schema_version: 1,
    source_hashes: sourceHashes(contentRoot),
    decision_manifest: {
      path: path.relative(root, decisionsPath).replaceAll("\\", "/"),
      sha256: createHash("sha256").update(readFileSync(decisionsPath)).digest("hex"),
    },
    coverage,
    exclusions: {
      by_owner: exclusionOwners,
      lc: exclusions.lc,
      td: exclusions.td,
    },
    item_review: {
      scanned_without_item_id: scannedWithoutItemId,
      unselected_candidates: scannedWithoutItemId.filter((entry) => entry.candidates.length > 0),
    },
    skill_corrections: skillCorrections,
    cross_table: {
      identical,
      different: crossTableDifferences.length,
      differences: crossTableDifferences,
    },
  };
}

export function writeFinalMigrationReport(
  options: GenerateFinalMigrationReportOptions = {},
): void {
  writeFileSync(
    path.resolve(options.outputPath ?? DEFAULT_MIGRATION_REPORT_PATH),
    serialize(generateFinalMigrationReport(options)),
    "utf8",
  );
}

export interface GenerateMigrationReportOptions {
  readonly root?: string;
  readonly contentRoot?: string;
  readonly outputPath?: string;
}

export function generateMigrationReport(
  options: GenerateMigrationReportOptions = {},
): Record<string, unknown> {
  const root = path.resolve(options.root ?? ROOT);
  const contentRoot = path.resolve(
    options.contentRoot ?? path.join(root, "refs", "Exports", "NZM", "Content"),
  );
  const reader = createWeaponDataSourceReader({ contentRoot });
  const rowsByTable = new Map<NumericalTable, readonly NumericalSourceRow[]>([
    ["lc", reader.getNumericalRows("lc")],
    ["td", reader.getNumericalRows("td")],
  ]);
  const signatures = new Map<NumericalTable, Map<string, ResolvedDamageSource | undefined>>();
  const sampleByTable = new Map<NumericalTable, WeaponFile>();
  for (const file of scanWeaponFiles(root)) {
    if (!sampleByTable.has(file.table)) sampleByTable.set(file.table, file);
  }
  for (const table of ["lc", "td"] as const) {
    const sample = sampleByTable.get(table)!;
    signatures.set(
      table,
      new Map(
        rowsByTable.get(table)!.map((row) => [row.key, resolveNumericalRow(sample, row)]),
      ),
    );
  }
  const tables: Record<NumericalTable, unknown[]> = { lc: [], td: [] };
  for (const file of scanWeaponFiles(root)) {
    if (file.data.schema_version === 2) {
      tables[file.table].push({
        title: file.data.title,
        path: file.relativePath,
        status: "already_v2",
      });
      continue;
    }
    try {
      const sources = legacySources(file).map((source) =>
        sourceProposal(
          file,
          source,
          reader,
          rowsByTable.get(file.table)!,
          signatures.get(file.table)!,
        ),
      );
      tables[file.table].push({
        title: file.data.title,
        path: file.relativePath,
        status: sources.every((source) => source.proposed) ? "candidate" : "unresolved",
        item: itemProposal(file, reader),
        skill: skillProposal(file, reader),
        sources,
      });
    } catch (error) {
      tables[file.table].push({
        title: file.data.title,
        path: file.relativePath,
        status: "unresolved",
        error: String(error),
      });
    }
  }
  return {
    schema_version: 1,
    sources: sourceHashes(contentRoot),
    tables,
  };
}

export function writeMigrationReport(options: GenerateMigrationReportOptions = {}): void {
  const report = generateMigrationReport(options);
  writeFileSync(
    path.resolve(options.outputPath ?? DEFAULT_MIGRATION_REPORT_PATH),
    serialize(report),
    "utf8",
  );
}

export function createMigrationDecisionDraft(
  reportPath = DEFAULT_MIGRATION_REPORT_PATH,
  outputPath = DEFAULT_MIGRATION_DECISIONS_PATH,
): void {
  const report = JSON.parse(readFileSync(reportPath, "utf8")) as {
    tables: Record<NumericalTable, Array<Record<string, unknown>>>;
  };
  const weapons: Record<string, { sources: Record<string, unknown>; tables: Record<string, unknown> }> = {};
  for (const table of ["lc", "td"] as const) {
    for (const row of report.tables[table]) {
      if (row.status === "already_v2") continue;
      const title = String(row.title);
      const weapon = (weapons[title] ??= { sources: {}, tables: {} });
      if (row.status !== "candidate") {
        weapon.tables[table] = {
          exclude: {
            code: "UNRESOLVED_SOURCE",
            reason: "候选报告存在零候选或多候选来源，Task 7 不自动猜测",
            owner: "source_mapping",
          },
          sources: {},
          field_decisions: {},
          snapshot_differences: [],
        };
        continue;
      }
      const sourceRefs: Record<string, unknown> = {};
      for (const source of row.sources as SourceProposal[]) {
        if (!source.proposed || !source.proposed_section) {
          throw new Error(`${table}:${title}:${source.locator_key} has no complete proposal`);
        }
        const identity = weapon.sources[source.locator_key] as
          | (Record<string, unknown> & { table_scope: string[] })
          | undefined;
        if (identity) {
          if (identity.name !== source.name || identity.id !== source.proposed_id) {
            throw new Error(`${title}:${source.locator_key} differs between LC and TD`);
          }
          identity.table_scope.push(table);
        } else {
          weapon.sources[source.locator_key] = {
            id: source.proposed_id,
            name: source.name,
            section: source.proposed_section,
            locator: source.locator,
            table_scope: [table],
            reason: "冻结旧 MDX 人工来源名称与页面分组语义",
          };
        }
        const proposedRef = source.proposed.source;
        sourceRefs[source.locator_key] =
          source.proposed_section === "special" ||
          source.proposed_section === "skill" ||
          source.proposed_section === "dot"
            ? {
                ...(proposedRef.prototype_mode !== undefined
                  ? { prototype_mode: proposedRef.prototype_mode }
                  : {}),
                numerical: proposedRef.numerical,
              }
            : proposedRef;
      }
      const item = row.item as { proposed?: string } | undefined;
      const skill = row.skill as { active_skill_id?: number; issue?: string } | undefined;
      if (skill?.issue) {
        weapon.tables[table] = {
          exclude: {
            code: "UNRESOLVED_SKILL",
            reason: `主动技能链尚未决：${skill.issue}`,
            owner: "skill_chain",
          },
          sources: {},
          field_decisions: {},
          snapshot_differences: [],
        };
        continue;
      }
      weapon.tables[table] = {
        ...(item?.proposed ? { item_id: item.proposed } : {}),
        ...(skill?.active_skill_id !== undefined
          ? { active_skill_id: skill.active_skill_id }
          : {}),
        sources: sourceRefs,
        field_decisions: {},
        snapshot_differences: [],
      };
    }
  }
  writeFileSync(
    outputPath,
    serialize({ schema_version: 1, weapons }),
    "utf8",
  );
}

export function readMigrationDecisions(
  inputPath = DEFAULT_MIGRATION_DECISIONS_PATH,
): MigrationDecisions {
  return migrationDecisionsSchema.parse(JSON.parse(readFileSync(inputPath, "utf8")));
}

function main(): void {
  const command = process.argv[2];
  if (command === "report") {
    writeMigrationReport();
    console.log(`Wrote migration report: ${DEFAULT_MIGRATION_REPORT_PATH}`);
    return;
  }
  if (command === "final-report") {
    writeFinalMigrationReport();
    console.log(`Wrote final migration report: ${DEFAULT_MIGRATION_REPORT_PATH}`);
    return;
  }
  if (command === "draft-decisions") {
    createMigrationDecisionDraft();
    console.log(`Wrote decision draft: ${DEFAULT_MIGRATION_DECISIONS_PATH}`);
    return;
  }
  if (command === "audit") {
    const audit = auditMigrationDecisions();
    const report = JSON.parse(readFileSync(DEFAULT_MIGRATION_REPORT_PATH, "utf8")) as Record<
      string,
      unknown
    >;
    report.decision_audit = audit.tables;
    writeFileSync(DEFAULT_MIGRATION_REPORT_PATH, serialize(report), "utf8");
    console.log(`Wrote migration decision audit: ${DEFAULT_MIGRATION_REPORT_PATH}`);
    return;
  }
  if (command === "apply") {
    const table = process.argv[3];
    if (table !== "lc" && table !== "td") {
      throw new Error("usage: bulk-migration.ts apply <lc|td>");
    }
    applyMigrationTable(table);
    console.log(`Applied ${table.toUpperCase()} migration decisions.`);
    return;
  }
  if (command === "capture-baseline") {
    captureMigrationBaseline();
    console.log(`Captured migration baseline: ${DEFAULT_MIGRATION_SNAPSHOT_PATH}`);
    return;
  }
  if (command === "refresh-snapshots") {
    refreshMigrationSnapshots();
    console.log(`Refreshed migration snapshots: ${DEFAULT_MIGRATION_SNAPSHOT_PATH}`);
    return;
  }
  if (command === "check") {
    checkMigrationCoverage();
    checkMigrationSnapshots();
    checkFinalMigrationReport();
    console.log("Weapon V2 migration coverage, snapshots, and final report match reviewed decisions.");
    return;
  }
  throw new Error(
    "usage: bulk-migration.ts <report|final-report|draft-decisions|audit|capture-baseline|refresh-snapshots|check|apply <lc|td>>",
  );
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  main();
}
