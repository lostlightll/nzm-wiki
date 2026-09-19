import type { ReactNode } from "react";
import { ActiveSkill, PassiveSkill } from "@/components/WeaponSkill";
import type { ResolvedNumSkill } from "@/lib/num-skill";
import { getNumSkillValue } from "@/lib/num-skill-data";

/** Bind MDX references to the already resolved, mode-specific weapon document. */
export function createNumWeaponSkillComponents(skills: readonly ResolvedNumSkill[]) {
  const byId = new Map(skills.map(skill => [skill.id, skill]));
  const find = (id: string) => {
    const entry = byId.get(id);
    if (!entry) throw new Error(`Unknown weapon skill: ${id}`);
    return entry;
  };
  const render = (kind: "active" | "passive", id: string, children: ReactNode) => {
    const skill = find(id);
    if (skill.kind !== kind || !skill.display || !skill.icon) throw new Error(`Invalid ${kind} skill: ${id}`);
    const Component = kind === "active" ? ActiveSkill : PassiveSkill;
    return <Component name={skill.name} icon={skill.icon} duration={skill.parameters.duration} cooldown={skill.parameters.cooldown} count={skill.parameters.count}>{children}</Component>;
  };
  return {
    ActiveSkill: ({ skill, children }: { skill: string; children?: ReactNode }) => render("active", skill, children),
    PassiveSkill: ({ skill, children }: { skill: string; children?: ReactNode }) => render("passive", skill, children),
    SkillValue: ({ skill, field, mge }: { skill: string; field: "duration" | "cooldown"; mge?: number }) => {
      return <>{Number(getNumSkillValue(find(skill), field, mge).toFixed(6))}</>;
    },
  };
}
