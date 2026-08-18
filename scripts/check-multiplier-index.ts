import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import overlimitBonds from "@/data/overlimit-bonds.json";
import overlimitCards from "@/data/overlimit-cards.json";
import passives from "@/data/season-talents/s3/passives.json";
import grapplingHook from "@/data/season-talents/s3/grappling-hook.json";
import ironFist from "@/data/season-talents/s3/iron-fist.json";
import zero from "@/data/season-talents/s3/zero.json";
import huntingSpeedrun from "@/data/guides/hunting-speedrun.json";
import { getAllOverlimitCards } from "@/lib/overlimit-cards";
import {
  MODIFIER_TYPES,
  MULTIPLIER_FACTORS,
  MULTIPLIER_PROVIDERS,
  MULTIPLIER_PROVIDER_EXCLUSIONS,
  PROVIDER_RELATIONS,
  getProviderRelationsForSource,
  getSourcesForModifierType,
  resolveMultiplierSourceHref,
  type MultiplierSource,
} from "@/lib/multiplier-data";

const root = process.cwd();
const errors: string[] = [];
const cardIds = new Set(overlimitCards.map((card) => String(card.id)));
const modifierTypeIds = new Set(MODIFIER_TYPES.map((modifier) => modifier.id));
const factorIds = new Set(MULTIPLIER_FACTORS.map((factor) => factor.id));
const coveredIds = new Set([
  ...MULTIPLIER_PROVIDERS.map((provider) => provider.id),
  ...MULTIPLIER_PROVIDER_EXCLUSIONS.map((exclusion) => exclusion.id),
]);
const bondStages = new Set(
  overlimitBonds.flatMap((bond) =>
    bond.effects.map((effect) => `${bond.name}:${effect.count}`),
  ),
);
const speedrunCardsById = new Map(
  huntingSpeedrun.cards.map((card) => [card.cardId, card]),
);
const hydratedOverlimitCards = getAllOverlimitCards();
const overlimitProviders = MULTIPLIER_PROVIDERS.filter(
  (provider) =>
    provider.source.type === "perk" && provider.source.overlimitCard,
);
const overlimitProviderByItemId = new Map(
  overlimitProviders.map((provider) => [provider.source.itemId, provider]),
);
const overlimitStatTypeByItemId = new Map<string, string>([
  ["20703040136", "toughness-efficiency"],
  ["20703040448", "critical-rate"],
  ["20703040460", "critical-rate"],
  ["20703040406", "critical-rate"],
  ["20703040115", "critical-rate"],
  ["20703040382", "critical-rate"],
  ["20703040028", "critical-rate"],
  ["20703040116", "critical-rate"],
  ["20704040477", "critical-rate"],
  ["20703040391", "critical-rate"],
  ["20703040102", "charge-efficiency"],
  ["20703040404", "charge-efficiency"],
  ["20703040182", "charge-efficiency"],
  ["20703040385", "charge-efficiency"],
  ["20703040447", "charge-efficiency"],
  ["20703040459", "charge-efficiency"],
]);

function requireFile(relativePath: string, label: string) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    errors.push(`${label} 指向不存在的文件：${relativePath}`);
  }
}

function runtimeSourcesForProvider(provider: (typeof MULTIPLIER_PROVIDERS)[number]) {
  const source = provider.source;
  const result: MultiplierSource[] = [];
  switch (source.type) {
    case "perk":
      result.push({ type: "perk", slot: source.slot, slug: source.slug });
      if (source.overlimitCard) {
        result.push({ type: "overlimit-card", id: source.itemId });
      }
      break;
    case "weapon":
      result.push({ type: "weapon", slug: source.slug });
      break;
    case "card":
      result.push({ type: "card", slug: source.slug });
      break;
    case "overlimit-bond":
      result.push(source);
      break;
    case "season-talent":
    case "post":
      result.push(source);
      break;
  }
  return result;
}

