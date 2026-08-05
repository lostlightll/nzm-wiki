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
  parseWeaponDataLock,
  serializeWeaponDataLock,
  type WeaponDataLock,
} from "../../lib/weapon-data-lock";
import {
  WEAPON_DATA_SOURCE_FILES,
  type WeaponDataSourceKind,
} from "./source-reader";
import {
  checkWeaponDataLock,
  diffWeaponDataLocks,
  generateWeaponDataLock,
  scanWeaponV2References,
  WeaponDataLockOperationError,
  type WeaponRoot,
} from "./lock";

type Rows = Record<string, Record<string, unknown>>;

const baseRows: Record<WeaponDataSourceKind, Rows> = {
  "numerical-lc": {
    "120_1": {
      id: 120,
      Level: 1,
      Settlements: [{ TagName: "Settlement.Health" }],
      Unknown: { keep: [1, 2, 3] },
    },
  },
  "numerical-td": {
    "120_1": {
      id: 120,
      Level: 1,
      Settlements: [{ TagName: "Settlement.TD" }],
      marker: "td",
    },
  },
  asc: {
    "10": {
      ASCTypeID: "10",
      DistanceBeginAttenuationBase: 0,
      DistanceEndAttenuationBase: 0,
      AttenuationMinScale: 0,
      UnknownAsc: true,
    },
    "11": {
      ASCTypeID: "11",
      DistanceBeginAttenuationBase: 1000,
      DistanceEndAttenuationBase: 2000,
      AttenuationMinScale: 0.3,
    },
  },
  feel: {
    "10": { WeaponFeelParamID: "10", Reload: 2 },
    "11": { WeaponFeelParamID: "11", Reload: 3 },
    "99": { WeaponFeelParamID: "99", Reload: 4, UnknownFeel: [true] },
  },
  item: {
    "1000": {
      ItemID: 1000,
      ModelID: 200,
      Active_Skill_Detail: "5001",
      UnknownItem: { radar: 77 },
    },
    "1001": {
      ItemID: 1001,
      ModelID: 200,
      Active_Skill_Detail: "5001",
    },
  },
  prototype: {
    "测试枪_0": {
      PrototypeID: "200",
      Mode: 0,
      ASCTypeID: "10",
      NumericalID: 120,
      ActiveSkillID: 5001,
    },
    "测试枪_1": {
      PrototypeID: "200",
      Mode: 1,
      ASCTypeID: "11",
      NumericalID: 120,
      ActiveSkillID: 5001,
    },
    "塔防枪_0": {
      PrototypeID: "300",
      Mode: 0,
      ASCTypeID: "10",
      NumericalID: 120,
      ActiveSkillID: 5002,
    },
  },
  "skill-pve": {
    "5001_1": {
      SkillID: 5001,
      Level: 1,
      ChargeNeedTime: 25,
      SkillCount: 2,
      UnknownSkill: { keep: true },
    },
  },
  "gp-active-skill": {
    "5002": {
      AbilityID: 5002,
      CooldownDuration: 0,
      MaxChargeStackCount: 1,
      UnknownGp: ["keep"],
    },
  },
};

interface Fixture {
  readonly root: string;
  readonly contentRoot: string;
  readonly lcRoot: string;
  readonly tdRoot: string;
  readonly weaponRoots: readonly WeaponRoot[];
}

function writeSource(
  contentRoot: string,
  kind: WeaponDataSourceKind,
  rows: Rows,
): void {
  const filePath = path.join(
    contentRoot,
    ...WEAPON_DATA_SOURCE_FILES[kind].split("/"),
  );
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify([{ Rows: rows }]), "utf8");
}

