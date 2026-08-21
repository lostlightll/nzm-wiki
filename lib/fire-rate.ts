import { getAllOverlimitCards } from "@/lib/overlimit-cards";
import { getAllPerks } from "@/lib/perks";
import { getResolvedFieldValue } from "@/lib/weapon-consumers";
import { getResolvedWeaponBySlug } from "@/lib/weapons";
import type {
  EffectValueStage,
  OverlimitCard,
  Perk,
  PerkEffectValue,
} from "@/types";

export const FIRE_RATE_STAT_ID = "fire-rate" as const;

export type FireRateCatalogGroup = "weapons" | "perks" | "overlimit" | "base";

export interface WeaponFireRateSource {
  id: string;
  slug: string;
  name: string;
  skillName: string;
  stages: EffectValueStage[];
}

export const WEAPON_FIRE_RATE_SOURCES: readonly WeaponFireRateSource[] = [
  {
    id: "weapon:星海狂想:深寒冲击",
    slug: "星海狂想",
    name: "星海狂想",
    skillName: "深寒冲击",
    stages: [{ condition: "主动技能期间（8秒）", value: "+50%" }],
  },
  {
    id: "weapon:死亡猎手:急速狂热",
    slug: "死亡猎手",
    name: "死亡猎手",
    skillName: "急速狂热",
    stages: [{ condition: "主动技能期间", value: "+50%" }],
  },
  {
    id: "weapon:元宵来袭:吃汤圆咯",
    slug: "元宵来袭",
    name: "元宵来袭",
    skillName: "吃汤圆咯",
    stages: [{ condition: "拾取橙汤圆", value: "+40%" }],
  },
  {
    id: "weapon:死神猎手:穿射充能",
    slug: "死神猎手",
    name: "死神猎手",
    skillName: "穿射充能",
    stages: [{ condition: "主动技能充能满", value: "+40%" }],
  },
  {
    id: "weapon:爆星:齐射爆星",
    slug: "爆星",
    name: "爆星",
    skillName: "齐射爆星",
    stages: [{ condition: "主动技能期间", value: "+30%" }],
  },
  {
    id: "weapon:维和者:狂热射击",
    slug: "维和者",
    name: "维和者",
    skillName: "狂热射击",
    stages: [{ condition: "主动技能期间（8秒）", value: "+30%" }],
  },
  {
    id: "weapon:黄沙风暴:狂热射击",
    slug: "黄沙风暴",
    name: "黄沙风暴",
    skillName: "狂热射击",
    stages: [{ condition: "主动技能期间（8秒）", value: "+30%" }],
  },
  {
    id: "weapon:裁决之眼:过载暴击",
    slug: "裁决之眼",
    name: "裁决之眼",
    skillName: "过载暴击",
    stages: [{ condition: "造成暴击后（2秒）", value: "+30%" }],
  },
  {
    id: "weapon:超级复合弓:主动技能",
    slug: "超级复合弓",
    name: "超级复合弓",
    skillName: "主动技能",
    stages: [{ condition: "技能持续期间（8秒）", value: "+30%" }],
  },
  {
    id: "weapon:钢铁游隼:游隼之击",
    slug: "钢铁游隼",
    name: "钢铁游隼",
    skillName: "游隼之击",
    stages: [{ condition: "主动技能期间（10秒）", value: "+20%" }],
  },
  {
    id: "weapon:振弦:急速杀戮",
    slug: "振弦",
    name: "振弦",
    skillName: "急速杀戮",
    stages: [
      { condition: "每层", value: "+3%" },
      { condition: "5层", value: "+15%" },
    ],
  },
];

export const FIRE_RATE_EXCLUSIONS = [
  {
    id: "weapon:哈士奇好友:加油，哈士奇！",
    category: "summon-fire-rate",
    reason: "提升召唤物攻击频率，不是玩家枪械射速。",
  },
  {
    id: "category:melee-attack-speed",
    category: "melee-attack-speed",
    reason: "近战攻速不属于枪械射速。",
  },
  {
    id: "category:fixed-action-cadence",
    category: "fixed-action-cadence",
    reason: "固定动作或召唤物攻击间隔不属于枪械射速加成。",
  },
  {
    id: "resource:121200031",
    category: "obsolete",
    reason: "振弦旧版 +20% 配置，不是现行急速杀戮。",
  },
  {
    id: "resource:120600290",
    category: "no-public-entity",
    reason: "火神暴君没有站内正式武器实体。",
  },
  {
    id: "resource:121400010",
    category: "no-public-entity",
    reason: "层流冷焰没有站内正式武器实体。",
  },
  {
    id: "resource:120100200",
    category: "unverified-current-link",
    reason:
      "雷霆999 的正式主动技能描述不含射速；旧效果与现行充能被动的运行时关联尚未证实。",
  },
  {
    id: "resource:120700070",
    category: "unverified-current-link",
    reason:
      "乘风快递的正式主动技能描述不含射速，空中专线与现行技能的运行时关联尚未证实。",
  },
] as const;

