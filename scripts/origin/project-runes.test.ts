import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import catalog from "../../data/origin/runes.json";
import { projectOriginRunes } from "./project-runes";

const tableDir = path.join(process.cwd(), "refs/Exports/NZM/Content/DataTables/Roguelike");
const rows = (name: string) => JSON.parse(fs.readFileSync(path.join(tableDir, `${name}.json`), "utf8"))[0].Rows;

test("the committed rune projection has reviewed descriptions for every source ID", () => {
  const special = rows("RoguelikeSpecialRuneTable");
  const normal = rows("RoguelikeRuneTable");
  const tags = rows("RoguelikeRuneTagTable");
  const projected = projectOriginRunes(special, normal, tags);
  assert.deepEqual(projected, catalog);
  assert.equal(projected.runes[0].id, "1378042010");
  assert.equal(projected.runes[46].id, Object.keys(normal)[0]);
  assert.equal(new Set(projected.runes.map((rune) => rune.id)).size, 174);
  assert.equal(new Set(projected.runes.map((rune) => rune.icon)).size, 37);
  assert.ok(projected.runes.every((rune) => rune.description.trim() &&
    !/[0-9０-９%％]|\{[^}]*\}/.test(rune.description)));
  assert.ok(projected.runes.every((rune) => rune.tagIds.every((id) => projected.tags.some((tag) => tag.id === id))));
  assert.ok(projected.runes.every((rune) => fs.existsSync(path.join(process.cwd(), "public", rune.icon))));
  assert.doesNotMatch(JSON.stringify(projected), /每次射击命中目标可以增加1层/);
  assert.equal(projected.runes[0].description, "射击命中叠加攻击力；命中弱点叠加更多。换弹或切枪后清除。");
  assert.throws(() => projectOriginRunes(special, { ...normal, "1378042010": special["1378042010"] }, tags), /collision/);
  const invalid = structuredClone(special);
  invalid["1378042010"].Tag.Values = [999];
  assert.throws(() => projectOriginRunes(invalid, normal, tags), /Invalid tags/);
});
