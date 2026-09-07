import type { LegacyTalentNode } from "@/lib/s0s1-season-talents";

export interface LegacyTalentView {
  version: 1;
  nodeId: string;
  level: number;
}

export function legacyViewStorageKey(season: string, treeId: string) {
  return `nzm-wiki:season-talents:${season}:${treeId}:view:v1`;
}

export function restoreLegacyTalentView(nodes: readonly Pick<LegacyTalentNode, "id" | "isRoot" | "maxLevel">[], saved: unknown): LegacyTalentView {
  const root = nodes.find(n => n.isRoot) ?? nodes[0];
  if (!root) throw new Error("Legacy talent tree has no nodes");
  const fallback: LegacyTalentView = {version:1,nodeId:root.id,level:1};
  if (!saved || typeof saved !== "object" || !("version" in saved) || saved.version !== 1 || !("nodeId" in saved) || !("level" in saved)) return fallback;
  const node = nodes.find(n => n.id === saved.nodeId);
  if (!node || typeof saved.level !== "number" || !Number.isFinite(saved.level)) return fallback;
  return {version:1,nodeId:node.id,level:Math.max(1,Math.min(node.maxLevel,Math.floor(saved.level)))};
}

export function legacyNodePosition(node: Pick<LegacyTalentNode, "column" | "phase">) {
  const x = [0, 65, 145, 225, 305, 430, 515, 600, 685, 770][node.column];
  if (x === undefined || node.phase < 1 || node.phase > 7) throw new Error("Invalid legacy talent position");
  return {x,y:72+(node.phase-1)*112};
}

export function isLegacyExclusiveNode(season: "s0" | "s1", column: number) {
  return column >= (season === "s0" ? 4 : 5);
}
