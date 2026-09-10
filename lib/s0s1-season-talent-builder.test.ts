import assert from "node:assert/strict";
import test from "node:test";
import { getLegacyTalentCatalog } from "./s0s1-season-talents";
import { legacySimulationNodes } from "./s0s1-season-talent-builder";
import { restoreS3TalentBuild, setS3TalentNodeLevel } from "./s3-season-talent-builder";

test("all legacy trees start empty and support exclusive prerequisite allocation, restoration and cascading refunds", () => {
  for (const season of ["s0", "s1"] as const) {
    for (const tree of getLegacyTalentCatalog(season)) {
      const nodes = legacySimulationNodes(tree);
      assert.deepEqual(restoreS3TalentBuild(nodes, "", null, new Set()).levels, {});
      const first = nodes.find(node => node.column === 1 && !node.prerequisites.length)!;
      assert.ok(first, tree.id);
      const child = nodes.find(node => node.prerequisites.includes(first.id))!;
      assert.ok(child, tree.id);
      assert.deepEqual(setS3TalentNodeLevel(nodes, {}, child.id, 1), {});
      let levels = setS3TalentNodeLevel(nodes, {}, first.id, first.maxLevel);
      levels = setS3TalentNodeLevel(nodes, levels, child.id, 1);
      assert.equal(levels[child.id], 1, tree.id);
      assert.deepEqual(restoreS3TalentBuild(nodes, "", { version: 1, levels }, new Set()).levels, levels);
      const refunded = setS3TalentNodeLevel(nodes, levels, first.id, 0);
      assert.equal(refunded[child.id] ?? 0, 0);
      assert.equal(refunded[first.id] ?? 0, 0);
    }
  }
});
