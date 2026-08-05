import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import {
  applyMigrationTable,
  captureMigrationBaseline,
  checkFinalMigrationReport,
  checkMigrationCoverage,
  createMigrationDecisionDraft,
  extractMdxBody,
  generateFinalMigrationReport,
  migrationDecisionsSchema,
  renderMigratedMdx,
  reviewedSnapshotDifferences,
} from "./bulk-migration";
import { WEAPON_DATA_SOURCE_FILES } from "./source-reader";

function temporaryDirectory(context: TestContext): string {
  const root = mkdtempSync(path.join(tmpdir(), "weapon-v2-migration-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function candidate(table: "lc" | "td") {
  return {
    title: "同名武器",
    path: `data/${table}/同名武器.mdx`,
    status: "candidate",
    sources: [
      {
        locator: { kind: "primary" },
        locator_key: "primary",
        name: "普通射击",
        proposed_id: "pu-tong-she-ji",
        proposed_section: "fire_mode",
        candidates: [],
        proposed: {
          scope: "prototype_mode",
          signatureMatch: true,
          titleMatch: true,
          source: {
            prototype_mode: 0,
            numerical: { table, id: 100, level: 1 },
            asc_type_id: "10",
          },
        },
      },
    ],
    item: {},
    skill: { active_skill_id: 0 },
  };
}

test("候选报告生成稳定 LC/TD 来源身份，歧义候选进入显式排除", (context) => {
  const root = temporaryDirectory(context);
  const reportPath = path.join(root, "report.json");
  const decisionsPath = path.join(root, "decisions.json");
  writeJson(reportPath, {
    schema_version: 1,
    tables: {
      lc: [
        candidate("lc"),
        { title: "歧义武器", path: "data/weapons/歧义武器.mdx", status: "unresolved" },
      ],
      td: [candidate("td")],
    },
  });

  createMigrationDecisionDraft(reportPath, decisionsPath);
  const decisions = migrationDecisionsSchema.parse(
    JSON.parse(readFileSync(decisionsPath, "utf8")),
  );
  const shared = decisions.weapons["同名武器"];
  assert.equal(shared.sources.primary.id, "pu-tong-she-ji");
  assert.deepEqual(shared.sources.primary.table_scope, ["lc", "td"]);
  assert.equal(shared.tables.lc?.sources.primary.numerical?.table, "lc");
  assert.equal(shared.tables.td?.sources.primary.numerical?.table, "td");
  assert.equal(
    decisions.weapons["歧义武器"].tables.lc?.exclude?.code,
    "UNRESOLVED_SOURCE",
  );
});

test("决策 Schema 拒绝技能修正漂移和表内重复来源 ID", () => {
  const source = {
    id: "primary",
    name: "普通射击",
    section: "fire_mode",
    locator: { kind: "primary" },
    table_scope: ["lc"],
    reason: "fixture",
  };
  assert.throws(
    () =>
      migrationDecisionsSchema.parse({
        schema_version: 1,
        weapons: {
          测试: {
            sources: { primary: source },
            tables: {
              lc: {
                active_skill_id: 2,
                active_skill_correction: {
                  from: 1,
                  to: 3,
                  reason: "fixture",
                  owner: "skill_chain",
                },
              },
            },
          },
        },
      }),
    /active_skill_correction\.to must equal active_skill_id/,
  );
  assert.throws(
    () =>
      migrationDecisionsSchema.parse({
        schema_version: 1,
        weapons: {
          测试: {
            sources: {
              primary: source,
              alternate: { ...source, name: "另一来源" },
            },
            tables: { lc: {} },
          },
        },
      }),
    /lc source id duplicates primary/,
  );

  const reviewed = migrationDecisionsSchema.parse({
    schema_version: 1,
    weapons: {
      排除: {
        sources: {},
        tables: {
          lc: {
            exclude: {
              code: "INVALID_ATTENUATION",
              reason: "ASC 衰减不满足领域约束",
              owner: "game_data",
            },
          },
        },
      },
      修正: {
        sources: { primary: source },
        tables: {
          lc: {
            sources: {
              primary: { numerical: { table: "lc", id: 100, level: 1 }, asc_type_id: "10" },
            },
            field_decisions: {
              primary: {
                attenuation: {
                  action: "preserve_legacy",
                  reason: "显式修正非法原表衰减",
                  owner: "wiki_semantics",
                },
              },
            },
          },
        },
      },
    },
  });
  assert.equal(reviewed.weapons["排除"].tables.lc?.exclude?.owner, "game_data");
  assert.equal(
    reviewed.weapons["修正"].tables.lc?.field_decisions.primary.attenuation.action,
    "preserve_legacy",
  );
});

function snapshotDecisions(snapshotDifferences: unknown[] = []) {
  return migrationDecisionsSchema.parse({
    schema_version: 1,
    weapons: {
      测试: {
        sources: {
          primary: {
            id: "primary",
            name: "普通射击",
            section: "fire_mode",
            locator: { kind: "primary" },
            table_scope: ["lc"],
            reason: "fixture",
          },
        },
        tables: {
          lc: {
            sources: { primary: { numerical: { table: "lc", id: 100, level: 1 } } },
            snapshot_differences: snapshotDifferences,
          },
        },
      },
    },
  });
}

function snapshotEntry(id: string, extra: Record<string, unknown> = {}) {
  return {
    resolver: { weapon: {} },
    detail: {
      damageSources: [{ id, name: "普通射击" }],
      mainSourceId: id,
      ...extra,
    },
    catalog: { mainSource: { id }, mainSourceId: id },
  };
}

test("快照比较归一化旧来源 ID，并拒绝未批准或陈旧 Pointer", () => {
  const baseline = { "lc:测试": snapshotEntry("v1-primary") };
  const after = { "lc:测试": snapshotEntry("primary") };
  assert.deepEqual(
    reviewedSnapshotDifferences(baseline as never, after as never, snapshotDecisions()),
    { "lc:测试": [] },
  );
  assert.throws(
    () =>
      reviewedSnapshotDifferences(
        baseline as never,
        { "lc:测试": snapshotEntry("primary", { changed: true }) } as never,
        snapshotDecisions(),
      ),
    /unapproved consumer difference \/detail\/changed/,
  );
  assert.throws(
    () =>
      reviewedSnapshotDifferences(
        baseline as never,
        after as never,
        snapshotDecisions([
          {
            pointer: "/detail/missing",
            classification: "source_difference",
            reason: "fixture",
          },
        ]),
      ),
    /stale consumer difference decision \/detail\/missing/,
  );
});

test("基线不可覆盖，重复 apply 不改 V2 文件或 MDX 正文", (context) => {
  const root = temporaryDirectory(context);
  const decisionsPath = path.join(root, "decisions.json");
  const snapshotPath = path.join(root, "snapshots.json");
  const weaponPath = path.join(root, "data", "weapons", "测试.mdx");
  mkdirSync(path.join(root, "data", "weapons_td"), { recursive: true });
  writeJson(decisionsPath, { schema_version: 1, weapons: {} });
  writeJson(snapshotPath, { schema_version: 1, baseline: {} });
  const original =
    "---\r\nschema_version: 2\r\ntitle: 测试\r\nprototype_id: \"1\"\r\ndamage_sources: []\r\n---\r\n# 正文\r\n保持不变\r\n";
  mkdirSync(path.dirname(weaponPath), { recursive: true });
  writeFileSync(weaponPath, original, "utf8");

  assert.throws(
    () => captureMigrationBaseline({ root, decisionsPath, outputPath: snapshotPath }),
    /baseline already exists and cannot be overwritten/,
  );
  const options = { root, contentRoot: path.join(root, "missing-refs"), decisionsPath };
  applyMigrationTable("lc", options);
  applyMigrationTable("lc", options);
  assert.equal(readFileSync(weaponPath, "utf8"), original);
  assert.equal(extractMdxBody(original), "# 正文\r\n保持不变\r\n");
  assert.equal(
    extractMdxBody(
      renderMigratedMdx(original, {
        schema_version: 2,
        title: "测试",
        prototype_id: "1",
        damage_sources: [],
      }),
    ),
    "# 正文\r\n保持不变\r\n",
  );
});

test("已迁移 V2 拒绝 field decision action、override 和 reason 漂移", (context) => {
  const root = temporaryDirectory(context);
  const decisionsPath = path.join(root, "decisions.json");
  const weaponPath = path.join(root, "data", "weapons", "测试.mdx");
  mkdirSync(path.join(root, "data", "weapons_td"), { recursive: true });
  mkdirSync(path.dirname(weaponPath), { recursive: true });
  writeFileSync(
    weaponPath,
    `---
schema_version: 2
title: 测试
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
        id: 100
        level: 1
    overrides:
      numerical:
        damage:
          base: 1
    override_reason: 保留旧伤害
---
正文
`,
    "utf8",
  );
  const decision = (action: "preserve_legacy" | "accept_source", reason: string) => ({
    schema_version: 1,
    weapons: {
      测试: {
        sources: {
          primary: {
            id: "primary",
            name: "普通射击",
            section: "fire_mode",
            locator: { kind: "primary" },
            table_scope: ["lc"],
            reason: "fixture",
          },
        },
        tables: {
          lc: {
            sources: { primary: { numerical: { table: "lc", id: 100, level: 1 } } },
            field_decisions: {
              primary: {
                "damage.base": { action, reason, owner: "wiki_semantics" },
              },
            },
          },
        },
      },
    },
  });

  writeJson(decisionsPath, decision("preserve_legacy", "保留旧伤害"));
  assert.deepEqual(checkMigrationCoverage({ root, decisionsPath }).lc, {
    total: 1,
    migrated: 1,
    preexisting_v2: 0,
    excluded: 0,
  });
  writeJson(decisionsPath, decision("accept_source", "接受原表"));
  assert.throws(
    () => checkMigrationCoverage({ root, decisionsPath }),
    /override presence differs from decision action/,
  );
  writeJson(decisionsPath, decision("preserve_legacy", "另一原因"));
  assert.throws(
    () => checkMigrationCoverage({ root, decisionsPath }),
    /override_reason differs from preserve_legacy decisions/,
  );
});

test("最终报告可由最小离线 MDX 与来源字节稳定生成", (context) => {
  const root = temporaryDirectory(context);
  const decisionsPath = path.join(root, "data", "decisions.json");
  const reportPath = path.join(root, "data", "report.json");
  const contentRoot = path.join(root, "content");
  writeJson(decisionsPath, { schema_version: 1, weapons: {} });
  for (const sourcePath of Object.values(WEAPON_DATA_SOURCE_FILES)) {
    const absolutePath = path.join(contentRoot, ...sourcePath.split("/"));
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    const rows =
      sourcePath === WEAPON_DATA_SOURCE_FILES.item
        ? { "201": { ItemID: 201, ModelID: 1 } }
        : {};
    writeJson(absolutePath, [{ Rows: rows }]);
  }
  const frontmatter =
    "---\nschema_version: 2\ntitle: 同名武器\nprototype_id: \"1\"\ndamage_sources: []\n---\n";
  for (const directory of ["weapons", "weapons_td"]) {
    const filePath = path.join(root, "data", directory, "同名武器.mdx");
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, frontmatter, "utf8");
  }

  const report = generateFinalMigrationReport({ root, contentRoot, decisionsPath });
  assert.deepEqual(report.coverage, {
    lc: { total: 1, migrated: 0, preexisting_v2: 1, excluded: 0 },
    td: { total: 1, migrated: 0, preexisting_v2: 1, excluded: 0 },
  });
  assert.deepEqual(report.cross_table, { identical: 1, different: 0, differences: [] });
  assert.equal(Object.keys(report.source_hashes as object).length, 8);
  const itemReview = report.item_review as {
    scanned_without_item_id: unknown[];
    unselected_candidates: unknown[];
  };
  assert.equal(itemReview.scanned_without_item_id.length, 2);
  assert.equal(itemReview.unselected_candidates.length, 2);

  writeJson(reportPath, report);
  checkFinalMigrationReport({ root, decisionsPath, reportPath });

  itemReview.unselected_candidates.pop();
  writeJson(reportPath, report);
  assert.throws(
    () => checkFinalMigrationReport({ root, decisionsPath, reportPath }),
    /missing unselected Item review entry/,
  );

  const refreshed = generateFinalMigrationReport({ root, contentRoot, decisionsPath });
  writeJson(reportPath, refreshed);
  writeFileSync(decisionsPath, `${readFileSync(decisionsPath, "utf8")}\n`, "utf8");
  assert.throws(
    () => checkFinalMigrationReport({ root, decisionsPath, reportPath }),
    /decision manifest SHA-256 is stale/,
  );
});

test("final report preserves actionable source-mapping exclusion details", (context) => {
  const root = temporaryDirectory(context);
  const decisionsPath = path.join(root, "data", "decisions.json");
  const reportPath = path.join(root, "data", "report.json");
  const contentRoot = path.join(root, "content");
  const weaponPath = path.join(root, "data", "weapons", "excluded.mdx");
  mkdirSync(path.join(root, "data", "weapons_td"), { recursive: true });
  mkdirSync(path.dirname(weaponPath), { recursive: true });
  writeFileSync(
    weaponPath,
    `---
title: Excluded
prototype_id: "1"
damage:
  base: 1
  impulse: 0
  toughness: 0
  flesh: 0
  hurtable: 0
element: Physical
element_add_rate: 0
weekness_multiplier: 1
enable_critical: true
toughness_type: Impact
ignore_shield: false
---
`,
    "utf8",
  );
  writeJson(decisionsPath, {
    schema_version: 1,
    weapons: {
      Excluded: {
        sources: {},
        tables: {
          lc: {
            exclude: {
              code: "UNRESOLVED_SOURCE",
              reason: "candidate requires manual review",
              owner: "source_mapping",
            },
          },
        },
      },
    },
  });
  for (const sourcePath of Object.values(WEAPON_DATA_SOURCE_FILES)) {
    writeJson(path.join(contentRoot, ...sourcePath.split("/")), [{ Rows: {} }]);
  }

  const report = generateFinalMigrationReport({ root, contentRoot, decisionsPath });
  const exclusion = (report.exclusions as { lc: Array<Record<string, unknown>> }).lc[0];
  const review = exclusion.review as { sources: Array<Record<string, unknown>> };
  assert.equal(review.sources.length, 1);
  assert.equal(review.sources[0].locator_key, "primary");
  assert.equal(review.sources[0].issue, "NO_CANDIDATE");
  assert.equal(review.sources[0].candidate_count, 0);

  writeJson(reportPath, report);
  checkFinalMigrationReport({ root, decisionsPath, reportPath });
  review.sources = [];
  writeJson(reportPath, report);
  assert.throws(
    () => checkFinalMigrationReport({ root, decisionsPath, reportPath }),
    /review\.sources must not be empty/,
  );
});
