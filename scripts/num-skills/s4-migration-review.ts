/** Reviewed S4 changes, separate from the immutable original migration baseline. */
export const s4HeaderChanges = [
  {
    slug: "樱之殇",
    before: '    source:\n      numerical:\n        id: 121300473\n        level: 1\n      asc_type_id: "343"',
    after: '    sources:\n      td:\n        numerical:\n          id: 121300473\n          level: 1\n        asc_type_id: "343"',
    reason: "S4正式LC表移除121300473_1；只保留仍有配置的TD来源。",
  },
  {
    slug: "猪猪捏捏乐",
    before: 'prototype_id: "20013000050"\n',
    after: 'prototype_id: "20013000050"\nprototype_rows:\n  "0": 猪猪侠捏捏乐\n',
    reason: "S4 Prototype同身份多候选，显式选择已核对的猪猪侠捏捏乐行。",
  },
] as const;

export const s4SkillChanges = [
  {
    slug: "炼狱蝎王",
    skillId: "active-1",
    parameter: "cooldown",
    before: 30,
    after: 40,
    sourceKind: "skill-pve",
    sourceKey: "5104101_1",
    sourceField: "ChargeNeedTime",
    evidence: "docs/standards/weapon-skills.md#s4正式服与历史迁移回归",
  },
] as const;
