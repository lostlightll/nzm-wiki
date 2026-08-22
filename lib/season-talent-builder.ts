export interface SeasonTalentNodeData {
  id: string;
  name: string;
  descriptions: string[];
  icon: string;
  phase: number;
  column: number;
  maxLevel: number;
  prerequisites: string[];
  mutualGroup: string | null;
  isRoot: boolean;
  unlockLevel: number;
  powerful: boolean;
}

export interface SeasonTalentTreeData {
  draft?: boolean;
  id: string;
  talentType: number;
  name: string;
  subtitle: string;
  applicableWeapons: string;
  icon: string;
  pointLimit: number;
  nodes: SeasonTalentNodeData[];
}

export interface SeasonTalentPassiveData {
  id: string;
  name: string;
  description: string;
  icon: string;
  energy: "light" | "dark";
  isDefault: boolean;
  tags: string[];
}

export interface SavedSeasonTalentBuild {
  version: 1;
  levels: Record<string, number>;
  lightPassiveId: string | null;
  darkPassiveId: string | null;
}

export function getSpentTalentPoints(levels: Record<string, number>) {
  return Object.values(levels).reduce((sum, level) => sum + level, 0);
}

function getNodeMap(nodes: readonly SeasonTalentNodeData[]) {
  return new Map(nodes.map((node) => [node.id, node]));
}

export function isTalentNodeUnlocked(
  node: SeasonTalentNodeData,
  nodes: readonly SeasonTalentNodeData[],
  levels: Record<string, number>,
) {
  if (node.isRoot || node.prerequisites.length === 0) return true;

  const nodeMap = getNodeMap(nodes);
  return node.prerequisites.some((prerequisiteId) => {
    const prerequisite = nodeMap.get(prerequisiteId);
    if (!prerequisite) return false;
    const requiredLevel = node.column >= 5 ? 1 : prerequisite.maxLevel;
    return (levels[prerequisiteId] ?? 0) >= requiredLevel;
  });
}

export function removeInvalidTalentLevels(
  nodes: readonly SeasonTalentNodeData[],
  levels: Record<string, number>,
) {
  const next = { ...levels };
  let changed = true;

  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (!next[node.id] || isTalentNodeUnlocked(node, nodes, next)) continue;
      delete next[node.id];
      changed = true;
    }
  }

  return next;
}

export function setTalentNodeLevel(
  tree: Pick<SeasonTalentTreeData, "nodes" | "pointLimit">,
  levels: Record<string, number>,
  nodeId: string,
  requestedLevel: number,
) {
  const node = tree.nodes.find((candidate) => candidate.id === nodeId);
  if (!node || node.isRoot) return levels;

  let targetLevel = Math.max(0, Math.min(node.maxLevel, Math.floor(requestedLevel)));
  if (targetLevel > 0 && !isTalentNodeUnlocked(node, tree.nodes, levels)) return levels;

  const next = { ...levels };
  if (targetLevel > 0 && node.mutualGroup) {
    const inheritedLevel = tree.nodes.reduce((highest, candidate) => {
      if (candidate.id === node.id || candidate.mutualGroup !== node.mutualGroup) return highest;
      return Math.max(highest, levels[candidate.id] ?? 0);
    }, 0);
    if (!(levels[node.id] ?? 0) && inheritedLevel > 0) {
      targetLevel = Math.min(node.maxLevel, Math.max(targetLevel, inheritedLevel));
    }

    for (const candidate of tree.nodes) {
      if (candidate.id !== node.id && candidate.mutualGroup === node.mutualGroup) {
        delete next[candidate.id];
      }
    }
  }

  if (targetLevel === 0) {
    delete next[node.id];
    return removeInvalidTalentLevels(tree.nodes, next);
  }

  const pointsWithoutNode = getSpentTalentPoints(next) - (next[node.id] ?? 0);
  const availableLevel = Math.max(0, tree.pointLimit - pointsWithoutNode);
  const cappedLevel = Math.min(targetLevel, availableLevel);
  if (cappedLevel === 0) return levels;

  next[node.id] = cappedLevel;
  return removeInvalidTalentLevels(tree.nodes, next);
}

export function restoreSeasonTalentBuild(
  tree: Pick<SeasonTalentTreeData, "nodes" | "pointLimit">,
  saved: unknown,
  passives: readonly SeasonTalentPassiveData[],
): SavedSeasonTalentBuild {
  const empty: SavedSeasonTalentBuild = {
    version: 1,
    levels: {},
    lightPassiveId: null,
    darkPassiveId: null,
  };
  if (!saved || typeof saved !== "object") return empty;

  const candidate = saved as Partial<SavedSeasonTalentBuild>;
  if (candidate.version !== 1 || !candidate.levels || typeof candidate.levels !== "object") {
    return empty;
  }

  const sortedNodes = [...tree.nodes]
    .filter((node) => !node.isRoot)
    .sort((a, b) => a.phase - b.phase || a.column - b.column);
  let levels: Record<string, number> = {};
  for (const node of sortedNodes) {
    const requested = Number(candidate.levels[node.id]);
    if (!Number.isFinite(requested) || requested <= 0) continue;
    levels = setTalentNodeLevel(tree, levels, node.id, requested);
  }

  const lightPassiveId = passives.some(
    (passive) => passive.energy === "light" && passive.id === candidate.lightPassiveId,
  )
    ? candidate.lightPassiveId ?? null
    : null;
  const darkPassiveId = passives.some(
    (passive) => passive.energy === "dark" && passive.id === candidate.darkPassiveId,
  )
    ? candidate.darkPassiveId ?? null
    : null;

  return { version: 1, levels, lightPassiveId, darkPassiveId };
}
