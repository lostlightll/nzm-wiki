import ironFistTalent from "@/data/season-talents/s3/iron-fist.json";
import passiveTalents from "@/data/season-talents/s3/passives.json";
import zeroTalent from "@/data/season-talents/s3/zero.json";
import summonDamageLockData from "@/data/summon-damage-lock.json";
import summonData from "@/data/summons.json";
import { getAllPerks } from "@/lib/perks";
import {
  buildDamageProfile,
  getApplicableModifierTypes,
  getProviderRelationsForSource,
} from "@/lib/multiplier-data";
import { getStatusEffectCatalog } from "@/lib/status-effects";
import { getResolvedFieldValue } from "@/lib/weapon-consumers";
import { getResolvedWeaponBySlug } from "@/lib/weapons";
import type {
  SummonBuffReference,
  SummonBuffView,
  SummonCatalogEntryView,
  SummonCatalogView,
  SummonDamageDefinition,
  SummonDamageLock,
  SummonDamageView,
  SummonDataLock,
  SummonPerkView,
  SummonSearchDocument,
  SummonTalentReference,
  SummonTalentView,
} from "@/types";

type TalentNode = {
  id: string;
  name: string;
  icon: string;
  descriptions: string[];
};

type TalentTree = {
  id: string;
  name: string;
  nodes: TalentNode[];
};

type PassiveTalent = {
  id: string;
  name: string;
  icon: string;
  description: string;
};

const data = summonData as SummonDataLock;
const damageLock = summonDamageLockData as SummonDamageLock;
const damageLockEntries = new Map(damageLock.entries.map((entry) => [entry.id, entry]));
const trees = new Map<string, TalentTree>(
  ([ironFistTalent, zeroTalent] as TalentTree[]).map((tree) => [tree.id, tree]),
);
const passives = new Map(
  (passiveTalents.passives as PassiveTalent[]).map((passive) => [passive.id, passive]),
);
const meaningfulDamageFactorIds = new Set([
  "dilution",
  "element",
  "element-vulnerability",
  "vulnerability",
]);

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function stripMarkup(value: string): string {
  return value
    .replace(/<qiangdiao>/g, "")
    .replace(/<\/>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\*\*/g, "")
    .trim();
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}

function formatDuration(values: readonly number[]): string {
  const labels = unique(values.map((value) => {
    if (value < 0) return "持续存在";
    if (value <= 0.1) return "瞬时";
    return `${formatNumber(value)} 秒`;
  }));
  return labels.length > 3 ? `${labels.slice(0, 3).join(" / ")} 等` : labels.join(" / ");
}

function formatStacks(values: readonly number[]): string {
  const stacks = unique(values.map((value) => `${value} 层`));
  return stacks.length > 3 ? `${stacks.slice(0, 3).join(" / ")} 等` : stacks.join(" / ");
}

function talentHref(reference: SummonTalentReference): string {
  const key = reference.kind === "node" ? "node" : "passive";
  return `/guides/season-talents/${reference.season}/${reference.tree}?${key}=${reference.id}#multiplier-provider-${key}-${reference.id}`;
}

function hydrateTalent(reference: SummonTalentReference): SummonTalentView {
  if (reference.kind === "passive") {
    const passive = passives.get(reference.id);
    if (!passive) throw new Error(`召唤物数据引用了不存在的 S3 被动：${reference.id}`);
    const source = {
      type: "season-talent" as const,
      season: reference.season,
      tree: reference.tree,
      passiveId: reference.id,
    };
    return {
      ...reference,
      name: passive.name,
      descriptions: [stripMarkup(passive.description)],
      icon: passive.icon,
      href: talentHref(reference),
      multiplierRelations: [...getProviderRelationsForSource(source)],
    };
  }

  const node = trees.get(reference.tree)?.nodes.find((item) => item.id === reference.id);
  if (!node) {
    throw new Error(`召唤物数据引用了不存在的 S3 节点：${reference.tree}:${reference.id}`);
  }
  const source = {
    type: "season-talent" as const,
    season: reference.season,
    tree: reference.tree,
    nodeId: reference.id,
  };
  return {
    ...reference,
    name: node.name,
    descriptions: node.descriptions.map(stripMarkup),
    icon: node.icon,
    href: talentHref(reference),
    multiplierRelations: [...getProviderRelationsForSource(source)],
  };
}

