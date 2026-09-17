import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { getPerkByName } from "@/lib/perks";
import {
  createPerkModifierResolverSelector,
  NUM_MODIFIER_LOCK,
  NUM_MODIFIER_RESOLVER,
} from "@/lib/num-modifier-data";

const rowName = "111010083_1_0";
const expression = { row: `lc:${rowName}` as const, field: "base" as const };

function previewEvidence() {
  return {
    schema_version: 1,
    season: "s4",
    source: { path: "preview/selected-table.json", sha256: "a".repeat(64) },
    rows: {
      [rowName]: {
        ...NUM_MODIFIER_LOCK.rows.lc[rowName].raw,
        BaseValue: 0.5,
      },
    },
  };
}

test("preview season overrides selected rows without changing official consumers", () => {
  const selectResolver = createPerkModifierResolverSelector(previewEvidence());
  const official = selectResolver("s3");
  const preview = selectResolver("s4-preview");
  const bindings = { toughness: expression };

  assert.equal(official.resolveValue(expression, "percent").text, "12.5%");
  assert.equal(preview.resolveValue(expression, "percent").text, "50%");
  assert.equal(
    preview.resolveTemplate("提升{{num:toughness|percent}}", bindings),
    "提升50%",
  );
  assert.equal(preview.resolveEffect(expression).value.value, 0.5);
  assert.equal(official.resolveEffect(expression).value.value, 0.125);
  assert.equal(NUM_MODIFIER_LOCK.rows.lc[rowName].raw.BaseValue, 0.125);
  assert.equal(selectResolver(undefined), NUM_MODIFIER_RESOLVER);
  assert.equal(selectResolver("pending"), NUM_MODIFIER_RESOLVER);
  assert.equal(selectResolver("s4"), NUM_MODIFIER_RESOLVER);
  assert.ok(official.getRow("lc:111010076_1_0"));
  assert.throws(() => preview.getRow("lc:111010076_1_0"), /MISSING_ROW/);
});

test("future previews require matching configured evidence and never fall back to official rows", () => {
  const evidence = { ...previewEvidence(), season: "s5" };
  const select = createPerkModifierResolverSelector(evidence, { season: "s5", version: "s5-preview", label: "S5 Preview" });
  assert.equal(select("s5-preview").resolveValue(expression, "percent").text, "50%");
  assert.equal(select("s4"), NUM_MODIFIER_RESOLVER);
  assert.throws(() => select("s4-preview"), /matching preview/);
  assert.throws(() => createPerkModifierResolverSelector(evidence)("s4-preview"), /matching preview/);
  const disabled = createPerkModifierResolverSelector(evidence, null);
  assert.throws(() => disabled("s5-preview"), /matching preview/);
  assert.equal(disabled("s5"), NUM_MODIFIER_RESOLVER);
  const missing = Object.keys(NUM_MODIFIER_LOCK.rows.lc).find(key => !(key in evidence.rows))!;
  assert.throws(() => select("s5-preview").resolveValue({ row: `lc:${missing}`, field: "base" }, "number"), /MISSING_ROW/);
});

test("preview evidence rejects malformed Numerical fields and provenance", () => {
  for (const [field, value] of [
    ["ID", 0],
    ["Level", 1.5],
    ["AttributeName", ""],
    ["GPModifierOp", ""],
    ["BaseValue", "0.5"],
    ["CoefValue", Infinity],
  ]) {
    const evidence = previewEvidence();
    const raw: Record<string, unknown> = evidence.rows[rowName];
    raw[String(field)] = value;
    assert.throws(() => createPerkModifierResolverSelector(evidence), String(field));
  }
  const evidence = previewEvidence();
  evidence.source.sha256 = "unverified";
  assert.throws(() => createPerkModifierResolverSelector(evidence));
});

test("preview icons retain numeric suffix separators through frontmatter and the perk reader", () => {
  for (const [name, icon] of [
    ["光暗死神", "1312071002_1"],
    ["火神爆发", "1312074004_2"],
  ]) {
    const perk = getPerkByName(name);
    assert.equal(perk?.icon, icon);
    assert.ok(existsSync(`public/icons/perks/${icon}.png`));
    assert.ok(existsSync(`public/webp/icons/perks/${icon}.webp`));
  }
});
