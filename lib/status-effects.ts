import statusEffectRelations from "@/data/status-effect-relations.json";
import statusEffectData from "@/data/status-effects.json";
import {
  MULTIPLIER_FACTORS,
  MODIFIER_TYPES,
  getSourcesForModifierType,
  resolveMultiplierFactorHref,
} from "@/lib/multiplier-data";
import { NUM_MODIFIER_RESOLVER } from "@/lib/num-modifier-data";
import type {
  MultiplierRelation,
  MultiplierSource,
} from "@/lib/multiplier-data";
import type { ResolvedModifierEffect } from "@/lib/num-modifier";
import type {
  StatusEffectCatalogEntry,
  StatusEffectCatalogViewEntry,
  ElementStatusViewSummary,
  StatusEffectDataLock,
  StatusEffectModifierReference,
  StatusEffectMultiplierRelation,
  StatusEffectNumericalReference,
  StatusEffectRelatedContent,
  StatusEffectRelatedContentType,
  StatusEffectSearchDocument,
  StatusEffectSemanticGroup,
  StatusEffectSemanticGroupId,
  StatusEffectTarget,
  StatusEffectVariant,
} from "@/types";

const data = statusEffectData as unknown as StatusEffectDataLock;

type ConfirmedSourceRelation = {
  sourceId: string;
  sourceType: "perk";
  itemId: string;
  title: string;
  slot: 1 | 2 | 3 | 4;
  slug: string;
  overlimitCard: boolean;
  buffId: number;
  rowName: string;
  configName: string;
  evidence: {
    kind: "mge-add-buff";
    passiveSkillId: string;
    mgeId: string;
    addCall: string;
  };
};

type ConfirmedSourceRelationLock = {
  schemaVersion: 1;
  relations: ConfirmedSourceRelation[];
};

const confirmedSourceRelations = (
  statusEffectRelations as unknown as ConfirmedSourceRelationLock
).relations;

const ENEMY_GROUPS: readonly StatusEffectSemanticGroup[] = [
  {
    id: "elemental",
    label: "四元素异常",
    description: "灼烧、冰缓、感电与溶解等元素状态。",
  },
  {
    id: "vulnerability",
    label: "易伤与防御削弱",
    description: "让目标承受更多伤害，或削弱其防护能力。",
  },
  {
    id: "control",
    label: "控制与行动限制",
    description: "减速、冰冻、禁锢、嘲讽等限制行动的效果。",
  },
  {
    id: "damage-over-time",
    label: "持续与触发伤害",
    description: "按周期结算，或满足条件后额外触发伤害。",
  },
  {
    id: "special",
    label: "标记与特殊机制",
    description: "用于技能联动、标记、计数或其他特殊规则。",
  },
];

const PLAYER_GROUPS: readonly StatusEffectSemanticGroup[] = [
  {
    id: "offense",
    label: "增伤与输出",
    description: "伤害、暴击、攻击、射速及元素输出强化。",
  },
  {
    id: "defense",
    label: "护盾与减伤",
    description: "护盾、免伤、无敌、生命上限和承伤降低。",
  },
  {
    id: "sustain",
    label: "治疗与恢复",
    description: "生命、护盾及其他持续恢复效果。",
  },
  {
    id: "mobility",
    label: "机动与操作",
    description: "移动、换弹、切枪、后坐力及操作手感变化。",
  },
  {
    id: "resource",
    label: "弹药与技能资源",
    description: "弹药、能量、充能、冷却和技能次数变化。",
  },
  {
    id: "negative",
    label: "负面与异常",
    description: "施加在玩家身上的减速、持续伤害和其他负面状态。",
  },
  {
    id: "special",
    label: "特殊状态",
    description: "技能联动、计数、准备状态或无法归入常规属性的效果。",
  },
];

const GROUPS_BY_TARGET = {
  enemy: ENEMY_GROUPS,
  player: PLAYER_GROUPS,
} as const;

const GROUP_BY_ID = new Map<StatusEffectSemanticGroupId, StatusEffectSemanticGroup>(
  [...ENEMY_GROUPS, ...PLAYER_GROUPS].map((group) => [group.id, group]),
);

