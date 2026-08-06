import assert from "node:assert/strict";
import test from "node:test";
import { buildWeaponEvidenceRecord } from "./extract-weapon-data";

test("武器提取结果只包含候选证据，不生成 V1 MDX 草稿", () => {
  const record = buildWeaponEvidenceRecord({
    prototypeId: "20003000011",
    protoModes: [
      {
        mode: 0,
        name: "测试模式",
        ascTypeId: "143",
        numericalId: 120300110,
        gameDataAvailable: true,
        fire_interval: 0.2,
      },
    ],
    numModes: 1,
    uniqueNumericalIds: [120300110],
    skillNumerical: [
      {
        key: "1400000001_1",
        settlements: ["WeaponSkillDamage"],
      },
    ],
  });

  assert.deepEqual(Object.keys(record), [
    "prototype_id",
    "proto_modes",
    "num_modes",
    "unique_numerical_ids",
    "skill_numerical",
  ]);
  assert.equal("suggested_label" in record.skill_numerical![0], false);

  const serialized = JSON.stringify(record);
  assert.equal(serialized.includes('"mdx"'), false);
  assert.equal(serialized.includes("damage_modes_yaml"), false);
  assert.equal(serialized.includes("extra_modes_yaml"), false);
});

test("没有技能候选时省略 skill_numerical", () => {
  const record = buildWeaponEvidenceRecord({
    prototypeId: "1",
    protoModes: [],
    numModes: 0,
    uniqueNumericalIds: [],
  });

  assert.deepEqual(Object.keys(record), [
    "prototype_id",
    "proto_modes",
    "num_modes",
    "unique_numerical_ids",
  ]);
});
