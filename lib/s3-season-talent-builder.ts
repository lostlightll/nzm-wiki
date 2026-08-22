export interface S3TalentStateNode {
  id: string;
  phase: number;
  column: number;
  maxLevel: number;
}

export interface SavedS3TalentBuild {
  version: 1;
  levels: Record<string, number>;
  passiveId: string | null;
}

export function getDefaultS3TalentLevels(
  nodes: readonly S3TalentStateNode[],
  rootNodeId: string,
) {
  return Object.fromEntries(
    nodes
      .filter((node) => node.id !== rootNodeId && node.column <= 3)
      .map((node) => [node.id, node.maxLevel]),
  ) as Record<string, number>;
}

export function getS3SpentTalentPoints(levels: Record<string, number>) {
  return Object.values(levels).reduce((sum, level) => sum + level, 0);
}

export function isS3TalentNodeUnlocked(
  node: S3TalentStateNode & { prerequisites?: readonly string[] },
  nodes: readonly (S3TalentStateNode & { prerequisites?: readonly string[] })[],
  levels: Record<string, number>,
) {
  if (!node.prerequisites?.length) return true;

  const nodeMap = new Map(nodes.map((candidate) => [candidate.id, candidate]));
  return node.prerequisites.some((prerequisiteId) => {
    const prerequisite = nodeMap.get(prerequisiteId);
    if (!prerequisite) return false;
    const requiredLevel = node.column >= 5 ? 1 : prerequisite.maxLevel;
    return (levels[prerequisiteId] ?? 0) >= requiredLevel;
  });
}

export function removeInvalidS3TalentLevels(
  nodes: readonly (S3TalentStateNode & { prerequisites?: readonly string[] })[],
  levels: Record<string, number>,
) {
  const next = { ...levels };
  let changed = true;

  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (!next[node.id] || isS3TalentNodeUnlocked(node, nodes, next)) continue;
      delete next[node.id];
      changed = true;
    }
  }

  return next;
}

export function setS3TalentNodeLevel(
  nodes: readonly (S3TalentStateNode & { prerequisites?: readonly string[] })[],
  levels: Record<string, number>,
  nodeId: string,
  requestedLevel: number,
  pointLimit = 40,
) {
  const node = nodes.find((candidate) => candidate.id === nodeId);
  if (!node) return levels;

  let level = Math.max(0, Math.min(node.maxLevel, Math.floor(requestedLevel)));
  if (level > 0 && !isS3TalentNodeUnlocked(node, nodes, levels)) return levels;
  const next = { ...levels };

  if (level > 0 && node.column >= 5) {
    const inheritedLevel = nodes.reduce((highest, candidate) => {
      if (
        candidate.id === node.id ||
        candidate.column < 5 ||
        candidate.phase !== node.phase
      ) {
        return highest;
      }
      return Math.max(highest, levels[candidate.id] ?? 0);
    }, 0);
    if (!(levels[node.id] ?? 0) && inheritedLevel > 0) {
      level = Math.min(node.maxLevel, Math.max(level, inheritedLevel));
    }

    for (const candidate of nodes) {
      if (candidate.column >= 5 && candidate.phase === node.phase) {
        delete next[candidate.id];
      }
    }
  }

  const pointsWithoutNode =
    getS3SpentTalentPoints(next) - (next[node.id] ?? 0);
  const cappedLevel = Math.min(level, Math.max(0, pointLimit - pointsWithoutNode));

  if (cappedLevel > 0 || node.column <= 3) next[node.id] = cappedLevel;
  else delete next[node.id];
  return removeInvalidS3TalentLevels(nodes, next);
}

export function restoreS3TalentBuild(
  nodes: readonly S3TalentStateNode[],
  rootNodeId: string,
  saved: unknown,
  validPassiveIds: ReadonlySet<string>,
  pointLimit = 40,
): SavedS3TalentBuild {
  const defaultLevels = getDefaultS3TalentLevels(nodes, rootNodeId);
  const empty: SavedS3TalentBuild = {
    version: 1,
    levels: defaultLevels,
    passiveId: null,
  };
  if (!saved || typeof saved !== "object") return empty;

  const candidate = saved as Partial<SavedS3TalentBuild>;
  if (
    candidate.version !== 1 ||
    !candidate.levels ||
    typeof candidate.levels !== "object"
  ) {
    return empty;
  }

  let levels = { ...defaultLevels };
  const occupiedGeneralPhases = new Set<number>();
  for (const node of nodes) {
    if (node.id === rootNodeId) continue;
    if (!Object.prototype.hasOwnProperty.call(candidate.levels, node.id)) continue;
    const requestedLevel = Number(candidate.levels[node.id]);
    if (!Number.isFinite(requestedLevel)) continue;
    if (
      requestedLevel > 0 &&
      node.column >= 5 &&
      occupiedGeneralPhases.has(node.phase)
    ) {
      continue;
    }
    levels = setS3TalentNodeLevel(
      nodes,
      levels,
      node.id,
      requestedLevel,
      pointLimit,
    );
    if (requestedLevel > 0 && node.column >= 5) {
      occupiedGeneralPhases.add(node.phase);
    }
  }

  const passiveId =
    typeof candidate.passiveId === "string" &&
    validPassiveIds.has(candidate.passiveId)
      ? candidate.passiveId
      : null;

  return { version: 1, levels, passiveId };
}