function createFixture(
  context: TestContext,
  overrides: Partial<Record<WeaponDataSourceKind, Rows>> = {},
): Fixture {
  const root = mkdtempSync(path.join(tmpdir(), "weapon-data-lock-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const contentRoot = path.join(root, "content");
  const lcRoot = path.join(root, "weapons");
  const tdRoot = path.join(root, "weapons_td");
  mkdirSync(lcRoot, { recursive: true });
  mkdirSync(tdRoot, { recursive: true });
  for (const kind of Object.keys(WEAPON_DATA_SOURCE_FILES) as WeaponDataSourceKind[]) {
    writeSource(contentRoot, kind, overrides[kind] ?? baseRows[kind]);
  }
  return {
    root,
    contentRoot,
    lcRoot,
    tdRoot,
    weaponRoots: Object.freeze([
      Object.freeze({ directory: lcRoot, table: "lc" as const }),
      Object.freeze({ directory: tdRoot, table: "td" as const }),
    ]),
  };
}

function writeMdx(directory: string, fileName: string, frontmatter: string): void {
  writeFileSync(
    path.join(directory, fileName),
    `---\n${frontmatter.trim()}\n---\n`,
    "utf8",
  );
}

const lcWeapon = `
schema_version: 2
title: 测试枪
prototype_id: "200"
item_id: "1000"
use_type: 主武器
element: 火焰
rarity: 传说
active_skill_id: 5001
damage_sources:
  - id: primary
    name: 主射击
    section: fire_mode
    source:
      prototype_mode: 0
      numerical: { table: lc, id: 120, level: 1 }
      asc_type_id: "10"
  - id: variant
    name: 变体
    section: variant
    inherits: primary
    source:
      prototype_mode: 1
      asc_type_id: "11"
      feel_param_id: "99"
`;

const tdWeapon = `
schema_version: 2
title: 塔防枪
prototype_id: "300"
use_type: 主武器
element: 物理
rarity: 史诗
active_skill_id: 5002
damage_sources:
  - id: primary
    name: 主射击
    section: fire_mode
    source:
      prototype_mode: 0
      numerical: { table: td, id: 120, level: 1 }
      asc_type_id: "10"
`;

function generateMainFixture(context: TestContext): {
  fixture: Fixture;
  lock: WeaponDataLock;
} {
  const fixture = createFixture(context);
  writeMdx(fixture.lcRoot, "测试枪.mdx", lcWeapon);
  writeMdx(fixture.tdRoot, "塔防枪.mdx", tdWeapon);
  const generated = generateWeaponDataLock({
    contentRoot: fixture.contentRoot,
    weaponRoots: fixture.weaponRoots,
  });
  return { fixture, lock: generated.lock };
}

function cloneLock(lock: WeaponDataLock): WeaponDataLock {
  return JSON.parse(JSON.stringify(lock)) as WeaponDataLock;
}

function captureOperationError(action: () => unknown): WeaponDataLockOperationError {
  try {
    action();
  } catch (error) {
    assert.ok(error instanceof WeaponDataLockOperationError);
    return error;
  }
  assert.fail("expected WeaponDataLockOperationError");
}

test("生成七命名空间 Lock，并保留继承、显式 Feel 与完整原始行", (context) => {
  const { lock } = generateMainFixture(context);

  assert.deepEqual(Object.keys(lock.rows["numerical-lc"]), ["lc:120_1"]);
  assert.deepEqual(Object.keys(lock.rows["numerical-td"]), ["td:120_1"]);
  assert.deepEqual(Object.keys(lock.rows.asc).sort(), ["10", "11"]);
  assert.deepEqual(Object.keys(lock.rows.feel).sort(), ["10", "99"]);
  assert.deepEqual(Object.keys(lock.rows.item), ["1000"]);
  assert.deepEqual(Object.keys(lock.rows["skill-pve"]), ["5001_1"]);
  assert.deepEqual(Object.keys(lock.rows["gp-active-skill"]), ["5002"]);
  assert.deepEqual(lock.active_skills, {
    "5001_1": { source: "weapon_pve", source_key: "5001_1" },
    "5002_1": { source: "gp_fallback", source_key: "5002" },
  });
  assert.deepEqual(
    lock.rows["numerical-lc"]["lc:120_1"].raw.Unknown,
    { keep: [1, 2, 3] },
  );
  assert.equal(lock.rows.asc["10"].raw.DistanceBeginAttenuationBase, 0);
  assert.equal(lock.rows.asc["10"].raw.DistanceEndAttenuationBase, 0);
  assert.equal(lock.rows.asc["10"].raw.AttenuationMinScale, 0);
  assert.deepEqual(lock.rows["gp-active-skill"]["5002"].raw.UnknownGp, ["keep"]);
});

test("序列化逐字节稳定并递归排序对象键，数组顺序不变", (context) => {
  const { fixture, lock } = generateMainFixture(context);
  const first = serializeWeaponDataLock(lock);
  const second = serializeWeaponDataLock(
    generateWeaponDataLock({
      contentRoot: fixture.contentRoot,
      weaponRoots: fixture.weaponRoots,
    }).lock,
  );
  assert.equal(first, second);
  assert.ok(first.endsWith("\n"));
  assert.equal(first.includes("\r\n"), false);
  assert.ok(first.indexOf('"Level"') < first.indexOf('"Settlements"'));
  assert.deepEqual(
    parseWeaponDataLock(JSON.parse(first)).rows["numerical-lc"]["lc:120_1"].raw
      .Settlements,
    [{ TagName: "Settlement.Health" }],
  );
});

test("离线 check 不读取 refs，并拒绝缺失、未使用和无效身份行", (context) => {
  const { fixture, lock } = generateMainFixture(context);
  rmSync(fixture.contentRoot, { recursive: true, force: true });
  assert.equal(
    checkWeaponDataLock({ lock, weaponRoots: fixture.weaponRoots }).ok,
    true,
  );

  const broken = cloneLock(lock);
  delete broken.rows.feel["99"];
  broken.rows.item["9999"] = {
    row_name: "9999",
    raw: { ItemID: 1 },
  };
  const result = checkWeaponDataLock({ lock: broken, weaponRoots: fixture.weaponRoots });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.includes("feel") && issue.includes("99")));
  assert.ok(result.issues.some((issue) => issue.includes("unused Lock row")));
  assert.ok(result.issues.some((issue) => issue.includes("ItemID, row_name and key")));
});

