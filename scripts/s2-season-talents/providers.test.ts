import assert from "node:assert/strict";
import test from "node:test";
import historical from "../../data/season-talents/s2/provider-evidence.json";
import { NUM_MODIFIER_RESOLVER } from "../../lib/num-modifier-data";
import { getProviderResolver } from "../num-modifier/provider-resolver";
import { getProviderRelationsForSource, resolveMultiplierSourceHref } from "../../lib/multiplier-data";
import { parseModifierProviderRegistry } from "../../lib/modifier-provider-registry";
import registryJson from "../../data/modifier-providers.json";
import { getS2TalentTree, S2_TALENT_IDS } from "../../lib/s2-season-talents";

const registry = parseModifierProviderRegistry(registryJson);
const providers = registry.providers.filter(p => p.source.type === "season-talent" && p.source.season === "s2");

test("S2 indexes use archived Numerical rows and never fall back to today's lock", () => {
  assert.ok(providers.length > 0);
  for (const provider of providers) {
    const resolver = getProviderResolver(provider.source, NUM_MODIFIER_RESOLVER);
    assert.notEqual(resolver, NUM_MODIFIER_RESOLVER);
    for (const application of provider.applications ?? []) {
      const effect = resolver.resolveEffect(application.expression, application.context);
      const rowName = application.expression.row.slice(3);
      const rows = historical.lock.rows.lc as Record<string, { raw: Record<string, unknown> }>;
      assert.deepEqual(effect.value.row.raw, rows[rowName].raw);
    }
    assert.throws(() => resolver.getRow("lc:111031014_1_0"), /not locked/);
  }
});

test("every S2 node and passive has exactly one registration or explicit exclusion", () => {
  const entries = [...registry.providers, ...registry.exclusions];
  for (const id of S2_TALENT_IDS) {
    const tree = getS2TalentTree(id)!;
    for (const item of [...tree.nodes, ...tree.passives]) {
      const matches = entries.filter(({ source }) => source.type === "season-talent" && source.season === "s2" && source.tree === id &&
        ("descriptions" in item ? source.nodeId === item.id : source.passiveId === item.id));
      assert.equal(matches.length, 1, `${id}:${item.id}`);
    }
  }
});

test("S2 damage facets can be followed back to the correct tree and talent", () => {
  for (const provider of providers) {
    assert.equal(provider.source.type, "season-talent");
    if (provider.source.type !== "season-talent") continue;
    const relations = getProviderRelationsForSource(provider.source);
    assert.ok(relations.length > 0, provider.id);
    const source = provider.source;
    const href = resolveMultiplierSourceHref(source);
    assert.ok(href.startsWith(`/guides/season-talents/s2/${source.tree}?`));
    assert.ok(href.includes(source.nodeId ? `node=${source.nodeId}` : `passive=${source.passiveId}`));
    const anchor = source.nodeId ? `node-${source.nodeId}` : `passive-${source.passiveId}`;
    assert.ok(relations.every(r => r.sourceHref === `${href}#multiplier-provider-${anchor}`));
  }
});
