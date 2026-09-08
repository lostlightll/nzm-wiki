import assert from "node:assert/strict";
import test from "node:test";
import { legacyDescriptionParts } from "./s0s1-talent-description";
import { getLegacyTalentCatalog } from "./s0s1-season-talents";
import { buildLegacyProviders } from "../scripts/s0s1-season-talents/providers";

test("reference wording restores single-shot grammar without becoming a configured value", () => {
  const level = { description: "每〔数值待核实〕秒释放〔数值待核实〕道射线，伤害提高20%。", descriptionReferences: [
    { text: "1", source: "exact-level-description", reason: "execution field unavailable" },
    { text: "一", source: "exact-level-description", reason: "wording only" },
  ] };
  const parts = legacyDescriptionParts(level);
  assert.equal(parts.map(part => part.text).join(""), "每1秒释放一道射线，伤害提高20%。");
  assert.deepEqual(parts.filter(part => part.reference).map(part => part.text), ["1", "一"]);
  assert.ok(level.description.includes("〔数值待核实〕"));
  assert.ok(parts.some(part => !part.reference && part.text.includes("20%")));
});

test("unresolved game tokens are not presented as quantities, and slot drift fails", () => {
  assert.deepEqual(legacyDescriptionParts({ description: "〔数值待核实〕", descriptionReferences: [{ text: "{Unknown:1}", source: "description", reason: "unresolved token" }] }).filter(part => part.text), [{ text: "〔数值待核实〕", reference: false }]);
  assert.throws(() => legacyDescriptionParts({ description: "〔数值待核实〕", descriptionReferences: [] }), /DESCRIPTION_REFERENCE_DRIFT/);
});

test("all five released branches have complete readable wording without promoting references into the index", () => {
  const trees = [...getLegacyTalentCatalog("s0"), ...getLegacyTalentCatalog("s1")].filter(tree => tree.historicalStatus === "video-confirmed");
  assert.equal(trees.length, 5);
  const before = buildLegacyProviders(trees);
  let references = 0;
  for (const tree of trees) for (const node of tree.nodes) for (const level of node.levels) {
    const parts = legacyDescriptionParts(level);
    assert.doesNotMatch(parts.map(part => part.text).join(""), /〔数值待核实〕|缺少该等级描述|\{[^}]+\}/, `${tree.id}/${node.id}/${level.level}`);
    references += parts.filter(part => part.reference).length;
    for (const reference of level.descriptionReferences ?? []) assert.ok(reference.source && reference.reason);
    delete level.descriptionReferences;
  }
  assert.ok(references > 0);
  assert.deepEqual(buildLegacyProviders(trees), before);
});
