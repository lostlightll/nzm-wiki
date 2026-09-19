import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import rawWeaponLock from "@/data/weapon-data-lock.json";
import rawVariants from "@/data/num-skill-variants.json";
import { createWeaponResolver } from "@/lib/weapon-resolver";
import { NUM_SKILL_LOCK } from "@/lib/num-skill-lock";
import { getActivePreview, getPreviewSeasonKey } from "@/lib/content-preview";
import { getModifierProvider } from "@/lib/modifier-index";
import { resolveNumSkill, skillVariantCatalogSchema, skillVariantReferenceSchema, type ResolvedNumSkill, type ResolvedSkillVariant } from "@/lib/num-skill";
import { resolveRuntimeDuration } from "@/lib/num-skill-runtime";
import { parseWeaponDataLock } from "@/lib/weapon-data-lock";

const resolver = createWeaponResolver(rawWeaponLock);
export const NUM_SKILL_VARIANTS = skillVariantCatalogSchema.parse(rawVariants);

/** Used by prose and tests so equipped-MGE numbers use the same audited branch. */
export function getNumSkillValue(skill: ResolvedNumSkill, field: "duration" | "cooldown", mge?: number): number {
  const value = skill.parameters[field];
  if (value === undefined) throw new Error(`Missing skill value: ${skill.id}.${field}`);
  if (mge === undefined) return value;
  const expression = skill.provenance[field];
  if (field !== "duration" || !expression || !("runtime" in expression) || expression.with_mge !== undefined) throw new Error("MGE requires an unmodified audited duration reference");
  const lock = parseWeaponDataLock(rawWeaponLock);
  const row = lock.rows["skill-pve"][`${skill.gameSkillId}_1`];
  return resolveRuntimeDuration({ ...expression, with_mge: mge }, {
    channel: "weapons", gameSkillId: skill.gameSkillId, bindings: NUM_SKILL_LOCK.runtime,
    pveParameters: row?.raw.Parameters, pveSourceHash: row?.source?.sha256 ?? lock.sources["skill-pve"].sha256,
  });
}

export function resolveWeaponSkills(data: unknown, slug: string, mode: "lc" | "td"): ResolvedNumSkill[] {
  const weapon = resolver.resolveWeapon(data, { slug, expectedTable: mode });
  const skills = weapon.skills ?? [];
  for (const skill of skills) {
    for (const providerId of skill.modifierSources) {
      const provider = getModifierProvider(providerId);
      if (!provider || provider.source.type !== "weapon" || provider.source.slug !== slug || provider.source.skillName !== skill.name || provider.source.component !== (skill.kind === "active" ? "ActiveSkill" : "PassiveSkill")) throw new Error(`${slug}/${skill.id}: invalid Num Modifier relation ${providerId}`);
    }
  }
  return skills;
}

export function resolvePerkSkillVariants(value: unknown, season?: string): ResolvedSkillVariant[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length === 0) throw new Error("skill_variants must be a nonempty array");
  const channel = season?.endsWith("-preview") ? season : "current";
  const active = getActivePreview();
  if (channel !== "current" && (!active || channel !== getPreviewSeasonKey(active))) throw new Error(`Unregistered skill variant channel: ${channel}`);
  const seen = new Set<string>();
  return value.map(input => {
    const reference = skillVariantReferenceSchema.parse(input);
    if ("weapon_slug" in reference && /[/\\]|^\.{1,2}$/.test(reference.weapon_slug)) throw new Error("Invalid weapon slug");
    const key = "scope" in reference ? reference.scope : `${reference.weapon_slug}/${reference.base_skill}`;
    if (seen.has(key)) throw new Error(`Duplicate skill replacement: ${key}`);
    seen.add(key);
    const variant = NUM_SKILL_VARIANTS.variants.find(entry => entry.key === reference.variant && entry.channel === channel);
    if (!variant) throw new Error(`Missing ${channel} variant: ${reference.variant}`);
    if (reference.operation !== (variant.operation ?? "replace") || ("scope" in reference) !== ("scope" in variant)) throw new Error(`Skill variant scope or operation mismatch: ${reference.variant}`);
    const skill = resolveNumSkill(variant.skill, { channel, lock: NUM_SKILL_LOCK });
    if ("scope" in reference) {
      return { reference, original: { scope: reference.scope, name: "武器主动技能" }, skill };
    }
    if ("scope" in variant) throw new Error(`Skill variant scope mismatch: ${reference.variant}`);
    const weaponSource = matter(fs.readFileSync(path.join(process.cwd(), "data/weapons", `${reference.weapon_slug}.mdx`), "utf8")).data;
    const base = resolveWeaponSkills(weaponSource, reference.weapon_slug, "lc").find(skill => skill.id === reference.base_skill);
    if (!base || base.kind !== "active" || base.gameSkillId !== variant.base_game_skill_id) throw new Error(`Skill replacement base identity mismatch: ${key}`);
    if (skill.kind !== "active" || (reference.operation === "modify") !== (skill.gameSkillId === base.gameSkillId)) throw new Error(`Invalid replacement variant: ${reference.variant}`);
    return { reference, original: { id: base.gameSkillId, name: base.name }, skill };
  });
}
