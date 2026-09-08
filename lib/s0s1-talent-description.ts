import type { LegacyTalentLevel } from "./s0s1-season-talents";

const missingValue = "〔数值待核实〕";

/** The configured description remains unchanged. Source wording is explicitly marked for the reader. */
export function legacyDescriptionParts(level: Pick<LegacyTalentLevel, "description" | "descriptionReferences">) {
  const chunks = level.description.split(missingValue);
  if (level.descriptionReferences && level.descriptionReferences.length !== chunks.length - 1) throw new Error("DESCRIPTION_REFERENCE_DRIFT");
  return chunks.flatMap((text, index) => {
    const normal = { text, reference: false };
    if (index === chunks.length - 1) return [normal];
    const original = level.descriptionReferences?.[index]?.text;
    // Unresolved game tokens and missing descriptions are not human-readable quantity references.
    const readable = original && /^(?:[+-]?\d+(?:\.\d+)?[%％]?|[零〇一二两三四五六七八九十百千万半]+)$/.test(original);
    return [normal, { text: readable ? original : missingValue, reference: !!readable }];
  });
}