function hydratePerks(slugs: readonly string[]): SummonPerkView[] {
  const published = new Map(
    getAllPerks()
      .filter((perk) => perk.collectModItem === 1)
      .map((perk) => [perk.slug, perk]),
  );

  return slugs.map((slug) => {
    const perk = published.get(slug);
    if (!perk) throw new Error(`召唤物数据引用了未上线或不存在的插件：${slug}`);
    return {
      slug,
      name: perk.name,
      description: perk.description ? stripMarkup(perk.description) : undefined,
      icon: perk.icon ? `/webp/icons/perks/${perk.icon}.webp` : undefined,
      slot: perk.slot,
      rarity: String(perk.rarity),
      href: `/perks/${perk.slug}`,
      multiplierRelations: [...getProviderRelationsForSource({
        type: "perk",
        slot: perk.slot,
        slug: perk.id,
      })],
    };
  });
}

const statusEntries = new Map<string, ReturnType<typeof getStatusEffectCatalog>["entries"][number]>(
  (["enemy", "player"] as const).flatMap((target) =>
    getStatusEffectCatalog(target).entries.map((entry) => [
      `${target}:${entry.buffId}`,
      entry,
    ] as const),
  ),
);

function hydrateBuffs(references: readonly SummonBuffReference[]): SummonBuffView[] {
  const seen = new Set<string>();
  return references.flatMap((reference) => {
    const key = `${reference.target}:${reference.buffId}`;
    if (seen.has(key)) return [];
    seen.add(key);
    const entry = statusEntries.get(key);
    if (!entry) throw new Error(`召唤物数据引用了不可见 Buff：${key}`);
    const route = reference.target === "enemy" ? "enemy-buffs" : "player-buffs";
    const relationLabels = {
      applies: "施加给敌人",
      grants: "赋予召唤/玩家",
      enhances: "插件或天赋强化",
      consumes: "作为触发条件",
    } as const;
    return [{
      buffId: entry.buffId,
      name: entry.name,
      summary: entry.summary,
      icon: entry.icon,
      target: reference.target,
      relation: reference.relation,
      relationLabel: relationLabels[reference.relation],
      note: reference.note,
      polarities: entry.polarities,
      durationLabel: formatDuration(entry.variants.map((variant) => variant.duration)),
      stackLabel: formatStacks(entry.variants.map((variant) => variant.stackLimit)),
      href: `/posts/${route}?buff=${entry.buffId}#status-effect-${entry.buffId}`,
      multiplierRelations: entry.multiplierRelations,
    }];
  });
}

