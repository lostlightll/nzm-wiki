import assert from "node:assert/strict";
import test from "node:test";
import { numSkillDefinitionsSchema, resolveNumSkill, resolvedNumSkillSchema, resolvedSkillVariantSchema, skillVariantCatalogSchema, skillVariantReferenceSchema, type NumSkillLock } from "./num-skill";
import { resolvePerkSkillVariants } from "./num-skill-data";

const base = { id: "active-1", kind: "active", name: "技能", icon: "/icons/test.png", game_skill_id: 100 };
const empty: NumSkillLock = { schema_version: 1, rows: {} };
const source = { path: "DataTables/GPActiveSkillDataTable.json", sha256: "a".repeat(64) };
const gp: NumSkillLock = { schema_version: 1, rows: { "s4-preview:gp:100": {
  row_name: "100", raw: { Duration: 10, CooldownDuration: 40, MaxChargeStackCount: 1, bPauseChargeDuringActivation: false }, source,
  pve_absence: { row_name: "100_1", source_path: "DataTables/SkillConfigTable_Weapon_PVE.json", sha256: "b".repeat(64) },
} } };

test("skill identity, parameter type and missing evidence fail closed", () => {
  assert.throws(() => numSkillDefinitionsSchema.parse([base, base]), /Duplicate/);
  assert.throws(() => resolveNumSkill({ ...base, parameters: { blocking: { literal: 0, reason: "旧记录", evidence: "mdx" } } }, { channel: "weapons", lock: empty }), /boolean/);
  assert.throws(() => resolveNumSkill({ ...base, parameters: { duration: { literal: 10 } } }, { channel: "weapons", lock: empty }));
  assert.throws(() => resolveNumSkill({ ...base, parameters: { count: { weapon_charge: "count" } } }, { channel: "weapons", lock: empty, gameSkillId: 101, charge: { count: 1 } }), /identity/);
});

test("base duration display semantics survive resolution only when explicitly declared", () => {
  const context = { channel: "current", lock: empty };
  assert.equal("durationIsBase" in resolveNumSkill(base, context), false);
  for (const duration_is_base of [true, false]) {
    const resolved = resolveNumSkill({ ...base, duration_is_base }, context);
    assert.equal(resolved.durationIsBase, duration_is_base);
    assert.equal(resolvedNumSkillSchema.parse(resolved).durationIsBase, duration_is_base);
  }
});

test("a PVE name and duration tag do not authorize an unaudited duration", () => {
  const skill = { ...base, parameters: { duration: { weapon_parameter: "BuffDuration" }, cooldown: { weapon_charge: "time" } } };
  const context = { channel: "weapons", lock: empty, gameSkillId: 100, charge: { cooldown: 40 }, pveParameters: [{ Name: "BuffDuration", Value: "27", Tags: ["SkillParamConfig.EffectDuration"] }] };
  assert.throws(() => resolveNumSkill(skill, context));
});

test("variants never inherit another season or silently select GP over PVE", () => {
  const skill = { ...base, parameters: { cooldown: { row: "s4-preview:gp:100", field: "CooldownDuration" }, blocking: { row: "s4-preview:gp:100", field: "bPauseChargeDuringActivation" } } };
  assert.deepEqual(resolveNumSkill(skill, { channel: "s4-preview", lock: gp }).parameters, { cooldown: 40, blocking: false });
  assert.throws(() => resolveNumSkill(skill, { channel: "current", lock: gp }), /cross-channel/);
  assert.throws(() => resolveNumSkill(skill, { channel: "s4-preview", lock: empty }), /missing/);
  const noAbsence = structuredClone(gp);
  delete noAbsence.rows["s4-preview:gp:100"].pve_absence;
  assert.throws(() => resolveNumSkill(skill, { channel: "s4-preview", lock: noAbsence }), /absence evidence/);
  assert.throws(() => resolveNumSkill(skill, { channel: "s4-preview", lock: { schema_version: 1, rows: { ...gp.rows, "s4-preview:pve:100_1": { row_name: "100_1", raw: { SkillID: 100, Level: 1, ChargeNeedTime: 20 }, source } } } }), /fallback forbidden/);
  assert.throws(() => resolveNumSkill({ ...base, parameters: { duration: { row: "s4-preview:gp:100", field: "CooldownDuration" } } }, { channel: "s4-preview", lock: gp }), /field does not match/);
});

