import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { WeaponModeDiff } from "@/components/WeaponModeDiff";
import {
  buildWeaponModeDiff,
  getWeaponModeDiffFieldLabel,
} from "./weapon-mode-diff";
import { getResolvedWeaponBySlug } from "./weapons";

async function modes(slug: string) {
  const [lc, td] = await Promise.all([
    getResolvedWeaponBySlug(slug, "lc"),
    getResolvedWeaponBySlug(slug, "td"),
  ]);
  assert.ok(lc);
  assert.ok(td);
  return { lc, td };
}

test("模式差异按稳定来源 ID 比较并表达来源缺失", async () => {
  const { lc, td } = await modes("木葫芦");
  assert.deepEqual(buildWeaponModeDiff(lc, td), [
    {
      sourceId: "he-shui-hui-xue",
      sourceName: "喝水回血",
      sourceSection: "special",
      field: "availability",
      lcAvailable: true,
      tdAvailable: false,
    },
  ]);
});

test("模式差异忽略原始 Settlement 标签并保留字段状态", async () => {
  const { lc, td } = await modes("炼狱蝎王");
  const rows = buildWeaponModeDiff(lc, td);
  assert.deepEqual(
    rows.map((row) => [row.sourceId, row.field]),
    [
      ["xie-ci", "damage.toughness"],
      ["xie-ci", "elementAddRate"],
    ],
  );
  assert.equal(rows[1].lcField?.state, "not_applicable");
  assert.equal(rows[1].tdField?.state, "resolved");
});

test("玩家差异表过滤冲击、肉身和受击伤害", async () => {
  const { lc, td } = await modes("炼狱蝎王");
  const fields = buildWeaponModeDiff(lc, td).map((row) => row.field as string);
  assert.ok(!fields.includes("damage.impulse"));
  assert.ok(!fields.includes("damage.flesh"));
  assert.ok(!fields.includes("damage.hurtable"));
});

test("差异表使用 LC x500、TD x400 并包含横向滚动容器", async () => {
  const { lc, td } = await modes("沙丘之怒");
  const markup = renderToStaticMarkup(
    <WeaponModeDiff lcWeapon={lc} tdWeapon={td} />,
  );
  assert.match(markup, />143</);
  assert.match(markup, />45\.76</);
  assert.match(markup, /overflow-x-auto/);
  assert.match(markup, /min-w-\[34rem\]/);
});

test("恢复差异按 Settlement 名称和百分比展示", async () => {
  const { lc, td } = await modes("夜影之逝");
  const changedTd = structuredClone(td);
  const recovery = changedTd.damageSources.find(
    (source) => source.id === "jin-zhan-hui-xue",
  );
  assert.ok(recovery);
  recovery.health.scale.value = 0.4;

  const row = buildWeaponModeDiff(lc, changedTd).find(
    (item) =>
      item.sourceId === "jin-zhan-hui-xue" && item.field === "health.scale",
  );
  assert.ok(row);
  assert.equal(getWeaponModeDiffFieldLabel(row), "护盾恢复");

  const markup = renderToStaticMarkup(
    <WeaponModeDiff lcWeapon={lc} tdWeapon={changedTd} />,
  );
  assert.match(markup, />30%</);
  assert.match(markup, />40%</);
});

test("基础伤害字段按 Health Settlement 显示具体伤害类型", async () => {
  const cases = [
    ["幽冥毒皇", "grenade-hit", "命中伤害"],
    ["精绝兽神", "mi-fa-liu-dan", "武器技能伤害"],
    ["精绝兽神", "mi-fa-liu-dan-fen-lie-tan", "武器技能伤害"],
    ["飓风之龙", "dragon-flame-explosion", "爆炸伤害"],
    ["Bully", "wu-ren-ji-she-ji", "命中伤害"],
    ["幽冥毒王", "du-chi-chi-xu-shang-hai", "持续伤害"],
    ["夜影之逝", "you-jian-jin-zhan", "近战伤害"],
    ["死神猎手", "pu-tong-she-ji", "命中伤害"],
  ] as const;

  for (const [slug, sourceId, expected] of cases) {
    const { lc, td } = await modes(slug);
    const row = buildWeaponModeDiff(lc, td).find(
      (item) => item.sourceId === sourceId && item.field === "damage.base",
    );
    assert.ok(row, `${slug}/${sourceId}`);
    assert.equal(getWeaponModeDiffFieldLabel(row), expected);
  }
});