interface BaseFireRateDefinition {
  slug: string;
  baseSourceId: string;
  maxSourceId: string;
  activeBonusPercent?: number;
}

const BASE_FIRE_RATE_DEFINITIONS: readonly BaseFireRateDefinition[] = [
  {
    slug: "星海狂想",
    baseSourceId: "primary-fire",
    maxSourceId: "passive-max-rate",
    activeBonusPercent: 50,
  },
  {
    slug: "纯白至上",
    baseSourceId: "pu-tong-she-ji",
    maxSourceId: "bei-dong-she-su",
  },
  {
    slug: "冥河之矛",
    baseSourceId: "pu-tong-she-ji",
    maxSourceId: "bei-dong-she-su",
  },
];

export interface BaseFireRateEntry {
  slug: string;
  name: string;
  baseInterval: number;
  baseRpm: number;
  maxInterval: number;
  maxRpm: number;
  multiplier: number;
  activeBonusPercent?: number;
  combinedMaxRpm?: number;
}

export function getFireRateEffect(
  effects: readonly PerkEffectValue[] | undefined,
): Extract<PerkEffectValue, { kind: "stat" }> | undefined {
  return effects?.find(
    (effect): effect is Extract<PerkEffectValue, { kind: "stat" }> =>
      effect.kind === "stat" && effect.statId === FIRE_RATE_STAT_ID,
  );
}

export function toWeaponFireRateEffect(
  source: WeaponFireRateSource,
): Extract<PerkEffectValue, { kind: "stat" }> {
  return {
    kind: "stat",
    statId: FIRE_RATE_STAT_ID,
    label: "射速",
    stages: source.stages,
  };
}

export function getWeaponFireRateSources(slug?: string): WeaponFireRateSource[] {
  return WEAPON_FIRE_RATE_SOURCES.filter(
    (source) => slug === undefined || source.slug === decodeURIComponent(slug),
  );
}

export function getPerkFireRateSources(): Array<{
  perk: Perk;
  effect: Extract<PerkEffectValue, { kind: "stat" }>;
}> {
  return getAllPerks()
    .flatMap((perk) => {
      const effect = getFireRateEffect(perk.effectValues);
      return effect ? [{ perk, effect }] : [];
    })
    .sort((left, right) => left.perk.name.localeCompare(right.perk.name, "zh-CN"));
}

export function getOverlimitFireRateSources(): Array<{
  card: OverlimitCard;
  effect: Extract<PerkEffectValue, { kind: "stat" }>;
}> {
  return getAllOverlimitCards()
    .flatMap((card) => {
      const effect = getFireRateEffect(card.effectValues);
      return effect ? [{ card, effect }] : [];
    })
    .sort((left, right) => left.card.name.localeCompare(right.card.name, "zh-CN"));
}

function requireFireRateValue(
  value: number | undefined,
  slug: string,
  sourceId: string,
  field: "interval" | "rpm",
): number {
  if (value === undefined) {
    throw new Error(`射速来源 ${slug}/${sourceId} 缺少 ${field}`);
  }
  return value;
}

export async function getBaseFireRateEntries(): Promise<BaseFireRateEntry[]> {
  return Promise.all(
    BASE_FIRE_RATE_DEFINITIONS.map(async (definition) => {
      const weapon = await getResolvedWeaponBySlug(definition.slug, "lc");
      if (!weapon) throw new Error(`基础射速武器不存在: ${definition.slug}`);

      const base = weapon.damageSources.find(
        (source) => source.id === definition.baseSourceId,
      );
      const max = weapon.damageSources.find(
        (source) => source.id === definition.maxSourceId,
      );
      if (!base || !max) {
        throw new Error(`基础射速来源不存在: ${definition.slug}`);
      }

      const baseInterval = requireFireRateValue(
        getResolvedFieldValue(base.fire.interval),
        definition.slug,
        definition.baseSourceId,
        "interval",
      );
      const baseRpm = requireFireRateValue(
        getResolvedFieldValue(base.fire.rpm),
        definition.slug,
        definition.baseSourceId,
        "rpm",
      );
      const maxInterval = requireFireRateValue(
        getResolvedFieldValue(max.fire.interval),
        definition.slug,
        definition.maxSourceId,
        "interval",
      );
      const maxRpm = requireFireRateValue(
        getResolvedFieldValue(max.fire.rpm),
        definition.slug,
        definition.maxSourceId,
        "rpm",
      );
      const activeBonusPercent = definition.activeBonusPercent;

      return {
        slug: definition.slug,
        name: weapon.title,
        baseInterval,
        baseRpm,
        maxInterval,
        maxRpm,
        multiplier: maxRpm / baseRpm,
        ...(activeBonusPercent === undefined
          ? {}
          : {
              activeBonusPercent,
              combinedMaxRpm: maxRpm * (1 + activeBonusPercent / 100),
            }),
      };
    }),
  );
}
