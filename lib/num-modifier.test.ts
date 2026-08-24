import assert from "node:assert/strict";
import test from "node:test";
import {
  NUM_MODIFIER_LOCK,
  NUM_MODIFIER_RESOLVER,
} from "@/lib/num-modifier-data";
import {
  NumModifierError,
  createNumModifierResolver,
} from "@/lib/num-modifier";
import type { NumModifierDataLock } from "@/lib/num-modifier-data-lock";

test("locks the complete LC modifier table", () => {
  assert.equal(NUM_MODIFIER_LOCK.sources.lc.row_count, 3044);
  assert.equal(Object.keys(NUM_MODIFIER_LOCK.rows.lc).length, 3044);
  assert.deepEqual(
    NUM_MODIFIER_RESOLVER.diagnostics.map((item) => item.code).sort(),
    ["EMPTY_ATTRIBUTE_NAME", "NON_STANDARD_ROW_NAME", "ROW_IDENTITY_MISMATCH"],
  );
});

test("uses exact row names and retains multiple rows for one modifier ID", () => {
  const rows = NUM_MODIFIER_RESOLVER.getRowsById("lc", 111010076);
  assert.deepEqual(
    rows.map((row) => row.key),
    ["lc:111010076_1_0", "lc:111010076_1_1"],
  );
  assert.equal(rows[0].attributeName, "GPAttributeSetCritical.CriticalRatio");
  assert.equal(rows[1].attributeName, "GPAttributeSetCritical.CriticalDamageRatio");
});

test("uses row_name as the authoritative modifier identity", () => {
  assert.deepEqual(
    NUM_MODIFIER_RESOLVER.getRowsById("lc", 111010094).map((row) => row.key),
    ["lc:111010094_1_0", "lc:111010094_1_1"],
  );
  assert.equal(NUM_MODIFIER_RESOLVER.getRow("lc:111010094_1_1").id, 111010094);
  assert.equal(
    NUM_MODIFIER_RESOLVER.getRowsById("lc", 111010096).some(
      (row) => row.key === "lc:111010094_1_1",
    ),
    false,
  );
});

test("resolves base, coefficient and scaled percentages", () => {
  assert.equal(
    NUM_MODIFIER_RESOLVER.resolveValue(
      { row: "lc:111010054_1_0", field: "base" },
      "percent",
    ).text,
    "2.5%",
  );
  assert.equal(
    NUM_MODIFIER_RESOLVER.resolveValue(
      { row: "lc:111010062_1_0", field: "coefficient", scale: 80 },
      "signed-percent",
    ).text,
    "+32%",
  );
});

test("resolves strict project templates", () => {
  const result = NUM_MODIFIER_RESOLVER.resolveTemplate(
    "每层**{{num:weakness-per-stack|percent}}**，六层**{{num:weakness-max|percent}}**。",
    {
      "weakness-per-stack": {
        row: "lc:111010061_1_0",
        field: "base",
      },
      "weakness-max": {
        row: "lc:111010061_1_0",
        field: "base",
        scale: 6,
      },
    },
  );
  assert.equal(result, "每层**7%**，六层**42%**。");
  assert.throws(
    () => NUM_MODIFIER_RESOLVER.resolveTemplate("{{num:missing|percent}}", {}),
    (error) => error instanceof NumModifierError && error.code === "INVALID_TEMPLATE",
  );
});

test("resolves original game GPModifier tokens through the same Lock", () => {
  const result = NUM_MODIFIER_RESOLVER.resolveGameModifierTokens(
    "获得{GPModifier:111010054:BaseValue:0:2:1}的增伤。",
  );
  assert.equal(result.text, "获得2.5%的增伤。");
  assert.deepEqual(result.unresolvedTokens, []);
});

test("original GPModifier tokens default to level one", () => {
  assert.deepEqual(
    NUM_MODIFIER_RESOLVER.resolveGameModifierTokens(
      "{GPModifier:111010061:BaseValue:0:2}",
    ),
    {
      text: "7%",
      unresolvedTokens: [],
    },
  );
});

test("original GPModifier tokens honor an explicit level", () => {
  assert.deepEqual(
    NUM_MODIFIER_RESOLVER.resolveGameModifierTokens(
      "{GPModifier:100200001:BaseValue:1:2:2}",
    ),
    {
      text: "-15%",
      unresolvedTokens: [],
    },
  );
});

test("invalid value fields and missing or ambiguous game tokens fail closed", () => {
  assert.throws(
    () =>
      NUM_MODIFIER_RESOLVER.resolveValue(
        {
          row: "lc:111010061_1_0",
          field: "description" as "base",
        },
        "percent",
        "test#invalid-field",
      ),
    /INVALID_EXPRESSION.*test#invalid-field/,
  );
  assert.deepEqual(
    NUM_MODIFIER_RESOLVER.resolveGameModifierTokens(
      "{GPModifier:999999999:BaseValue:0:2}",
    ).unresolvedTokens,
    ["{GPModifier:999999999:BaseValue:0:2}"],
  );

  const source = NUM_MODIFIER_LOCK.rows.lc["111010061_1_0"];
  const duplicateRowName = "111010061_1_00";
  const ambiguousResolver = createNumModifierResolver({
    ...NUM_MODIFIER_LOCK,
    sources: {
      lc: {
        ...NUM_MODIFIER_LOCK.sources.lc,
        row_count: NUM_MODIFIER_LOCK.sources.lc.row_count + 1,
      },
    },
    rows: {
      lc: {
        ...NUM_MODIFIER_LOCK.rows.lc,
        [duplicateRowName]: {
          row_name: duplicateRowName,
          raw: source.raw,
        },
      },
    },
  } as NumModifierDataLock);
  assert.deepEqual(
    ambiguousResolver.resolveGameModifierTokens(
      "{GPModifier:111010061:BaseValue:0:2}",
    ).unresolvedTokens,
    ["{GPModifier:111010061:BaseValue:0:2}"],
  );
});
