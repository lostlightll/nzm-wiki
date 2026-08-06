import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { pathToFileURL } from "node:url";
import matter from "gray-matter";
import { z } from "zod";
import type { WeaponDataLock } from "../../lib/weapon-data-lock";
import {
  createWeaponResolver,
  type ResolvedDamageSource,
} from "../../lib/weapon-resolver";
import {
  resolveDamageSourceReferences,
  validateWeaponSourceV2,
  type NumericalReference,
  type NumericalTable,
  type WeaponDataSourceRef,
} from "../../lib/weapon-source-v2";
import { getResolvedFieldValue } from "../../lib/weapon-consumers";
import { readWeaponDataLock, selectWeaponPrototypeRowName } from "./lock";
import {
  currentMigrationConsumerDifferences,
  DEFAULT_MIGRATION_SNAPSHOT_PATH,
  migrationDecisionsV1Schema,
  migrationDecisionsV2Schema,
  renderMigratedMdx,
  type MigrationDecisions,
} from "./bulk-migration";
import {
  WEAPON_DATA_SOURCE_FILES,
  createWeaponDataSourceReader,
  type NumericalSourceRow,
} from "./source-reader";

const ROOT = process.cwd();
const DEFAULT_DECISIONS_PATH = path.join(ROOT, "data", "weapon-v2-migration-decisions.json");
const DEFAULT_PROPOSAL_PATH = path.join(
  ROOT,
  "MD",
  "_local",
  "weapon-v2-reconciliation",
  "proposals.json",
);
const DEFAULT_RECONCILIATION_DOCUMENT_PATH = path.join(
  ROOT,
  "MD",
  "_local",
  "weapon-v2-reconciliation",
  "source-reconciliation.md",
);