const ELEMENT_PATTERN = /灼烧|燃烧|冰缓|冰冻|感电|电弧|溶解|腐蚀/i;
const CONTROL_PATTERN = /减速|缓速|冰冻|眩晕|定身|禁锢|沉默|嘲讽|击飞|无法.{0,4}行动|行动速度|移动速度降低/i;
const DOT_PATTERN = /持续.{0,4}伤害|每.{0,5}秒.{0,12}伤害|流血|中毒|灼烧|燃烧/i;
const DEFENSE_PATTERN = /护盾|减伤|伤害减免|承受.{0,5}降低|受到.{0,5}降低|免伤|无敌|最大生命|生命上限|防御/i;
const SUSTAIN_PATTERN = /治疗|恢复.{0,5}(生命|护盾)|生命恢复|回血|复活/i;
const MOBILITY_PATTERN = /移动速度|移速|换弹|切枪|装填|射速|后坐力|散布|准确|冲刺|闪避|跳跃|蓄力速度/i;
const RESOURCE_PATTERN = /弹药|弹匣|能量|充能|冷却|技能次数|技能消耗|技能恢复/i;
const OFFENSE_PATTERN = /增伤|伤害.{0,6}(提高|增加|提升)|攻击力|攻击.{0,4}(提高|增加|提升)|暴击|弱点|近程|远程|元素伤害/i;
const INTERNAL_ONLY_PATTERN = /测试|test|废弃|弃用|占位|策划用|不要用/i;
const REMOVED_ELEMENT_STATUS_ROWS = new Set([
  "Cryo_S2_Decelerate",
  "Shock_S2_Fragile",
]);
const ENEMY_STATUS_SUMMARY_OVERRIDES = new Map([
  ["Fire", "每 2 秒受到 10 × 当前层数的火焰伤害，并减少 1 层。"],
  [
    "Corossive",
    "每 1 秒受到 5 × 当前层数的腐蚀伤害，最多叠加 10 层。",
  ],
]);

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function pickReferences<T>(
  source: Record<string, T[]>,
  ids: Set<number>,
): Record<string, T[]> {
  return Object.fromEntries(
    [...ids]
      .sort((left, right) => left - right)
      .flatMap((id) => {
        const value = source[String(id)];
        return value ? [[String(id), value] as const] : [];
      }),
  );
}

export function isStatusEffectVariantVisibleForTarget(
  variant: StatusEffectVariant,
  target: StatusEffectTarget,
): boolean {
  if (target === "enemy") {
    return (
      variant.polarity === "negative" &&
      (variant.displayMask === 2 || variant.displayMask === 3)
    );
  }
  return (
    variant.displayMask === 1 ||
    variant.displayMask === 3 ||
    variant.displayMask === 4
  );
}

function targetEntry(
  entry: StatusEffectCatalogEntry,
  target: StatusEffectTarget,
): StatusEffectCatalogEntry {
  const variants = entry.variants.filter((variant) =>
    isStatusEffectVariantVisibleForTarget(variant, target),
  );
  return {
    ...entry,
    name: variants.find((variant) => variant.name)?.name || entry.name,
    names: unique(variants.map((variant) => variant.name).filter(Boolean)),
    descriptions: unique(
      variants.map((variant) => variant.description).filter(Boolean),
    ),
    categories: unique(variants.map((variant) => variant.category)),
    polarities: unique(variants.map((variant) => variant.polarity)),
    targets: [target],
    icon: variants.find((variant) => variant.icon)?.icon ?? entry.icon,
    variants,
  };
}

function resolvedEffectsForEntry(
  entry: StatusEffectCatalogEntry,
  target: StatusEffectTarget,
): Array<{ modifierId: number; effect: ResolvedModifierEffect }> {
  const effects: Array<{ modifierId: number; effect: ResolvedModifierEffect }> = [];
  for (const modifierId of unique(
    entry.variants.flatMap((variant) => variant.modifierIds),
  )) {
    for (const row of NUM_MODIFIER_RESOLVER.getRowsById("lc", modifierId)) {
      const field = row.baseValue !== 0 ? "base" : "coefficient";
      effects.push({
        modifierId,
        effect: NUM_MODIFIER_RESOLVER.resolveEffect(
          { row: row.key, field },
          { recipient: target === "enemy" ? "enemy" : "self" },
          `status-effect:${entry.buffId}:modifier:${modifierId}`,
        ),
      });
    }
  }
  return effects;
}

