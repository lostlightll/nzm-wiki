import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import dualStar from "../data/season-talents/s4/dual-star.json";
import matrixSymbiosis from "../data/season-talents/s4/matrix-symbiosis.json";
import blackHole from "../data/season-talents/s4/black-hole.json";
import passives from "../data/season-talents/s4/passives.json";

const trees = [dualStar, matrixSymbiosis, blackHole];

test("S4 正式天赋树与被动可发布，全部节点和图标引用闭合", () => {
  assert.equal(passives.draft, false);
  for (const tree of trees) {
    assert.equal(tree.draft, false);
    assert.equal(tree.nodes.filter((node) => node.isRoot).length, 1);
    const ids = new Set(tree.nodes.map((node) => node.id));
    assert.equal(ids.size, tree.nodes.length);
    for (const node of tree.nodes) {
      assert.ok(node.maxLevel > 0);
      assert.ok(node.descriptions.length > 0);
      assert.ok(node.descriptions.every((description) => description && description !== "暂无技能说明"));
      assert.ok(node.prerequisites.every((id) => ids.has(id)), `${tree.id}/${node.id} prerequisite`);
      assert.ok(fs.existsSync(path.join(process.cwd(), "public", node.icon)), node.icon);
    }
  }
});

test("S4 各树的光暗被动各有唯一默认项，资源和身份完整", () => {
  for (const tree of Object.values(passives.trees)) {
    for (const energy of ["light", "dark"] as const) {
      const options = tree[energy];
      assert.equal(options.filter((passive) => passive.isDefault).length, 1);
      assert.equal(new Set(options.map((passive) => passive.id)).size, options.length);
      assert.ok(options.every((passive) => passive.energy === energy));
      for (const passive of options) {
        assert.ok(passive.description && passive.description !== "暂无技能说明");
        assert.ok(fs.existsSync(path.join(process.cwd(), "public", passive.icon)), passive.icon);
      }
    }
  }
});