test("frozen skill parameters cannot lose provenance or cite another skill field", () => {
  const [variant] = resolvePerkSkillVariants([{ weapon_slug: "雷霆之影", base_skill: "active-1", variant: "s4-preview:5104901", operation: "replace" }], "s4-preview");
  assert.throws(() => resolvedNumSkillSchema.parse({ ...variant.skill, provenance: {} }), /provenance/);
  assert.throws(() => resolvedNumSkillSchema.parse({ ...variant.skill, provenance: { ...variant.skill.provenance, cooldown: { row: "s4-preview:gp:9999999", field: "Duration" } } }), /mismatch/);
});

test("雷霆增幅 resolves by skill identity and rejects wrong bases and channels", () => {
  const references = [{ weapon_slug: "雷霆之影", base_skill: "active-1", variant: "s4-preview:5104901", operation: "replace" }];
  const [variant] = resolvePerkSkillVariants(references, "s4-preview");
  assert.ok("id" in variant.original);
  assert.equal(variant.original.id, 5000901);
  assert.equal(variant.skill.gameSkillId, 5104901);
  assert.deepEqual(variant.skill.parameters, { cooldown: 40, count: 1, duration: 10, blocking: false });
  assert.throws(() => resolvePerkSkillVariants(references), /Missing current/);
  assert.throws(() => resolvePerkSkillVariants(references, "s5-preview"), /Unregistered/);
  assert.throws(() => resolvePerkSkillVariants([{ ...references[0], base_skill: "passive-1" }], "s4-preview"), /identity mismatch/);
  assert.throws(() => resolvePerkSkillVariants([...references, ...references], "s4-preview"), /Duplicate/);
});

test("variant scopes and operations are explicit and reject unknown or mixed targets", () => {
  const generic = { scope: "all-weapons-active", variant: "current:100", operation: "replace" };
  skillVariantReferenceSchema.parse(generic);
  for (const invalid of [{ ...generic, scope: "all" }, { ...generic, weapon_slug: "test" }, { ...generic, operation: "modify" }]) {
    assert.throws(() => skillVariantReferenceSchema.parse(invalid));
  }
  const entry = { key: "current:100", channel: "current", base_game_skill_id: 100, operation: "modify", skill: base, evidence: ["audited"] };
  skillVariantCatalogSchema.parse({ schema_version: 1, variants: [entry] });
  assert.throws(() => skillVariantCatalogSchema.parse({ schema_version: 1, variants: [{ ...entry, operation: "replace" }] }), /identity mismatch/);
  assert.throws(() => skillVariantCatalogSchema.parse({ schema_version: 1, variants: [{ ...entry, base_game_skill_id: 101 }] }), /identity mismatch/);
  const skill = resolveNumSkill(base, { channel: "current", lock: empty });
  resolvedSkillVariantSchema.parse({ reference: generic, original: { scope: "all-weapons-active", name: "武器主动技能" }, skill });
  assert.throws(() => resolvedSkillVariantSchema.parse({ reference: generic, original: { id: 100, name: "wrong" }, skill }), /scope identity mismatch/);
  const specific = { weapon_slug: "test", base_skill: "active-1", variant: "current:100", operation: "modify" };
  resolvedSkillVariantSchema.parse({ reference: specific, original: { id: 100, name: "技能" }, skill });
  assert.throws(() => resolvedSkillVariantSchema.parse({ reference: { ...specific, operation: "replace" }, original: { id: 100, name: "技能" }, skill }), /identity mismatch/);
});