const MULTIPLIER_FACTORS_WITH_MODIFIER_DETAIL = new Set([
  "dilution",
  "element",
  "element-vulnerability",
  "vulnerability",
]);

function getMultiplierDisplayLabel(
  factorId: string,
  factorLabel: string,
  modifierTypeLabel: string,
): string {
  return MULTIPLIER_FACTORS_WITH_MODIFIER_DETAIL.has(factorId)
    ? `${factorLabel} · ${modifierTypeLabel}`
    : factorLabel;
}

function getMultiplierRelations(
  entry: StatusEffectCatalogEntry,
  target: StatusEffectTarget,
): StatusEffectMultiplierRelation[] {
  const grouped = new Map<string, StatusEffectMultiplierRelation>();
  for (const { modifierId, effect } of resolvedEffectsForEntry(entry, target)) {
    for (const facet of effect.facets) {
      if (facet.consumer !== "damage") continue;
      const modifier = MODIFIER_TYPES.find((candidate) => candidate.facetId === facet.id);
      if (!modifier) continue;
      const existing = grouped.get(modifier.id);
      if (existing) {
        existing.modifierIds = unique([...existing.modifierIds, modifierId]);
        continue;
      }
      const factorLabel =
        MULTIPLIER_FACTORS.find((factor) => factor.id === modifier.factorId)?.label ??
        modifier.label;
      grouped.set(modifier.id, {
        factorId: modifier.factorId,
        factorLabel,
        modifierTypeId: modifier.id,
        modifierTypeLabel: modifier.label,
        displayLabel: getMultiplierDisplayLabel(
          modifier.factorId,
          factorLabel,
          modifier.label,
        ),
        modifierIds: [modifierId],
        href: resolveMultiplierFactorHref(modifier.factorId, {
          view: "providers",
          modifierTypeId: modifier.id,
        }),
      });
    }
  }
  return [...grouped.values()];
}

function sourceType(
  source: Exclude<MultiplierSource, { type: "card" }>,
): StatusEffectRelatedContentType {
  return source.type;
}

function sourceTypeLabel(type: StatusEffectRelatedContentType): string {
  switch (type) {
    case "perk":
      return "插件";
    case "overlimit-card":
      return "超限卡片";
    case "season-talent":
      return "赛季天赋";
    case "weapon":
      return "武器技能";
    case "overlimit-bond":
      return "超限羁绊";
    case "post":
      return "机制文章";
  }
}

function confirmedSourcesForEntry(entry: StatusEffectCatalogEntry) {
  const rowNames = new Set(entry.variants.map((variant) => variant.rowName));
  return confirmedSourceRelations.filter(
    (relation) =>
      relation.buffId === entry.buffId && rowNames.has(relation.rowName),
  );
}

function confirmedRelatedContent(
  entry: StatusEffectCatalogEntry,
): StatusEffectRelatedContent[] {
  return confirmedSourcesForEntry(entry).flatMap((relation) => {
    const shared = {
      relation: "confirmed-source" as const,
      relationLabel: "确认施加来源",
      factorLabels: [] as string[],
    };
    const perk: StatusEffectRelatedContent = {
      ...shared,
      id: relation.sourceId,
      type: "perk",
      typeLabel: "插件",
      title: relation.title,
      href: `/perks/slot-${relation.slot}/${relation.slug}`,
      note: "已沿插件被动技能与 MGE 的 AddBuff 调用确认到此 Buff。",
    };
    if (!relation.overlimitCard) return [perk];
    return [
      perk,
      {
        ...shared,
        id: `overlimit-card:${relation.itemId}`,
        type: "overlimit-card",
        typeLabel: "超限卡片",
        title: relation.title,
        href: `/overlimit/${relation.itemId}`,
        note: "与该插件共享来源身份；具体卡片数值以卡片详情页为准。",
      },
    ];
  });
}