for (const provider of MULTIPLIER_PROVIDERS) {
  if (provider.modifierTypeIds.some((id) => !modifierTypeIds.has(id))) {
    errors.push(`${provider.id} 使用不存在的 modifier type`);
  }
  if (
    provider.evidence.kind === "reviewed-override" &&
    (!provider.evidence.basis || provider.evidence.basis.length === 0)
  ) {
    errors.push(`${provider.id} 的 reviewed-override 缺少依据`);
  }

  const source = provider.source;
  switch (source.type) {
    case "perk":
      requireFile(`data/perks/slot-${source.slot}/${source.slug}.mdx`, provider.id);
      if (source.overlimitCard !== cardIds.has(source.itemId)) {
        errors.push(`${provider.id} 的超限卡片镜像状态与 overlimit-cards.json 不一致`);
      }
      break;
    case "weapon":
      requireFile(`data/weapons/${source.slug}.mdx`, provider.id);
      break;
    case "card": {
      requireFile(`data/cards/${source.slug}.mdx`, provider.id);
      const card = speedrunCardsById.get(source.cardId);
      if (!card || card.slug !== source.slug) {
        errors.push(`${provider.id} 指向的卡牌不在当前 38 张卡池`);
      }
      if (
        provider.evidence.kind === "reviewed-override" ||
        provider.evidence.numericalRows.length === 0
      ) {
        errors.push(`${provider.id} 的卡牌来源缺少真实 Numerical 证据`);
      }
      break;
    }
    case "overlimit-bond":
      if (!bondStages.has(`${source.name}:${source.count}`)) {
        errors.push(`${provider.id} 指向不存在的羁绊阶段`);
      }
      break;
    case "post":
      requireFile(`data/posts/${source.slug}.mdx`, provider.id);
      break;
    case "season-talent": {
      const href = resolveMultiplierSourceHref(source);
      if (source.nodeId && !href.includes(`?node=${source.nodeId}`)) {
        errors.push(`${provider.id} 的节点深链未使用 ?node=`);
      }
      if (source.passiveId && !href.includes(`?passive=${source.passiveId}`)) {
        errors.push(`${provider.id} 的被动深链未使用 ?passive=`);
      }
      break;
    }
  }

  const expectedRelations = provider.modifierTypeIds.length * runtimeSourcesForProvider(provider).length;
  const actualRelations = PROVIDER_RELATIONS.filter(
    (relation) => relation.effectId === provider.id,
  );
  if (actualRelations.length !== expectedRelations) {
    errors.push(`${provider.id} 预期 ${expectedRelations} 条关系，实际 ${actualRelations.length} 条`);
  }
  for (const relation of actualRelations) {
    if (!factorIds.has(relation.factorId)) {
      errors.push(`${provider.id} 生成了不存在的 factor`);
    }
    if (!getSourcesForModifierType(relation.modifierTypeId).includes(relation)) {
      errors.push(`${provider.id} 无法从 modifier type 反查`);
    }
    if (
      relation.source &&
      !getProviderRelationsForSource(relation.source).includes(relation)
    ) {
      errors.push(`${provider.id} 无法从来源正查`);
    }
  }
}

for (const exclusion of MULTIPLIER_PROVIDER_EXCLUSIONS) {
  if (!exclusion.reason.trim()) errors.push(`${exclusion.id} 缺少排除理由`);
}

const perkRoot = path.join(root, "data", "perks");
const perkCandidates = new Map<string, string>();
for (const slotDirectory of fs.readdirSync(perkRoot, { withFileTypes: true })) {
  if (!slotDirectory.isDirectory()) continue;
  for (const file of fs.readdirSync(path.join(perkRoot, slotDirectory.name))) {
    if (!file.endsWith(".mdx")) continue;
    const parsed = matter(
      fs.readFileSync(path.join(perkRoot, slotDirectory.name, file), "utf8"),
    );
    const itemId = String(parsed.data.id);
    if (Number(parsed.data.CollectMODItem) === 1 || cardIds.has(itemId)) {
      perkCandidates.set(`perk:${itemId}`, String(parsed.data.title));
    }
  }
}
for (const [id, label] of perkCandidates) {
  if (!coveredIds.has(id)) errors.push(`插件/卡片候选未处理：${id} ${label}`);
}
for (const cardId of cardIds) {
  if (!perkCandidates.has(`perk:${cardId}`)) {
    errors.push(`超限卡片没有同 ItemID 插件实体：${cardId}`);
  }
}

