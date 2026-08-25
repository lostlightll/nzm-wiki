import assert from "node:assert/strict";
import test from "node:test";
import {
  parseNumModifierDataLock,
  serializeNumModifierDataLock,
} from "../../lib/num-modifier-data-lock";
import {
  checkNumModifierDataLock,
  readNumModifierDataLock,
} from "./lock";

test("the committed Lock is canonical and internally complete", () => {
  const lock = readNumModifierDataLock();
  const result = checkNumModifierDataLock(lock);
  assert.equal(result.ok, true, result.issues.join("\n"));
  assert.equal(result.warnings.length, 3);
  assert.equal(lock.sources.lc.modifiers.row_count, 3044);
  assert.equal(lock.sources.lc.attribute_descriptions.row_count, 180);
  assert.equal(Object.keys(lock.attribute_descriptions.lc).length, 180);
  assert.deepEqual(
    parseNumModifierDataLock(JSON.parse(serializeNumModifierDataLock(lock))),
    lock,
  );
});