async function hydrateDamage(
  definition: SummonDamageDefinition,
): Promise<SummonDamageView> {
  if (definition.weaponSource) {
    const weapon = await getResolvedWeaponBySlug(definition.weaponSource.weaponSlug, "lc");
    const source = weapon?.damageSources.find(
      (item) => item.id === definition.weaponSource?.damageSourceId,
    );
    if (!weapon || !source) {
      throw new Error(
        `召唤物伤害引用不存在：${definition.weaponSource.weaponSlug}:${definition.weaponSource.damageSourceId}`,
      );
    }
    const coefficient = getResolvedFieldValue(source.damage.base);
    const element = getResolvedFieldValue(source.element);
    const enableCritical = getResolvedFieldValue(source.enableCritical);
    const enableWeakness = getResolvedFieldValue(source.enableWeakness);
    const weaknessMultiplier = getResolvedFieldValue(source.weaknessMultiplier);
    const resolvedInterval =
      definition.rate?.intervalSeconds ??
      getResolvedFieldValue(source.attack.interval) ??
      getResolvedFieldValue(source.fire.interval);
    const resolvedRpm =
      definition.rate?.roundsPerMinute ??
      getResolvedFieldValue(source.fire.rpm) ??
      (resolvedInterval && resolvedInterval > 0 ? 60 / resolvedInterval : undefined);
    const attacksPerAction =
      definition.rate?.attacksPerAction ??
      getResolvedFieldValue(source.attack.count) ??
      getResolvedFieldValue(source.fire.pellets);
    const profile = buildDamageProfile({
      section: source.section,
      settlements: source.settlements,
      element,
      enableCritical,
      enableWeakness,
    });
    return {
      ...definition,
      coefficient,
      attackStatLabel: "攻击力",
      baseAttack: damageLock.baseAttack,
      baseDamage: coefficient === undefined ? undefined : coefficient * damageLock.baseAttack,
      element,
      enableCritical,
      enableWeakness,
      weaknessMultiplier,
      settlements: [...source.settlements],
      intervalSeconds: resolvedInterval,
      roundsPerMinute: resolvedRpm,
      attacksPerAction,
      multiplierRelations: getApplicableModifierTypes(profile).filter((relation) =>
        meaningfulDamageFactorIds.has(relation.factorId),
      ) as SummonDamageView["multiplierRelations"],
      sourceHref: `/weapons/${encodeURIComponent(weapon.slug)}#damage-source-${encodeURIComponent(source.id)}`,
      sourceLabel: "武器数据锁",
    };
  }

  const locked = definition.lockSource
    ? damageLockEntries.get(definition.lockSource)
    : undefined;
  if (!locked) throw new Error(`召唤物伤害 ${definition.id} 缺少有效的伤害锁引用`);
  const coefficient = locked.rows.reduce((total, row) => total + row.coefficient, 0);
  const profile = buildDamageProfile({
    settlements: locked.settlements,
    element: locked.element,
    enableCritical: locked.enableCritical,
    enableWeakness: locked.enableWeakness,
  });
  return {
    ...definition,
    coefficient,
    attackStatLabel: locked.attackStat,
    baseAttack: damageLock.baseAttack,
    baseDamage: coefficient * damageLock.baseAttack,
    element: locked.element,
    enableCritical: locked.enableCritical,
    enableWeakness: locked.enableWeakness,
    weaknessMultiplier: locked.weaknessMultiplier,
    settlements: locked.settlements,
    intervalSeconds: definition.rate?.intervalSeconds,
    roundsPerMinute: definition.rate?.roundsPerMinute,
    attacksPerAction: definition.rate?.attacksPerAction,
    multiplierRelations: getApplicableModifierTypes(profile).filter((relation) =>
      meaningfulDamageFactorIds.has(relation.factorId),
    ) as SummonDamageView["multiplierRelations"],
    sourceLabel: "召唤伤害锁",
  };
}

export function assertSummonDamageLock(lock: SummonDamageLock = damageLock): void {
  if (lock.schemaVersion !== 1 || lock.mode !== "lc" || lock.baseAttack <= 0) {
    throw new Error("召唤伤害锁顶层结构无效");
  }
  const ids = new Set<string>();
  for (const entry of lock.entries) {
    if (!entry.id || ids.has(entry.id)) {
      throw new Error(`召唤伤害锁 ID 重复或为空：${entry.id}`);
    }
    ids.add(entry.id);
    if (entry.rows.length === 0) throw new Error(`召唤伤害锁 ${entry.id} 缺少 Numerical 行`);
    for (const row of entry.rows) {
      if (!Number.isInteger(row.id) || row.level <= 0 || row.coefficient <= 0) {
        throw new Error(`召唤伤害锁 ${entry.id} 包含无效 Numerical 行`);
      }
    }
  }
}

export function assertSummonDataLock(lock: SummonDataLock = data): void {
  if (lock.schemaVersion !== 1 || lock.mode !== "lc") {
    throw new Error("召唤物数据锁顶层结构无效");
  }
  const ids = new Set<string>();
  for (const summon of lock.summons) {
    if (!summon.id || ids.has(summon.id)) throw new Error(`召唤物 ID 重复或为空：${summon.id}`);
    ids.add(summon.id);
    const damageIds = new Set<string>();
    for (const damage of summon.damageSources) {
      if (!damage.id || damageIds.has(damage.id)) {
        throw new Error(`${summon.id} 的伤害 ID 重复或为空：${damage.id}`);
      }
      damageIds.add(damage.id);
      const sourceCount = Number(Boolean(damage.weaponSource)) + Number(Boolean(damage.lockSource));
      if (sourceCount !== 1) {
        throw new Error(`${summon.id}:${damage.id} 缺少伤害来源`);
      }
      if (damage.lockSource && !damageLockEntries.has(damage.lockSource)) {
        throw new Error(`${summon.id}:${damage.id} 引用了不存在的召唤伤害锁`);
      }
    }
  }
}

