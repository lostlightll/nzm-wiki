import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import type { ContentDocument } from "./content-catalog";
import { validateContentCatalog } from "./validate-content";

function weaponDocument(
  slug: string,
  metadata: Record<string, unknown>,
): ContentDocument {
  return {
    fileName: slug.split("/").at(-1) ?? slug,
    filePath: path.join(process.cwd(), "data", `${slug}.mdx`),
    slug,
    metadata,
  };
}

test("reports typed frontmatter errors with the source file", () => {
  const errors = validateContentCatalog([
    weaponDocument("weapons/invalid", {
      title: "",
      use_type: "未知槽位",
      rarity: "普通",
      element: "虚空",
      weapon_type: null,
      damage: null,
      keywards: ["typo"],
    }),
  ]);

  assert.ok(errors.some((error) => error.includes("frontmatter.title")));
  assert.ok(errors.some((error) => error.includes("frontmatter.use_type")));
  assert.ok(errors.some((error) => error.includes("frontmatter.rarity")));
  assert.ok(errors.some((error) => error.includes("frontmatter.element")));
  assert.ok(errors.some((error) => error.includes("frontmatter.keywards")));
  assert.ok(errors.every((error) => error.includes("data")));
});

test("accepts a minimally valid weapon document", () => {
  const errors = validateContentCatalog([
    weaponDocument("weapons/valid", {
      title: "测试武器",
      use_type: "主武器",
      rarity: "传说",
      element: "物理",
      weapon_type: "突击步枪",
      damage: { base: 1 },
    }),
  ]);

  assert.deepEqual(errors, []);
});
