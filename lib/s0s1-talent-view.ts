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

export function legacyNodePosition(season: "s0" | "s1", node: Pick<LegacyTalentNode, "column" | "phase">) {
  const exclusive = isLegacyExclusiveNode(season, node.column);
  const columns = exclusive ? (season === "s0" ? [4, 6, 8] : [5, 6, 7, 8, 9]) : (season === "s0" ? [1, 2] : [1, 2, 3, 4]);
  const index = columns.indexOf(node.column);
  if (index < 0 || node.phase < 1 || node.phase > 7) throw new Error("Invalid legacy talent position");
  // The active skill is inspected in the shared header. Both tree regions start at phase 2.
  // Kunlun's fourth phase has four exclusive nodes, including columns 6 and 8.
  const exclusiveX = season === "s1" && node.phase === 4
    ? [420, 560, 630, 700, 840][index]
    : 450 + (node.column - (season === "s0" ? 4 : 5)) * 90;
  const x = exclusive ? exclusiveX : season === "s0" ? 85 + index * 170 : 45 + index * 80;
  return { x, y: 100 + Math.max(0, node.phase - 2) * 120 };
}

export function isLegacyExclusiveNode(season: "s0" | "s1", column: number) {
  return column >= (season === "s0" ? 4 : 5);
}
