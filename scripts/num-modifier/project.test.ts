import assert from "node:assert/strict";
import test from "node:test";

import { hashJsonSourceText } from "./project";
import { getProviderResolver } from "./provider-resolver";
import { NUM_MODIFIER_RESOLVER } from "../../lib/num-modifier-data";
import { parseModifierProviderRegistry } from "../../lib/modifier-provider-registry";
import providerRegistry from "../../data/modifier-providers.json";

test("preview weapon providers resolve selected evidence without changing the official resolver", () => {
  const provider = parseModifierProviderRegistry(providerRegistry).providers.find(
    entry => entry.id === "weapon:极地夜曲:冷凝超载",
  );
  assert.ok(provider);
  const expression = provider.applications![0].expression;
  const resolver = getProviderResolver(provider.source, NUM_MODIFIER_RESOLVER);
  assert.equal(resolver.getRow(expression.row).baseValue, 0.5);
  assert.throws(() => NUM_MODIFIER_RESOLVER.getRow(expression.row));
  assert.equal(getProviderResolver({
    type: "weapon", slug: "极地夜曲", skillName: "冷凝超载", component: "ActiveSkill",
  }, NUM_MODIFIER_RESOLVER), NUM_MODIFIER_RESOLVER);
});

test("projection source hashes ignore JSON formatting and line endings", () => {
  const lf = "{\n  \"schemaVersion\": 1,\n  \"values\": [1, 2]\n}\n";
  const crlf = "{\r\n\"schemaVersion\":1,\r\n\"values\":[1,2]\r\n}\r\n";

  assert.equal(hashJsonSourceText(lf), hashJsonSourceText(crlf));
});
