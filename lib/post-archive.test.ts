import assert from "node:assert/strict";
import test from "node:test";
import { sortPostArchiveItems } from "./post-archive";

test("元素与 Buff 图鉴在文章归档中连续排列", () => {
  const posts = [
    { slug: "player-buffs" },
    { slug: "hunting-atk" },
    { slug: "enemy-buffs" },
    { slug: "element" },
    { slug: "damage-calculation" },
  ];

  assert.deepEqual(
    sortPostArchiveItems(posts).map((post) => post.slug),
    [
      "damage-calculation",
      "element",
      "enemy-buffs",
      "player-buffs",
      "hunting-atk",
    ],
  );
  assert.equal(posts[0].slug, "player-buffs");
});

