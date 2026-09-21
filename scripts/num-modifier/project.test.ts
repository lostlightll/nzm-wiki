import assert from "node:assert/strict";
import test from "node:test";

import { hashJsonSourceText } from "./project";
import { getProviderResolver } from "./provider-resolver";
import { NUM_MODIFIER_LOCK, NUM_MODIFIER_SEMANTICS } from "../../lib/num-modifier-data";
import { createNumModifierResolver } from "../../lib/num-modifier";
import { parseModifierProviderRegistry } from "../../lib/modifier-provider-registry";
import providerRegistry from "../../data/modifier-providers.json";

test("promoted weapon providers use the live resolver and reject retired preview selection", () => {
  const provider = parseModifierProviderRegistry(providerRegistry).providers.find(
    entry => entry.id === "weapon:极地夜曲:冷凝超载",
  );
  assert.ok(provider);
  const expression = provider.applications![0].expression;
  // A distinct live value proves the retired snapshot cannot override a promoted source.
  const formalLock = structuredClone(NUM_MODIFIER_LOCK);
  formalLock.rows.lc[expression.row.slice(3)].raw.BaseValue = 0.125;
  const formalResolver = createNumModifierResolver(formalLock, NUM_MODIFIER_SEMANTICS);
  const resolver = getProviderResolver(provider.source, formalResolver);
  assert.equal(resolver.getRow(expression.row).baseValue, 0.125);
  assert.throws(() => getProviderResolver({ ...provider.source, season: "s4-preview" }, formalResolver), /Missing matching preview/);
  assert.equal(formalResolver.getRow(expression.row).baseValue, 0.125);
  assert.equal(getProviderResolver({
    type: "weapon", slug: "极地夜曲", skillName: "冷凝超载", component: "ActiveSkill",
  }, formalResolver), formalResolver);
});

test("projection source hashes ignore JSON formatting and line endings", () => {
  const lf = "{\n  \"schemaVersion\": 1,\n  \"values\": [1, 2]\n}\n";
  const crlf = "{\r\n\"schemaVersion\":1,\r\n\"values\":[1,2]\r\n}\r\n";

  assert.equal(hashJsonSourceText(lf), hashJsonSourceText(crlf));
});
