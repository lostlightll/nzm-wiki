import assert from "node:assert/strict";
import test from "node:test";
import {
  getStatusEffectCatalog,
  getStatusEffectSearchDocuments,
  isStatusEffectVariantVisibleForTarget,
} from "./status-effects";

test("目录只保留当前页面目标可见的配置变体", () => {
  const enemy = getStatusEffectCatalog("enemy").entries;
  const player = getStatusEffectCatalog("player").entries;

  assert.equal(enemy.length, 91);
  assert.equal(player.length, 705);
  assert.ok(
    enemy.every((entry) =>
      entry.variants.every((variant) =>
        isStatusEffectVariantVisibleForTarget(variant, "enemy"),
      ),
    ),
  );
  assert.ok(
    player.every((entry) =>
      entry.variants.every((variant) =>
        isStatusEffectVariantVisibleForTarget(variant, "player"),
      ),
    ),
  );
});

test("承伤字段按方向区分易伤与减伤", () => {
  const enemyShock = getStatusEffectCatalog("enemy").entries.find(
    (entry) => entry.buffId === 100300001,
  );
  const playerReduction = getStatusEffectCatalog("player").entries.find(
    (entry) => entry.buffId === 14010005,
  );

  assert.ok(enemyShock);
  assert.ok(
    enemyShock.multiplierRelations.some(
      (relation) => relation.modifierTypeId === "vulnerability",
    ),
  );
  assert.ok(playerReduction);
  assert.equal(playerReduction.group.id, "defense");
  assert.ok(
    playerReduction.multiplierRelations.every(
      (relation) => relation.modifierTypeId !== "vulnerability",
    ),
  );
});

test("乘区标签只在需要区分伤害类型时显示具体类型", () => {
  const relations = (["enemy", "player"] as const).flatMap((target) =>
    getStatusEffectCatalog(target).entries.flatMap((entry) => entry.multiplierRelations),
  );
  const factorsWithDetail = new Set(["dilution", "element", "vulnerability"]);

  for (const relation of relations) {
    assert.equal(
      relation.displayLabel,
      factorsWithDetail.has(relation.factorId)
        ? `${relation.factorLabel} · ${relation.modifierTypeLabel}`
        : relation.factorLabel,
    );
  }

  for (const factorId of ["dilution", "element", "vulnerability", "critical", "weakness"]) {
    assert.ok(relations.some((relation) => relation.factorId === factorId));
  }
});

test("确认来源与同乘区参考保持不同证据标签", () => {
  const entry = getStatusEffectCatalog("player").entries.find(
    (item) => item.buffId === 110100085,
  );

  assert.ok(entry);
  assert.ok(
    entry.relatedContent.some(
      (item) =>
        item.relation === "confirmed-source" &&
        item.type === "perk" &&
        item.title === "致命节拍" &&
        item.href === "/perks/slot-3/致命节拍",
    ),
  );
  assert.ok(
    entry.relatedContent.some(
      (item) => item.relation === "confirmed-source" && item.type === "overlimit-card",
    ),
  );
  assert.ok(
    entry.relatedContent
      .filter((item) => item.type === "season-talent")
      .every((item) => item.season === "S3" && item.relation === "same-multiplier"),
  );
});

test("玩家视图隐藏测试项，全局索引包含可追踪的 Buff 关联词", () => {
  const testBuff = getStatusEffectCatalog("player").entries.find(
    (entry) => entry.buffId === 1,
  );
  const document = getStatusEffectSearchDocuments().find(
    (entry) => entry.buffId === 110100085,
  );

  assert.ok(testBuff);
  assert.equal(testBuff.practical, false);
  assert.ok(document);
  assert.equal(document.target, "player");
  assert.ok(document.keywords.includes("致命节拍"));
  assert.ok(document.keywords.includes("大稀释乘区"));
  assert.ok(!getStatusEffectSearchDocuments().some((entry) => entry.buffId === 1));
});
