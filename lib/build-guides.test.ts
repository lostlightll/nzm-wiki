import assert from "node:assert/strict";
import test from "node:test";
import {
  getAllBuildGuides,
  resolveBuildGuideSource,
  resolveS3BuildTalent,
  type BuildGuideSource,
} from "./build-guides";

const VALID_SOURCE: BuildGuideSource = {
  title: "测试搭配",
  summary: "测试搭配摘要",
  source: "测试作者",
  season: "s3",
  draft: true,
  tags: ["测试"],
  weapons: {
    primary: "精绝兽神",
    secondary: "暗夜之殇",
    melee: "冰点双峰",
  },
  perks: {
    primary: {
      "1": "slot-1/万钧过载",
      "2": "slot-2/出其不意",
      "3": "slot-3/伏击弹药",
      "4": "slot-4/伤害回血",
    },
    secondary: {
      "1": "slot-1/使唤回弹",
      "2": "slot-2/加速蓄能",
      "3": "slot-3/危险膛压",
      "4": "slot-4/冲刺得速",
    },
  },
  talent: { tree: "zero", passive: "2030101", route: "43211" },
};

test("resolves a complete S3 build guide", async () => {
  const guide = await resolveBuildGuideSource(VALID_SOURCE, "valid");
  assert.equal(guide.source, "测试作者");
  assert.equal(guide.weapons.primary.useType, "主武器");
  assert.equal(guide.weapons.secondary.useType, "副武器");
  assert.equal(guide.weapons.melee.useType, "近战武器");
  assert.equal(guide.perks.primary[4]?.name, "伤害回血");
  assert.equal(guide.talent.totalPoints, 40);
});

test("allows empty perk slots while preserving the four-slot layout", async () => {
  const guide = await resolveBuildGuideSource(
    {
      ...VALID_SOURCE,
      perks: {
        primary: { "1": "", "2": "", "3": "", "4": "" },
        secondary: { ...VALID_SOURCE.perks.secondary, "2": "" },
      },
    },
    "empty-perks",
  );

  assert.deepEqual(Object.keys(guide.perks.primary), ["1", "2", "3", "4"]);
  assert.equal(guide.perks.primary[1], null);
  assert.equal(guide.perks.primary[4], null);
  assert.equal(guide.perks.secondary[2], null);
  assert.equal(guide.perks.secondary[1]?.name, "使唤回弹");
});

test("maps 43211 to the five S3 general talent nodes", () => {
  const talent = resolveS3BuildTalent(VALID_SOURCE.talent, "route");
  assert.deepEqual(
    talent.nodes.map((node) => node.name),
    ["游击轮盘", "绝对洞察", "概率极化", "厄运补偿", "跃迁共振"],
  );
  assert.equal(talent.exclusivePoints, 15);
  assert.equal(talent.generalPoints, 25);
  assert.equal(talent.totalPoints, 40);
  assert.match(talent.treeDescription, /点击技能释放泡泡/);
  assert.match(talent.passive.description, /武器直击伤害/);
  assert.match(talent.nodes[0].description, /持续移动2秒以上时射击/);
});

test("rejects an invalid route code", async () => {
  await assert.rejects(
    resolveBuildGuideSource(
      { ...VALID_SOURCE, talent: { ...VALID_SOURCE.talent, route: "53211" } },
      "bad-route",
    ),
    /必须是五位 1-4 数字/,
  );
});

test("rejects missing weapons and wrong weapon roles", async () => {
  await assert.rejects(
    resolveBuildGuideSource(
      {
        ...VALID_SOURCE,
        weapons: { ...VALID_SOURCE.weapons, primary: "不存在的武器" },
      },
      "missing-weapon",
    ),
    /武器不存在/,
  );
  await assert.rejects(
    resolveBuildGuideSource(
      {
        ...VALID_SOURCE,
        weapons: { ...VALID_SOURCE.weapons, primary: "暗夜之殇" },
      },
      "wrong-role",
    ),
    /用途应为主武器/,
  );
});

test("rejects missing, misplaced, and incompatible perks", async () => {
  await assert.rejects(
    resolveBuildGuideSource(
      {
        ...VALID_SOURCE,
        perks: {
          ...VALID_SOURCE.perks,
          primary: { ...VALID_SOURCE.perks.primary, "1": "slot-1/不存在" },
        },
      },
      "missing-perk",
    ),
    /插件不存在/,
  );
  await assert.rejects(
    resolveBuildGuideSource(
      {
        ...VALID_SOURCE,
        perks: {
          ...VALID_SOURCE.perks,
          primary: { ...VALID_SOURCE.perks.primary, "1": "slot-2/出其不意" },
        },
      },
      "wrong-slot",
    ),
    /应位于 1 号槽/,
  );
  await assert.rejects(
    resolveBuildGuideSource(
      {
        ...VALID_SOURCE,
        perks: {
          ...VALID_SOURCE.perks,
          primary: { ...VALID_SOURCE.perks.primary, "4": "slot-4/剑摧魂" },
        },
      },
      "incompatible-perk",
    ),
    /不适用于武器/,
  );
});

test("rejects an unknown S3 passive", async () => {
  await assert.rejects(
    resolveBuildGuideSource(
      {
        ...VALID_SOURCE,
        talent: { ...VALID_SOURCE.talent, passive: "unknown" },
      },
      "bad-passive",
    ),
    /被动天赋不存在/,
  );
});

test("filters draft build guides for production consumers", async () => {
  const withDrafts = await getAllBuildGuides({ includeDrafts: true });
  const withoutDrafts = await getAllBuildGuides({ includeDrafts: false });
  assert.ok(withDrafts.some((guide) => guide.slug === "s3-build-template"));
  assert.ok(!withoutDrafts.some((guide) => guide.slug === "s3-build-template"));
});
