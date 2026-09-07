import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import sharp from "sharp";
import { LEGACY_ATLAS_REVIEWS, legacyAtlasCrop } from "./atlas-crops";
import type { LegacyTalentTree } from "../../lib/s0s1-season-talents";

const trees: LegacyTalentTree[] = ["s0", "s1"].flatMap(season => JSON.parse(readFileSync(join(process.cwd(), "data/season-talents", season, "trees.json"), "utf8")));

test("reviewed atlas identities refer to exact nodes and retain recording timestamps", () => {
  assert.equal(Object.keys(LEGACY_ATLAS_REVIEWS).length, 21);
  for (const [name, review] of Object.entries(LEGACY_ATLAS_REVIEWS)) {
    const node = trees.flatMap(tree => tree.nodes).find(node => node.id === review.nodeId);
    assert.ok(node);
    assert.ok(node.icon.endsWith(`/${name}.webp`));
    assert.ok(review.videoSeconds >= 0 && review.videoSeconds < 500);
    const crop = legacyAtlasCrop(review);
    assert.ok(crop.left >= 0 && crop.top >= 0 && crop.left + crop.width <= 2748 && crop.top + crop.height <= 3656);
  }
});

test("reviewed crops are nonblank and have transparent boundaries without clipping", async () => {
  for (const name of Object.keys(LEGACY_ATLAS_REVIEWS)) {
    const {data, info} = await sharp(join(process.cwd(), "public/webp/images/season-talents/s0s1", `${name}.webp`)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    let visible = 0;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      const alpha = data[(y * info.width + x) * 4 + 3];
      if (alpha > 8) visible++;
      if (x === 0 || y === 0 || x === info.width - 1 || y === info.height - 1) assert.ok(alpha <= 8, `${name}: clipped edge`);
    }
    assert.ok(visible > 1000, `${name}: blank crop`);
  }
});

test("all five video-confirmed branches have exported icons", () => {
  for (const tree of trees.filter(tree => tree.id !== "destruction-dream")) {
    for (const node of tree.nodes) assert.ok(existsSync(join(process.cwd(), "public", node.icon)), `${tree.id}/${node.id}: ${node.icon}`);
  }
});
