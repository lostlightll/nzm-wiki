import assert from "node:assert/strict";
import test from "node:test";
import {
  extractStatusEffects,
  getGeneratedIconPath,
  getStatusEffectPolarity,
  getStatusEffectTargets,
} from "./extract";

const icon = "/Game/UI/UI_Textures/Icons/Buff/T_Test.T_Test";

function buffRow(overrides: Record<string, unknown> = {}) {
  return {
    BuffID: 1,
    ChineseName: "测试状态",
    Desc: { LocalizedString: "测试效果" },
    Category: "ENZBuffCategory::PositiveModifier",
    SubscriptType: "ENZBuffSubscriptType::Positive",
    DisplayPlaceEnumBitmask: 1,
    Duration: 5,
    Period: 0,
    StackLimitCount: 1,
    LevelDuration: "1",
    BuffIconPath: { AssetPathName: icon },
    GPModifyIDs: [],
    NumericalID: 0,
    ...overrides,
  };
}

test("极性与显示位映射符合页面口径", () => {
  assert.equal(getStatusEffectPolarity("ENZBuffSubscriptType::Positive"), "positive");
  assert.equal(getStatusEffectPolarity("ENZBuffSubscriptType::Normal"), null);
  assert.deepEqual(getStatusEffectTargets(2, "negative"), ["enemy"]);
  assert.deepEqual(getStatusEffectTargets(3, "negative"), ["enemy", "player"]);
  assert.deepEqual(getStatusEffectTargets(4, "positive"), ["player"]);
  assert.deepEqual(getStatusEffectTargets(4, "negative"), ["player"]);
  assert.deepEqual(getStatusEffectTargets(2, "positive"), []);
});

test("按 BuffID 合并并保留全部变体", () => {
  const result = extractStatusEffects({
    buffRows: {
      Buff_A: buffRow({ BuffID: 10 }),
      Buff_B: buffRow({ BuffID: 10, ChineseName: "测试状态二", Duration: 8 }),
      Buff_C: buffRow({
        BuffID: 10,
        SubscriptType: "ENZBuffSubscriptType::Negative",
        DisplayPlaceEnumBitmask: 2,
      }),
      Enemy: buffRow({
        BuffID: 20,
        SubscriptType: "ENZBuffSubscriptType::Negative",
        DisplayPlaceEnumBitmask: 2,
      }),
      Hidden: buffRow({ BuffID: 30, DisplayPlaceEnumBitmask: 0 }),
      Normal: buffRow({
        BuffID: 40,
        SubscriptType: "ENZBuffSubscriptType::Normal",
      }),
    },
    elementRows: {
      Fire: elementRow("Fire"),
      Cryo: elementRow("Cryo"),
      Shock: elementRow("Shock"),
      Corossive: elementRow("Corossive"),
    },
    numericalRows: {},
  });

  assert.equal(result.data.effects.length, 2);
  assert.equal(result.data.effects[0].variants.length, 3);
  assert.deepEqual(result.data.effects[0].names, ["测试状态", "测试状态二"]);
  assert.deepEqual(result.data.effects[0].targets, ["player", "enemy"]);
  assert.deepEqual(result.data.effects[1].targets, ["enemy"]);
  assert.equal(result.data.summary.playerRows, 2);
  assert.equal(result.data.summary.enemyRows, 2);
  assert.equal(result.data.elements.length, 4);
  assert.deepEqual(result.data.elements[0].enemyBuffNames, ["Fire"]);
  assert.deepEqual(result.data.elements[0].playerBuffNames, ["Player_Fire"]);
});

test("数值引用可联查，缺失引用仍保留在变体中", () => {
  const result = extractStatusEffects({
    buffRows: {
      Referenced: buffRow({ GPModifyIDs: [42, 404], NumericalID: 77 }),
    },
    elementRows: {
      Fire: elementRow("Fire"),
      Cryo: elementRow("Cryo"),
      Shock: elementRow("Shock"),
      Corossive: elementRow("Corossive"),
    },
    numericalRows: {
      "77_1": {
        id: 77,
        Level: 1,
        ElementType: "EElementEffectType::EDamageType_Fire",
        Settlements: [{ TagName: "Numerical.SettlementType.Test" }],
        EnableAttributes: [],
        HpCalScale: 0,
        HpCalBase: 0,
        FleshDamageBase: 10,
      },
    },
  });

  assert.deepEqual(result.data.effects[0].variants[0].modifierIds, [42, 404]);
  assert.equal(result.data.effects[0].variants[0].numericalId, 77);
  assert.equal(result.data.schemaVersion, 2);
  assert.equal("modifiers" in result.data.references, false);
  assert.equal(result.data.references.numericals["77"][0].fleshDamageBase, 10);
});

test("生成图标路径稳定且不会暴露 refs 路径", () => {
  const generated = getGeneratedIconPath(icon);
  assert.match(generated ?? "", /^\/webp\/icons\/status-effects\/[a-f0-9]{10}-T_Test\.webp$/);
});

function elementRow(name: string) {
  return {
    Name: { LocalizedString: name },
    DetailDescription: { LocalizedString: `${name} description` },
    ElementDuration: 5,
    ElementClearTime: 8,
    BuffName: name,
    BuffNameType1: "None",
    BuffNameType2: "None",
    BuffNameType3: "None",
    PlayerBuffName: `Player_${name}`,
    PlayerBuffNameType1: "None",
    PlayerBuffNameType2: "None",
    PlayerBuffNameType3: "None",
    ElementIconPath: { AssetPathName: icon },
  };
}