assertSummonDamageLock();
assertSummonDataLock();

export async function getSummonCatalog(): Promise<SummonCatalogView> {
  const entries: SummonCatalogEntryView[] = await Promise.all(
    data.summons.map(async (summon) => ({
      ...summon,
      damageSources: await Promise.all(summon.damageSources.map(hydrateDamage)),
      buffs: hydrateBuffs(summon.buffRefs),
      perks: hydratePerks(summon.perkSlugs),
      talents: summon.talentRefs.map(hydrateTalent),
    })),
  );

  return {
    entries,
    sharedSystems: data.sharedSystems,
    sharedBuffs: hydrateBuffs(data.sharedBuffRefs),
    sharedPerks: hydratePerks(data.sharedPerkSlugs),
    sharedTalents: data.sharedTalentRefs.map(hydrateTalent),
    totalDamageSources: entries.reduce((total, entry) => total + entry.damageSources.length, 0),
    verifiedRateCount: entries.reduce(
      (total, entry) => total + entry.damageSources.filter((source) => source.intervalSeconds).length,
      0,
    ),
    relatedBuffCount: new Set([
      ...data.sharedBuffRefs.map((reference) => reference.buffId),
      ...data.summons.flatMap((summon) => summon.buffRefs.map((reference) => reference.buffId)),
    ]).size,
  };
}

export function getSummonSearchDocuments(): SummonSearchDocument[] {
  const perks = new Map(getAllPerks().map((perk) => [perk.slug, perk]));
  return data.summons.flatMap((summon) => {
    const buffs = hydrateBuffs([
      ...data.sharedBuffRefs,
      ...summon.buffRefs,
      ...summon.mechanics.flatMap((mechanic) => mechanic.buffRefs ?? []),
    ]);
    const perkKeywords = [...data.sharedPerkSlugs, ...summon.perkSlugs].flatMap((slug) => {
      const perk = perks.get(slug);
      return perk ? [perk.name, stripMarkup(perk.description ?? "")] : [];
    });
    const commonKeywords = unique([
      summon.name,
      ...summon.aliases,
      summon.kindLabel,
      summon.summary,
      summon.deployment,
      summon.control,
      summon.targeting,
      summon.lifetime,
      summon.rateSummary,
      summon.perkSelectionNote ?? "",
      ...summon.searchTerms,
      ...summon.damageSources.flatMap((damage) => [damage.name, damage.role, damage.note ?? ""]),
      ...buffs.flatMap((buff) => [
        String(buff.buffId),
        buff.name,
        buff.summary,
        ...buff.multiplierRelations.flatMap((relation) => [
          relation.factorLabel,
          relation.modifierTypeLabel,
          relation.displayLabel,
        ]),
      ]),
      ...perkKeywords,
      "召唤物",
      "召唤物射速",
      "召唤物伤害",
      "增伤乘区",
      "Buff",
    ]);
    const documents: SummonSearchDocument[] = [{
      id: summon.id,
      title: summon.name,
      summonId: summon.id,
      kind: "summon",
      keywords: commonKeywords,
    }];
    for (const mechanic of summon.mechanics) {
      documents.push({
        id: `${summon.id}:${mechanic.id}`,
        title: `${summon.name} · ${mechanic.name}`,
        summonId: summon.id,
        section: mechanic.id,
        kind: "mechanic",
        keywords: unique([
          ...commonKeywords,
          mechanic.name,
          mechanic.summary,
          ...(mechanic.details ?? []),
          ...(mechanic.searchTerms ?? []),
        ]),
      });
    }
    return documents;
  });
}