test("pending 可省略 Numerical，但显式悬空候选仍失败", (context) => {
  const fixture = createFixture(context);
  writeMdx(
    fixture.lcRoot,
    "pending.mdx",
    `
schema_version: 2
title: 待核验枪
prototype_id: "400"
use_type: 主武器
element: 物理
rarity: 稀有
draft: true
damage_sources:
  - id: pending
    name: 待核验
    section: skill
    verification: { status: pending, reason: 尚未确认 }
`,
  );
  const generated = generateWeaponDataLock({
    contentRoot: fixture.contentRoot,
    weaponRoots: fixture.weaponRoots,
  });
  assert.deepEqual(generated.lock.rows["numerical-lc"], {});

  writeMdx(
    fixture.lcRoot,
    "pending.mdx",
    `
schema_version: 2
title: 待核验枪
prototype_id: "400"
use_type: 主武器
element: 物理
rarity: 稀有
draft: true
damage_sources:
  - id: pending
    name: 待核验
    section: skill
    source:
      numerical: { table: lc, id: 999, level: 1 }
    verification: { status: pending, reason: 尚未确认 }
`,
  );
  const error = captureOperationError(() =>
    generateWeaponDataLock({
      contentRoot: fixture.contentRoot,
      weaponRoots: fixture.weaponRoots,
    }),
  );
  assert.ok(error.issues.some((issue) => issue.includes("lc:999_1")));
});

test("非法 PVE 行不会回退 GP，两个技能来源都缺失时明确失败", (context) => {
  const fixture = createFixture(context, {
    "skill-pve": {
      ...baseRows["skill-pve"],
      "5003_1": {
        SkillID: 5003,
        Level: 1,
        ChargeNeedTime: "bad",
        SkillCount: 1,
      },
    },
    "gp-active-skill": {
      ...baseRows["gp-active-skill"],
      "5003": {
        AbilityID: 5003,
        CooldownDuration: 10,
        MaxChargeStackCount: 1,
      },
    },
    prototype: {
      ...baseRows.prototype,
      "坏技能枪_0": {
        PrototypeID: "500",
        Mode: 0,
        ASCTypeID: "10",
        NumericalID: 120,
        ActiveSkillID: 5003,
      },
    },
  });
  writeMdx(
    fixture.lcRoot,
    "坏技能枪.mdx",
    lcWeapon
      .replace("title: 测试枪", "title: 坏技能枪")
      .replace('prototype_id: "200"', 'prototype_id: "500"')
      .replace('item_id: "1000"\n', "")
      .replace("active_skill_id: 5001", "active_skill_id: 5003")
      .replace("prototype_mode: 1", "prototype_mode: 0"),
  );
  const invalid = captureOperationError(() =>
    generateWeaponDataLock({
      contentRoot: fixture.contentRoot,
      weaponRoots: fixture.weaponRoots,
    }),
  );
  assert.ok(invalid.issues.some((issue) => issue.includes("INVALID_SKILL_CHARGE_VALUE")));
  assert.equal(invalid.issues.some((issue) => issue.includes("gp_fallback")), false);

  writeMdx(
    fixture.lcRoot,
    "坏技能枪.mdx",
    lcWeapon
      .replace("title: 测试枪", "title: 坏技能枪")
      .replace('prototype_id: "200"', 'prototype_id: "500"')
      .replace('item_id: "1000"\n', "")
      .replace("active_skill_id: 5001", "active_skill_id: 5999")
      .replace("prototype_mode: 1", "prototype_mode: 0"),
  );
  const missing = captureOperationError(() =>
    generateWeaponDataLock({
      contentRoot: fixture.contentRoot,
      weaponRoots: fixture.weaponRoots,
    }),
  );
  assert.ok(missing.issues.some((issue) => issue.includes("MISSING_SKILL_CHARGE_SOURCE")));
});

