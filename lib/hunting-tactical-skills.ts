import rawHuntingTacticalSkills from "@/data/guides/hunting-tactical-skills.json";

export type HuntingTacticalSkillAvailability = "permanent" | "limited";

export type HuntingTacticalSkill = {
  id: number;
  name: string;
  description: string;
  icon: string;
  availability: HuntingTacticalSkillAvailability;
};

type RawHuntingTacticalSkillData = {
  schemaVersion: 1;
  skills: HuntingTacticalSkill[];
};

function assertHuntingTacticalSkillData(
  value: unknown,
): asserts value is RawHuntingTacticalSkillData {
  if (!value || typeof value !== "object") {
    throw new Error("猎场战术技能数据无效");
  }

  const data = value as Partial<RawHuntingTacticalSkillData>;
  if (data.schemaVersion !== 1 || !Array.isArray(data.skills)) {
    throw new Error("猎场战术技能顶层数据无效");
  }

  const ids = new Set<number>();
  const names = new Set<string>();

  for (const skill of data.skills) {
    if (
      !Number.isInteger(skill.id) ||
      ids.has(skill.id) ||
      typeof skill.name !== "string" ||
      skill.name.length === 0 ||
      names.has(skill.name) ||
      typeof skill.description !== "string" ||
      skill.description.length === 0 ||
      typeof skill.icon !== "string" ||
      !skill.icon.startsWith("/") ||
      (skill.availability !== "permanent" &&
        skill.availability !== "limited")
    ) {
      throw new Error("猎场战术技能条目无效");
    }

    ids.add(skill.id);
    names.add(skill.name);
  }
}

assertHuntingTacticalSkillData(rawHuntingTacticalSkills);

export const HUNTING_TACTICAL_SKILLS: readonly HuntingTacticalSkill[] =
  rawHuntingTacticalSkills.skills;
