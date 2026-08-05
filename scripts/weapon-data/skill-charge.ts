import {
  WEAPON_DATA_SOURCE_FILES,
  WeaponDataSourceError,
  type GpActiveSkillSourceRow,
  type ItemSourceRow,
  type PrototypeSourceRow,
  type WeaponDataSourceReader,
  type WeaponDataSourceRow,
  type WeaponPveSkillSourceRow,
} from "./source-reader";

export type WeaponSkillChargeErrorCode =
  | "INVALID_SKILL_REFERENCE"
  | "UNSUPPORTED_SKILL_LEVEL"
  | "MISSING_SKILL_CHARGE_SOURCE"
  | "INVALID_SKILL_CHARGE_VALUE"
  | "INVALID_SKILL_AUDIT_SOURCE";

export interface WeaponSkillChargeAttempt {
  readonly kind: "skill-pve" | "gp-active-skill";
  readonly sourcePath: string;
  readonly key: string;
}

export class WeaponSkillChargeError extends Error {
  readonly code: WeaponSkillChargeErrorCode;
  readonly skillId: number;
  readonly level: number;
  readonly attempts?: readonly WeaponSkillChargeAttempt[];

  constructor(
    code: WeaponSkillChargeErrorCode,
    skillId: number,
    level: number,
    detail: string,
    options: {
      attempts?: readonly WeaponSkillChargeAttempt[];
      cause?: unknown;
    } = {},
  ) {
    const attemptsText = options.attempts?.length
      ? ` attempts=${options.attempts
          .map(
            (attempt) =>
              `${attempt.kind}:${attempt.sourcePath}#${attempt.key}`,
          )
          .join(",")}`
      : "";
    super(
      `[${code}] active-skill ${skillId}_${level}${attemptsText}: ${detail}`,
      { cause: options.cause },
    );
    this.name = "WeaponSkillChargeError";
    this.code = code;
    this.skillId = skillId;
    this.level = level;
    this.attempts = options.attempts;
  }
}

export interface ResolveActiveSkillChargeInput {
  skillId: number;
  level?: number;
}

export interface ActiveSkillChargeResolution {
  readonly skillId: number;
  readonly level: 1;
  readonly chargeTime: number;
  readonly chargeCount: number;
  readonly source: "weapon_pve" | "gp_fallback";
  readonly sourceKey: string;
  readonly row: WeaponPveSkillSourceRow | GpActiveSkillSourceRow;
}

export type ActiveSkillAuditIssue =
  | {
      readonly code: "MDX_PROTOTYPE_SKILL_MISMATCH";
      readonly severity: "error";
      readonly mdxActiveSkillId: number;
      readonly prototypeActiveSkillId: number;
    }
  | {
      readonly code: "ITEM_PROTOTYPE_SKILL_MISMATCH";
      readonly severity: "warning";
      readonly itemRowName: string;
      readonly itemActiveSkillId: number;
      readonly prototypeActiveSkillId: number;
    }
  | {
      readonly code: "ITEM_SKILL_AMBIGUOUS";
      readonly severity: "warning";
      readonly candidateRowNames: readonly string[];
    }
  | {
      readonly code: "ITEM_SKILL_MISSING";
      readonly severity: "info";
      readonly itemRowName: string;
    }
  | {
      readonly code: "ITEM_SKILL_INVALID";
      readonly severity: "warning";
      readonly itemRowName: string;
      readonly rawValue: unknown;
    };

export interface AuditActiveSkillReferenceInput {
  prototypeId: string;
  mdxActiveSkillId: number;
  prototypeRowName?: string;
  itemId?: string;
}

export interface ActiveSkillReferenceAudit {
  readonly prototype: PrototypeSourceRow;
  readonly prototypeActiveSkillId: number;
  readonly itemSelection:
    | "explicit"
    | "model_id_candidate"
    | "ambiguous"
    | "none";
  readonly itemCandidates: readonly ItemSourceRow[];
  readonly issues: readonly ActiveSkillAuditIssue[];
}

function isSafePositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isNotFoundFrom(
  error: unknown,
  kind: "skill-pve" | "gp-active-skill",
): error is WeaponDataSourceError {
  return (
    error instanceof WeaponDataSourceError &&
    error.code === "NOT_FOUND" &&
    error.kind === kind
  );
}

function invalidSourceValue(
  skillId: number,
  level: number,
  row: WeaponDataSourceRow,
  field: string,
  expected: string,
): WeaponSkillChargeError {
  return new WeaponSkillChargeError(
    "INVALID_SKILL_CHARGE_VALUE",
    skillId,
    level,
    `${row.kind} ${row.sourcePath} key=${row.key} field=${field} must be ${expected}`,
  );
}

function readChargeTime(
  skillId: number,
  level: number,
  row: WeaponDataSourceRow,
  field: "ChargeNeedTime" | "CooldownDuration",
): number {
  const value = row.raw[field];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw invalidSourceValue(
      skillId,
      level,
      row,
      field,
      "a finite non-negative number",
    );
  }
  return value;
}

function readChargeCount(
  skillId: number,
  level: number,
  row: WeaponDataSourceRow,
  field: "SkillCount" | "MaxChargeStackCount",
): number {
  const value = row.raw[field];
  if (!isSafePositiveInteger(value)) {
    throw invalidSourceValue(
      skillId,
      level,
      row,
      field,
      "a positive safe integer",
    );
  }
  return value;
}

export function resolveActiveSkillCharge(
  reader: WeaponDataSourceReader,
  { skillId, level = 1 }: ResolveActiveSkillChargeInput,
): ActiveSkillChargeResolution {
  if (!isSafePositiveInteger(skillId)) {
    throw new WeaponSkillChargeError(
      "INVALID_SKILL_REFERENCE",
      skillId,
      level,
      "skillId must be a positive safe integer",
    );
  }
  if (level !== 1) {
    throw new WeaponSkillChargeError(
      "UNSUPPORTED_SKILL_LEVEL",
      skillId,
      level,
      "Task 2.5 only defines Level 1 charge resolution",
    );
  }

  let pveRow: WeaponPveSkillSourceRow;
  try {
    pveRow = reader.getWeaponPveSkill({ skillId, level });
  } catch (error) {
    if (!isNotFoundFrom(error, "skill-pve")) throw error;

    let gpRow: GpActiveSkillSourceRow;
    try {
      gpRow = reader.getGpActiveSkill(skillId);
    } catch (gpError) {
      if (!isNotFoundFrom(gpError, "gp-active-skill")) throw gpError;
      const attempts = Object.freeze([
        Object.freeze({
          kind: "skill-pve" as const,
          sourcePath: WEAPON_DATA_SOURCE_FILES["skill-pve"],
          key: `${skillId}_${level}`,
        }),
        Object.freeze({
          kind: "gp-active-skill" as const,
          sourcePath: WEAPON_DATA_SOURCE_FILES["gp-active-skill"],
          key: String(skillId),
        }),
      ]);
      throw new WeaponSkillChargeError(
        "MISSING_SKILL_CHARGE_SOURCE",
        skillId,
        level,
        "neither PVE nor GP contains the active skill",
        { attempts, cause: gpError },
      );
    }

    return Object.freeze({
      skillId,
      level: 1,
      chargeTime: readChargeTime(
        skillId,
        level,
        gpRow,
        "CooldownDuration",
      ),
      chargeCount: readChargeCount(
        skillId,
        level,
        gpRow,
        "MaxChargeStackCount",
      ),
      source: "gp_fallback",
      sourceKey: gpRow.key,
      row: gpRow,
    });
  }

  return Object.freeze({
    skillId,
    level: 1,
    chargeTime: readChargeTime(skillId, level, pveRow, "ChargeNeedTime"),
    chargeCount: readChargeCount(skillId, level, pveRow, "SkillCount"),
    source: "weapon_pve",
    sourceKey: pveRow.key,
    row: pveRow,
  });
}

function readPrototypeActiveSkillId(
  prototype: PrototypeSourceRow,
): number {
  const value = prototype.raw.ActiveSkillID;
  if (!isSafeNonNegativeInteger(value)) {
    throw new WeaponSkillChargeError(
      "INVALID_SKILL_AUDIT_SOURCE",
      0,
      1,
      `prototype ${prototype.sourcePath} key=${prototype.key} ActiveSkillID must be a non-negative safe integer`,
    );
  }
  return value;
}

function readItemActiveSkillId(
  item: ItemSourceRow,
): number | "missing" | "invalid" {
  const value = item.raw.Active_Skill_Detail;
  if (value === "" || value === undefined) return "missing";
  if (typeof value === "string" && /^[1-9]\d*$/.test(value)) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed)) return parsed;
  }
  return "invalid";
}

export function auditActiveSkillReference(
  reader: WeaponDataSourceReader,
  input: AuditActiveSkillReferenceInput,
): ActiveSkillReferenceAudit {
  if (!isSafeNonNegativeInteger(input.mdxActiveSkillId)) {
    throw new WeaponSkillChargeError(
      "INVALID_SKILL_REFERENCE",
      input.mdxActiveSkillId,
      1,
      "mdxActiveSkillId must be a non-negative safe integer",
    );
  }

  const prototype = reader.getPrototype({
    prototypeId: input.prototypeId,
    mode: 0,
    rowName: input.prototypeRowName,
  });
  const prototypeActiveSkillId = readPrototypeActiveSkillId(prototype);
  const issues: ActiveSkillAuditIssue[] = [];
  if (input.mdxActiveSkillId !== prototypeActiveSkillId) {
    issues.push(
      Object.freeze({
        code: "MDX_PROTOTYPE_SKILL_MISMATCH",
        severity: "error",
        mdxActiveSkillId: input.mdxActiveSkillId,
        prototypeActiveSkillId,
      }),
    );
  }

  let itemSelection: ActiveSkillReferenceAudit["itemSelection"] = "none";
  let itemCandidates: readonly ItemSourceRow[] = Object.freeze([]);
  if (input.itemId) {
    itemSelection = "explicit";
    itemCandidates = Object.freeze([reader.getItem(input.itemId)]);
  } else {
    itemCandidates = reader.findItemsByPrototypeId(input.prototypeId);
    if (itemCandidates.length === 1) {
      itemSelection = "model_id_candidate";
    } else if (itemCandidates.length > 1) {
      itemSelection = "ambiguous";
      issues.push(
        Object.freeze({
          code: "ITEM_SKILL_AMBIGUOUS",
          severity: "warning",
          candidateRowNames: Object.freeze(
            itemCandidates.map((candidate) => candidate.rowName),
          ),
        }),
      );
    }
  }

  if (itemCandidates.length === 1) {
    const item = itemCandidates[0];
    const itemActiveSkillId = readItemActiveSkillId(item);
    if (itemActiveSkillId === "missing") {
      issues.push(
        Object.freeze({
          code: "ITEM_SKILL_MISSING",
          severity: "info",
          itemRowName: item.rowName,
        }),
      );
    } else if (itemActiveSkillId === "invalid") {
      issues.push(
        Object.freeze({
          code: "ITEM_SKILL_INVALID",
          severity: "warning",
          itemRowName: item.rowName,
          rawValue: item.raw.Active_Skill_Detail,
        }),
      );
    } else if (itemActiveSkillId !== prototypeActiveSkillId) {
      issues.push(
        Object.freeze({
          code: "ITEM_PROTOTYPE_SKILL_MISMATCH",
          severity: "warning",
          itemRowName: item.rowName,
          itemActiveSkillId,
          prototypeActiveSkillId,
        }),
      );
    }
  }

  return Object.freeze({
    prototype,
    prototypeActiveSkillId,
    itemSelection,
    itemCandidates,
    issues: Object.freeze(issues),
  });
}
