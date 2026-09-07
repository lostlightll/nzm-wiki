import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const paths = {
  constants: "DataTables/NumericalSettlementConstantConfig.json",
  system: "Numerical/Systems/BP_NumericalConfigSystem.json",
  presets: "DataTables/AlwaysCook/GameplaySystem/SystemPresetsTable.json",
} as const;
const classPath = "/Game/Numerical/Systems/BP_NumericalConfigSystem.BP_NumericalConfigSystem_C";
const tablePath = "/Game/DataTables/NumericalSettlementConstantConfig.NumericalSettlementConstantConfig";
const rowSchema = z.object({ Constant: z.number().finite().positive(), UsedSituation: z.literal(1), TableRowPlatformCookRule: z.literal("EUEDataTableRowCookRule::Default") });
export interface RangeEvidence {
  constants: Record<string, unknown>;
  system: unknown;
  preset: unknown;
  sources: Array<{ path: string; sha256: string }>;
}

export function readRangeEvidence(root = process.cwd()): RangeEvidence {
  const sources: RangeEvidence["sources"] = [];
  const read = (path: string) => {
    const bytes = readFileSync(join(root, "refs/Exports/NZM/Content", path));
    sources.push({ path: `NZM/Content/${path}`, sha256: createHash("sha256").update(bytes).digest("hex") });
    return z.array(z.record(z.string(), z.unknown())).parse(JSON.parse(bytes.toString("utf8")));
  };
  const rows = (path: string) => {
    const tables = read(path).filter(entry => entry.Rows);
    if (tables.length !== 1) throw new Error(`RANGE_EVIDENCE: ambiguous table ${path}`);
    return z.record(z.string(), z.unknown()).parse(tables[0].Rows);
  };
  const constants = rows(paths.constants);
  const systems = read(paths.system).filter(entry => entry.Name === "Default__BP_NumericalConfigSystem_C");
  if (systems.length !== 1) throw new Error("RANGE_EVIDENCE: missing exact Numerical CDO");
  const preset = rows(paths.presets).PVE;
  const evidence = { constants: Object.fromEntries(["CloseRangeDamageThreshold", "LongRangeDamageThreshold"].map(key => [key, constants[key]])), system: systems[0], preset, sources };
  reviewRangeValue(1701000105, evidence);
  reviewRangeValue(1701000106, evidence);
  return evidence;
}

/** Caller must already have verified the Passive -> CharacterModifierList identity. */
export function reviewRangeValue(skillId: number, evidence: RangeEvidence) {
  const key = skillId === 1701000105 ? "CloseRangeDamageThreshold" : skillId === 1701000106 ? "LongRangeDamageThreshold" : undefined;
  if (!key) throw new Error(`RANGE_EVIDENCE: unreviewed skill ${skillId}`);
  const preset = z.object({ SystemConfigPreset: z.array(z.object({ SoftSystemClass: z.object({ AssetPathName: z.string() }).nullable() }).passthrough()) }).parse(evidence.preset);
  const selected = preset.SystemConfigPreset.flatMap((entry, index) => entry.SoftSystemClass?.AssetPathName === classPath ? [{ entry, index }] : []);
  if (selected.length !== 1) throw new Error("RANGE_EVIDENCE: PVE Numerical system selection drift");
  z.object({ SystemClass: z.null(), Flags: z.literal(3) }).parse(selected[0].entry);
  z.object({ Name: z.literal("Default__BP_NumericalConfigSystem_C"), Type: z.literal("BP_NumericalConfigSystem_C"), Properties: z.object({ SettlementConstantConfigTablePath: z.object({ AssetPathName: z.literal(tablePath) }) }) }).parse(evidence.system);
  const row = rowSchema.parse(evidence.constants[key]);
  return {
    value: row.Constant / 100,
    chain: [
      { source: `NZM/Content/${paths.presets}#PVE.SystemConfigPreset[${selected[0].index}]`, value: selected[0].entry },
      { source: `NZM/Content/${paths.system}#Default__BP_NumericalConfigSystem_C.Properties.SettlementConstantConfigTablePath`, value: tablePath },
      { source: `NZM/Content/${paths.constants}#${key}`, value: row },
    ],
    note: "距离采用 PVE Numerical 系统加载的结算常量；Unreal 世界距离厘米除以 100 转为米。仅确认当前配置，不证明历史阈值或边界等号的运行时判定。",
  };
}
