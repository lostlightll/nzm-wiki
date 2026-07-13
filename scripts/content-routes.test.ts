import assert from "node:assert/strict";
import test from "node:test";
import { getContentRouteRule, resolveContentPath } from "./content-routes";

test("resolves tower-defense weapons before the weapons prefix", () => {
  assert.equal(resolveContentPath("weapons_td/哈士奇好友"), "/weapons/td/哈士奇好友");
});

test("resolves existing content routes", () => {
  assert.equal(resolveContentPath("weapons/哈士奇好友"), "/weapons/哈士奇好友");
  assert.equal(resolveContentPath("enemies/lc/boss/钢管男"), "/enemies/lc/钢管男");
  assert.equal(resolveContentPath("posts/guide"), "/posts/guide");
});

test("matches complete path segments only", () => {
  assert.equal(resolveContentPath("weapons_extra/test"), undefined);
});

test("keeps tower-defense weapons out of the search index", () => {
  assert.equal(getContentRouteRule("weapons_td/哈士奇好友")?.searchable, false);
  assert.equal(getContentRouteRule("weapons/哈士奇好友")?.searchable, true);
});
