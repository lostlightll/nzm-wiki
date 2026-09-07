import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const numericalPath = "NZM/Content/DataTables/numerical_config_playerskill.json";
const actorPath = "NZM/Content/Abilities/Skills/Season/S2/TabooEyes/BP_TabooEyes2.json";
const keys = ["160102005_1", "160202001_1", "160202002_1", "160202003_1", "160202004_1"];
export interface S1SkillNumericalEvidence {
  rows: Record<string, unknown>;
  baseActor: { name: string; numericalId: number };
  sources: Array<{ path: string; sha256: string }>;
}
export function readS1SkillNumerical(root: string): S1SkillNumericalEvidence {
  const sources: S1SkillNumericalEvidence["sources"] = [];
  const read = (path: string) => {
    const bytes = readFileSync(join(root, "refs/Exports", path));
    sources.push({ path, sha256: createHash("sha256").update(bytes).digest("hex") });
    return z.array(z.record(z.string(), z.unknown())).parse(JSON.parse(bytes.toString("utf8")));
  };
  const exports = read(numericalPath).filter(row => row.Rows);
  if (exports.length !== 1) throw new Error("S1_SKILL_NUMERICAL_TABLE");
  const table = z.record(z.string(), z.unknown()).parse(exports[0].Rows);
  const actors = read(actorPath).filter(row => row.Name === "Default__BP_TabooEyes2_C");
  if (actors.length !== 1) throw new Error("S1_SKILL_NUMERICAL_ACTOR");
  const actor = z.object({ NumericalID: z.number().int() }).parse(actors[0].Properties);
  return { rows: Object.fromEntries(keys.map(key => [key, table[key]])), baseActor: { name: "Default__BP_TabooEyes2_C", numericalId: actor.NumericalID }, sources };
}

export function reviewS1SkillNumerical(skill: number, level: number, numericalId: number, evidence: S1SkillNumericalEvidence) {
  const chain: Array<{ source: string; value: unknown }> = [];
  const row = (id: number, settlement: string) => {
    const raw = evidence.rows[`${id}_1`];
    const parsed = z.object({ id: z.literal(id), Level: z.literal(1), HpCalScale: z.number().finite().positive(), HpCalBase: z.literal(0), HpFloatCoef: z.literal(0), Settlements: z.array(z.object({ TagName: z.string() })) }).parse(raw);
    if (!parsed.Settlements.some(item => item.TagName === settlement)) throw new Error("S1_SKILL_SETTLEMENT_DRIFT");
    chain.push({ source: `${numericalPath}#${id}_1`, value: raw });
    return parsed;
  };
  if (skill === 1319022015 && level === 1 && numericalId === 160102005) {
    return { value: row(160102005, "Numerical.SettlementType.Health.IndirectDamage").HpCalScale, chain,
      note: "Passive WoundID 与精确描述 Token 均指向技能 Numerical 的 HpCalScale；不是同 ID 的 Modifier。仅确认间接伤害系数，不据此证明累计伤害输入与触发次数。" };
  }
  if (skill !== 1319022006 || ![1, 2, 3].includes(level) || numericalId !== 160202001 + level || evidence.baseActor.name !== "Default__BP_TabooEyes2_C" || evidence.baseActor.numericalId !== 160202001) throw new Error("S1_SKILL_IDENTITY_DRIFT");
  chain.push({ source: `${actorPath}#${evidence.baseActor.name}.NumericalID`, value: evidence.baseActor.numericalId });
  const base = row(160202001, "Numerical.SettlementType.Health.SkillDamage");
  const upgraded = row(numericalId, "Numerical.SettlementType.Health.SkillDamage");
  return { value: Number((upgraded.HpCalScale / base.HpCalScale - 1).toPrecision(12)), chain,
    note: "按逐级 NumericalID_Talent 与技能 Actor 默认 NumericalID 的 HpCalScale 比值计算增幅；不是独立 Modifier 乘区，不宣称历史实测。" };
}