test("Prototype 多候选只按标题精确消歧，关系不一致会阻止生成", (context) => {
  const fixture = createFixture(context, {
    prototype: {
      ...baseRows.prototype,
      旧名称: {
        PrototypeID: "600",
        Mode: 0,
        ASCTypeID: "11",
        NumericalID: 120,
        ActiveSkillID: 0,
      },
      歧义枪: {
        PrototypeID: "600",
        Mode: 0,
        ASCTypeID: "10",
        NumericalID: 120,
        ActiveSkillID: 0,
      },
    },
  });
  writeMdx(
    fixture.lcRoot,
    "歧义枪.mdx",
    `
schema_version: 2
title: 歧义枪
prototype_id: "600"
use_type: 主武器
element: 物理
rarity: 稀有
damage_sources:
  - id: primary
    name: 主射击
    section: fire_mode
    source:
      prototype_mode: 0
      numerical: { table: lc, id: 120, level: 1 }
      asc_type_id: "10"
`,
  );
  assert.doesNotThrow(() =>
    generateWeaponDataLock({
      contentRoot: fixture.contentRoot,
      weaponRoots: fixture.weaponRoots,
    }),
  );

  writeMdx(
    fixture.lcRoot,
    "歧义枪.mdx",
    readFileSync(path.join(fixture.lcRoot, "歧义枪.mdx"), "utf8").replace(
      'asc_type_id: "10"',
      'asc_type_id: "11"',
    ).replace(/^---\n|\n---\n$/g, ""),
  );
  const mismatch = captureOperationError(() =>
    generateWeaponDataLock({
      contentRoot: fixture.contentRoot,
      weaponRoots: fixture.weaponRoots,
    }),
  );
  assert.ok(mismatch.issues.some((issue) => issue.includes("PROTOTYPE_LINK_MISMATCH")));
});

test("差异报告区分增删、字段、Settlement Tag 和来源哈希", (context) => {
  const { lock } = generateMainFixture(context);
  const next = cloneLock(lock);
  next.sources.asc.sha256 = "f".repeat(64);
  delete next.rows.feel["99"];
  next.rows.feel["11"] = {
    row_name: "11",
    raw: { WeaponFeelParamID: "11", Reload: 3 },
  };
  next.rows["numerical-lc"]["lc:120_1"].raw.Settlements = [
    { TagName: "Settlement.New" },
  ];
  const diff = diffWeaponDataLocks(lock, parseWeaponDataLock(next));
  assert.ok(diff.added.includes("feel 11"));
  assert.ok(diff.removed.includes("feel 99"));
  assert.ok(diff.changed.some((change) => change.includes("Settlements")));
  assert.equal(diff.settlementChanges.length, 1);
  assert.ok(diff.sourceHashChanges.some((change) => change.startsWith("asc:")));
});

test("扫描器忽略 V1，并拒绝未知显式 Schema 版本", (context) => {
  const fixture = createFixture(context);
  writeMdx(fixture.lcRoot, "v1.mdx", "title: V1\ndamage: 10");
  const manifest = scanWeaponV2References({ weaponRoots: fixture.weaponRoots });
  assert.equal(manifest.weapons.length, 0);

  writeMdx(
    fixture.lcRoot,
    "zero-skill.mdx",
    `
schema_version: 2
title: 零技能
prototype_id: "700"
use_type: 近战武器
element: 物理
rarity: 稀有
active_skill_id: 0
damage_sources: []
`,
  );
  const zeroSkill = scanWeaponV2References({ weaponRoots: fixture.weaponRoots });
  assert.equal(zeroSkill.weapons.length, 1);
  assert.equal(zeroSkill.activeSkills.size, 0);

  writeMdx(fixture.lcRoot, "bad.mdx", "schema_version: 3\ntitle: Bad");
  const error = captureOperationError(() =>
    scanWeaponV2References({ weaponRoots: fixture.weaponRoots }),
  );
  assert.ok(error.issues.some((issue) => issue.includes("unsupported schema_version 3")));
});
