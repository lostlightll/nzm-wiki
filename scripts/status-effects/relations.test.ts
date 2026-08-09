import assert from "node:assert/strict";
import test from "node:test";
import {
  extractStatusEffectRelations,
  type StatusEffectRelationSourceTables,
} from "./relations";

function mgeAsset(configName: string, callName: string) {
  return [
    {
      Name: "ExecuteUbergraph_Test",
      ChildProperties: [{ Name: callName }],
    },
    {
      Name: "Default__MGE_Test_C",
      Properties: { BuffName: configName },
    },
  ];
}

function baseTables(): StatusEffectRelationSourceTables {
  return {
    weaponModRows: {
      "100": { PassiveSkill_ID: "500:1" },
      "101": { PassiveSkill_ID: "501:1" },
      "102": { PassiveSkill_ID: "502:1" },
      "103": { PassiveSkill_ID: "503:1" },
    },
    passiveRows: {
      "500_1": { MGEConfig: { Id: "600" } },
      "501_1": { MGEConfig: { Id: "601" } },
      "502_1": { MGEConfig: { Id: "602" } },
      "503_1": { MGEConfig: { Id: "603" } },
    },
    mgeRows: {
      "600": {},
      "601": {},
      "602": {},
      "603": {},
    },
    buffRows: {
      Config_A_Level: { BuffID: 10, BuffName: "Config_A" },
      Config_B: { BuffID: 20, BuffName: "Config_B" },
      Hidden: { BuffID: 30, BuffName: "Config_Hidden" },
    },
    mgeAssets: {
      "600": mgeAsset("Config_A", "CallFunc_AddBuffByName_ReturnValue"),
      "601": mgeAsset("Config_B", "CallFunc_MGEHasBuffWithLayer_ReturnValue"),
      "602": mgeAsset("Config_B", "CallFunc_MGEAddBuff_ReturnValue"),
      "603": mgeAsset("Config_Hidden", "CallFunc_AddBuffToWeapon_ReturnValue_1"),
    },
    perks: [
      {
        itemId: "100",
        title: "精确来源",
        slot: 3,
        slug: "exact-source",
        collectModItem: 1,
      },
      {
        itemId: "101",
        title: "只检查状态",
        slot: 3,
        slug: "consumer-only",
        collectModItem: 1,
      },
      {
        itemId: "102",
        title: "未上线来源",
        slot: 2,
        slug: "unpublished",
        collectModItem: 0,
      },
      {
        itemId: "103",
        title: "配置未进入图鉴",
        slot: 4,
        slug: "hidden-status",
        collectModItem: 0,
      },
    ],
    overlimitCardIds: new Set(["100", "103"]),
  };
}

test("只生成当前数据锁内具有 AddBuff 结构证据的来源关系", () => {
  const result = extractStatusEffectRelations(baseTables(), {
    effects: [
      { buffId: 10, variants: [{ rowName: "Config_A_Level" }] },
      { buffId: 20, variants: [{ rowName: "Config_B" }] },
    ],
  });

  assert.equal(result.summary.relations, 1);
  assert.equal(result.summary.sources, 1);
  assert.equal(result.summary.overlimitCards, 1);
  assert.deepEqual(result.relations[0], {
    sourceId: "perk:100",
    sourceType: "perk",
    itemId: "100",
    title: "精确来源",
    slot: 3,
    slug: "exact-source",
    overlimitCard: true,
    buffId: 10,
    rowName: "Config_A_Level",
    configName: "Config_A",
    evidence: {
      kind: "mge-add-buff",
      passiveSkillId: "500",
      mgeId: "600",
      addCall: "CallFunc_AddBuffByName_ReturnValue",
    },
  });
});

test("BuffID 不一致时拒绝关系，避免仅按内部名误连", () => {
  const result = extractStatusEffectRelations(baseTables(), {
    effects: [{ buffId: 999, variants: [{ rowName: "Config_A_Level" }] }],
  });

  assert.deepEqual(result.relations, []);
});

test("同一配置名的已发布变体完整保留且排序稳定", () => {
  const tables = baseTables();
  tables.buffRows.Config_A_Level_2 = { BuffID: 10, BuffName: "Config_A" };
  const result = extractStatusEffectRelations(tables, {
    effects: [
      {
        buffId: 10,
        variants: [
          { rowName: "Config_A_Level_2" },
          { rowName: "Config_A_Level" },
        ],
      },
    ],
  });

  assert.deepEqual(
    result.relations.map((relation) => relation.rowName),
    ["Config_A_Level", "Config_A_Level_2"],
  );
});