const numericalFields = [
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

type NumericalField = (typeof numericalFields)[number];

interface WeaponDocument {
  readonly table: NumericalTable;
  readonly title: string;
  readonly slug: string;
  readonly relativePath: string;
  readonly absolutePath: string;
  readonly rawText: string;
  readonly data: Record<string, unknown>;
}

interface LegacyDecision {
  readonly action: "preserve_legacy" | "accept_source";
  readonly reason: string;
  readonly owner: string;
}

interface CandidateRow {
  readonly reference: NumericalReference;
  readonly description: string;
  readonly title_match: boolean;
  readonly source_name_match: boolean;
  readonly values: Readonly<Record<string, unknown>>;
}

interface SourceProposal {
  readonly title: string;
  readonly table: NumericalTable;
  readonly path: string;
  readonly decision_source_key: string;
  readonly source_id: string;
  readonly source_name: string;
  readonly previous_explicit_source: WeaponDataSourceRef;
  readonly previous_effective_source: WeaponDataSourceRef;
  readonly fields: readonly string[];
  readonly expected_values: Readonly<Record<string, unknown>>;
  readonly numerical_candidates: readonly CandidateRow[];
  readonly semantic_candidates: readonly CandidateRow[];
  readonly status: "unique_candidate" | "ambiguous_candidate" | "no_candidate" | "non_numerical_only";
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

function scanWeaponDocuments(root: string): WeaponDocument[] {
  const result: WeaponDocument[] = [];
  for (const [directory, table] of [
    ["data/weapons", "lc"],
    ["data/weapons_td", "td"],
  ] as const) {
    const absoluteDirectory = path.join(root, directory);
    for (const name of readdirSync(absoluteDirectory)
      .filter((entry) => entry.toLowerCase().endsWith(".mdx"))
      .sort((left, right) => left.localeCompare(right, "en"))) {
      const absolutePath = path.join(absoluteDirectory, name);
      const rawText = readFileSync(absolutePath, "utf8");
      const data = matter(rawText).data as Record<string, unknown>;
      result.push({
        table,
        title: String(data.title ?? path.basename(name, ".mdx")),
        slug: path.basename(name, ".mdx"),
        relativePath: path.relative(root, absolutePath).replaceAll("\\", "/"),
        absolutePath,
        rawText,
        data,
      });
    }
  }
  return result;
}

function emptyLock(): WeaponDataLock {
  const sources = Object.fromEntries(
    Object.entries(WEAPON_DATA_SOURCE_FILES)
      .filter(([kind]) => kind !== "prototype")
      .map(([kind, source_path]) => [kind, { source_path, sha256: "0".repeat(64) }]),
  ) as WeaponDataLock["sources"];
  return {
    schema_version: 1,
    sources,
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
  return { table: row.table, id: Number(match[1]), level: Number(match[2]) };
}

function candidateContext(document: WeaponDocument): Record<string, unknown> {
  return {
    schema_version: 2,
    title: document.title,
    prototype_id: String(document.data.prototype_id),
    use_type: String(document.data.use_type),
    element: document.data.element,
    rarity: document.data.rarity,
  };
}

function resolveNumericalRow(
  document: WeaponDocument,
  row: NumericalSourceRow,
): ResolvedDamageSource | undefined {
  const numerical = numericalReference(row);
  if (!numerical) return undefined;
  const lock = emptyLock();
  lock.rows[row.kind][row.key] = {
    row_name: row.rowName,
    raw: row.raw as Record<string, never>,
  };
  try {
    return createWeaponResolver(lock).resolveWeapon(
      {
        ...candidateContext(document),
        damage_sources: [
          {
            id: "candidate",
            name: "候选",
            section: "special",
            source: { numerical },
          },
        ],
      },
      { slug: document.slug, expectedTable: document.table },
    ).damageSources[0];
  } catch {
    return undefined;
  }
}

function sourceFieldValue(source: ResolvedDamageSource, field: string): unknown {
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
  if (field === "ignore_shield") return getResolvedFieldValue(source.ignoreShield);
  if (field === "fire.interval") return getResolvedFieldValue(source.fire.interval);
  if (field === "attenuation") {
    if (source.attenuation.status === "not_applicable") return { status: "not_applicable" };
    if (source.attenuation.status === "applicable") {
      return {
        status: "applicable",
        begin_meters: source.attenuation.beginMeters,
        end_meters: source.attenuation.endMeters,
        min_scale: source.attenuation.minScale,
      };
    }
  }
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

function targetSources(decisions: MigrationDecisions): Map<string, Map<string, Record<string, LegacyDecision>>> {
  if (decisions.schema_version !== 1) {
    throw new Error("reconciliation proposal expects the current v1 migration decisions");
  }
  const result = new Map<string, Map<string, Record<string, LegacyDecision>>>();
  for (const [title, weapon] of Object.entries(decisions.weapons)) {
    for (const table of ["lc", "td"] as const) {
      const selected = weapon.tables[table];
      if (!selected || selected.exclude) continue;
      const sources = new Map<string, Record<string, LegacyDecision>>();
      for (const [sourceKey, fields] of Object.entries(selected.field_decisions)) {
        const preserved = Object.fromEntries(
          Object.entries(fields).filter(([, decision]) => decision.action === "preserve_legacy"),
        ) as Record<string, LegacyDecision>;
        if (Object.keys(preserved).length > 0) sources.set(sourceKey, preserved);
      }
      if (sources.size > 0) result.set(`${table}:${title}`, sources);
    }
  }
  return result;
}

export interface GenerateReconciliationProposalOptions {
  readonly root?: string;
  readonly contentRoot?: string;
  readonly decisionsPath?: string;
  readonly lockPath?: string;
}

export function generateReconciliationProposals(
  options: GenerateReconciliationProposalOptions = {},
): Record<string, unknown> {
  const root = path.resolve(options.root ?? ROOT);
  const contentRoot = path.resolve(
    options.contentRoot ?? path.join(root, "refs", "Exports", "NZM", "Content"),
  );
  const decisionsPath = path.resolve(options.decisionsPath ?? DEFAULT_DECISIONS_PATH);
  const decisions = migrationDecisionsV1Schema.parse(
    JSON.parse(readFileSync(decisionsPath, "utf8")),
  );
  const targets = targetSources(decisions);
  const lock = readWeaponDataLock(options.lockPath);
  const resolver = createWeaponResolver(lock);
  const reader = createWeaponDataSourceReader({ contentRoot });
  const documents = scanWeaponDocuments(root);
  const resolvedRows = new Map<NumericalTable, Map<string, ResolvedDamageSource | undefined>>();
  const proposals: SourceProposal[] = [];

  for (const document of documents) {
    const sourceTargets = targets.get(`${document.table}:${document.title}`);
    if (!sourceTargets) continue;
    const weaponDecision = decisions.weapons[document.title];
    const tableDecision = weaponDecision.tables[document.table]!;
    const weapon = validateWeaponSourceV2(document.data, { expectedTable: document.table });
    const effective = resolveDamageSourceReferences(weapon);
    const resolved = resolver.resolveWeapon(document.data, {
      slug: document.slug,
      expectedTable: document.table,
    });
    const sourceById = new Map(resolved.damageSources.map((source) => [source.id, source]));
    const rawSourceById = new Map(weapon.damage_sources.map((source) => [source.id, source]));
    let tableRows = resolvedRows.get(document.table);
    if (!tableRows) {
      tableRows = new Map(
        reader.getNumericalRows(document.table).map((row) => [
          row.key,
          resolveNumericalRow(document, row),
        ]),
      );
      resolvedRows.set(document.table, tableRows);
    }

    for (const [sourceKey, fieldDecisions] of sourceTargets) {
      const identity = weaponDecision.sources[sourceKey];
      if (!identity) throw new Error(`${document.table}:${document.title}:${sourceKey}: missing identity`);
      const current = sourceById.get(identity.id);
      const raw = rawSourceById.get(identity.id);
      const previousEffective = effective.get(identity.id)?.source;
      if (!current || !raw || !previousEffective) {
        throw new Error(`${document.relativePath}:${identity.id}: cannot align current source`);
      }
      const fields = Object.keys(fieldDecisions).sort((left, right) => left.localeCompare(right, "en"));
      const expectedValues = Object.fromEntries(
        fields.map((field) => [field, sourceFieldValue(current, field)]),
      );
      const comparable = fields.filter((field): field is NumericalField =>
        numericalFields.includes(field as NumericalField),
      );
      const allRows = comparable.length === 0
        ? []
        : reader.getNumericalRows(document.table).flatMap((row): CandidateRow[] => {
            const candidate = tableRows!.get(row.key);
            if (!candidate) return [];
            const values = Object.fromEntries(
              comparable.map((field) => [field, sourceFieldValue(candidate, field)]),
            );
            const reference = numericalReference(row);
            if (!reference) return [];
            const description = localizedText(row.raw.Description);
            return [{
              reference,
              description,
              title_match: description.includes(document.title),
              source_name_match: description.includes(identity.name),
              values,
            }];
          });
      const candidates = allRows.filter((candidate) =>
        comparable.every((field) =>
          isDeepStrictEqual(candidate.values[field], expectedValues[field]),
        ),
      );
      const semanticCandidates = allRows.filter(
        (candidate) => candidate.title_match || candidate.source_name_match,
      );
      proposals.push({
        title: document.title,
        table: document.table,
        path: document.relativePath,
        decision_source_key: sourceKey,
        source_id: identity.id,
        source_name: identity.name,
        previous_explicit_source: tableDecision.sources[sourceKey] ?? {},
        previous_effective_source: previousEffective,
        fields,
        expected_values: expectedValues,
        numerical_candidates: candidates,
        semantic_candidates: semanticCandidates,
        status: comparable.length === 0
          ? "non_numerical_only"
          : candidates.length === 0
            ? "no_candidate"
            : candidates.length === 1
              ? "unique_candidate"
              : "ambiguous_candidate",
      });
    }
  }

  const decisionBytes = readFileSync(decisionsPath);
  return {
    schema_version: 1,
    decision_manifest: {
      path: path.relative(root, decisionsPath).replaceAll("\\", "/"),
      sha256: createHash("sha256").update(decisionBytes).digest("hex"),
    },
    counts: {
      sources: proposals.length,
      unique_candidate: proposals.filter((entry) => entry.status === "unique_candidate").length,
      ambiguous_candidate: proposals.filter((entry) => entry.status === "ambiguous_candidate").length,
      no_candidate: proposals.filter((entry) => entry.status === "no_candidate").length,
      non_numerical_only: proposals.filter((entry) => entry.status === "non_numerical_only").length,
    },
    proposals,
  };
}

export function writeReconciliationProposals(
  outputPath = DEFAULT_PROPOSAL_PATH,
  options: GenerateReconciliationProposalOptions = {},
): void {
  const resolved = path.resolve(outputPath);
  mkdirSync(path.dirname(resolved), { recursive: true });
  writeFileSync(resolved, serialize(generateReconciliationProposals(options)), "utf8");
}

const correctedSpecialNumericalIds: Readonly<Record<string, number>> = Object.freeze({
  "再生冷却|冰弹命中": 120300122,
  "再生冷却|碎冰": 120300121,
  "夜影之逝|切刀近战": 120300242,
  "夜影之逝|贯长虹剑气": 120300245,
  "夜影之逝|近战回血": 120300246,
  "夜影之逝|连斩前7刀": 120300243,
  "夜影之逝|连斩第8刀": 120300244,
  "梦魇|导弹": 120600011,
  "死神猎手|死神之光": 1410210101,
  "火山口|多重燃烧手雷": 1400100102,
  "炼狱双蝎|火环": 120500101,
  "炼狱蝎王|腾炎": 120500341,
  "玄凌飞刃|致命链接": 121900102,
  "精绝兽神|秘法榴弹": 120100242,
  "精绝兽神|秘法榴弹分裂弹": 120100243,
  "胜利誓约|酸液手雷": 1400110101,
  "雷霆999|闪电锁链": 1400030101,
});

const correctedSpecialNumericalIdsByTable: Readonly<Record<string, number>> = Object.freeze({
  "lc|炼狱蝎王|蝎刺": 120500342,
  "td|炼狱蝎王|蝎刺": 11010053,
});

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function pointerEscape(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function fileSha256(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function evidenceId(...parts: readonly string[]): string {
  return parts
    .join("-")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function sourceIdentityFor(
  decisions: z.infer<typeof migrationDecisionsV1Schema>,
  title: string,
  table: NumericalTable,
  sourceKey: string,
): { id: string; name: string } {
  const identity = decisions.weapons[title]?.sources[sourceKey];
  if (!identity || !identity.table_scope.includes(table)) {
    throw new Error(`${table}:${title}:${sourceKey}: missing source identity`);
  }
  return identity;
}

function prototypeDefaultSource(
  document: WeaponDocument,
  explicit: WeaponDataSourceRef,
  reader: ReturnType<typeof createWeaponDataSourceReader>,
): { source: WeaponDataSourceRef; rowName: string } {
  const mode = explicit.prototype_mode ?? 0;
  const rowName = selectWeaponPrototypeRowName(
    reader,
    String(document.data.prototype_id),
    mode,
    document.title,
  );
  const prototype = reader.getPrototype({
    prototypeId: String(document.data.prototype_id),
    mode,
    rowName,
  });
  const id = prototype.raw.NumericalID;
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) {
    throw new Error(`${document.relativePath}: Prototype ${rowName} has no NumericalID`);
  }
  reader.getNumerical({ table: document.table, id, level: 1 });
  return {
    rowName,
    source: {
      ...explicit,
      prototype_mode: mode,
      numerical: { table: document.table, id, level: 1 },
    },
  };
}

function finalExplicitSource(
  document: WeaponDocument,
  sourceName: string,
  previous: WeaponDataSourceRef,
  reader: ReturnType<typeof createWeaponDataSourceReader>,
): { source: WeaponDataSourceRef; prototypeRowName?: string; prototypeField?: string } {
  if (sourceName === "近战攻击") {
    const selected = prototypeDefaultSource(document, previous, reader);
    return { ...selected, prototypeField: "NumericalID" };
  }
  const tableSpecific = correctedSpecialNumericalIdsByTable[
    `${document.table}|${document.title}|${sourceName}`
  ];
  const shared = correctedSpecialNumericalIds[`${document.title}|${sourceName}`];
  const correctedId = tableSpecific ?? shared;
  if (correctedId !== undefined) {
    reader.getNumerical({ table: document.table, id: correctedId, level: 1 });
    return {
      source: {
        numerical: { table: document.table, id: correctedId, level: 1 },
      },
    };
  }
  return { source: cloneJson(previous) };
}

function fieldDecisionReason(field: string, action: "accept_source" | "confirmed_override"): string {
  if (action === "accept_source") {
    return `来源重核后采用有效 V2 数据链的 ${field}`;
  }
  if (field === "attenuation") {
    return "人工确认该伤害来源沿用页面核验后的距离衰减适用状态";
  }
  if (field === "fire.interval") {
    return "人工确认该模式使用独立射击间隔";
  }
  return `人工确认该来源需要覆盖 ${field}`;
}

type EvidenceRecord = Record<string, unknown>;

function addNumericalEvidence(
  evidence: Record<string, EvidenceRecord>,
  root: string,
  reference: NumericalReference,
): string {
  const kind = reference.table === "lc" ? "numerical-lc" : "numerical-td";
  const sourcePath = WEAPON_DATA_SOURCE_FILES[kind];
  const id = evidenceId("numerical", reference.table, String(reference.id), String(reference.level));
  const absolutePath = path.join(root, "refs", "Exports", "NZM", "Content", sourcePath);
  const pointer = `/0/Rows/${reference.id}_${reference.level}/id`;
  const observedValue = readJsonPointer(JSON.parse(readFileSync(absolutePath, "utf8")), pointer);
  evidence[id] ??= {
    kind: "numerical_row",
    path: `refs/Exports/NZM/Content/${sourcePath}`,
    pointer,
    observed_value: observedValue,
    sha256: fileSha256(absolutePath),
    note: `确认 ${reference.table.toUpperCase()} Numerical ${reference.id}_${reference.level} 原始行`,
  };
  return id;
}

function addPrototypeEvidence(
  evidence: Record<string, EvidenceRecord>,
  root: string,
  document: WeaponDocument,
  rowName: string,
  field: string,
  observedValue: unknown,
): string {
  const sourcePath = WEAPON_DATA_SOURCE_FILES.prototype;
  const id = evidenceId("prototype", document.title, document.table, rowName, field);
  const absolutePath = path.join(root, "refs", "Exports", "NZM", "Content", sourcePath);
  evidence[id] ??= {
    kind: "prototype_field",
    path: `refs/Exports/NZM/Content/${sourcePath}`,
    pointer: `/0/Rows/${pointerEscape(rowName)}/${pointerEscape(field)}`,
    observed_value: observedValue,
    sha256: fileSha256(absolutePath),
    note: `确认 ${document.title} ${document.table.toUpperCase()} 的 ${field} 来源关系`,
  };
  return id;
}

function addManualEvidence(
  evidence: Record<string, EvidenceRecord>,
  id: string,
  note: string,
): string {
  evidence[id] ??= { kind: "manual_verification", note };
  return id;
}

export interface UpgradeReconciliationDecisionsOptions {
  readonly root?: string;
  readonly contentRoot?: string;
  readonly decisionsPath?: string;
}

export function upgradeReconciliationDecisions(
  options: UpgradeReconciliationDecisionsOptions = {},
): z.infer<typeof migrationDecisionsV2Schema> {
  const root = path.resolve(options.root ?? ROOT);
  const contentRoot = path.resolve(
    options.contentRoot ?? path.join(root, "refs", "Exports", "NZM", "Content"),
  );
  const decisionsPath = path.resolve(options.decisionsPath ?? DEFAULT_DECISIONS_PATH);
  const legacy = migrationDecisionsV1Schema.parse(
    JSON.parse(readFileSync(decisionsPath, "utf8")),
  );
  const proposalFile = generateReconciliationProposals({ root, contentRoot, decisionsPath });
  const proposals = (proposalFile.proposals as SourceProposal[]);
  const proposalByKey = new Map(
    proposals.map((entry) => [
      `${entry.table}:${entry.title}:${entry.decision_source_key}`,
      entry,
    ]),
  );
  const reader = createWeaponDataSourceReader({ contentRoot });
  const documents = new Map(
    scanWeaponDocuments(root).map((document) => [`${document.table}:${document.title}`, document]),
  );
  const evidence: Record<string, EvidenceRecord> = {};
  const output = cloneJson(legacy) as unknown as Record<string, unknown>;
  output.schema_version = 2;
  output.evidence = evidence;
  const outputWeapons = output.weapons as Record<string, Record<string, unknown>>;

  for (const [title, legacyWeapon] of Object.entries(legacy.weapons)) {
    const outputWeapon = outputWeapons[title];
    const outputTables = outputWeapon.tables as Record<NumericalTable, Record<string, unknown>>;
    for (const table of ["lc", "td"] as const) {
      const legacyTable = legacyWeapon.tables[table];
      const outputTable = outputTables[table];
      if (!legacyTable || !outputTable || legacyTable.exclude) continue;
      const document = documents.get(`${table}:${title}`);
      if (!document || document.data.schema_version !== 2) {
        throw new Error(`${table}:${title}: migrated V2 document is missing`);
      }
      const sourceReviews: Record<string, unknown> = {};
      outputTable.source_reviews = sourceReviews;
      const outputSources = outputTable.sources as Record<string, WeaponDataSourceRef>;
      const outputFields = outputTable.field_decisions as Record<
        string,
        Record<string, Record<string, unknown>>
      >;

      for (const [sourceKey, legacyFields] of Object.entries(legacyTable.field_decisions)) {
        const preserved = Object.entries(legacyFields).filter(
          ([, decision]) => decision.action === "preserve_legacy",
        );
        if (preserved.length === 0) continue;
        const proposal = proposalByKey.get(`${table}:${title}:${sourceKey}`);
        if (!proposal) throw new Error(`${table}:${title}:${sourceKey}: proposal is missing`);
        const identity = sourceIdentityFor(legacy, title, table, sourceKey);
        const final = finalExplicitSource(
          document,
          identity.name,
          legacyTable.sources[sourceKey] ?? {},
          reader,
        );
        outputSources[sourceKey] = final.source;
        const reviewEvidence: string[] = [];
        if (final.source.numerical) {
          reviewEvidence.push(addNumericalEvidence(evidence, root, final.source.numerical));
        }
        if (final.prototypeRowName && final.prototypeField && final.source.numerical) {
          reviewEvidence.push(
            addPrototypeEvidence(
              evidence,
              root,
              document,
              final.prototypeRowName,
              final.prototypeField,
              final.source.numerical.id,
            ),
          );
        } else {
          reviewEvidence.push(
            addManualEvidence(
              evidence,
              evidenceId("manual", title, table, identity.id),
              `依据 Numerical 描述、来源名称及页面机制确认 ${title}「${identity.name}」的有效来源`,
            ),
          );
        }
        sourceReviews[sourceKey] = {
          previous_effective_source: proposal.previous_effective_source,
          resolution: isDeepStrictEqual(
            canonicalize(proposal.previous_explicit_source),
            canonicalize(final.source),
          ) ? "confirmed" : "corrected",
          reason: isDeepStrictEqual(
            canonicalize(proposal.previous_explicit_source),
            canonicalize(final.source),
          )
            ? "现有显式来源通过数据链复核"
            : "来源重核后修正完整显式引用",
          evidence_ids: [...new Set(reviewEvidence)],
        };

        for (const [field, legacyDecision] of Object.entries(legacyFields)) {
          if (legacyDecision.action !== "preserve_legacy") continue;
          const confirmed = field === "attenuation" || field === "fire.interval";
          outputFields[sourceKey][field] = confirmed
            ? {
                action: "confirmed_override",
                owner: "wiki_semantics",
                reason: fieldDecisionReason(field, "confirmed_override"),
                value: proposal.expected_values[field],
                evidence_ids: [
                  addManualEvidence(
                    evidence,
                    evidenceId("manual", field.replace(".", "-"), "behavior"),
                    field === "attenuation"
                      ? "现有页面衰减适用状态经过 Task 5/7 机制核验，不能由 ASC 候选值直接覆盖"
                      : "该射速模式具有独立射击间隔，当前 ASC 不单独表达此行为变体",
                  ),
                ],
              }
            : {
                action: "accept_source",
                owner: "game_data",
                reason: fieldDecisionReason(field, "accept_source"),
              };
        }
      }
    }
  }

  return migrationDecisionsV2Schema.parse(output);
}

export function writeUpgradedReconciliationDecisions(
  options: UpgradeReconciliationDecisionsOptions & { outputPath?: string } = {},
): void {
  const decisionsPath = path.resolve(options.outputPath ?? options.decisionsPath ?? DEFAULT_DECISIONS_PATH);
  const value = upgradeReconciliationDecisions(options);
  writeFileSync(decisionsPath, serialize(value), "utf8");
}

function ensureRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function deleteNested(target: Record<string, unknown>, pathSegments: readonly string[]): void {
  const parents: Record<string, unknown>[] = [target];
  let current = target;
  for (const segment of pathSegments.slice(0, -1)) {
    const child = current[segment];
    if (!child || typeof child !== "object" || Array.isArray(child)) return;
    current = child as Record<string, unknown>;
    parents.push(current);
  }
  delete current[pathSegments.at(-1)!];
  for (let index = parents.length - 1; index > 0; index -= 1) {
    if (Object.keys(parents[index]).length > 0) break;
    const parent = parents[index - 1];
    delete parent[pathSegments[index - 1]];
  }
}

function setNested(
  target: Record<string, unknown>,
  pathSegments: readonly string[],
  value: unknown,
): void {
  let current = target;
  for (const segment of pathSegments.slice(0, -1)) {
    const child = current[segment];
    if (!child || typeof child !== "object" || Array.isArray(child)) current[segment] = {};
    current = current[segment] as Record<string, unknown>;
  }
  current[pathSegments.at(-1)!] = cloneJson(value);
}

function overridePath(field: string): readonly string[] | undefined {
  if (field.startsWith("damage.")) return ["numerical", ...field.split(".")];
  if (numericalFields.includes(field as NumericalField)) return ["numerical", field];
  if (field === "attenuation") return ["asc", "attenuation"];
  if (field === "fire.interval") return ["asc", "fire_interval"];
  return undefined;
}

function uniqueReasons(
  fields: Readonly<Record<string, Record<string, unknown>>>,
): string[] {
  const ordered = [
    ...numericalFields,
    "attenuation",
    "fire.interval",
  ];
  const result: string[] = [];
  for (const field of ordered) {
    const decision = fields[field];
    if (decision?.action !== "confirmed_override") continue;
    const reason = String(decision.reason);
    if (!result.includes(reason)) result.push(reason);
  }
  return result;
}

function readJsonPointer(root: unknown, pointer: string): unknown {
  if (pointer === "") return root;
  let current = root;
  for (const token of pointer.slice(1).split("/")) {
    const key = token.replaceAll("~1", "/").replaceAll("~0", "~");
    if (Array.isArray(current)) {
      const index = Number(key);
      if (!Number.isSafeInteger(index) || index < 0 || index >= current.length) return undefined;
      current = current[index];
    } else if (current && typeof current === "object") {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return current;
}

function validateOnlineEvidence(
  root: string,
  decisions: z.infer<typeof migrationDecisionsV2Schema>,
): void {
  const issues: string[] = [];
  for (const [id, entry] of Object.entries(decisions.evidence)) {
    if (entry.kind === "manual_verification") continue;
    const absolutePath = path.resolve(root, entry.path);
    if (!absolutePath.startsWith(path.resolve(root) + path.sep) || !existsSync(absolutePath)) {
      issues.push(`${id}: evidence file is missing or outside repository`);
      continue;
    }
    if (fileSha256(absolutePath) !== entry.sha256) {
      issues.push(`${id}: evidence SHA-256 differs`);
      continue;
    }
    const value = readJsonPointer(JSON.parse(readFileSync(absolutePath, "utf8")), entry.pointer);
    if (!isDeepStrictEqual(value, entry.observed_value)) {
      issues.push(`${id}: evidence pointer value differs`);
      continue;
    }
    if (entry.kind === "weapon_item_identity") {
      const row = value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : undefined;
      if (
        !row ||
        String(row.WeaponName) !== entry.weapon_name ||
        String(row.ModelID) !== entry.model_id
      ) {
        issues.push(`${id}: WeaponItem identity fields differ`);
      }
    }
  }
  if (issues.length > 0) throw new Error(`online evidence validation failed:\n${issues.join("\n")}`);
}

function applyFieldDecisions(
  source: Record<string, unknown>,
  fields: Readonly<Record<string, Record<string, unknown>>>,
  hasEffectiveAsc: boolean,
): void {
  const overrides = source.overrides && typeof source.overrides === "object" && !Array.isArray(source.overrides)
    ? cloneJson(source.overrides as Record<string, unknown>)
    : {};
  const overrideFields: Record<string, Record<string, unknown>> = {};
  for (const [field, decision] of Object.entries(fields)) {
    if (field === "fire.interval" && !hasEffectiveAsc) {
      if (decision.action === "accept_source") delete source.fire_interval;
      else if (decision.action === "confirmed_override") {
        source.fire_interval = cloneJson(decision.value);
      }
      continue;
    }
    const pathSegments = overridePath(field);
    if (!pathSegments) continue;
    if (decision.action === "accept_source") deleteNested(overrides, pathSegments);
    else if (decision.action === "confirmed_override") {
      setNested(overrides, pathSegments, decision.value);
      overrideFields[field] = decision;
    }
    if (field === "fire.interval") delete source.fire_interval;
  }
  if (Object.keys(overrides).length === 0) {
    delete source.overrides;
    delete source.override_reason;
  } else {
    source.overrides = overrides;
    source.override_reason = uniqueReasons(overrideFields).join("；");
  }
}

interface RenderedReconciliation {
  readonly document: WeaponDocument;
  readonly text: string;
}

function renderReconciledDocuments(
  root: string,
  decisions: z.infer<typeof migrationDecisionsV2Schema>,
): RenderedReconciliation[] {
  const rendered: RenderedReconciliation[] = [];
  const issues: string[] = [];
  for (const document of scanWeaponDocuments(root)) {
    const weaponDecision = decisions.weapons[document.title];
    const tableDecision = weaponDecision?.tables[document.table];
    if (!tableDecision || tableDecision.exclude || Object.keys(tableDecision.source_reviews).length === 0) {
      continue;
    }
    try {
      const data = cloneJson(document.data);
      const rawSources = data.damage_sources;
      if (!Array.isArray(rawSources)) throw new Error("damage_sources is not an array");
      const sources = rawSources.map((value, index) =>
        ensureRecord(value, `${document.relativePath}:damage_sources[${index}]`),
      );
      const sourceById = new Map(sources.map((source) => [String(source.id), source]));
      for (const sourceKey of Object.keys(tableDecision.source_reviews)) {
        const identity = weaponDecision.sources[sourceKey];
        const source = identity ? sourceById.get(identity.id) : undefined;
        if (!identity || !source) throw new Error(`${sourceKey}: cannot align V2 source`);
        source.source = cloneJson(tableDecision.sources[sourceKey] ?? {});
      }
      const effectiveReferences = resolveDamageSourceReferences(
        validateWeaponSourceV2(data, { expectedTable: document.table }),
      );
      for (const sourceKey of Object.keys(tableDecision.source_reviews)) {
        const identity = weaponDecision.sources[sourceKey]!;
        const source = sourceById.get(identity.id)!;
        applyFieldDecisions(
          source,
          tableDecision.field_decisions[sourceKey] ?? {},
          Boolean(effectiveReferences.get(identity.id)?.source?.asc_type_id),
        );
      }
      validateWeaponSourceV2(data, { expectedTable: document.table });
      rendered.push({
        document,
        text: renderMigratedMdx(document.rawText, data, document.relativePath),
      });
    } catch (error) {
      issues.push(`${document.relativePath}: ${String(error)}`);
    }
  }
  if (issues.length > 0) throw new Error(`reconciliation render failed:\n${issues.join("\n")}`);
  return rendered;
}

export interface ApplyReconciliationOptions {
  readonly root?: string;
  readonly decisionsPath?: string;
}

export function applyReconciliation(options: ApplyReconciliationOptions = {}): void {
  const root = path.resolve(options.root ?? ROOT);
  const decisionsPath = path.resolve(options.decisionsPath ?? DEFAULT_DECISIONS_PATH);
  const decisions = migrationDecisionsV2Schema.parse(
    JSON.parse(readFileSync(decisionsPath, "utf8")),
  );
  validateOnlineEvidence(root, decisions);
  const rendered = renderReconciledDocuments(root, decisions);
  for (const entry of rendered) {
    if (entry.text === entry.document.rawText) continue;
    const temporary = `${entry.document.absolutePath}.task76.tmp`;
    writeFileSync(temporary, entry.text, "utf8");
    renameSync(temporary, entry.document.absolutePath);
  }
}

function effectiveSourceByIdentity(
  document: WeaponDocument,
  identityId: string,
): WeaponDataSourceRef | undefined {
  const weapon = validateWeaponSourceV2(document.data, { expectedTable: document.table });
  return resolveDamageSourceReferences(weapon).get(identityId)?.source;
}

export interface ReconciliationCheckResult {
  readonly reviewed_sources: number;
  readonly confirmed_sources: number;
  readonly corrected_sources: number;
  readonly resolved_sources: number;
  readonly confirmed_overrides: number;
}

export function checkReconciliation(
  options: ApplyReconciliationOptions = {},
): ReconciliationCheckResult {
  const root = path.resolve(options.root ?? ROOT);
  const decisionsPath = path.resolve(options.decisionsPath ?? DEFAULT_DECISIONS_PATH);
  const decisions = migrationDecisionsV2Schema.parse(
    JSON.parse(readFileSync(decisionsPath, "utf8")),
  );
  const documents = new Map(
    scanWeaponDocuments(root).map((document) => [`${document.table}:${document.title}`, document]),
  );
  const usedEvidence = new Set<string>();
  const issues: string[] = [];
  let reviewedSources = 0;
  let confirmedSources = 0;
  let correctedSources = 0;
  let resolvedSources = 0;
  let confirmedOverrides = 0;

  for (const [title, weapon] of Object.entries(decisions.weapons)) {
    for (const table of ["lc", "td"] as const) {
      const selected = weapon.tables[table];
      if (!selected || selected.exclude) continue;
      const document = documents.get(`${table}:${title}`);
      if (!document) {
        issues.push(`${table}:${title}: MDX is missing`);
        continue;
      }
      for (const [sourceKey, review] of Object.entries(selected.source_reviews)) {
        reviewedSources += 1;
        if (review.resolution === "confirmed") confirmedSources += 1;
        else if (review.resolution === "corrected") correctedSources += 1;
        else resolvedSources += 1;
        const identity = weapon.sources[sourceKey];
        const finalEffective = identity
          ? effectiveSourceByIdentity(document, identity.id)
          : undefined;
        if (!identity || !finalEffective) {
          issues.push(`${table}:${title}:${sourceKey}: final effective source is missing`);
          continue;
        }
        if (review.resolution === "resolved") {
          if (
            !isDeepStrictEqual(
              canonicalize(review.effective_source),
              canonicalize(finalEffective),
            )
          ) {
            issues.push(`${table}:${title}:${sourceKey}: resolved source review is stale`);
          }
        } else {
          const same = isDeepStrictEqual(
            canonicalize(review.previous_effective_source),
            canonicalize(finalEffective),
          );
          if (same !== (review.resolution === "confirmed")) {
            issues.push(`${table}:${title}:${sourceKey}: source review resolution is stale`);
          }
        }
        for (const id of review.evidence_ids) usedEvidence.add(id);
        for (const [field, decision] of Object.entries(selected.field_decisions[sourceKey] ?? {})) {
          if (decision.action !== "confirmed_override") continue;
          confirmedOverrides += 1;
          for (const id of decision.evidence_ids) usedEvidence.add(id);
          const weaponSource = (document.data.damage_sources as Array<Record<string, unknown>>)
            .find((source) => source.id === identity.id);
          const compatibilityInterval =
            field === "fire.interval" && !finalEffective.asc_type_id;
          const pathSegments = compatibilityInterval ? undefined : overridePath(field);
          let value: unknown = compatibilityInterval
            ? weaponSource?.fire_interval
            : weaponSource?.overrides;
          for (const segment of pathSegments ?? []) {
            value = value && typeof value === "object" && !Array.isArray(value)
              ? (value as Record<string, unknown>)[segment]
              : undefined;
          }
          if (!isDeepStrictEqual(value, decision.value)) {
            issues.push(`${table}:${title}:${sourceKey}:${field}: confirmed override value differs`);
          }
        }
      }
      for (const addition of selected.source_additions ?? []) {
        reviewedSources += 1;
        resolvedSources += 1;
        const finalEffective = effectiveSourceByIdentity(document, addition.identity.id);
        if (
          !finalEffective ||
          !isDeepStrictEqual(
            canonicalize(addition.source_review.effective_source),
            canonicalize(finalEffective),
          )
        ) {
          issues.push(`${table}:${title}:${addition.key}: added source review is stale`);
        }
        for (const id of addition.source_review.evidence_ids) usedEvidence.add(id);
      }
      for (const correction of Object.values(selected.compatibility_field_corrections ?? {})) {
        if (!correction) continue;
        for (const id of correction.evidence_ids) usedEvidence.add(id);
      }
    }
  }
  for (const id of usedEvidence) {
    if (!decisions.evidence[id]) issues.push(`${id}: referenced evidence is missing`);
  }
  for (const id of Object.keys(decisions.evidence)) {
    if (!usedEvidence.has(id)) issues.push(`${id}: evidence is unused`);
  }
  for (const document of documents.values()) {
    if (document.data.schema_version !== 2) continue;
    if (document.rawText.includes("结构迁移保留旧 MDX 直接维护")) {
      issues.push(`${document.relativePath}: temporary migration reason remains`);
    }
  }
  const historicalReviewedSources = confirmedSources + correctedSources;
  if (historicalReviewedSources !== 101) {
    issues.push(
      `Task 7.6 reviewed source count is ${historicalReviewedSources}, expected 101`,
    );
  }
  if (issues.length > 0) throw new Error(`reconciliation check failed:\n${issues.join("\n")}`);
  return {
    reviewed_sources: reviewedSources,
    confirmed_sources: confirmedSources,
    corrected_sources: correctedSources,
    resolved_sources: resolvedSources,
    confirmed_overrides: confirmedOverrides,
  };
}

function markdownCell(value: unknown): string {
  if (value === undefined) return "—";
  const text = typeof value === "string" ? value : JSON.stringify(canonicalize(value));
  return text.replaceAll("|", "\\|").replaceAll("\n", " ");
}

export function generateReconciliationMarkdown(
  options: ApplyReconciliationOptions = {},
): string {
  const root = path.resolve(options.root ?? ROOT);
  const decisionsPath = path.resolve(options.decisionsPath ?? DEFAULT_DECISIONS_PATH);
  const decisions = migrationDecisionsV2Schema.parse(
    JSON.parse(readFileSync(decisionsPath, "utf8")),
  );
  const documents = new Map(
    scanWeaponDocuments(root).map((document) => [`${document.table}:${document.title}`, document]),
  );
  const rows: string[] = [];
  let confirmed = 0;
  let corrected = 0;
  let resolved = 0;
  let overrides = 0;
  for (const [title, weapon] of Object.entries(decisions.weapons).sort(([a], [b]) =>
    a.localeCompare(b, "zh-CN"),
  )) {
    for (const table of ["lc", "td"] as const) {
      const selected = weapon.tables[table];
      if (!selected || selected.exclude) continue;
      const document = documents.get(`${table}:${title}`);
      if (!document) continue;
      for (const [sourceKey, review] of Object.entries(selected.source_reviews).sort(([a], [b]) =>
        a.localeCompare(b, "en"),
      )) {
        const identity = weapon.sources[sourceKey];
        const finalExplicit = selected.sources[sourceKey] ?? {};
        const finalEffective = identity
          ? effectiveSourceByIdentity(document, identity.id)
          : undefined;
        const fields = selected.field_decisions[sourceKey] ?? {};
        const confirmedFields = Object.entries(fields)
          .filter(([, decision]) => decision.action === "confirmed_override")
          .map(([field]) => field);
        overrides += confirmedFields.length;
        if (review.resolution === "confirmed") confirmed += 1;
        else if (review.resolution === "corrected") corrected += 1;
        else resolved += 1;
        rows.push(
          `| ${markdownCell(title)} | ${table.toUpperCase()} | ${markdownCell(identity?.name ?? sourceKey)} | ${review.resolution} | ${markdownCell(review.resolution === "resolved" ? undefined : review.previous_effective_source)} | ${markdownCell(finalExplicit)} | ${markdownCell(finalEffective)} | ${markdownCell(review.evidence_ids.join(", "))} | ${markdownCell(confirmedFields.length > 0 ? confirmedFields.join(", ") : "采用来源值")} |`,
        );
      }
      for (const addition of selected.source_additions ?? []) {
        resolved += 1;
        const finalEffective = effectiveSourceByIdentity(document, addition.identity.id);
        rows.push(
          `| ${markdownCell(title)} | ${table.toUpperCase()} | ${markdownCell(addition.identity.name)} | resolved | ${markdownCell(undefined)} | ${markdownCell(addition.source)} | ${markdownCell(finalEffective)} | ${markdownCell(addition.source_review.evidence_ids.join(", "))} | accepted addition |`,
        );
      }
    }
  }
  return `# Weapon V2 来源重核与正式化\n\n本文记录 Task 7.6 的既有来源重核，以及 Task 7.7 对原 V1 排除项的首次来源解析。机器权威仍是 \`data/weapon-v2-migration-decisions.json\`；本文由该清单确定性生成。\n\n## 结果\n\n- 已审核来源：${rows.length}\n- Task 7.6 原来源确认：${confirmed}\n- Task 7.6 完整来源纠正：${corrected}\n- Task 7.7 首次解析来源：${resolved}\n- 正式保留 override 字段：${overrides}\n- 未完成来源：0\n- V1 排除项：0\n\n## 规则\n\n- 常规 Prototype 射击和近战采用经过交叉校验的有效来源。\n- 技能、特殊、插件和恢复来源使用独立 Numerical，不伪装成 Prototype Mode 0。\n- Numerical 差异采用正式来源值；距离衰减和独立射速仅在机制确认后保留 typed override。\n- LC/TD 始终独立引用，不执行跨表 fallback。\n\n## 来源明细\n\n| 武器 | 表 | 来源 | 结果 | 旧有效来源 | 最终显式来源 | 最终有效来源 | 证据 | 字段处理 |\n| :--- | :---: | :--- | :---: | :--- | :--- | :--- | :--- | :--- |\n${rows.join("\n")}\n`;
}

export function writeReconciliationMarkdown(
  outputPath = DEFAULT_RECONCILIATION_DOCUMENT_PATH,
  options: ApplyReconciliationOptions = {},
): void {
  const resolved = path.resolve(outputPath);
  mkdirSync(path.dirname(resolved), { recursive: true });
  writeFileSync(resolved, generateReconciliationMarkdown(options), "utf8");
}

export function reconcileSnapshotDifferenceDecisions(
  current: readonly { readonly pointer: string }[],
  existing: readonly {
    readonly pointer: string;
    readonly classification: "source_difference" | "accepted_correction";
    readonly reason: string;
  }[],
): readonly {
  readonly pointer: string;
  readonly classification: "source_difference" | "accepted_correction";
  readonly reason: string;
}[] {
  const previous = new Map(existing.map((decision) => [decision.pointer, decision]));
  return [...current]
    .sort((left, right) => left.pointer.localeCompare(right.pointer, "en"))
    .map(({ pointer }) => previous.get(pointer) ?? {
      pointer,
      classification: "accepted_correction" as const,
      reason: `Task 7.6 已核验来源纠正：${pointer}`,
    });
}

export function updateReconciliationSnapshotDecisions(options: {
  root?: string;
  decisionsPath?: string;
  snapshotPath?: string;
} = {}): void {
  const root = path.resolve(options.root ?? ROOT);
  const decisionsPath = path.resolve(options.decisionsPath ?? DEFAULT_DECISIONS_PATH);
  const snapshotPath = path.resolve(options.snapshotPath ?? DEFAULT_MIGRATION_SNAPSHOT_PATH);
  const decisions = migrationDecisionsV2Schema.parse(
    JSON.parse(readFileSync(decisionsPath, "utf8")),
  );
  const current = currentMigrationConsumerDifferences({ root, decisionsPath, snapshotPath });
  const weapons = Object.fromEntries(
    Object.entries(decisions.weapons).map(([title, weapon]) => [
      title,
      {
        ...weapon,
        tables: Object.fromEntries(
          Object.entries(weapon.tables).map(([table, selected]) => {
            if (!selected || selected.exclude || Object.keys(selected.source_reviews).length === 0) {
              return [table, selected];
            }
            return [
              table,
              {
                ...selected,
                snapshot_differences: reconcileSnapshotDifferenceDecisions(
                  current[`${table}:${title}`] ?? [],
                  selected.snapshot_differences,
                ),
              },
            ];
          }),
        ),
      },
    ]),
  );
  writeFileSync(
    decisionsPath,
    serialize(migrationDecisionsV2Schema.parse({ ...decisions, weapons })),
    "utf8",
  );
}

function main(): void {
  const command = process.argv[2];
  if (command === "report") {
    const output = process.argv[3] ?? DEFAULT_PROPOSAL_PATH;
    writeReconciliationProposals(output);
    console.log(`Wrote reconciliation proposals: ${output}`);
    return;
  }
  if (command === "upgrade") {
    const output = process.argv[3] ?? DEFAULT_DECISIONS_PATH;
    writeUpgradedReconciliationDecisions({ outputPath: output });
    console.log(`Wrote reviewed reconciliation decisions: ${output}`);
    return;
  }
  if (command === "apply") {
    applyReconciliation();
    console.log("Applied reviewed Weapon V2 source reconciliation.");
    return;
  }
  if (command === "document") {
    writeReconciliationMarkdown();
    console.log(`Wrote reconciliation document: ${DEFAULT_RECONCILIATION_DOCUMENT_PATH}`);
    return;
  }
  if (command === "snapshot-decisions") {
    updateReconciliationSnapshotDecisions();
    console.log("Updated reviewed migration snapshot difference decisions.");
    return;
  }
  if (command === "check") {
    console.log(JSON.stringify(checkReconciliation()));
    return;
  }
  throw new Error("usage: source-reconciliation.ts <report [output]|upgrade [output]|apply|snapshot-decisions|document|check>");
}

if (
  process.argv[1] &&
  existsSync(process.argv[1]) &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  main();
}
