import assert from "node:assert/strict";
import test from "node:test";
import historical from "../../data/season-talents/s2/provider-evidence.json";
import { NUM_MODIFIER_RESOLVER } from "../../lib/num-modifier-data";
import { getProviderResolver } from "../num-modifier/provider-resolver";
import { getApplicableModifierTypes, getProviderRelationsForSource, resolveMultiplierSourceHref } from "../../lib/multiplier-data";
import { parseModifierProviderRegistry } from "../../lib/modifier-provider-registry";
import registryJson from "../../data/modifier-providers.json";
import { getS2TalentTree, S2_TALENT_IDS } from "../../lib/s2-season-talents";

const registry = parseModifierProviderRegistry(registryJson);
const providers = registry.providers.filter(p => p.source.type === "season-talent" && p.source.season === "s2");

test("fire amplification indexes damage in dilution without indexing tick frequency", () => {
  const provider = providers.find(p => p.source.type === "season-talent" && p.source.nodeId === "2002206");
  assert.ok(provider);
  assert.deepEqual(provider.applications?.map(a => a.expression.row), ["lc:111030019_1_1"]);
  const relations = getProviderRelationsForSource(provider.source);
  assert.equal(relations.length, 1);
  assert.equal(relations[0].factorId, "dilution");
  assert.equal(relations[0].modifierTypeId, "fire-debuff-damage");
  for (const [element, settlement, expected] of [
    ["火焰", "DebuffDamage", true],
    ["寒冷", "DebuffDamage", false],
    ["火焰", "WeaponDamage", false],
  ] as const) {
    const targets = getApplicableModifierTypes({ element, settlements: [`Numerical.SettlementType.Health.${settlement}`] });
    assert.equal(targets.some(r => r.modifierTypeId === "fire-debuff-damage"), expected);
  }
});

test("S2 clone buffs identify both shot damage facets without claiming a runtime recipient or talent level", () => {
  for (const [nodeId, modifierId] of [["2003206", "111031043"], ["2003305", "111031044"], ["2003507", "111031045"]]) {
    const provider = historical.providers.find(p => p.source.nodeId === nodeId);
    assert.ok(provider, nodeId);
    assert.deepEqual(provider.applications.map(application => application.expression.row).sort(), [`lc:${modifierId}_1_0`, `lc:${modifierId}_1_1`]);
    assert.ok(provider.applications.every(application => application.context.recipient === "unknown"));
    assert.ok(provider.evidence.basis.some(line => line.includes("GPModifyIDs=")));
    assert.ok(provider.evidence.basis.some(line => line.includes("未导出执行连线")));
  }
  for (const [nodeId, skillKey, buffKey] of [["2003305", "side1-DamageUp=1319032005", "side1-DamageUpBuffName=SeasonTalent_S3_YHFS_002"], ["2003507", "side4-Phase2DamageUp=1319032008", "side4-DamageUpBuffName=SeasonTalent_S3_YHFS_003"]]) {
    const provider = historical.providers.find(p => p.source.nodeId === nodeId)!;
    assert.ok(provider.evidence.basis.some(line => line.includes(skillKey)));
    assert.ok(provider.evidence.basis.some(line => line.includes(buffKey)));
  }
});

test("reviewed invisibility identities index damage attributes, not trigger wording or critical chance", () => {
  for (const [nodeId, rows, factor] of [
    ["2001206", ["lc:160303001_1_0", "lc:160303001_1_1"], "dilution"],
    ["2001406", ["lc:160303005_1_0"], "critical"],
    ["2001505", ["lc:160303004_1_0"], "critical"],
    ["2001606", ["lc:160303006_1_0", "lc:160303006_1_1"], "dilution"],
  ] as const) {
    const provider = providers.find(p => p.source.type === "season-talent" && p.source.nodeId === nodeId);
    assert.ok(provider, nodeId);
    assert.deepEqual(provider.applications?.map(a => a.expression.row).sort(), [...rows].sort());
    const relations = getProviderRelationsForSource(provider.source);
    assert.equal(relations.length, rows.length);
    assert.ok(relations.every(r => r.factorId === factor));
    assert.ok(provider.evidence.basis?.some(line => line.includes("维护者明确确认")));
  }
});

test("common elemental damage talents expose four dilution channels in every tree", () => {
  for (const prefix of ["2001", "2002", "2003"]) for (const [suffix, modifier, field] of [["303", "111030002", "base"], ["402", "111030003", "base"], ["502", "111030006", "coefficient"]]) {
    const nodeId = prefix + suffix;
    const provider = providers.find(p => p.source.type === "season-talent" && p.source.nodeId === nodeId);
    assert.ok(provider, nodeId);
    assert.deepEqual(provider.applications?.map(a => a.expression), [0, 1, 2, 3].map(index => ({ row: `lc:${modifier}_1_${index}`, field })));
    const relations = getProviderRelationsForSource(provider.source);
    assert.equal(relations.length, 4);
    assert.ok(relations.every(r => r.factorId === "dilution"));
  }
});

test("enhanced shooting indexes its positive per-stack coefficient in all three passive placements", () => {
  for (const [tree, passiveId] of [["invisibility", "2020305"], ["inferno-arm", "2020105"], ["holographic-sync", "2020205"]]) {
    const provider = providers.find(p => p.source.type === "season-talent" && p.source.tree === tree && p.source.passiveId === passiveId);
    assert.ok(provider, tree);
    assert.deepEqual(provider.applications?.map(a => a.expression), [{ row: "lc:111030011_1_0", field: "coefficient" }]);
    const relations = getProviderRelationsForSource(provider.source);
    assert.equal(relations.length, 1);
    assert.equal(relations[0].factorId, "dilution");
    assert.equal(relations[0].modifierTypeId, "weapon-damage");
    assert.ok(relations[0].sourceHref.includes(`passive=${passiveId}`));
  }
});

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
