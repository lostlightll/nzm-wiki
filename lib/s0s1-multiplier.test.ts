import assert from "node:assert/strict";
import test from "node:test";
import { getLegacyTalentCatalog } from "./s0s1-season-talents";
import { buildLegacyProviders, syncLegacyProviders } from "../scripts/s0s1-season-talents/providers";
import { getProviderRelationsForSource, getSourcesForModifierType, resolveMultiplierSourceHref } from "./multiplier-data";

const trees = () => [...getLegacyTalentCatalog("s0"), ...getLegacyTalentCatalog("s1")];

test("all 143 nodes of the five released branches have a source or explicit exclusion", () => {
  const result = syncLegacyProviders();
  const entries = [...result.providers, ...result.exclusions];
  assert.equal(entries.length, 143);
  assert.equal(new Set(entries.map(entry => entry.id)).size, 143);
  assert.ok(result.providers.length > 0);
  assert.ok(entries.every(entry => entry.source.type === "season-talent" && entry.source.tree !== "destruction-dream"));
  for (const provider of result.providers) {
    assert.equal(provider.evidence.kind, "reviewed-chain");
    assert.ok(provider.applications?.length);
    const relations = getProviderRelationsForSource(provider.source);
    assert.ok(relations.length, provider.id);
    for (const relation of relations) assert.ok(getSourcesForModifierType(relation.modifierTypeId).includes(relation));
    assert.match(resolveMultiplierSourceHref(provider.source), /\/s[01]\/[^?]+\?node=\d+/);
  }
});

test("unreviewed raw Modifier facts never become historical source badges", () => {
  const input = trees();
  for (const tree of input) for (const node of tree.nodes) for (const level of node.levels) delete level.valueReview;
  const result = buildLegacyProviders(input);
  assert.equal(result.providers.length, 0);
  assert.equal(result.exclusions.length, 143);
});

test("registered Num applications must retain structured provenance", () => {
  const input = trees();
  const level = input.flatMap(tree => tree.nodes.flatMap(node => node.levels)).find(level => level.valueReview?.applications.length);
  assert.ok(level);
  const only = input.find(tree => tree.nodes.some(node => node.levels.includes(level)))!;
  const node = only.nodes.find(node => node.levels.includes(level))!;
  for (const value of node.levels) if (value.valueReview) value.valueReview.sources = [];
  assert.throws(() => buildLegacyProviders([{ ...only, nodes: [node] }]), /provenance/);
});

test("a quarantined swarm chain cannot enter the index even if an application is injected", () => {
  const input = trees();
  const node = input.flatMap(tree => tree.nodes).find(node => node.levels.some(level => level.valueReview?.executionConflict));
  assert.ok(node);
  const application = input.flatMap(tree => tree.nodes.flatMap(node => node.levels.flatMap(level => level.valueReview?.applications ?? [])))[0];
  assert.ok(application);
  const before = buildLegacyProviders(input);
  for (const level of node.levels) level.valueReview!.applications = [application];
  assert.deepEqual(buildLegacyProviders(input), before);
});
