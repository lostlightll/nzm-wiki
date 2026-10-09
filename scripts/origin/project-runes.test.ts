import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import catalog from "../../data/origin/runes.json";
import highlightedDescriptions from "../../data/origin/rune-descriptions.json";
import { projectOriginRunes, resolveRuneDescription } from "./project-runes";

const tableDir = path.join(process.cwd(), "refs/Exports/NZM/Content/DataTables/Roguelike");
const rows = (name: string) => JSON.parse(fs.readFileSync(path.join(tableDir, `${name}.json`), "utf8"))[0].Rows;

test("the committed rune projection preserves in-game descriptions for every source ID", () => {
  const special = rows("RoguelikeSpecialRuneTable");
  const normal = rows("RoguelikeRuneTable");
  const tags = rows("RoguelikeRuneTagTable");
  const projected = projectOriginRunes(special, normal, tags);
  assert.deepEqual(projected, catalog);
  assert.equal(projected.runes[0].id, "1378042010");
  assert.equal(projected.runes[46].id, Object.keys(normal)[0]);
  assert.equal(new Set(projected.runes.map((rune) => rune.id)).size, 174);
  assert.equal(new Set(projected.runes.map((rune) => rune.icon)).size, 37);
  for (const rune of projected.runes) {
    const source = (rune.category === "special" ? special : normal)[rune.id].Description;
    assert.match(rune.description, /\*\*[^*\n]+\*\*/);
    assert.equal(rune.description, resolveRuneDescription(rune.id,
      (source.LocalizedString || source.SourceString).trim(),
      highlightedDescriptions[rune.id as keyof typeof highlightedDescriptions]));
  }
  assert.ok(projected.runes.every((rune) => rune.tagIds.every((id) => projected.tags.some((tag) => tag.id === id))));
  assert.ok(projected.runes.every((rune) => fs.existsSync(path.join(process.cwd(), "public", rune.icon))));
  assert.equal(projected.runes.find((rune) => rune.name === "聚金增伤")?.description.replace(/\*\*/g, ""),
    "攻击力受拥有的金币影响，每拥有200金币提升2.5%攻击力。");
  assert.throws(() => projectOriginRunes(special, { ...normal, "1378042010": special["1378042010"] }, tags), /collision/);
  const invalid = structuredClone(special);
  invalid["1378042010"].Tag.Values = [999];
  assert.throws(() => projectOriginRunes(invalid, normal, tags), /Invalid tags/);
});

test("source description changes require a manual highlight review", () => {
  const special = rows("RoguelikeSpecialRuneTable");
  special["1378042010"].Description.LocalizedString += "已更新";
  assert.throws(() => projectOriginRunes(special, rows("RoguelikeRuneTable"), rows("RoguelikeRuneTagTable")),
    /Rune highlights must preserve the source description: 1378042010/);
});

test("Numerical conflict reviews reject changed source text and unreviewed display values", () => {
  const source = "受到致命伤害时免疫死亡4秒，期间攻击力+300%（CD120秒）。";
  const highlighted = highlightedDescriptions["1378042250"];
  assert.match(resolveRuneDescription("1378042250", source, highlighted), /攻击力\*\*\+200%\*\*/);
  assert.throws(() => resolveRuneDescription("1378042250", source + "已更新", highlighted), /review is stale/);
  assert.throws(() => resolveRuneDescription("1378042250", source,
    highlighted.replace("{{num:attack|percent}}", "300%")), /must preserve/);
});
