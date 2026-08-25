import { z } from "zod";

export const numModifierModeSchema = z.enum(["lc"]);
export type NumModifierMode = z.infer<typeof numModifierModeSchema>;

const sourceMetadataSchema = z.strictObject({
  source_path: z.string().trim().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  row_count: z.number().int().nonnegative(),
});

const lockRowSchema = z.strictObject({
  row_name: z.string().trim().min(1),
  raw: z.record(z.string(), z.json()),
});

export const numModifierDataLockSchema = z.strictObject({
  schema_version: z.literal(2),
  sources: z.strictObject({
    lc: z.strictObject({
      modifiers: sourceMetadataSchema,
      attribute_descriptions: sourceMetadataSchema,
    }),
  }),
  rows: z.strictObject({
    lc: z.record(z.string(), lockRowSchema),
  }),
  attribute_descriptions: z.strictObject({
    lc: z.record(z.string(), lockRowSchema),
  }),
});

export type NumModifierDataLock = z.infer<typeof numModifierDataLockSchema>;
export type NumModifierDataLockRow = z.infer<typeof lockRowSchema>;
export type NumModifierDataLockSource = z.infer<typeof sourceMetadataSchema>;

export type NumModifierDataLockErrorCode =
  | "INVALID_LOCK"
  | "MISSING_LOCK_ROW";

export class NumModifierDataLockError extends Error {
  readonly code: NumModifierDataLockErrorCode;
  readonly key?: string;
  readonly referencePath?: string;

  constructor(
    code: NumModifierDataLockErrorCode,
    detail: string,
    context: { key?: string; referencePath?: string; cause?: unknown } = {},
  ) {
    const keyText = context.key ? ` key=${context.key}` : "";
    const referenceText = context.referencePath
      ? ` reference=${context.referencePath}`
      : "";
    super(`[${code}] num-modifier-lock${keyText}${referenceText}: ${detail}`, {
      cause: context.cause,
    });
    this.name = "NumModifierDataLockError";
    this.code = code;
    this.key = context.key;
    this.referencePath = context.referencePath;
  }
}

export function parseNumModifierDataLock(input: unknown): NumModifierDataLock {
  const parsed = numModifierDataLockSchema.safeParse(input);
  if (!parsed.success) {
    throw new NumModifierDataLockError("INVALID_LOCK", z.prettifyError(parsed.error), {
      cause: parsed.error,
    });
  }
  return parsed.data;
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

export function serializeNumModifierDataLock(lock: NumModifierDataLock): string {
  const parsed = parseNumModifierDataLock(lock);
  return `${JSON.stringify(canonicalize(parsed), null, 2)}\n`;
}
