import { z } from "zod";

export const weaponDataLockKindSchema = z.enum([
  "numerical-lc",
  "numerical-td",
  "asc",
  "feel",
  "item",
  "skill-pve",
  "gp-active-skill",
]);

export const WEAPON_DATA_LOCK_KINDS = weaponDataLockKindSchema.options;

const sourceMetadataSchema = z.strictObject({
  source_path: z.string().trim().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

const lockRowSchema = z.strictObject({
  row_name: z.string().trim().min(1),
  raw: z.record(z.string(), z.json()),
});

const rowsByKindSchema = z.strictObject({
  "numerical-lc": z.record(z.string(), lockRowSchema),
  "numerical-td": z.record(z.string(), lockRowSchema),
  asc: z.record(z.string(), lockRowSchema),
  feel: z.record(z.string(), lockRowSchema),
  item: z.record(z.string(), lockRowSchema),
  "skill-pve": z.record(z.string(), lockRowSchema),
  "gp-active-skill": z.record(z.string(), lockRowSchema),
});

const sourcesByKindSchema = z.strictObject({
  "numerical-lc": sourceMetadataSchema,
  "numerical-td": sourceMetadataSchema,
  asc: sourceMetadataSchema,
  feel: sourceMetadataSchema,
  item: sourceMetadataSchema,
  "skill-pve": sourceMetadataSchema,
  "gp-active-skill": sourceMetadataSchema,
});

const activeSkillLockSchema = z.strictObject({
  source: z.enum(["weapon_pve", "gp_fallback"]),
  source_key: z.string().trim().min(1),
});

export const weaponDataLockSchema = z.strictObject({
  schema_version: z.literal(1),
  game_content_version: z.string().trim().min(1).optional(),
  sources: sourcesByKindSchema,
  rows: rowsByKindSchema,
  active_skills: z.record(
    z.string().regex(/^[1-9]\d*_1$/),
    activeSkillLockSchema,
  ),
});

export type WeaponDataLockKind = z.infer<typeof weaponDataLockKindSchema>;
export type WeaponDataLockRow = z.infer<typeof lockRowSchema>;
export type WeaponDataLockSource = z.infer<typeof sourceMetadataSchema>;
export type WeaponDataLockActiveSkill = z.infer<typeof activeSkillLockSchema>;
export type WeaponDataLock = z.infer<typeof weaponDataLockSchema>;

export type WeaponDataLockErrorCode = "INVALID_LOCK" | "MISSING_LOCK_ROW";

export class WeaponDataLockError extends Error {
  readonly code: WeaponDataLockErrorCode;
  readonly kind?: WeaponDataLockKind;
  readonly key?: string;
  readonly referencePath?: string;

  constructor(
    code: WeaponDataLockErrorCode,
    detail: string,
    context: {
      kind?: WeaponDataLockKind;
      key?: string;
      referencePath?: string;
      cause?: unknown;
    } = {},
  ) {
    const kindText = context.kind ? ` kind=${context.kind}` : "";
    const keyText = context.key ? ` key=${context.key}` : "";
    const referenceText = context.referencePath
      ? ` reference=${context.referencePath}`
      : "";
    super(`[${code}] weapon-data-lock${kindText}${keyText}${referenceText}: ${detail}`, {
      cause: context.cause,
    });
    this.name = "WeaponDataLockError";
    this.code = code;
    this.kind = context.kind;
    this.key = context.key;
    this.referencePath = context.referencePath;
  }
}

export function parseWeaponDataLock(input: unknown): WeaponDataLock {
  const parsed = weaponDataLockSchema.safeParse(input);
  if (!parsed.success) {
    throw new WeaponDataLockError("INVALID_LOCK", z.prettifyError(parsed.error), {
      cause: parsed.error,
    });
  }
  return parsed.data;
}

export function getWeaponDataLockRow(
  lock: WeaponDataLock,
  kind: WeaponDataLockKind,
  key: string,
  referencePath?: string,
): WeaponDataLockRow {
  const row = lock.rows[kind][key];
  if (!row) {
    throw new WeaponDataLockError("MISSING_LOCK_ROW", "referenced row is not locked", {
      kind,
      key,
      referencePath,
    });
  }
  return row;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

export function serializeWeaponDataLock(lock: WeaponDataLock): string {
  const parsed = parseWeaponDataLock(lock);
  return `${JSON.stringify(canonicalize(parsed), null, 2)}\n`;
}
