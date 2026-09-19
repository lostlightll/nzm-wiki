import assert from "node:assert/strict";
import test from "node:test";
import { createSkillIndexQueries, type IndexedWeaponSkill, type NumSkillIndex } from "../../lib/num-skill-index";
import type { NumSkillDefinition, ResolvedSkillVariant } from "../../lib/num-skill";
import { parseModifierProviderRegistry } from "../../lib/modifier-provider-registry";
import { projectSkillVariants, validateSkillMarkup, validateSkillProviders } from "./project";

const active: NumSkillDefinition = { id: "active", kind: "active", name: "力场", icon: "/icon.png", game_skill_id: 1001 };
const passive: NumSkillDefinition = { id: "passive", kind: "passive", name: "充能", icon: "/icon.png" };
const base: IndexedWeaponSkill = {
  id: "active", kind: "active", name: "力场", icon: "/icon.png", gameSkillId: 1001,
  display: true, parameters: { cooldown: 40 }, modifierSources: ["weapon:test:力场"],
  provenance: {}, weaponSlug: "test", mode: "lc", draft: false,
};
const replacement: ResolvedSkillVariant = {
  reference: { weapon_slug: "test", base_skill: "active", variant: "s4-replacement", operation: "replace" },
  original: { id: 1001, name: "力场" },
  skill: {
    id: "replacement", kind: "active", name: "强化力场", gameSkillId: 1002,
    display: true, parameters: { cooldown: 30, blocking: false }, modifierSources: [],
    provenance: { cooldown: { row: "s4-preview:pve:1002_1", field: "ChargeNeedTime" } },
  },
};
const context = { perkItemId: "2001", perkSlug: "preview/slot-4/强化", channel: "s4-preview" };

test("migration validates every visible skill while preserving nested mode-specific bodies", () => {
  const body = '<ActiveSkill skill="active"><GameMode only="lc">150%</GameMode><GameMode only="td">105%</GameMode></ActiveSkill>\n<PassiveSkill skill="passive">充能</PassiveSkill>';
  assert.equal(validateSkillMarkup(body, [active, passive], "weapon"), 2);
  assert.equal(validateSkillMarkup("", [{ ...active, display: false }], "weapon"), 0);
  for (const broken of [
    '<ActiveSkill skill="active" duration={10}>旧值</ActiveSkill>',
    '<ActiveSkill name="力场">旧名称</ActiveSkill>',
    '<ActiveSkill skill={"active"}>动态引用</ActiveSkill>',
    '<ActiveSkill skill="missing" />',
    '<PassiveSkill skill="active" />',
    '<ActiveSkill skill="active" /><ActiveSkill skill="active" />',
    "",
  ]) assert.throws(() => validateSkillMarkup(broken, [active], "weapon"));
  assert.throws(() => validateSkillMarkup('<ActiveSkill skill="active" />', [{ ...active, display: false }], "weapon"), /hidden/);
});

test("provider migration cannot silently lose an existing source or attach it to another skill", () => {
  const registry = parseModifierProviderRegistry({
    schemaVersion: 1, evidencePriority: ["identity"],
    providers: [{ id: "weapon:test:力场", label: "test·力场", source: { type: "weapon", slug: "test", skillName: "力场", component: "ActiveSkill" },
      applications: [{ expression: { row: "lc:1_1_0", field: "base" }, context: { recipient: "self" } }], evidence: { kind: "gp-modifier" } }],
    exclusions: [],
  });
  validateSkillProviders([base, { ...base, mode: "td" }], registry);
  assert.throws(() => validateSkillProviders([{ ...base, modifierSources: [] }], registry), /Unreferenced/);
  assert.throws(() => validateSkillProviders([{ ...base, name: "另一技能" }], registry), /invalid modifier provider/);
  assert.throws(() => validateSkillProviders([base, { ...base, mode: "td", modifierSources: [] }], registry), /Unreferenced/);
});

test("published replacement projection rejects channel leakage, missing bases and repeated replacements", () => {
  const result = projectSkillVariants([replacement], context, [base]);
  assert.equal(result[0].parameters.cooldown, 30);
  assert.equal(result[0].channel, "s4-preview");
  assert.throws(() => projectSkillVariants([replacement], { ...context, channel: "current" }, [base]), /Cross-channel/);
  assert.throws(() => projectSkillVariants([replacement], context, []), /base/);
  assert.throws(() => projectSkillVariants([replacement, replacement], context, [base]), /Duplicate/);
  assert.throws(() => projectSkillVariants([{ ...replacement, original: { id: 999, name: "错绑" } }], context, [base]), /base/);
});

test("reverse queries retain both modes and diagnose broken index relationships", () => {
  const index: NumSkillIndex = {
    schema_version: 1, provenance: { files: [] },
    skills: [base, { ...base, mode: "td", parameters: { cooldown: 50 } }],
    variants: projectSkillVariants([replacement], context, [base]),
  };
  const query = createSkillIndexQueries(index);
  assert.equal(query.getWeaponSkill("test", "td", "active")?.parameters.cooldown, 50);
  assert.equal(query.getWeaponSkill("missing", "lc", "active"), undefined);
  assert.equal(query.getSkillsForModifier("weapon:test:力场").length, 2);
  assert.equal(query.getSkillVariantsForWeapon("test", "td", "active").length, 1);
  assert.equal(query.getSkillVariantsForWeapon("test", "lc", "passive").length, 0);
  assert.equal(query.getSkillVariantsForWeapon("test", "lc", "active", "current").length, 0);
  assert.throws(() => createSkillIndexQueries({ ...index, skills: [base, base] }), /Duplicate/);
  assert.throws(() => createSkillIndexQueries({ ...index, skills: [] }), /replacement base/);
  assert.throws(() => createSkillIndexQueries({ ...index, variants: [...index.variants, ...index.variants] }), /Duplicate/);
});
