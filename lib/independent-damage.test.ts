import assert from "node:assert/strict";
import test from "node:test";
import {
  getIndependentDamageByOverlimitId,
  getIndependentDamageByPerkSlug,
} from "./independent-damage";
import { getAllPerks } from "./perks";

const EXPECTED_REFERENCES = new Map([
  ["slot-4/强袭", ["能源之影", "qiang-xi-ji-guang"]],
  ["slot-4/恶鬼眷顾", ["鬼铜蚀", "d-o-t-chi-shang-hai-jian-su-cha-jian"]],
  ["slot-4/索命龙炎", ["飓风之龙", "seeking-dragon-flame"]],
  ["slot-4/自动龙炎", ["飓风之龙", "automatic-dragon-flame"]],
  ["slot-4/腾焰", ["炼狱蝎王", "teng-yan"]],
  ["slot-4/蝎刺", ["炼狱蝎王", "xie-ci"]],
  ["slot-4/贯长虹", ["夜影之逝", "guan-chang-hong-jian-qi"]],
  ["slot-4/霜华", ["星海狂想", "frost-ice-spike"]],
]);

test("专属插件显式引用全部八个独立武器伤害来源", () => {
  const actual = new Map(
    getAllPerks().flatMap((perk) =>
      (perk.independentDamageSources ?? []).map(
        (reference) =>
          [
            perk.slug,
            [reference.weaponSlug, reference.damageSourceId],
          ] as const,
      ),
    ),
  );
  assert.deepEqual(actual, EXPECTED_REFERENCES);
});

test("武器来源解析为插件详情页独立伤害表格", async () => {
  const rainbow = await getIndependentDamageByPerkSlug("slot-4/贯长虹");
  assert.deepEqual(rainbow, [
    {
      name: "贯长虹",
      trigger: "切出本武器时向前发射剑气",
      interval: "10秒",
      numericalId: "120300245",
      damageType: "近战伤害",
      damageValue: "6500",
      toughness: "56.5",
      element: "电弧",
      critical: true,
      weakpoint: true,
      weakpointMultiplier: 1.2,
    },
  ]);

  const automatic = await getIndependentDamageByPerkSlug("slot-4/自动龙炎");
  assert.equal(automatic[0]?.numericalId, "120300114");
  assert.equal(automatic[0]?.damageValue, "75");

  const seeking = await getIndependentDamageByPerkSlug("slot-4/索命龙炎");
  assert.equal(seeking[0]?.numericalId, "120300113");
  assert.equal(seeking[0]?.damageValue, "90");
});

test("同 ItemID 超限卡复用专属插件伤害来源", async () => {
  const rainbow = await getIndependentDamageByOverlimitId("20703040346");
  assert.equal(rainbow[0]?.numericalId, "120300245");

  const seeking = await getIndependentDamageByOverlimitId("20703040339");
  assert.equal(seeking[0]?.numericalId, "120300113");
});

test("超限专属执行数据优先于普通插件映射", async () => {
  const fatalExplosion = await getIndependentDamageByOverlimitId("20703040437");
  assert.equal(fatalExplosion.length, 1);
  assert.match(fatalExplosion[0]?.trigger ?? "", /5%/);
  assert.equal(fatalExplosion[0]?.interval, "2 秒");
  assert.equal(fatalExplosion[0]?.numericalId, "130103014");
  assert.equal(fatalExplosion[0]?.damageValue, "5000");

  const hybridDamage = await getIndependentDamageByOverlimitId("20703040444");
  assert.equal(hybridDamage[0]?.interval, "触发 5 秒；追加 0.25 秒");

  const toxicZone = await getIndependentDamageByOverlimitId("20703040474");
  assert.equal(toxicZone[0]?.interval, "5 秒");
});
