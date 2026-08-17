import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import overlimitCards from "@/data/overlimit-cards.json";
import {
  getTriggerDamageByOverlimitId,
  getTriggerDamageByPerkSlug,
  TRIGGER_DAMAGE_ENTRIES,
  TRIGGER_DAMAGE_GROUPS,
} from "@/lib/trigger-damage";

test("触发伤害分组保留文章中的全部 55 项", () => {
  assert.equal(TRIGGER_DAMAGE_GROUPS.current.length, 24);
  assert.equal(TRIGGER_DAMAGE_GROUPS.overlimit.length, 10);
  assert.equal(TRIGGER_DAMAGE_GROUPS.prototype.length, 20);
  assert.equal(TRIGGER_DAMAGE_GROUPS.historical.length, 1);
  assert.equal(TRIGGER_DAMAGE_ENTRIES.length, 55);
});

test("普通插件映射唯一且全部指向现有详情页", () => {
  const entries = TRIGGER_DAMAGE_ENTRIES.filter((entry) => entry.perkSlug);
  const slugs = entries.map((entry) => entry.perkSlug!);

  assert.equal(new Set(slugs).size, slugs.length);
  for (const slug of slugs) {
    assert.equal(
      existsSync(path.join(process.cwd(), "data", "perks", `${slug}.mdx`)),
      true,
      `缺少插件详情页：${slug}`,
    );
    assert.equal(getTriggerDamageByPerkSlug(slug)?.perkSlug, slug);
  }
});

test("十张触发伤害超限卡均可按卡片 ID 查询", () => {
  const cardIds = new Set(overlimitCards.map((card) => card.id));
  const entries = TRIGGER_DAMAGE_GROUPS.overlimit;

  assert.equal(new Set(entries.map((entry) => entry.overlimitId)).size, 10);
  for (const entry of entries) {
    assert.equal(cardIds.has(entry.overlimitId), true);
    assert.equal(
      getTriggerDamageByOverlimitId(entry.overlimitId)?.numericalId,
      entry.numericalId,
    );
  }
});