function relatedContentFromRelation(
  relation: MultiplierRelation,
): StatusEffectRelatedContent | null {
  if (!relation.source || !relation.sourceHref || !relation.effectLabel) return null;
  if (relation.source.type === "card") return null;
  if (
    relation.source.type === "season-talent" &&
    relation.source.season.toLocaleLowerCase() !== "s3"
  ) {
    return null;
  }
  const type = sourceType(relation.source);
  return {
    id: `${type}:${relation.effectId ?? relation.sourceHref}`,
    type,
    typeLabel: sourceTypeLabel(type),
    title: relation.effectLabel,
    href: relation.sourceHref,
    relation: "same-multiplier",
    relationLabel: "同乘区参考",
    note: "使用同一伤害通道，不代表它会施加这个 Buff。",
    factorLabels: [relation.factorLabel],
    season:
      relation.source.type === "season-talent"
        ? relation.source.season.toLocaleUpperCase()
        : undefined,
  };
}

function pickSameMultiplierContent(
  multiplierRelations: readonly StatusEffectMultiplierRelation[],
  excludedHrefs: ReadonlySet<string>,
): StatusEffectRelatedContent[] {
  const candidates = multiplierRelations.flatMap((multiplier) =>
    getSourcesForModifierType(multiplier.modifierTypeId)
      .map(relatedContentFromRelation)
      .filter((item): item is StatusEffectRelatedContent => item !== null)
      .filter((item) => !excludedHrefs.has(item.href))
      .map((item) => ({
        ...item,
        factorLabels: unique([...item.factorLabels, multiplier.factorLabel]),
      })),
  );
  const deduped = [
    ...new Map(candidates.map((item) => [`${item.type}:${item.href}`, item])).values(),
  ];
  const typeOrder: readonly StatusEffectRelatedContentType[] = [
    "perk",
    "overlimit-card",
    "season-talent",
    "weapon",
    "overlimit-bond",
    "post",
  ];
  const picked: StatusEffectRelatedContent[] = [];
  for (const type of typeOrder) {
    const match = deduped.find((item) => item.type === type);
    if (match) picked.push(match);
  }
  for (const candidate of deduped) {
    if (picked.length >= 10) break;
    if (!picked.some((item) => item.id === candidate.id && item.href === candidate.href)) {
      picked.push(candidate);
    }
  }
  return picked;
}

function getRelatedContent(
  entry: StatusEffectCatalogEntry,
  multiplierRelations: readonly StatusEffectMultiplierRelation[],
): StatusEffectRelatedContent[] {
  const confirmed = confirmedRelatedContent(entry);
  const confirmedHrefs = new Set(confirmed.map((item) => item.href));
  return [
    ...confirmed,
    ...pickSameMultiplierContent(multiplierRelations, confirmedHrefs),
  ];
}

function hasPositiveBearDamageReduction(entry: StatusEffectCatalogEntry): boolean {
  return resolvedEffectsForEntry(entry, "player").some(
    ({ effect }) => effect.facets.some((facet) => facet.id === "damage-reduction"),
  );
}

function semanticGroup(
  entry: StatusEffectCatalogEntry,
  target: StatusEffectTarget,
  multiplierRelations: readonly StatusEffectMultiplierRelation[],
): StatusEffectSemanticGroup {
  const text = [entry.name, ...entry.names, ...entry.descriptions].join(" ");
  const categories = new Set(entry.categories);
  const structuredFacets = new Set(
    resolvedEffectsForEntry(entry, target).flatMap(({ effect }) =>
      effect.facets.map((facet) => facet.id),
    ),
  );
  const hasStructuredEffects = resolvedEffectsForEntry(entry, target).some(
    ({ effect }) => effect.attribute.disposition === "indexed",
  );
  let id: StatusEffectSemanticGroupId;

  if (target === "enemy") {
    if (ELEMENT_PATTERN.test(text)) id = "elemental";
    else if (
      multiplierRelations.some(
        (relation) =>
          relation.modifierTypeId === "vulnerability" ||
          relation.modifierTypeId === "element-vulnerability",
      ) ||
       (!hasStructuredEffects && /易伤|受到.{0,6}伤害.{0,4}(增加|提高|提升)|防御.{0,4}降低/i.test(text))
     ) id = "vulnerability";
    else if (
      structuredFacets.has("slow") ||
      categories.has("SpeedDown") ||
      categories.has("Frozen") ||
      (!hasStructuredEffects && CONTROL_PATTERN.test(text))
    ) {
      id = "control";
    } else if (
      categories.has("DotDamage") ||
      entry.variants.some((variant) => variant.numericalId !== null) ||
      DOT_PATTERN.test(text)
    ) id = "damage-over-time";
    else id = "special";
  } else if (entry.polarities.includes("negative")) {
    id = "negative";
  } else if (
    multiplierRelations.length > 0 ||
    structuredFacets.has("critical-rate") ||
    structuredFacets.has("toughness-efficiency") ||
    (!hasStructuredEffects && OFFENSE_PATTERN.test(text))
  ) {
    id = "offense";
  } else if (
    categories.has("TemporaryShield") ||
    categories.has("Invincible") ||
    categories.has("NoInjured") ||
    hasPositiveBearDamageReduction(entry) ||
    (!hasStructuredEffects && DEFENSE_PATTERN.test(text))
  ) {
    id = "defense";
  } else if (categories.has("Recovery") || SUSTAIN_PATTERN.test(text)) {
    id = "sustain";
  } else if (RESOURCE_PATTERN.test(text)) {
    id = "resource";
  } else if (MOBILITY_PATTERN.test(text)) {
    id = "mobility";
  } else {
    id = "special";
  }
  return GROUP_BY_ID.get(id) ?? GROUP_BY_ID.get("special")!;
}

