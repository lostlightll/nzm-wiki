import assert from "node:assert/strict";
import test from "node:test";
import { task77EvidenceId } from "./task77";

test("Task 7.7 evidence IDs preserve distinct Unicode identities", () => {
  const values = ["哈士奇好友", "鬼铜蚀", "extra-mode:丢枪爆炸", "extra-mode:回血恢复"];
  const ids = values.map(task77EvidenceId);

  assert.equal(new Set(ids).size, values.length);
  for (const id of ids) assert.match(id, /^[a-z][a-z0-9-]*$/);
});
