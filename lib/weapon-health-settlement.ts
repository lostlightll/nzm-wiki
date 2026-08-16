export const HEALTH_SETTLEMENT_PREFIX =
  "Numerical.SettlementType.Health." as const;

export const HEALTH_SETTLEMENT_TYPES = {
  WeaponDamage: {
    kind: "damage",
    label: "命中伤害",
    valueFormat: "attack-coefficient",
  },
  MeleeWeaponDamage: {
    kind: "damage",
    label: "近战伤害",
    valueFormat: "attack-coefficient",
  },
  WeaponExplosionDamage: {
    kind: "damage",
    label: "爆炸伤害",
    valueFormat: "attack-coefficient",
  },
  WeaponSkillDamage: {
    kind: "damage",
    label: "武器技能伤害",
    valueFormat: "attack-coefficient",
  },
  SkillDamage: {
    kind: "damage",
    label: "技能伤害",
    valueFormat: "attack-coefficient",
  },
  DebuffDamage: {
    kind: "damage",
    label: "持续伤害",
    valueFormat: "attack-coefficient",
  },
  IndirectDamage: {
    kind: "damage",
    label: "间接伤害",
    valueFormat: "attack-coefficient",
  },
  EnvironmentDamage: {
    kind: "damage",
    label: "环境伤害",
    valueFormat: "attack-coefficient",
  },
  CustomDamage: {
    kind: "damage",
    label: "自定义伤害",
    valueFormat: "attack-coefficient",
  },
  DeathExecute: {
    kind: "damage",
    label: "斩杀伤害",
    valueFormat: "attack-coefficient",
  },
  DropEnvironmentDamage: {
    kind: "damage",
    label: "坠落伤害",
    valueFormat: "attack-coefficient",
  },
  HealthThenShieldPercentRecover: {
    kind: "recovery",
    label: "生命/护盾恢复",
    valueFormat: "percentage",
  },
  CharStandardHealing: {
    kind: "recovery",
    label: "生命恢复",
    valueFormat: "percentage",
  },
  CharExtraShieldRecovery: {
    kind: "recovery",
    label: "临时护盾",
    valueFormat: "percentage",
  },
  CharStandardShieldRecovery: {
    kind: "recovery",
    label: "护盾恢复",
    valueFormat: "percentage",
  },
  CustomHealing: {
    kind: "recovery",
    label: "自定义治疗",
    valueFormat: "raw",
  },
  CustomExtraShield: {
    kind: "recovery",
    label: "自定义临时护盾",
    valueFormat: "raw",
  },
} as const;

export type WeaponHealthSettlementType = keyof typeof HEALTH_SETTLEMENT_TYPES;
export type WeaponHealthSettlementKind =
  (typeof HEALTH_SETTLEMENT_TYPES)[WeaponHealthSettlementType]["kind"];
export type WeaponHealthValueFormat =
  (typeof HEALTH_SETTLEMENT_TYPES)[WeaponHealthSettlementType]["valueFormat"];

export function isWeaponHealthSettlementType(
  value: string,
): value is WeaponHealthSettlementType {
  return value in HEALTH_SETTLEMENT_TYPES;
}

export function getHealthSettlementTag(
  type: WeaponHealthSettlementType,
): `${typeof HEALTH_SETTLEMENT_PREFIX}${WeaponHealthSettlementType}` {
  return `${HEALTH_SETTLEMENT_PREFIX}${type}`;
}

export function getHealthSettlementDefinition(
  type: WeaponHealthSettlementType,
): (typeof HEALTH_SETTLEMENT_TYPES)[WeaponHealthSettlementType] {
  return HEALTH_SETTLEMENT_TYPES[type];
}
