import assert from "node:assert/strict";
import test from "node:test";
import { MODIFIER_TYPES } from "./multiplier-data";
import { NUM_MODIFIER_RESOLVER } from "./num-modifier-data";
import {
  getWeeklyBuffFactors,
  getWeeklyBuffRotationWindow,
  getWeeklyBuffsForRotation,
  WEEKLY_BUFF_DAMAGE_INDEX,
  WEEKLY_BUFFS,
  WEEKLY_BUFF_POOLS,
} from "./weekly-buffs";

test("周 Buff 每七天按三组循环", () => {
  assert.equal(
    getWeeklyBuffRotationWindow(Date.parse("2025-10-20T05:00:00+08:00")).rotationIndex,
    1,
  );
  assert.equal(
    getWeeklyBuffRotationWindow(Date.parse("2025-10-27T05:00:00+08:00")).rotationIndex,
    2,
  );
  assert.equal(
    getWeeklyBuffRotationWindow(Date.parse("2025-11-03T05:00:00+08:00")).rotationIndex,
    3,
  );
  assert.equal(
    getWeeklyBuffRotationWindow(Date.parse("2025-11-10T05:00:00+08:00")).rotationIndex,
    1,
  );
});

test("两种难度共用正式服的三周轮换", () => {
  assert.deepEqual(WEEKLY_BUFF_POOLS.map((pool) => pool.rotations), [
    [
      [1398001490, 1398001500, 1398001510],
      [1398001550, 1398001560, 1398001570],
      [1398001580, 1398001590, 1398001600],
    ],
    [
      [1398001640, 1398001650, 1398001660],
      [1398001520, 1398001530, 1398001540],
      [1398001610, 1398001620, 1398001630],
    ],
  ]);
  assert.equal(Object.keys(WEEKLY_BUFFS).length, 18);
  for (const pool of WEEKLY_BUFF_POOLS) {
    for (const rotationIndex of [1, 2, 3]) {
      assert.equal(getWeeklyBuffsForRotation(pool, rotationIndex).length, 3);
    }
  }
});

test("炼狱与折磨仅在地图池 A 的 L04 上有差异", () => {
  const [a, b] = WEEKLY_BUFF_POOLS;
  assert.ok(a.maps.inferno.includes("L04"));
  assert.ok(!a.maps.torment.includes("L04"));
  assert.deepEqual(a.maps.inferno.filter((map) => map !== "L04"), a.maps.torment);
  assert.deepEqual(b.maps.inferno, b.maps.torment);
  assert.ok(b.maps.torment.includes("禁魔岛"));
  assert.ok(a.maps.torment.includes("LC02"));
});

test("当前配置日期落在第三组轮换", () => {
  assert.equal(
    getWeeklyBuffRotationWindow(Date.parse("2026-08-09T12:00:00+08:00"))
      .rotationIndex,
    3,
  );
});

test("各伤害通道由精确 Numerical 行解析为规范乘区", () => {
  const types = new Map(MODIFIER_TYPES.map((type) => [type.id, type]));
  assert.equal(WEEKLY_BUFF_DAMAGE_INDEX.length, 17);
  assert.equal(WEEKLY_BUFFS[1398001620].indexKind, "extra");
  for (const buff of Object.values(WEEKLY_BUFFS)) {
    for (const channel of buff.damageChannels ?? []) {
      const type = types.get(channel.modifierTypeId);
      assert.ok(type, `${buff.name}: ${channel.modifierTypeId}`);
      const effect = NUM_MODIFIER_RESOLVER.resolveEffect(
        { row: channel.row, field: "base" },
        { recipient: "self" },
      );
      assert.equal(effect.direction, "increase", `${buff.name}: ${channel.row}`);
      assert.ok(effect.facets.some((facet) => facet.id === type.facetId),
        `${buff.name}: ${channel.row} does not resolve to ${type.facetId}`);
    }
  }
  assert.deepEqual(getWeeklyBuffFactors(WEEKLY_BUFFS[1398001590]).map((group) => group.factorId),
    ["dilution", "weakness"]);
  assert.deepEqual(getWeeklyBuffFactors(WEEKLY_BUFFS[1398001640]).map((group) => group.factorId),
    ["dilution"]);
  assert.deepEqual(getWeeklyBuffFactors(WEEKLY_BUFFS[1398001640])[0].channels.map((channel) => channel.modifierTypeId),
    ["weapon-damage", "weapon-skill-damage"]);
  assert.deepEqual(getWeeklyBuffFactors(WEEKLY_BUFFS[1398001620])[0].channels.map((channel) => channel.modifierTypeId),
    ["weapon-explode-damage"]);
  assert.deepEqual(getWeeklyBuffFactors(WEEKLY_BUFFS[1398001540])[0].channels.map((channel) => channel.modifierTypeId),
    ["weapon-hit-damage", "weapon-explode-damage"]);
});

test("暴击率与额外伤害事件不冒充乘区", () => {
  for (const buff of Object.values(WEEKLY_BUFFS)) {
    if (buff.indexKind !== "critical" && buff.indexKind !== "extra") continue;
    assert.ok(buff.indexLabel);
    if (buff.indexKind === "critical") assert.deepEqual(getWeeklyBuffFactors(buff), []);
  }
});
