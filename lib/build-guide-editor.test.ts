import assert from "node:assert/strict";
import test from "node:test";
import matter from "gray-matter";
import { formatBuildGuideMdx } from "./build-guide-editor-format";
import { resolveBuildGuideEditorFile } from "./build-guide-editor";
import type { BuildGuideSource } from "./build-guides";

const SOURCE: BuildGuideSource = {
  title: "测试攻略",
  summary: "测试摘要",
  source: "测试作者",
  season: "s3",
  draft: true,
  tags: ["测试"],
  weapons: {
    primary: "精绝兽神",
    secondary: "黑金仲裁者",
    melee: "黑天使之刃",
  },
  perks: {
    primary: {
      "1": "slot-1/加弹抽奖",
      "2": "slot-2/超频蓄能",
      "3": "slot-3/技能增涌",
      "4": "slot-4/兽躯双衍",
    },
    secondary: {
      "1": "slot-1/弹药续杯",
      "2": "slot-2/技能抽奖",
      "3": "slot-3/钩出痛打",
      "4": "slot-4/连环震波",
    },
  },
  talent: {
    tree: "grappling-hook",
    passive: "2030102",
    route: "23211",
  },
};

test("formats editor state as parseable build guide MDX", () => {
  const output = formatBuildGuideMdx(SOURCE, "## 手法教学\n\n正文");
  const parsed = matter(output);
  assert.deepEqual(parsed.data, SOURCE);
  assert.equal(parsed.content.trim(), "## 手法教学\n\n正文");
});

test("accepts safe build filenames and rejects traversal", () => {
  const resolved = resolveBuildGuideEditorFile("builds/s3-build-template.mdx");
  assert.equal(resolved.file, "builds/s3-build-template.mdx");
  assert.equal(resolved.slug, "s3-build-template");

  for (const file of [
    "../builds/test.mdx",
    "builds/nested/test.mdx",
    "weapons/test.mdx",
    "builds/test.json",
    "builds/test..mdx",
  ]) {
    assert.throws(() => resolveBuildGuideEditorFile(file), /安全 MDX 文件名/);
  }
});
