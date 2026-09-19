import rawIndex from "@/data/num-skill-index.json";
import type { ResolvedNumSkill } from "@/lib/num-skill";

export interface IndexedWeaponSkill extends ResolvedNumSkill {
  weaponSlug: string;
  mode: "lc" | "td";
  draft: boolean;
}

export interface IndexedSkillVariant extends ResolvedNumSkill {
  perkItemId: string;
  perkSlug: string;
  channel: string;
  weaponSlug: string;
  baseSkillId: string;
  originalId: number;
  variantKey: string;
  operation: "replace";
}

export interface NumSkillIndex {
  schema_version: 1;
  provenance: { files: { path: string; sha256: string }[] };
  skills: IndexedWeaponSkill[];
  variants: IndexedSkillVariant[];
}

/** Lightweight projection only: no raw game tables or server resolver imports. */
export function createSkillIndexQueries(index: NumSkillIndex) {
  if (index.schema_version !== 1) throw new Error("Unsupported Num skill index");
  const byIdentity = new Map<string, IndexedWeaponSkill>();
  const byModifier = new Map<string, IndexedWeaponSkill[]>();
  for (const skill of index.skills) {
    const key = `${skill.weaponSlug}/${skill.mode}/${skill.id}`;
    if (byIdentity.has(key)) throw new Error(`Duplicate indexed skill: ${key}`);
    if (skill.mode !== "lc" && skill.mode !== "td") throw new Error(`Invalid indexed mode: ${key}`);
    byIdentity.set(key, skill);
    for (const provider of skill.modifierSources) {
      const previous = byModifier.get(provider) ?? [];
      if (previous.includes(skill)) throw new Error(`Duplicate indexed modifier relation: ${key}/${provider}`);
      previous.push(skill);
      byModifier.set(provider, previous);
    }
  }
  const variantKeys = new Set<string>();
  for (const variant of index.variants) {
    const key = `${variant.channel}/${variant.perkItemId}/${variant.weaponSlug}/${variant.baseSkillId}`;
    if (variantKeys.has(key)) throw new Error(`Duplicate indexed replacement: ${key}`);
    variantKeys.add(key);
    const bases = index.skills.filter(skill => skill.weaponSlug === variant.weaponSlug && skill.id === variant.baseSkillId);
    if (variant.operation !== "replace" || variant.kind !== "active" || !bases.length ||
        bases.some(base => base.kind !== "active" || base.gameSkillId !== variant.originalId || base.gameSkillId === variant.gameSkillId)) {
      throw new Error(`Invalid indexed replacement base: ${key}`);
    }
  }
  return {
    getWeaponSkill(slug: string, mode: "lc" | "td", id: string) {
      return byIdentity.get(`${slug}/${mode}/${id}`);
    },
    getSkillVariantsForWeapon(slug: string, mode?: "lc" | "td", skillId?: string, channel?: string) {
      return index.variants.filter(variant => variant.weaponSlug === slug &&
        (skillId === undefined || variant.baseSkillId === skillId) &&
        (channel === undefined || variant.channel === channel) &&
        (mode === undefined || byIdentity.has(`${slug}/${mode}/${variant.baseSkillId}`)));
    },
    getSkillsForModifier(providerId: string) {
      return [...(byModifier.get(providerId) ?? [])];
    },
  };
}

const queries = createSkillIndexQueries(rawIndex as NumSkillIndex);
export const getWeaponSkill = queries.getWeaponSkill;
export const getSkillVariantsForWeapon = queries.getSkillVariantsForWeapon;
export const getSkillsForModifier = queries.getSkillsForModifier;
