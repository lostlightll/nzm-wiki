import fs from "node:fs";
import path from "node:path";
import overlimitBonds from "@/data/overlimit-bonds.json";
import overlimitCards from "@/data/overlimit-cards.json";
import {
  MODIFIER_TYPES,
  PROVIDER_EFFECTS,
  PROVIDER_PLACEMENTS,
  PROVIDER_RELATIONS,
} from "@/lib/multiplier-data";

const root = process.cwd();
const errors: string[] = [];
const cardIds = new Set(overlimitCards.map((card) => card.id));
const bondStages = new Set(
  overlimitBonds.flatMap((bond) =>
    bond.effects.map((effect) => `${bond.name}:${effect.count}`),
  ),
);

function requireFile(relativePath: string, label: string) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    errors.push(`${label} 指向不存在的文件：${relativePath}`);
  }
}

for (const placement of PROVIDER_PLACEMENTS) {
  const source = placement.source;
  switch (source.type) {
    case "weapon":
      requireFile(`data/weapons/${source.slug}.mdx`, placement.effectId);
      break;
    case "perk":
      requireFile(
        `data/perks/slot-${source.slot}/${source.slug}.mdx`,
        placement.effectId,
      );
      break;
    case "overlimit-card":
      if (!cardIds.has(source.id)) {
        errors.push(`${placement.effectId} 指向不存在的超限卡片：${source.id}`);
      }
      break;
    case "overlimit-bond":
      if (!bondStages.has(`${source.name}:${source.count}`)) {
        errors.push(
          `${placement.effectId} 指向不存在的羁绊阶段：${source.name} x${source.count}`,
        );
      }
      break;
    case "post":
      requireFile(`data/posts/${source.slug}.mdx`, placement.effectId);
      break;
    case "season-talent":
      break;
  }
}

if (errors.length > 0) {
  throw new Error(`乘区索引校验失败：\n${errors.map((error) => `- ${error}`).join("\n")}`);
}

console.log(
  `乘区索引校验通过：${MODIFIER_TYPES.length} 个增伤类型，${PROVIDER_EFFECTS.length} 个共享效果，${PROVIDER_RELATIONS.length} 条来源关系。`,
);
