import assert from "node:assert/strict";
import test from "node:test";
import catalog from "../../data/origin/affixes.json";
import { filterOriginAffixes, type OriginAffixCatalog, type OriginAffixFilters } from "../../lib/origin-affixes";
import { projectOriginAffixes, readAffixRows } from "./project-affixes";

const data = catalog as OriginAffixCatalog;
const empty: OriginAffixFilters = { query: "", categories: new Set() };

test("the committed affix projection matches the display table in ID order", () => {
  const rows = readAffixRows();
  const projected = projectOriginAffixes(rows);
  assert.deepEqual(projected, catalog);
  assert.deepEqual(projected.affixes.slice(0, 3).map((affix) => affix.name), ["毒皇·毒池", "龙神·连发", "毒皇·腐蚀"]);
  assert.ok(!projected.affixes.some((affix) => affix.id === "10025"));
  const zeroWidth = new RegExp("[\\u200B-\\u200D\\uFEFF]", "g");
  assert.ok(projected.affixes.every((affix) => !affix.description.match(zeroWidth)));
  assert.ok(rows["10096"].Description.SourceString!.match(zeroWidth));
  for (const affix of projected.affixes) {
    const source = rows[affix.id].Description;
    assert.equal(affix.description, (source.LocalizedString || source.SourceString)!.replace(zeroWidth, "").trim());
  }
});

test("projection rejects identity, category and icon drift", () => {
  const rows = readAffixRows();
  assert.throws(() => projectOriginAffixes({ ...rows, 99999: rows["10001"] }), /identity mismatch/);
  const category = structuredClone(rows);
  category["10001"].AffixCategory = "EWeaponAffixCategory::Legendary";
  assert.throws(() => projectOriginAffixes(category), /Unknown affix category/);
  const icon = structuredClone(rows);
  icon["10001"].Icon.AssetPathName = "/Game/Other.Other";
  assert.throws(() => projectOriginAffixes(icon), /icon changed/);
});

test("affix filters match ID, name or description within the selected categories", () => {
  assert.equal(filterOriginAffixes(data.affixes, empty).length, 108);
  assert.equal(filterOriginAffixes(data.affixes, { ...empty, categories: new Set(["special"]) }).length, 71);
  assert.equal(filterOriginAffixes(data.affixes, { ...empty, categories: new Set(["normal"]) }).length, 37);
  assert.equal(filterOriginAffixes(data.affixes, { ...empty, categories: new Set(["special", "normal"]) }).length, 108);
  assert.deepEqual(filterOriginAffixes(data.affixes, { ...empty, query: "10003" }).map((affix) => affix.name), ["毒皇·腐蚀"]);
  assert.deepEqual(filterOriginAffixes(data.affixes, { ...empty, query: " 弹射飞刃 " }).map((affix) => affix.id), ["10021"]);
  const poison = filterOriginAffixes(data.affixes, { ...empty, query: "毒池" });
  assert.ok(poison.some((affix) => affix.id === "10001"));
  const critNormal = filterOriginAffixes(data.affixes, { query: "暴击率", categories: new Set(["normal"]) });
  assert.deepEqual(critNormal.map((affix) => affix.id), ["10057", "10068", "10079"]);
  assert.deepEqual(filterOriginAffixes(data.affixes, { ...empty, query: "no such affix" }), []);
});
