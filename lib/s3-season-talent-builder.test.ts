import assert from "node:assert/strict";
import test from "node:test";
import grapplingHookData from "@/data/season-talents/s3/grappling-hook.json";
import ironFistData from "@/data/season-talents/s3/iron-fist.json";
import zeroData from "@/data/season-talents/s3/zero.json";
import {
  getDefaultS3TalentLevels,
  getS3SpentTalentPoints,
  isS3TalentNodeUnlocked,
  restoreS3TalentBuild,
  setS3TalentNodeLevel,
  type S3TalentStateNode,
} from "./s3-season-talent-builder";

const zeroNodes = zeroData.nodes as S3TalentStateNode[];
const generalNodes = zeroNodes.filter((node) => node.column >= 5);

test("S3 三棵树默认 15 点且最大均为 40 点", () => {
  for (const data of [ironFistData, zeroData, grapplingHookData]) {
    const exclusiveNodes = (data.nodes as S3TalentStateNode[]).filter(
      (node, index) => index > 0 && node.column <= 3,
    );
    const exclusiveMaximum = exclusiveNodes.reduce(
      (sum, node) => sum + node.maxLevel,
      0,
    );
    const generalMaximum = [...new Set(generalNodes.map((node) => node.phase))]
      .map((phase) =>
        Math.max(
          ...generalNodes
            .filter((node) => node.phase === phase)
            .map((node) => node.maxLevel),
        ),
      )
      .reduce((sum, level) => sum + level, 0);

    assert.equal(exclusiveMaximum, 15, data.id);
    assert.equal(generalMaximum, 25, data.id);
    assert.equal(exclusiveMaximum + generalMaximum, 40, data.id);
  }

  const defaults = getDefaultS3TalentLevels(zeroNodes, zeroNodes[0].id);
  assert.equal(getS3SpentTalentPoints(defaults), 15);
});

test("S3 通用天赋同阶段互斥并限制等级与总点数", () => {
  const defaults = getDefaultS3TalentLevels(zeroNodes, zeroNodes[0].id);
  const phaseTwo = generalNodes.filter((node) => node.phase === 2);
  let levels = setS3TalentNodeLevel(
    zeroNodes,
    defaults,
    phaseTwo[0].id,
    phaseTwo[0].maxLevel,
  );
  levels = setS3TalentNodeLevel(
    zeroNodes,
    levels,
    phaseTwo[1].id,
    phaseTwo[1].maxLevel + 99,
  );

  assert.equal(levels[phaseTwo[0].id], undefined);
  assert.equal(levels[phaseTwo[1].id], phaseTwo[1].maxLevel);

  for (const phase of [3, 4, 5, 6]) {
    const node = generalNodes.find((candidate) => candidate.phase === phase);
    assert.ok(node);
    levels = setS3TalentNodeLevel(zeroNodes, levels, node.id, node.maxLevel);
  }
  assert.equal(getS3SpentTalentPoints(levels), 40);

  const cleared = setS3TalentNodeLevel(
    zeroNodes,
    levels,
    phaseTwo[1].id,
    -10,
  );
  assert.equal(cleared[phaseTwo[1].id], undefined);
  assert.equal(getS3SpentTalentPoints(cleared), 15);
});

test("S3 通用天赋遵循前置解锁并在清空前置后级联清理", () => {
  const defaults = getDefaultS3TalentLevels(zeroNodes, zeroNodes[0].id);
  const phaseTwo = generalNodes.find((node) => node.phase === 2);
  const phaseThree = generalNodes.find((node) => node.phase === 3);
  assert.ok(phaseTwo);
  assert.ok(phaseThree);

  assert.equal(isS3TalentNodeUnlocked(phaseThree, zeroNodes, defaults), false);
  const stillLocked = setS3TalentNodeLevel(
    zeroNodes,
    defaults,
    phaseThree.id,
    1,
  );
  assert.equal(stillLocked[phaseThree.id], undefined);

  let levels = setS3TalentNodeLevel(zeroNodes, defaults, phaseTwo.id, 1);
  assert.equal(isS3TalentNodeUnlocked(phaseThree, zeroNodes, levels), true);
  levels = setS3TalentNodeLevel(zeroNodes, levels, phaseThree.id, 2);
  assert.equal(levels[phaseThree.id], 2);

  levels = setS3TalentNodeLevel(zeroNodes, levels, phaseTwo.id, 0);
  assert.equal(levels[phaseThree.id], undefined);
});

test("S3 同阶段通用天赋切换时继承已有等级", () => {
  const defaults = getDefaultS3TalentLevels(zeroNodes, zeroNodes[0].id);
  const phaseTwo = generalNodes.filter((node) => node.phase === 2);
  let levels = setS3TalentNodeLevel(
    zeroNodes,
    defaults,
    phaseTwo[0].id,
    4,
  );
  levels = setS3TalentNodeLevel(zeroNodes, levels, phaseTwo[1].id, 1);

  assert.equal(levels[phaseTwo[0].id], undefined);
  assert.equal(levels[phaseTwo[1].id], 4);
});

test("S3 v1 存档恢复保留显式零级、首个同阶段通用天赋和有效被动", () => {
  const exclusiveNode = zeroNodes.find(
    (node, index) => index > 0 && node.column <= 3,
  );
  const phaseTwo = generalNodes.filter((node) => node.phase === 2);
  assert.ok(exclusiveNode);

  const restored = restoreS3TalentBuild(
    zeroNodes,
    zeroNodes[0].id,
    {
      version: 1,
      levels: {
        [exclusiveNode.id]: 0,
        [phaseTwo[0].id]: 3,
        [phaseTwo[1].id]: 5,
      },
      passiveId: "2030103",
    },
    new Set(["2030103"]),
  );

  assert.equal(restored.levels[exclusiveNode.id], 0);
  assert.equal(restored.levels[phaseTwo[0].id], 3);
  assert.equal(restored.levels[phaseTwo[1].id], undefined);
  assert.equal(restored.passiveId, "2030103");

  const malformed = restoreS3TalentBuild(
    zeroNodes,
    zeroNodes[0].id,
    { version: 2, levels: {}, passiveId: "invalid" },
    new Set(["2030103"]),
  );
  assert.equal(getS3SpentTalentPoints(malformed.levels), 15);
  assert.equal(malformed.passiveId, null);
});
