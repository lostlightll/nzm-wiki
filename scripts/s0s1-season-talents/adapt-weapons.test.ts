import assert from "node:assert/strict";
import test from "node:test";
import { resolveApplicableWeapons, type Evidence } from "./extract";

const tables: Evidence["tables"] = {
  basic: {}, types: {}, structure1: {}, structure2: {}, structure3: {}, params: {}, mgeDescriptions: {}, skillDescriptions: {}, activeSkills: {},
  adaptWeapons: {
    s0: { SeasonID: 1, SeasonPhaseID: 0, TextID: 1, TextContent: { LocalizedString: "适配武器：<qiangdiao>突击步枪、机枪</>" } },
    s1: { SeasonID: 1, SeasonPhaseID: 1, TextID: 1, TextContent: { LocalizedString: "适配武器：全方面<qiangdiao>适配于所有武器</>" } },
  },
};

test("adapted weapons join by root identity and exact season phase, stripping only presentation markup", () => {
  assert.equal(resolveApplicableWeapons(tables, 0, 1), "突击步枪、机枪");
  assert.equal(resolveApplicableWeapons(tables, 1, 1), "全方面适配于所有武器");
  assert.throws(() => resolveApplicableWeapons(tables, 2, 1), /expected one exact row/);
  assert.throws(() => resolveApplicableWeapons(tables, 0, undefined), /no AdaptWeapon identity/);
  assert.throws(() => resolveApplicableWeapons({ ...tables, adaptWeapons: { ...tables.adaptWeapons, duplicate: tables.adaptWeapons!.s0 } }, 0, 1), /expected one exact row/);
});

test("old snapshots omit unsupported weapon applicability instead of inventing a fallback", () => {
  assert.equal(resolveApplicableWeapons({ ...tables, adaptWeapons: undefined }, 0, 1), undefined);
});
