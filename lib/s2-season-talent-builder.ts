export interface S2TalentNode {
  id: string;
  name: string;
  icon: string;
  phase: number;
  column: number;
  maxLevel: number;
  costs: number[];
  prerequisite: string;
  unlockPoints: number;
  group: number;
  mutualGroups: number[];
  isRoot: boolean;
  descriptions: string[];
  sourceIds: number[];
  auditNote?: string | null;
}

export interface S2Passive {
  id: string;
  name: string;
  icon: string;
  description: string;
  sourceId: number;
}

export interface S2TalentTree {
  id: string;
  name: string;
  subtitle: string;
  applicableWeapons: string;
  icon: string;
  core: string;
  pointLimit: number;
  nodes: S2TalentNode[];
  passives: S2Passive[];
}

export interface S2TalentBuild {
  version: 1;
  levels: Record<string, number>;
  passiveId: string | null;
}

export function emptyS2Build(): S2TalentBuild {
  return { version: 1, levels: {}, passiveId: null };
}

export function s2SpentPoints(tree: S2TalentTree, levels: Record<string, number>, beforePhase = Infinity) {
  return tree.nodes.reduce((sum, node) => sum + (node.isRoot || node.phase >= beforePhase ? 0 :
    node.costs.slice(0, levels[node.id] ?? 0).reduce((a, b) => a + b, 0)), 0);
}

export function s2PrerequisiteGroups(expression: string): string[][] {
  if (!expression) return [];
  if (!/^\d+(?:[|&]\d+)*$/.test(expression)) throw new Error(`Invalid S2 prerequisite: ${expression}`);
  return expression.split("|").map((part) => part.split("&"));
}

export function s2UnlockReason(tree: S2TalentTree, node: S2TalentNode, levels: Record<string, number>): string | null {
  if (node.isRoot) return null;
  if (s2SpentPoints(tree, levels, node.phase) < node.unlockPoints) return `前置阶段需投入 ${node.unlockPoints} 点`;
  const groups = s2PrerequisiteGroups(node.prerequisite);
  if (groups.length && !groups.some((group) => group.every((id) => {
    const before = tree.nodes.find((candidate) => candidate.id === id);
    return before && (before.isRoot || (levels[id] ?? 0) >= before.maxLevel);
  }))) return `需点满前置天赋${node.prerequisite.includes("&") ? "（全部）" : ""}`;
  return null;
}

function pruneS2Levels(tree: S2TalentTree, levels: Record<string, number>) {
  const next = { ...levels };
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of tree.nodes) {
      if (next[node.id] && s2UnlockReason(tree, node, next)) {
        delete next[node.id];
        changed = true;
      }
    }
  }
  return next;
}

export function setS2Level(tree: S2TalentTree, build: S2TalentBuild, id: string, requested: number): S2TalentBuild {
  const node = tree.nodes.find((candidate) => candidate.id === id);
  if (!node || node.isRoot || !Number.isInteger(requested) || requested < 0 || requested > node.maxLevel) return build;
  if (requested > (build.levels[id] ?? 0) && s2UnlockReason(tree, node, build.levels)) return build;
  const levels = { ...build.levels };
  if (requested) {
    // Mutual groups are table identities, not a visual-column convention.
    for (const peer of tree.nodes) {
      if (peer.id !== id && (node.mutualGroups.includes(peer.group) || peer.mutualGroups.includes(node.group))) delete levels[peer.id];
    }
    levels[id] = requested;
  } else delete levels[id];
  const valid = pruneS2Levels(tree, levels);
  if (s2SpentPoints(tree, valid) > tree.pointLimit) return build;
  return { ...build, levels: valid };
}

export function restoreS2Build(tree: S2TalentTree, value: unknown): S2TalentBuild {
  if (!value || typeof value !== "object" || !("version" in value) || value.version !== 1 ||
    !("levels" in value) || !value.levels || typeof value.levels !== "object" || Array.isArray(value.levels)) return emptyS2Build();
  let result = emptyS2Build();
  for (const node of [...tree.nodes].sort((a, b) => a.phase - b.phase || a.column - b.column)) {
    const level = Object.getOwnPropertyDescriptor(value.levels, node.id)?.value;
    if (typeof level === "number") result = setS2Level(tree, result, node.id, level);
  }
  if ("passiveId" in value && typeof value.passiveId === "string" && tree.passives.some((p) => p.id === value.passiveId)) result.passiveId = value.passiveId;
  return result;
}
