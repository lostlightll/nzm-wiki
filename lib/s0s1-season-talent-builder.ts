import type { LegacyTalentTree } from "./s0s1-season-talents";
import { isLegacyExclusiveNode } from "./s0s1-talent-view";

/** Adapt historical layouts to the S3 simulator's exclusive/common rules. */
export function legacySimulationNodes(tree: LegacyTalentTree) {
  return tree.nodes.filter(node => !node.isRoot).map(node => ({
    id: node.id,
    phase: node.phase,
    column: isLegacyExclusiveNode(tree.season, node.column) ? 1 : 5,
    maxLevel: node.maxLevel,
    prerequisites: tree.nodes.filter(before => !before.isRoot && before.afterIds.includes(node.id)).map(before => before.id),
  }));
}
