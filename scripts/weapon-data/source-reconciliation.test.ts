import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import matter from "gray-matter";
import { migrationDecisionsV2Schema } from "./bulk-migration";
import {
  applyReconciliation,
  generateReconciliationMarkdown,
  reconcileSnapshotDifferenceDecisions,
  writeReconciliationMarkdown,
} from "./source-reconciliation";

function fixtureRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), "weapon-reconciliation-"));
  mkdirSync(path.join(root, "data", "weapons"), { recursive: true });
  mkdirSync(path.join(root, "data", "weapons_td"), { recursive: true });
  return root;
}

function decisions() {
  return {
    schema_version: 2,
    evidence: {
      "manual-source": {
        kind: "manual_verification",
        note: "测试确认来源",
      },
      "manual-fire": {
        kind: "manual_verification",
        note: "测试确认独立射速",
      },
    },
    weapons: {
      测试武器: {
        sources: {
          primary: {
            id: "primary",
            name: "普通射击",
            section: "fire_mode",
            locator: { kind: "primary" },
            table_scope: ["lc"],
            reason: "测试身份",
          },
        },
        tables: {
          lc: {
            sources: {
              primary: {
                numerical: { table: "lc", id: 2, level: 1 },
                asc_type_id: "3",
              },
            },
            field_decisions: {
              primary: {
                "damage.base": {
                  action: "accept_source",
                  owner: "game_data",
                  reason: "采用正式来源",
                },
                "fire.interval": {
                  action: "confirmed_override",
                  owner: "wiki_semantics",
                  reason: "确认独立射速",
                  value: 0.2,
                  evidence_ids: ["manual-fire"],
                },
              },
            },
            snapshot_differences: [],
            source_reviews: {
              primary: {
                previous_effective_source: {
                  numerical: { table: "lc", id: 1, level: 1 },
                  asc_type_id: "3",
                },
                resolution: "corrected",
                reason: "修正来源",
                evidence_ids: ["manual-source"],
              },
            },
          },
        },
      },
    },
  };
}

test("Schema v2 的 migrated 分支拒绝 preserve_legacy", () => {
  const input = decisions();
  const invalid = structuredClone(input) as Record<string, unknown>;
  const root = invalid.weapons as Record<string, Record<string, unknown>>;
  const weapon = root.测试武器;
  const table = ((weapon.tables as Record<string, unknown>).lc as Record<string, unknown>);
  const fields = ((table.field_decisions as Record<string, unknown>).primary as Record<string, unknown>);
  fields["damage.base"] = {
    action: "preserve_legacy",
    owner: "wiki_semantics",
    reason: "临时值",
  };
  assert.equal(migrationDecisionsV2Schema.safeParse(invalid).success, false);
});

test("apply 替换完整来源、删除临时 Numerical override 并保留正文", () => {
  const root = fixtureRoot();
  const decisionsPath = path.join(root, "data", "decisions.json");
  const mdxPath = path.join(root, "data", "weapons", "测试武器.mdx");
  writeFileSync(decisionsPath, `${JSON.stringify(decisions(), null, 2)}\n`, "utf8");
  writeFileSync(
    mdxPath,
    `---
title: 测试武器
schema_version: 2
prototype_id: "1"
use_type: 主武器
element: 物理
rarity: 稀有
damage_sources:
  - id: primary
    name: 普通射击
    section: fire_mode
    source:
      numerical:
        table: lc
        id: 1
        level: 1
      asc_type_id: "3"
    fire_interval: 0.2
    overrides:
      numerical:
        damage:
          base: 2
    override_reason: 结构迁移保留旧 MDX 直接维护的 damage.base，原表差异待独立核验
---
正文保持不变
`,
    "utf8",
  );

  applyReconciliation({ root, decisionsPath });
  const first = readFileSync(mdxPath, "utf8");
  const parsed = matter(first).data;
  assert.equal(first.endsWith("正文保持不变\n"), true);
  assert.deepEqual(parsed.damage_sources[0].source, {
    numerical: { table: "lc", id: 2, level: 1 },
    asc_type_id: "3",
  });
  assert.deepEqual(parsed.damage_sources[0].overrides, {
    asc: { fire_interval: 0.2 },
  });
  assert.equal(parsed.damage_sources[0].fire_interval, undefined);
  assert.equal(parsed.damage_sources[0].override_reason, "确认独立射速");

  applyReconciliation({ root, decisionsPath });
  assert.equal(readFileSync(mdxPath, "utf8"), first);
});

