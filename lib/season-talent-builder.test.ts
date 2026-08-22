import assert from "node:assert/strict";
import test from "node:test";
import {
  getSpentTalentPoints,
  isTalentNodeUnlocked,
  removeInvalidTalentLevels,
  restoreSeasonTalentBuild,
  setTalentNodeLevel,
  type SeasonTalentNodeData,
  type SeasonTalentPassiveData,
} from "./season-talent-builder";

const nodes: SeasonTalentNodeData[] = [
  {
    id: "root",
    name: "根技能",
    descriptions: [""],
    icon: "",
    phase: 1,
    column: 2,
    maxLevel: 1,
    prerequisites: [],
    mutualGroup: null,
    isRoot: true,
    unlockLevel: 0,
    powerful: true,
  },
  ...["a", "b"].map((id, index) => ({
    id,
    name: id,
    descriptions: ["1", "2"],
    icon: "",
    phase: 2,
    column: index + 1,
    maxLevel: 2,
    prerequisites: [],
    mutualGroup: null,
    isRoot: false,
    unlockLevel: 0,
    powerful: false,
  })),
  {
    id: "choice-a",
    name: "选项 A",
    descriptions: [""],
    icon: "",
    phase: 3,
    column: 5,
    maxLevel: 3,
    prerequisites: ["a", "b"],
    mutualGroup: "choice",
    isRoot: false,
    unlockLevel: 4,
    powerful: false,
  },
  {
    id: "choice-b",
    name: "选项 B",
    descriptions: [""],
    icon: "",
    phase: 3,
    column: 6,
    maxLevel: 3,
    prerequisites: ["a", "b"],
    mutualGroup: "choice",
    isRoot: false,
    unlockLevel: 4,
    powerful: false,
  },
  {
    id: "after",
    name: "后续",
    descriptions: [""],
    icon: "",
    phase: 4,
    column: 5,
    maxLevel: 2,
    prerequisites: ["choice-a", "choice-b"],
    mutualGroup: null,
    isRoot: false,
    unlockLevel: 12,
    powerful: false,
  },
  {
    id: "exclusive-after",
    name: "专属后续",
    descriptions: [""],
    icon: "",
    phase: 3,
    column: 1,
    maxLevel: 1,
    prerequisites: ["a", "b"],
    mutualGroup: null,
    isRoot: false,
    unlockLevel: 4,
    powerful: false,
  },
];

const tree = { nodes, pointLimit: 7 };
const passives: SeasonTalentPassiveData[] = [
  { id: "light", name: "光", description: "", icon: "", energy: "light", isDefault: true, tags: [] },
  { id: "dark", name: "暗", description: "", icon: "", energy: "dark", isDefault: true, tags: [] },
];

test("通用天赋任一前置达到 1 级即可解锁", () => {
  assert.equal(isTalentNodeUnlocked(nodes[3], nodes, { a: 1 }), true);
  assert.equal(isTalentNodeUnlocked(nodes[3], nodes, { b: 1 }), true);
});

test("专属天赋仍需任一前置满级", () => {
  assert.equal(isTalentNodeUnlocked(nodes[6], nodes, { a: 1 }), false);
  assert.equal(isTalentNodeUnlocked(nodes[6], nodes, { a: 2 }), true);
  assert.equal(isTalentNodeUnlocked(nodes[6], nodes, { b: 2 }), true);
});

test("点数不会超过上限", () => {
  let levels = setTalentNodeLevel(tree, {}, "a", 2);
  levels = setTalentNodeLevel(tree, levels, "choice-a", 3);
  levels = setTalentNodeLevel(tree, levels, "after", 2);
  assert.equal(getSpentTalentPoints(levels), 7);
  assert.deepEqual(levels, { a: 2, "choice-a": 3, after: 2 });
});

test("互斥切换会继承等级并保留仍然有效的下游", () => {
  const levels = setTalentNodeLevel(
    tree,
    { a: 2, "choice-a": 3, after: 2 },
    "choice-b",
    1,
  );
  assert.deepEqual(levels, { a: 2, "choice-b": 3, after: 2 });
});

test("通用前置保留 1 级时不会清理下游", () => {
  const levels = removeInvalidTalentLevels(nodes, {
    a: 1,
    "choice-a": 3,
    after: 2,
  });
  assert.deepEqual(levels, { a: 1, "choice-a": 3, after: 2 });
});

test("清空通用前置会级联清理下游", () => {
  const levels = removeInvalidTalentLevels(nodes, {
    "choice-a": 3,
    after: 2,
  });
  assert.deepEqual(levels, {});
});

test("恢复方案会校验节点、点数和两个被动槽", () => {
  const restored = restoreSeasonTalentBuild(
    tree,
    {
      version: 1,
      levels: { unknown: 5, a: 99, "choice-a": 99, after: 99 },
      lightPassiveId: "light",
      darkPassiveId: "dark",
    },
    passives,
  );
  assert.deepEqual(restored, {
    version: 1,
    levels: { a: 2, "choice-a": 3, after: 2 },
    lightPassiveId: "light",
    darkPassiveId: "dark",
  });
});