function humanizeDescription(description: string): string {
  return description.replace(
    /\{(-?\d+(?:\.\d+)?)\*<bufflevel>(?:%\.?\d*f)?\}(%?)/gi,
    (_match, value: string, percent: string) =>
      `每级 ${value}${percent ? "%" : ""}`,
  );
}

function isPracticalEntry(
  entry: StatusEffectCatalogEntry,
  target: StatusEffectTarget,
  group: StatusEffectSemanticGroup,
  multiplierRelations: readonly StatusEffectMultiplierRelation[],
  relatedContent: readonly StatusEffectRelatedContent[],
): boolean {
  const text = [entry.name, ...entry.names, ...entry.descriptions].join(" ");
  if (INTERNAL_ONLY_PATTERN.test(text)) return false;
  if (
    entry.variants.every((variant) =>
      REMOVED_ELEMENT_STATUS_ROWS.has(variant.rowName),
    )
  ) {
    return false;
  }
  if (target === "enemy") return true;
  if (relatedContent.some((item) => item.relation === "confirmed-source")) return true;
  if (multiplierRelations.length > 0) return true;
  if (group.id !== "special") return true;
  return entry.descriptions.some((description) => description.trim().length >= 8);
}

function enrichEntry(
  rawEntry: StatusEffectCatalogEntry,
  target: StatusEffectTarget,
): StatusEffectCatalogViewEntry {
  const entry = targetEntry(rawEntry, target);
  const multiplierRelations = getMultiplierRelations(entry, target);
  const relatedContent = getRelatedContent(entry, multiplierRelations);
  const group = semanticGroup(entry, target, multiplierRelations);
  const summaryOverride =
    target === "enemy"
      ? entry.variants
          .map((variant) => ENEMY_STATUS_SUMMARY_OVERRIDES.get(variant.rowName))
          .find(Boolean)
      : undefined;
  const summary =
    summaryOverride ??
    humanizeDescription(entry.descriptions[0] || group.description);
  const searchTerms = unique([
    String(entry.buffId),
    entry.name,
    ...entry.names,
    ...entry.descriptions,
    ...entry.categories,
    ...entry.variants.flatMap((variant) => [variant.rowName, variant.name]),
    group.label,
    group.description,
    ...multiplierRelations.flatMap((relation) => [
      relation.factorLabel,
      relation.modifierTypeLabel,
      "增伤乘区",
    ]),
    ...relatedContent.flatMap((item) => [
      item.title,
      item.typeLabel,
      item.relationLabel,
      ...item.factorLabels,
    ]),
  ]);
  return {
    ...entry,
    group,
    summary,
    practical: isPracticalEntry(
      entry,
      target,
      group,
      multiplierRelations,
      relatedContent,
    ),
    multiplierRelations,
    relatedContent,
    searchTerms,
  };
}

