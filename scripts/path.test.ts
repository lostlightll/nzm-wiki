import assert from "node:assert/strict";
import test from "node:test";
import {
  getAssetPath,
  getImageAssetPaths,
  getOptimizedImagePath,
} from "../lib/path";

test("keeps generic assets unchanged and optimizes local PNG displays", () => {
  const previous = process.env.NEXT_PUBLIC_BASE_PATH;
  process.env.NEXT_PUBLIC_BASE_PATH = "";

  try {
    assert.equal(getAssetPath("/icon.png"), "/icon.png");
    assert.equal(
      getOptimizedImagePath("/icons/weapons/demo.png?rev=1"),
      "/webp/icons/weapons/demo.webp?rev=1",
    );
    assert.deepEqual(getImageAssetPaths("/icons/demo.png"), {
      src: "/webp/icons/demo.webp",
      fallbackSrc: "/icons/demo.png",
    });
    assert.equal(
      getOptimizedImagePath("https://example.com/demo.png"),
      "https://example.com/demo.png",
    );
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
    else process.env.NEXT_PUBLIC_BASE_PATH = previous;
  }
});

test("applies the configured base path to original and optimized assets", () => {
  const previous = process.env.NEXT_PUBLIC_BASE_PATH;
  process.env.NEXT_PUBLIC_BASE_PATH = "/nzm-wiki";

  try {
    assert.equal(getAssetPath("icon.png"), "/nzm-wiki/icon.png");
    assert.equal(
      getOptimizedImagePath("icons/demo.png"),
      "/nzm-wiki/webp/icons/demo.webp",
    );
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
    else process.env.NEXT_PUBLIC_BASE_PATH = previous;
  }
});
