import assert from "node:assert/strict";
import test from "node:test";
import { reviewRangeValue, type RangeEvidence } from "./range-values";

const fixture = (): RangeEvidence => ({
  constants: Object.fromEntries([["CloseRangeDamageThreshold", 1000], ["LongRangeDamageThreshold", 2500]].map(([key, value]) => [key, { Constant: value, UsedSituation: 1, TableRowPlatformCookRule: "EUEDataTableRowCookRule::Default" }])),
  system: { Name: "Default__BP_NumericalConfigSystem_C", Type: "BP_NumericalConfigSystem_C", Properties: { SettlementConstantConfigTablePath: { AssetPathName: "/Game/DataTables/NumericalSettlementConstantConfig.NumericalSettlementConstantConfig" } } },
  preset: { SystemConfigPreset: [{ SystemClass: null, SoftSystemClass: { AssetPathName: "/Game/Numerical/Systems/BP_NumericalConfigSystem.BP_NumericalConfigSystem_C" }, Flags: 3 }] },
  sources: [],
});

test("range thresholds follow selected constant fields in centimetres, not prose", () => {
  const evidence = fixture();
  assert.equal(reviewRangeValue(1701000105, evidence).value, 10);
  assert.equal(reviewRangeValue(1701000106, evidence).value, 25);
  evidence.constants.CloseRangeDamageThreshold = { Constant: 1234, UsedSituation: 1, TableRowPlatformCookRule: "EUEDataTableRowCookRule::Default" };
  assert.equal(reviewRangeValue(1701000105, evidence).value, 12.34);
  assert.equal(reviewRangeValue(1701000105, evidence).chain.length, 3);
});

test("range evidence fails on missing fields, unsupported skills or loader drift", () => {
  const evidence = fixture();
  assert.throws(() => reviewRangeValue(1701000101, evidence), /unreviewed skill/);
  delete evidence.constants.CloseRangeDamageThreshold;
  assert.throws(() => reviewRangeValue(1701000105, evidence));
  evidence.preset = { SystemConfigPreset: [] };
  assert.throws(() => reviewRangeValue(1701000106, evidence), /selection drift/);
  evidence.preset = fixture().preset;
  evidence.system = { ...fixture().system as object, Properties: { SettlementConstantConfigTablePath: { AssetPathName: "/Game/Other" } } };
  assert.throws(() => reviewRangeValue(1701000106, evidence));
});

test("nonfinite, nonpositive and differently scoped constants cannot render", () => {
  for (const constant of [NaN, Infinity, -1, 0]) {
    const evidence = fixture();
    evidence.constants.CloseRangeDamageThreshold = { Constant: constant, UsedSituation: 1, TableRowPlatformCookRule: "EUEDataTableRowCookRule::Default" };
    assert.throws(() => reviewRangeValue(1701000105, evidence));
  }
  const evidence = fixture();
  evidence.constants.CloseRangeDamageThreshold = { Constant: 1000, UsedSituation: 0, TableRowPlatformCookRule: "EUEDataTableRowCookRule::Default" };
  assert.throws(() => reviewRangeValue(1701000105, evidence));
});
