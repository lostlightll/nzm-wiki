import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { LegacyTalentTree } from "../../lib/s0s1-season-talents";
import { buildTrees, readEvidence, type Evidence } from "./extract";
import { summarizeSemanticReview } from "./semantic-conflicts";

export function checkLegacyTalents(checkSources = false) {
  for (const season of ["s0", "s1"] as const) {
    const evidence: Evidence = JSON.parse(readFileSync(join(process.cwd(), "data/season-talents", season, "audit.json"), "utf8"));
    assert.equal(evidence.schemaVersion, 1);
    assert.equal(evidence.season, season);
    assert.equal(evidence.visualVerification.nodes, "not-verified");
    for (const asset of evidence.visualVerification.assets) {
      assert.match(asset.name, /^[A-Za-z0-9_]+$/);
      assert.ok(["missing", "pending-visual-review", "video-matched"].includes(asset.status));
    }
    // Rebuild from committed evidence and the current Resolver, without reading refs.
    const trees: LegacyTalentTree[] = JSON.parse(readFileSync(join(process.cwd(), "data/season-talents", season, "trees.json"), "utf8"));
    checkProjection(trees, evidence);
    assert.deepEqual(evidence.semanticReview, summarizeSemanticReview(trees));
    const selected = new Set(trees.flatMap((tree) => tree.nodes.map((node) => node.id)));
    const expectedExcluded = new Set(Object.values(evidence.tables.basic).map((value) => String((value as { TalentID: number }).TalentID)).filter((id) => !selected.has(id)));
    assert.deepEqual(new Set(evidence.excluded.map((item) => item.id)), expectedExcluded);
    for (const excluded of evidence.excluded) {
      assert.ok(excluded.reason && excluded.basicRows.length);
      for (const key of excluded.basicRows) assert.equal(String((evidence.tables.basic[key] as { TalentID: number }).TalentID), excluded.id);
    }
    for (const tree of trees) {
      assert.equal(tree.nodeCount, tree.nodes.length);
      for (const node of tree.nodes) {
        // Existence is intentionally not checked: missing sprites are an explicit supported state.
        assert.match(node.icon, /^\/webp\/images\/season-talents\/s0s1\/[A-Za-z0-9_]+\.webp$/);
        assert.equal(node.maxLevel, node.levels.length);
        for (const level of node.levels) {
          assert.ok(level.description);
          assert.doesNotMatch(level.description, /\{[^}]*\}|<[^>]*>/);
          if (level.description.includes("〔数值待核实〕")) assert.ok(level.warnings.some((warning) => /UNVERIFIED_DESCRIPTION_NUMBER|UNRESOLVED_TOKEN/.test(warning)));
          if (!level.facts.length) assert.ok(level.warnings.length, "Missing evidence must not be silent");
          for (const key of level.modifierRows) assert.ok(level.facts.some((fact) => fact.modifierRow === key));
          for (const fact of level.facts) {
            assert.ok(fact.evidenceKind);
            assert.ok(fact.historicalEffectStatus === "unverified" || fact.historicalEffectStatus === "semantic-conflict");
            for (const id of fact.conflictIds ?? []) assert.ok(level.semanticConflicts?.some((conflict) => conflict.id === id));
          }
        }
      }
    }
    if (checkSources) {
      const current = readEvidence(season);
      assert.deepEqual(evidence.sources, current.sources, `${season}: source hash drift`);
      assert.deepEqual(evidence.tables, current.tables, `${season}: evidence no longer matches current Main tables`);
      assert.deepEqual(evidence.excluded, current.excluded);
    }
    console.log(`${season}: ${trees.length} trees, ${selected.size} nodes, ${evidence.excluded.length} excluded; offline evidence check passed${checkSources ? "; source hashes verified" : ""}`);
  }
}

export function checkProjection(rawTrees: readonly LegacyTalentTree[], evidence: Evidence) {
  assert.deepEqual(rawTrees, buildTrees(evidence), `${evidence.season}: projection or Numerical facts drifted; rerun extract`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) checkLegacyTalents(process.argv.includes("--sources"));
