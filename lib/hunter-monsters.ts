import { z } from "zod";
import { getMDXList } from "@/lib/mdx";
import type { HunterMonster } from "@/lib/hunter-monster-health";

const difficultyValues = z.object({
  heroic: z.number().positive().optional(),
  inferno: z.number().positive().optional(),
  torment: z.number().positive().optional(),
  overlimit: z.number().positive().optional(),
});
const monsterSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  monster_id: z.number().int().positive(),
  kind: z.enum(["normal", "captain", "elite"]),
  image: z.string().startsWith("/").optional(),
  description: z.string(),
  appearances: z.array(z.object({
    map: z.string().min(1),
    area: z.string().min(1),
    health: difficultyValues,
    source_plans: difficultyValues,
  })).min(1),
});

export function getHunterMonsters(): HunterMonster[] {
  return getMDXList("enemies/lc/monsters").map(row => monsterSchema.parse(row));
}
