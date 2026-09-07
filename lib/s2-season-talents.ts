import invisibility from "@/data/season-talents/s2/invisibility.json";
import inferno from "@/data/season-talents/s2/inferno-arm.json";
import hologram from "@/data/season-talents/s2/holographic-sync.json";
import type { S2TalentTree } from "@/lib/s2-season-talent-builder";

export const S2_TALENT_IDS = ["invisibility", "inferno-arm", "holographic-sync"] as const;
const trees: readonly S2TalentTree[] = [invisibility, inferno, hologram];

export function getS2TalentTree(id: string): S2TalentTree | undefined {
  return trees.find(t => t.id === id);
}