test("无 ASC 的正式射速写入兼容字段而不是非法 ASC override", () => {
  const root = fixtureRoot();
  const decisionsPath = path.join(root, "data", "decisions.json");
  const mdxPath = path.join(root, "data", "weapons", "测试武器.mdx");
  const input = decisions();
  const table = input.weapons.测试武器.tables.lc;
  delete (table.sources.primary as { asc_type_id?: string }).asc_type_id;
  delete (
    table.source_reviews.primary.previous_effective_source as { asc_type_id?: string }
  ).asc_type_id;
  writeFileSync(decisionsPath, `${JSON.stringify(input, null, 2)}\n`, "utf8");
  writeFileSync(
    mdxPath,
    `---
title: 测试武器
schema_version: 2
prototype_id: "1"
use_type: 主武器
element: 物理
rarity: 稀有
damage_sources:
  - id: primary
    name: 普通射击
    section: fire_mode
    source:
      numerical:
        table: lc
        id: 1
        level: 1
    fire_interval: 0.3
---
正文
`,
    "utf8",
  );

  applyReconciliation({ root, decisionsPath });
  const source = matter(readFileSync(mdxPath, "utf8")).data.damage_sources[0];
  assert.equal(source.fire_interval, 0.2);
  assert.equal(source.overrides, undefined);
  assert.equal(source.override_reason, undefined);
});

test("snapshot decisions 保留既有分类、移除过期项并登记新纠正", () => {
  assert.deepEqual(
    reconcileSnapshotDifferenceDecisions(
      [{ pointer: "/kept" }, { pointer: "/new" }],
      [
        {
          pointer: "/kept",
          classification: "source_difference",
          reason: "既有审核",
        },
        {
          pointer: "/stale",
          classification: "source_difference",
          reason: "过期审核",
        },
      ],
    ),
    [
      {
        pointer: "/kept",
        classification: "source_difference",
        reason: "既有审核",
      },
      {
        pointer: "/new",
        classification: "accepted_correction",
        reason: "Task 7.6 已核验来源纠正：/new",
      },
    ],
  );
});

test("apply 在写入 MDX 前拒绝失效的文件证据", () => {
  const root = fixtureRoot();
  const decisionsPath = path.join(root, "data", "decisions.json");
  const evidencePath = path.join(root, "evidence.json");
  const evidenceText = '{"value":1}\n';
  writeFileSync(evidencePath, evidenceText, "utf8");

  const input = structuredClone(decisions()) as unknown as {
    evidence: Record<string, unknown>;
  };
  input.evidence["file-source"] = {
    kind: "numerical_row",
    path: "evidence.json",
    pointer: "/value",
    observed_value: 1,
    sha256: "0".repeat(64),
    note: "测试原表证据",
  };
  writeFileSync(decisionsPath, `${JSON.stringify(input, null, 2)}\n`, "utf8");
  assert.throws(
    () => applyReconciliation({ root, decisionsPath }),
    /evidence SHA-256 differs/,
  );

  input.evidence["file-source"] = {
    kind: "numerical_row",
    path: "evidence.json",
    pointer: "/value",
    observed_value: 2,
    sha256: createHash("sha256").update(evidenceText).digest("hex"),
    note: "测试原表证据",
  };
  writeFileSync(decisionsPath, `${JSON.stringify(input, null, 2)}\n`, "utf8");
  assert.throws(
    () => applyReconciliation({ root, decisionsPath }),
    /evidence pointer value differs/,
  );
});

test("reconciliation 文档写入会创建嵌套目录并保持确定性", () => {
  const root = mkdtempSync(path.join(tmpdir(), "weapon-reconciliation-document-"));
  const outputPath = path.join(root, "nested", "source-reconciliation.md");
  const expected = generateReconciliationMarkdown();

  writeReconciliationMarkdown(outputPath);

  assert.equal(readFileSync(outputPath, "utf8"), expected);
});