for (const card of hydratedOverlimitCards) {
  const provider = overlimitProviderByItemId.get(card.id);
  const damageEffects =
    card.effectValues?.filter((effect) => effect.kind === "damage") ?? [];
  const statEffects =
    card.effectValues?.filter((effect) => effect.kind === "stat") ?? [];

  const expectedStatType = overlimitStatTypeByItemId.get(card.id);
  const actualStatTypes = statEffects.map((effect) => effect.statId);
  const expectedStatTypes = expectedStatType ? [expectedStatType] : [];
  if (JSON.stringify(actualStatTypes) !== JSON.stringify(expectedStatTypes)) {
    errors.push(
      `超限卡片 ${card.id} ${card.name} 的 stat 类型不匹配：期望 ${expectedStatTypes.join(", ") || "无"}，实际 ${actualStatTypes.join(", ") || "无"}`,
    );
  }
  if (!provider && damageEffects.length > 0) {
    errors.push(`超限卡片 ${card.id} ${card.name} 存在孤立 effect_values`);
    continue;
  }
  if (!provider) continue;

  const expected = [...new Set(provider.modifierTypeIds)].sort();
  const actual = damageEffects.map((effect) => effect.modifierTypeId).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    errors.push(
      `超限卡片 ${card.id} ${card.name} 的 effect_values 类型不匹配：期望 ${expected.join(", ")}，实际 ${actual.join(", ") || "无"}`,
    );
  }
}

if (overlimitProviders.length !== 58) {
  errors.push(`超限增伤来源数量异常：期望 58，实际 ${overlimitProviders.length}`);
}

const weaponCandidates = new Map<string, string>();
for (const file of fs.readdirSync(path.join(root, "data", "weapons"))) {
  if (!file.endsWith(".mdx")) continue;
  const slug = file.slice(0, -4);
  const parsed = matter(fs.readFileSync(path.join(root, "data", "weapons", file), "utf8"));
  if (parsed.data.draft === true) continue;
  const pattern = /<(ActiveSkill|PassiveSkill)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(parsed.content)) !== null) {
    const skillName = match[2].match(/\bname\s*=\s*["']([^"']+)["']/)?.[1];
    if (!skillName) continue;
    weaponCandidates.set(`weapon:${slug}:${skillName}`, `${slug}·${skillName}`);
  }
}
for (const [id, label] of weaponCandidates) {
  if (!coveredIds.has(id)) errors.push(`武器技能候选未处理：${id} ${label}`);
}

for (const tree of [zero, ironFist, grapplingHook]) {
  for (const node of tree.nodes) {
    const id = `season:s3:${tree.id}:${node.id}`;
    if (!coveredIds.has(id)) errors.push(`S3 节点未处理：${id} ${node.name}`);
  }
}
for (const passive of passives.passives) {
  const id = `season:s3:passive:${passive.id}`;
  if (!coveredIds.has(id)) errors.push(`S3 被动未处理：${id} ${passive.name}`);
}

const relationKeys = new Set<string>();
for (const relation of PROVIDER_RELATIONS) {
  const key = `${relation.effectId}:${relation.modifierTypeId}:${relation.sourceHref}`;
  if (relationKeys.has(key)) errors.push(`重复关系：${key}`);
  relationKeys.add(key);
}

const regressions = [
  "独弹强化",
  "冥河送葬",
  "致命节拍",
  "腐蚀榴弹",
  "腐蚀狂热",
  "解构增幅",
  "近距增幅",
  "过载膛压",
  "递进膛压",
  "霰弹增伤",
  "Z型步枪·神射心流",
  "射击属性",
  "技能属性",
  "弱点属性",
  "伤害属性",
  "狂轰乱炸",
];
for (const label of regressions) {
  if (!MULTIPLIER_PROVIDERS.some((provider) => provider.label.includes(label))) {
    errors.push(`首批回归来源缺失：${label}`);
  }
}

if (errors.length > 0) {
  throw new Error(`乘区索引校验失败：\n${errors.map((error) => `- ${error}`).join("\n")}`);
}

console.log(
  `乘区索引校验通过：${MODIFIER_TYPES.length} 个增伤类型，${MULTIPLIER_PROVIDERS.length} 个来源，${MULTIPLIER_PROVIDER_EXCLUSIONS.length} 个排除项，${PROVIDER_RELATIONS.length} 条双向关系；覆盖 ${perkCandidates.size} 个插件/卡片身份、${overlimitStatTypeByItemId.size} 个属性数值来源、${weaponCandidates.size} 个武器技能组件。`,
);
