import { getPerkByItemId, getPerkBySlug } from "@/lib/perks";
import {
  getTriggerDamageByOverlimitId,
  getTriggerDamageByPerkSlug,
  type TriggerDamageEntry,
} from "@/lib/trigger-damage";
import { getResolvedFieldValue } from "@/lib/weapon-consumers";
import { getHealthSettlementDefinition } from "@/lib/weapon-health-settlement";
import { getResolvedWeaponBySlug } from "@/lib/weapons";
import type {
  Perk,
  PerkIndependentDamageSourceReference,
} from "@/types";

const HUNTING_GROUND_BASE_ATTACK = 500;

function formatNumber(value: number): string {
  return String(Math.round(value * 10_000) / 10_000);
}

async function resolveWeaponDamageSource(
  name: string,
  reference: PerkIndependentDamageSourceReference,
): Promise<TriggerDamageEntry> {
  const weapon = await getResolvedWeaponBySlug(reference.weaponSlug, "lc");
  if (!weapon) {
    throw new Error(
      `插件 ${name} 的独立伤害引用不存在武器 ${reference.weaponSlug}`,
    );
  }
  const source = weapon.damageSources.find(
    (candidate) => candidate.id === reference.damageSourceId,
  );
  if (!source) {
    throw new Error(
      `插件 ${name} 的独立伤害引用不存在来源 ${reference.weaponSlug}:${reference.damageSourceId}`,
    );
  }

  const numericalId = source.raw.numerical?.id;
  const healthType = getResolvedFieldValue(source.health.type);
  const damageScale = getResolvedFieldValue(source.damage.base);
  if (
    (typeof numericalId !== "number" && typeof numericalId !== "string") ||
    !healthType ||
    damageScale === undefined
  ) {
    throw new Error(
      `插件 ${name} 的独立伤害来源未解析完整 ${reference.weaponSlug}:${reference.damageSourceId}`,
    );
  }

  const toughness = getResolvedFieldValue(source.damage.toughness);
  const element = getResolvedFieldValue(source.element);
  const critical = getResolvedFieldValue(source.enableCritical);
  const weakpoint = getResolvedFieldValue(source.enableWeakness);
  const weakpointMultiplier = getResolvedFieldValue(source.weaknessMultiplier);

  return {
    name,
    trigger: reference.trigger,
    interval: reference.interval,
    numericalId: String(numericalId),
    damageType: getHealthSettlementDefinition(healthType).label,
    damageValue: formatNumber(damageScale * HUNTING_GROUND_BASE_ATTACK),
    toughness: toughness === undefined ? "-" : formatNumber(toughness),
    element: element ?? "-",
    critical: critical ?? null,
    weakpoint: weakpoint ?? null,
    weakpointMultiplier: weakpointMultiplier ?? null,
  };
}

async function resolvePerkReferences(
  perk: Perk | undefined,
): Promise<TriggerDamageEntry[]> {
  if (!perk?.independentDamageSources?.length) return [];
  return Promise.all(
    perk.independentDamageSources.map((reference) =>
      resolveWeaponDamageSource(perk.name, reference),
    ),
  );
}

export async function getIndependentDamageByPerkSlug(
  slug: string,
): Promise<TriggerDamageEntry[]> {
  const perk = getPerkBySlug(slug);
  const triggerDamage = getTriggerDamageByPerkSlug(slug);
  return [
    ...(triggerDamage ? [triggerDamage] : []),
    ...(await resolvePerkReferences(perk)),
  ];
}

export async function getIndependentDamageByOverlimitId(
  id: string,
): Promise<TriggerDamageEntry[]> {
  const perk = getPerkByItemId(id);
  const overlimitDamage = getTriggerDamageByOverlimitId(id);
  const perkDamage =
    !overlimitDamage && perk ? getTriggerDamageByPerkSlug(perk.slug) : undefined;
  return [
    ...(overlimitDamage ? [overlimitDamage] : perkDamage ? [perkDamage] : []),
    ...(await resolvePerkReferences(perk)),
  ];
}