function sortCatalogEntries(
  entries: StatusEffectCatalogViewEntry[],
  target: StatusEffectTarget,
): StatusEffectCatalogViewEntry[] {
  const groupOrder = new Map(
    GROUPS_BY_TARGET[target].map((group, index) => [group.id, index]),
  );
  return entries.sort((left, right) => {
    const groupDifference =
      (groupOrder.get(left.group.id) ?? 99) -
      (groupOrder.get(right.group.id) ?? 99);
    if (groupDifference !== 0) return groupDifference;
    const confirmedDifference =
      right.relatedContent.filter((item) => item.relation === "confirmed-source").length -
      left.relatedContent.filter((item) => item.relation === "confirmed-source").length;
    if (confirmedDifference !== 0) return confirmedDifference;
    const multiplierDifference =
      right.multiplierRelations.length - left.multiplierRelations.length;
    if (multiplierDifference !== 0) return multiplierDifference;
    const nameDifference = left.name.localeCompare(right.name, "zh-CN");
    return nameDifference || left.buffId - right.buffId;
  });
}

export function getStatusEffectSemanticGroups(target: StatusEffectTarget) {
  return GROUPS_BY_TARGET[target];
}

export function getStatusEffectCatalog(target: StatusEffectTarget): {
  entries: StatusEffectCatalogViewEntry[];
  modifiers: Record<string, StatusEffectModifierReference[]>;
  numericals: Record<string, StatusEffectNumericalReference[]>;
} {
  const entries = sortCatalogEntries(
    data.effects
      .filter((entry) => entry.targets.includes(target))
      .map((entry) => enrichEntry(entry, target)),
    target,
  );
  const modifierIds = new Set(
    entries.flatMap((entry) =>
      entry.variants.flatMap((variant) => variant.modifierIds),
    ),
  );
  const numericalIds = new Set(
    entries.flatMap((entry) =>
      entry.variants.flatMap((variant) =>
        variant.numericalId === null ? [] : [variant.numericalId],
      ),
    ),
  );
  const modifiers = Object.fromEntries(
    [...modifierIds]
      .sort((left, right) => left - right)
      .flatMap((modifierId) => {
        const rows = NUM_MODIFIER_RESOLVER.getRowsById("lc", modifierId).map(
          (row): StatusEffectModifierReference => {
            const effect = NUM_MODIFIER_RESOLVER.resolveEffect(
              {
                row: row.key,
                field: row.baseValue !== 0 ? "base" : "coefficient",
              },
              { recipient: target === "enemy" ? "enemy" : "self" },
              `status-effect-catalog:${target}:modifier:${modifierId}`,
            );
            return {
              id: row.id,
              level: row.level,
              attributeName: row.attributeName,
              attributeLabel: effect.attribute.label,
              attributeTypeId: effect.attribute.typeId,
              operation: row.operation,
              operationModel: effect.operation.model,
              direction: effect.direction,
              facetLabels: effect.facets.map((facet) => facet.label),
              baseValue: row.baseValue,
              coefficient: row.coefficient,
              description: row.description,
            };
          },
        );
        return rows.length > 0 ? [[String(modifierId), rows] as const] : [];
      }),
  );

  return {
    entries,
    modifiers,
    numericals: pickReferences(data.references.numericals, numericalIds),
  };
}

export function getStatusEffectSearchDocuments(): StatusEffectSearchDocument[] {
  const enemy = getStatusEffectCatalog("enemy").entries.filter(
    (entry) => entry.practical,
  );
  const enemyIds = new Set(enemy.map((entry) => entry.buffId));
  const player = getStatusEffectCatalog("player").entries.filter(
    (entry) => entry.practical && !enemyIds.has(entry.buffId),
  );
  return [...enemy, ...player].map((entry) => ({
    buffId: entry.buffId,
    title: entry.name,
    target: entry.targets[0],
    keywords: unique([
      ...entry.searchTerms,
      entry.targets[0] === "enemy" ? "敌方 Debuff" : "玩家 Buff",
      "状态效果",
    ]),
  }));
}

export function getElementStatusSummaries(): ElementStatusViewSummary[] {
  return data.elements.map((element): ElementStatusViewSummary => {
    const enemyBuffNames = new Set(element.enemyBuffNames);
    const enemyStatus = data.effects
      .flatMap((effect) => effect.variants)
      .find(
        (variant) =>
          enemyBuffNames.has(variant.rowName) &&
          isStatusEffectVariantVisibleForTarget(variant, "enemy"),
      );

    if (!enemyStatus) {
      throw new Error(`四元素摘要缺少敌方 Buff 主配置：${element.name}`);
    }

    return {
      ...element,
      enemyStatus,
    };
  });
}
