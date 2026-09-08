import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { NUM_MODIFIER_RESOLVER as resolver } from "../../lib/num-modifier-data";
import type { LegacyTalentLevel, LegacyTalentSeason, LegacyTalentTree } from "../../lib/s0s1-season-talents";
import { resolveLegacyTalentFact } from "../../lib/s0s1-season-talents";
import { reviewSemanticConflict, summarizeSemanticReview } from "./semantic-conflicts";
import { applyLegacyValueReviews, type LegacyValueEvidence } from "./reviewed";
import { compactS0ReviewEvidence, readS0ReviewEvidence } from "./s0-reviewed-values";
import { compactS1ReviewEvidence, readS1ReviewInput } from "./s1-reviewed-values";

const textSchema = z.object({ LocalizedString: z.string().optional(), SourceString: z.string().optional() }).passthrough();
const assetSchema = z.object({ AssetPathName: z.string() });
const basicSchema = z.object({
  UniqueID: z.number(), SeasonID: z.number(), SeasonPhaseID: z.number(), TalentID: z.number(),
  TalentILevel: z.number().int().positive(), TalentType: z.number(), PhaseID: z.number(), ColumnID: z.number(),
  TalentName: textSchema, TalentIcon: assetSchema, AfterTalentID: z.string(),
  TalentSkillsID: z.number(), AttributeSkillsID: z.number(), SeasonSkill: z.number(),
  AdaptWeapon: z.number().int().nonnegative().optional(),
});
type Basic = z.infer<typeof basicSchema>;
const structureSchema = z.object({ SeasonID: z.number(), SeasonPhaseID: z.number(), PhaseID: z.number() }).catchall(z.number());
const typeSchema = z.object({ SeasonID: z.number(), SeasonPhaseID: z.number(), TalentType: z.number(), TypeText: textSchema, TypeIcon: assetSchema });
const parameterSchema = z.object({ Type: z.string(), Name: z.string(), Value: z.string() });
const configSchema = z.object({ ConfigId: z.number(), Parameters: z.array(parameterSchema) }).passthrough();
const mgeDescriptionSchema = z.object({ MGEId: z.number(), TextID: z.number(), MGEDescription: textSchema });
const skillDescriptionSchema = z.object({ SkillId: z.number(), SkillLevel: textSchema, SkillDescription: textSchema });
const activeSkillSchema = z.object({ AbilityID: z.number(), Duration: z.number().finite().nonnegative().optional(), CooldownDuration: z.number().finite().nonnegative().optional() });

export const INPUT_PATHS = {
  basic: "SeasonTalent/SeasonTalentBasicTable.json",
  types: "SeasonTalent/SeasonTalentTypeTable.json",
  structure1: "SeasonTalent/SeasonTalentStructure1Table.json",
  structure2: "SeasonTalent/SeasonTalentStructure2Table.json",
  structure3: "SeasonTalent/SeasonTalentStructure3Table.json",
  params: "MGE/DT_MGEParamConfig_Main.json",
  mgeDescriptions: "MGE/DT_GPMGESkillDesConfigTable_Main.json",
  skillDescriptions: "Ability/DT_SkillDesConfig_Main.json",
  activeSkills: "GPActiveSkillDataTable.json",
  adaptWeapons: "SeasonTalent/AdaptWeaponTable.json",
} as const;
type TableName = keyof typeof INPUT_PATHS;
export interface Evidence {
  schemaVersion: 1;
  season: LegacyTalentSeason;
  sources: Array<{ path: string; sha256: string }>;
  tables: Record<Exclude<TableName, "adaptWeapons">, Record<string, unknown>> & { adaptWeapons?: Record<string, unknown> };
  excluded: Array<{ id: string; name: string; basicRows: string[]; reason: string }>;
  semanticReview?: ReturnType<typeof summarizeSemanticReview>;
  valueEvidence?: LegacyValueEvidence;
  visualVerification: {
    nodes: "not-verified";
    basis: string;
    assets: Array<{ name: string; status: "missing" | "pending-visual-review" | "video-matched" }>;
  };
}
const NAMES = {
  s0: [["frost-barrage", "急冻弹幕"], ["destruction-dream", "毁灭之梦"], ["mechanical-dance", "机械之舞"]],
  s1: [["kunlun-wood", "昆仑神木"], ["phantom-form", "行境幻化"], ["forbidden-eye", "禁忌之瞳"]],
} as const;
export const UNVERIFIED = "〔数值待核实〕";
const localText = (value: z.infer<typeof textSchema>) => value.LocalizedString ?? value.SourceString ?? "";
const source = (table: TableName, row: string, field = "") => `NZM/Content/DataTables/${INPUT_PATHS[table]}#${row}${field ? `.${field}` : ""}`;
const icon = (asset: z.infer<typeof assetSchema>) => {
  const name = asset.AssetPathName.split("/").at(-1)?.split(".")[0];
  if (!name || name === "None") throw new Error(`Missing icon: ${asset.AssetPathName}`);
  return `/webp/images/season-talents/s0s1/${name}.webp`;
};
const skillIds = (row: Basic) => [row.TalentSkillsID, row.AttributeSkillsID, row.SeasonSkill].filter((id) => id > 0);

function addModifier(level: LegacyTalentLevel, id: number, exactLevel: number, origin: string, index?: number, evidenceKind: "current-same-id" | "current-description-token" = "current-same-id") {
  const rows = resolver.getRowsById("lc", id).filter((row) => row.level === exactLevel && (index === undefined || row.index === index));
  if (!rows.length) level.warnings.push(`MISSING_MODIFIER: ${origin} -> ID=${id}, Level=${exactLevel}${index === undefined ? "" : `, Index=${index}`}; 未回退等级。`);
  for (const row of rows) {
    if (!level.modifierRows.includes(row.key)) level.modifierRows.push(row.key);
    level.facts.push(resolveLegacyTalentFact({
      label: `Modifier ${row.key}`,
      value: `AttributeName=${row.attributeName}; BaseValue=${row.baseValue}; CoefValue=${row.coefficient}; GPModifierOp=${row.operation}; Level=${row.level}`,
      source: `${origin} -> ${row.key}`,
      modifierRow: row.key,
      evidenceKind,
      historicalEffectStatus: "unverified",
    }));
  }
}

export function sanitizeDescription(description: string, result: LegacyTalentLevel, origin: string, bindings: Readonly<Record<string, string>> = {}): string {
  const template: string[] = [];
  // Resolve tokens separately so untrusted literal numbers cannot survive beside them.
  const resolved = description.replace(/<[^>]*>/g, "").split(/(\{[^{}]*\})/g).map((part) => {
    if (part.startsWith("{")) {
      if (Object.hasOwn(bindings, part)) {
        template.push(bindings[part]);
        return bindings[part];
      }
      const token = /^\{GPModifier:(\d+):([^:}]+):(\d+):([^:}]+)(?::(\d+))?\}$/i.exec(part);
      if (token) {
        const resolution = resolver.resolveGameModifierTokens(part, origin);
        if (!resolution.unresolvedTokens.length) {
          addModifier(result, Number(token[1]), Number(token[5] ?? 1), `${origin} ${part}`, Number(token[3]), "current-description-token");
          if (!token[5] && result.level !== 1) result.warnings.push(`TOKEN_DEFAULT_LEVEL: ${origin} ${part} 按 Resolver 默认 Level=1，不推定为天赋等级。`);
          template.push(part);
          return resolution.text;
        }
      }
      result.warnings.push(`UNRESOLVED_TOKEN: ${origin} ${part}`);
      template.push(UNVERIFIED);
      return UNVERIFIED;
    }
    // Chinese numeric quantities are masked only before units, preserving ordinary idioms.
    const sanitized = part.replace(/[+-]?\d+(?:\.\d+)?(?:[%％])?|[零〇一二两三四五六七八九十百千万半]+(?=[个枚颗发层次秒米点种倍])/g, (number) => {
      result.warnings.push(`UNVERIFIED_DESCRIPTION_NUMBER: ${origin} ${number}; 无逐项结构映射，不采用描述数值。`);
      return UNVERIFIED;
    });
    template.push(sanitized);
    return sanitized;
  }).join("");
  if (resolved) result.descriptionTemplate = [result.descriptionTemplate, template.join("")].filter(Boolean).join("\n");
  return resolved;
}

export function auditActiveSkill(skillId: number, raw: unknown, description: string, result: LegacyTalentLevel, origin: string): string {
  const bindings: Record<string, string> = {};
  if (raw === undefined) result.warnings.push(`MISSING_ACTIVE_SKILL: ${origin} -> ${source("activeSkills", String(skillId))}`);
  else {
    const active = activeSkillSchema.parse(raw);
    if (active.AbilityID !== skillId) throw new Error(`Active skill identity mismatch: ${skillId} != ${active.AbilityID}`);
    for (const field of ["Duration", "CooldownDuration"] as const) {
      const value = active[field];
      const at = `${origin} -> ${source("activeSkills", String(skillId), field)}`;
      if (value === undefined) result.warnings.push(`MISSING_ACTIVE_SKILL_FIELD: ${at}`);
      else result.facts.push({ label: field === "Duration" ? "主动技能 Duration（结构值）" : "基础冷却/充能时间 CooldownDuration", value: `${value} 秒`, source: at });
    }
    result.warnings.push(`ACTIVE_DURATION_SCOPE: ${source("activeSkills", String(skillId), "Duration")} 仅记录结构值；零值不等于无持续效果，未与激光、区域或聚能延长时间等同。`);
    const plain = description.replace(/<[^>]*>/g, "");
    // Reviewed exact SkillDes identities: a standalone cooldown line, not an effect interval.
    const cooldownLine = /(^|\n)([·\s]*冷却[：:]\s*)(\d+(?:\.\d+)?)(秒[。.]?)(?=\n|$)/g;
    const matches = [...plain.matchAll(cooldownLine)];
    if ([6001301, 6001401, 6002301].includes(skillId) && result.level === 1 && active.CooldownDuration !== undefined && matches.length === 1) {
      bindings["{LegacyActive:CooldownDuration}"] = String(active.CooldownDuration);
      description = plain.replace(cooldownLine, "$1$2{LegacyActive:CooldownDuration}$4");
      result.warnings.push(`BOUND_ACTIVE_COOLDOWN: ${origin} SkillDes 冷却行 -> ${source("activeSkills", String(skillId), "CooldownDuration")}; 描述原值=${matches[0][3]}，采用结构值=${active.CooldownDuration}。`);
    }
  }
  return sanitizeDescription(description, result, origin, bindings);
}

// These names are explicit identity-bearing parameters, not a numeric-ID range heuristic.
const modifierNames = new Set(["ModifierId", "ModifyID", "CharacterModifierList", "DeathStare", "ExtraShieldID", "SteelFrame", "SlowDownID", "MoJinFu", "ModifyID_XTHX"]);

function auditConfig(result: LegacyTalentLevel, key: string, raw: unknown, origin: string) {
  const config = configSchema.parse(raw);
  if (String(config.ConfigId) !== key) throw new Error(`Config identity mismatch: ${key}`);
  let count = 0;
  for (const [index, parameter] of config.Parameters.entries()) {
    const at = `${origin} -> ${source("params", key, `Parameters[${index}]`)}`;
    result.facts.push({ label: parameter.Name, value: parameter.Value, source: at });
    count++;
    if (parameter.Type === "EMGEParameterType::SkillModifierList") {
      // This export uses flat (SkillID,Name,Value) tuples. Reject schema drift instead of guessing.
      const tuple = /\(SkillID=(\d+),Name=([A-Za-z0-9_]+),Value=([-+\d.eE]+)\)/g;
      const matches = [...parameter.Value.matchAll(tuple)];
      if (!matches.length || `(${matches.map((match) => match[0]).join(",")})` !== parameter.Value) {
        result.warnings.push(`UNPARSED_STRUCTURED_PARAMETER: ${at}`);
        continue;
      }
      for (const match of matches) {
        if (modifierNames.has(match[2])) addModifier(result, Number(match[3]), result.level, `${at}.SkillID=${match[1]}.${match[2]}`);
        else if (/NumericalID/i.test(match[2])) result.warnings.push(`NON_MODIFIER_NUMERICAL: ${at}.${match[2]}=${match[3]}; 不是 Num Modifier 身份，不推测伤害公式。`);
      }
    } else if (modifierNames.has(parameter.Name)) {
      if (!/^\d+(?:[;,]\d+)*$/.test(parameter.Value)) result.warnings.push(`UNPARSED_MODIFIER_REFERENCE: ${at}`);
      else for (const id of parameter.Value.split(/[;,]/)) addModifier(result, Number(id), result.level, at);
    } else if (/NumericalID/i.test(parameter.Name)) {
      result.warnings.push(`NON_MODIFIER_NUMERICAL: ${at}; 不是 Num Modifier 身份，不推测伤害公式。`);
    }
  }
  for (const [field, value] of Object.entries(config)) {
    if (field.endsWith("Parameters") && field !== "Parameters" && Array.isArray(value) && value.length) {
      result.warnings.push(`UNTRAVERSED_CONFIG_FIELD: ${source("params", key, field)}`);
    }
  }
  if (!count) result.warnings.push(`EMPTY_CURRENT_CONFIG: ${source("params", key)} 无参数；未采用旧 MGEConfig_Season 同 ID 配置。`);
  else result.warnings.push(`CURRENT_CONFIG_ONLY: ${source("params", key)} 参数未声明天赋等级公式；只记录原值，不推定缩放或历史版本效果。`);
}

export function resolveApplicableWeapons(tables: Evidence["tables"], phase: number, adaptWeapon: number | undefined): string | undefined {
  if (!tables.adaptWeapons) return undefined; // Older offline snapshots do not contain this evidence.
  if (!adaptWeapon) throw new Error(`MISSING_ADAPT_WEAPON: phase ${phase} root has no AdaptWeapon identity`);
  const schema = z.object({ SeasonID: z.number(), SeasonPhaseID: z.number(), TextID: z.number(), TextContent: textSchema });
  const rows = Object.values(tables.adaptWeapons).map(row => schema.parse(row))
    .filter(row => row.SeasonID === 1 && row.SeasonPhaseID === phase && row.TextID === adaptWeapon);
  if (rows.length !== 1) throw new Error(`MISSING_ADAPT_WEAPON: phase ${phase}, TextID=${adaptWeapon}; expected one exact row`);
  const text = localText(rows[0].TextContent).replace(/<[^>]*>/g, "").replace(/^\s*适配武器\s*[：:]\s*/, "").trim();
  if (!text) throw new Error(`MISSING_ADAPT_WEAPON: empty TextContent for phase ${phase}, TextID=${adaptWeapon}`);
  return text;
}

export function buildTrees(evidence: Evidence): LegacyTalentTree[] {
  const phase = evidence.season === "s0" ? 0 : 1;
  const basics = Object.entries(evidence.tables.basic).map(([key, value]) => ({ key, row: basicSchema.parse(value) }));
  const trees: LegacyTalentTree[] = NAMES[evidence.season].map(([id, name], typeIndex) => {
    const type = typeIndex + 1;
    const structure = Object.values(evidence.tables[`structure${type}` as "structure1" | "structure2" | "structure3"]).map((value) => structureSchema.parse(value))
      .filter((row) => row.SeasonID === 1 && row.SeasonPhaseID === phase).sort((a, b) => a.PhaseID - b.PhaseID);
    if (structure.length !== 7 || structure.some((row, index) => row.PhaseID !== index + 1)) throw new Error(`${id}: expected seven structure phases`);
    const typeRows = Object.values(evidence.tables.types).map((value) => typeSchema.parse(value)).filter((row) => row.SeasonID === 1 && row.SeasonPhaseID === phase && row.TalentType === type);
    if (typeRows.length !== 1) throw new Error(`${id}: ambiguous type`);
    const nodes = structure.flatMap((row) => Array.from({ length: 9 }, (_, index) => ({ column: index + 1, id: row[`TalentColumn${index + 1}`] })).filter((cell) => cell.id > 0).map((cell) => {
      const levels = basics.filter(({ row: basic }) => basic.SeasonID === 1 && basic.SeasonPhaseID === phase && basic.TalentType === type && basic.TalentID === cell.id).sort((a, b) => a.row.TalentILevel - b.row.TalentILevel);
      if (!levels.length || levels.some(({ row: basic }, index) => basic.TalentILevel !== index + 1 || basic.PhaseID !== row.PhaseID || basic.ColumnID !== cell.column)) throw new Error(`${id}/${cell.id}: missing or inconsistent Basic levels`);
      const first = levels[0].row;
      return {
        id: String(cell.id), name: row.PhaseID === 1 ? name : localText(first.TalentName), phase: row.PhaseID, column: cell.column,
        maxLevel: levels.length, isRoot: row.PhaseID === 1, icon: icon(first.TalentIcon),
        afterIds: first.AfterTalentID.split(";").filter(Boolean), skillIds: [...new Set(levels.flatMap(({ row }) => skillIds(row)))],
        levels: levels.map(({ key, row: basic }) => {
          const result: LegacyTalentLevel = { level: basic.TalentILevel, description: "", modifierRows: [], facts: [], warnings: [] };
          const descriptions: string[] = [];
          for (const field of ["TalentSkillsID", "AttributeSkillsID", "SeasonSkill"] as const) {
            const skillId = basic[field];
            if (!skillId) continue;
            const origin = `${source("basic", key, field)}=${skillId}`;
            result.facts.push({ label: field, value: String(skillId), source: source("basic", key, field), evidenceKind: "basic-identity", historicalEffectStatus: "unverified" });
            if (field === "SeasonSkill") {
              const matches = Object.entries(evidence.tables.skillDescriptions).filter(([, raw]) => {
                const row = skillDescriptionSchema.parse(raw);
                return row.SkillId === skillId && Number(localText(row.SkillLevel)) === result.level;
              });
              if (matches.length !== 1) result.warnings.push(`MISSING_SKILL_DESCRIPTION: ${origin}; Level=${result.level}`);
              descriptions.push(auditActiveSkill(skillId, evidence.tables.activeSkills[String(skillId)], matches.length === 1 ? localText(skillDescriptionSchema.parse(matches[0][1]).SkillDescription) : "", result,
                matches.length === 1 ? `${origin} -> ${source("skillDescriptions", matches[0][0])}` : origin));
            } else {
              const firstFactIndex = result.facts.length;
              const config = evidence.tables.params[String(skillId)];
              if (config) auditConfig(result, String(skillId), config, origin);
              else result.warnings.push(`MISSING_CURRENT_CONFIG: ${origin} -> ${source("params", String(skillId))}; 不使用旧表同 ID 替代。`);
              const matches = Object.entries(evidence.tables.mgeDescriptions).filter(([, raw]) => {
                const row = mgeDescriptionSchema.parse(raw);
                return row.MGEId === skillId && row.TextID === result.level;
              });
              if (matches.length !== 1) result.warnings.push(`MISSING_MGE_DESCRIPTION: ${origin}; TextID=${result.level}; 不回退其他等级描述。`);
              else descriptions.push(sanitizeDescription(localText(mgeDescriptionSchema.parse(matches[0][1]).MGEDescription), result, `${origin} -> ${source("mgeDescriptions", matches[0][0])}`));
              if (config && matches.length === 1) {
                const conflict = reviewSemanticConflict({ season: evidence.season, nodeId: String(basic.TalentID), level: result.level, mgeId: skillId,
                  parameters: configSchema.parse(config).Parameters, description: localText(mgeDescriptionSchema.parse(matches[0][1]).MGEDescription),
                  parameterSource: source("params", String(skillId)), descriptionSource: source("mgeDescriptions", matches[0][0]) });
                if (conflict) {
                  (result.semanticConflicts ??= []).push(conflict);
                  result.warnings.push(`CURRENT_ID_SEMANTIC_CONFLICT: ${conflict.id}; ${conflict.summary} ${conflict.parameterSource} <> ${conflict.descriptionSource}`);
                  for (const fact of result.facts.slice(firstFactIndex)) {
                    if (fact.evidenceKind === "current-description-token") continue;
                    fact.historicalEffectStatus = "semantic-conflict";
                    fact.conflictIds = [conflict.id];
                  }
                }
              }
            }
          }
          if (!skillIds(basic).length) result.warnings.push(`MISSING_SKILL_IDENTITY: ${source("basic", key)}`);
          for (const fact of result.facts) {
            fact.evidenceKind ??= "current-same-id";
            fact.historicalEffectStatus ??= "unverified";
          }
          result.warnings.push("CURRENT_IDENTITY_NOT_HISTORICAL: 当前 Main/Num/主动技能事实及描述 Token 均仅为当前同 ID 配置；同 ID 不证明旧节点效果身份延续，未抽查项亦未确认历史效果。");
          result.description = descriptions.filter(Boolean).join("\n") || "当前配置缺少该等级描述。";
          result.warnings = [...new Set(result.warnings)];
          return result;
        }),
      };
    }));
    const nodeIds = new Set(nodes.map((node) => node.id));
    if (nodeIds.size !== nodes.length || nodes.filter((node) => node.isRoot).length !== 1) throw new Error(`${id}: duplicate nodes or roots`);
    for (const node of nodes) for (const afterId of node.afterIds) if (!nodeIds.has(afterId)) throw new Error(`${id}: dangling edge ${node.id} -> ${afterId}`);
    const notes = [
      "结构来源：主 Content，SeasonID=1，SeasonPhaseID=" + phase + `，Structure${type} 的七行；仅纳入结构节点。`,
      "名称与录像确认状态按任务提供的人工审定；当前 Main 表与已提交 Num Lock 仅代表当前配置，不是历史赛季数值。",
      "当前同 ID 配置（非历史效果）：同 ID 不证明节点效果身份延续；已发现多处参数与描述语义冲突，未抽查节点也不能默认认定为历史效果。",
      "historicalStatus 仅表示分支出现情况；节点、连线与录像尚未逐项核对，不表示全部节点 video-confirmed。",
      "图标使用原始 asset basename；缺图允许客户端 fallback，atlas 裁切与图标对应关系尚待人工视觉核实。",
      "描述数字不作配置真值；技术事实未推导未确证公式。GPToken 与参数链分别保留确切身份，冲突不合并。",
    ];
    if (id === "mechanical-dance") notes.push("人工名称 override：主 Basic root「重机枪模式」按用户录像名称改为「机械之舞」。");
    if (id === "destruction-dream") notes.push("用户提供录像未见此树；保留主结构配置，但历史上线状态未确认。");
    const root = basics.find(({ row }) => row.TalentID === Number(nodes.find(node => node.isRoot)!.id) && row.TalentILevel === 1)!.row;
    const applicableWeapons = resolveApplicableWeapons(evidence.tables, phase, root.AdaptWeapon);
    return { season: evidence.season, id, name, subtitle: localText(typeRows[0].TypeText), icon: icon(typeRows[0].TypeIcon), nodeCount: nodes.length, nodes,
      ...(applicableWeapons ? { applicableWeapons } : {}),
      historicalStatus: id === "destruction-dream" ? "unconfirmed" : "video-confirmed", evidenceNotes: notes };
  });
  return applyLegacyValueReviews(trees, evidence.valueEvidence);
}

export function readEvidence(season: LegacyTalentSeason, root = process.cwd(), options: { tabooScriptFile?: string } = {}): Evidence {
  const phase = season === "s0" ? 0 : 1;
  const sources: Evidence["sources"] = [];
  const tables = {} as Evidence["tables"];
  for (const [name, path] of Object.entries(INPUT_PATHS) as [TableName, string][]) {
    const file = readFileSync(join(root, "refs/Exports/NZM/Content/DataTables", path));
    sources.push({ path: `NZM/Content/DataTables/${path}`, sha256: createHash("sha256").update(file).digest("hex") });
    const exports = z.array(z.object({ Rows: z.record(z.string(), z.unknown()).optional() })).parse(JSON.parse(file.toString("utf8")));
    const table = exports.find((entry) => entry.Rows)?.Rows;
    if (!table) throw new Error(`Missing Rows: ${path}`);
    tables[name] = table;
  }
  const basicRows = Object.entries(tables.basic).filter(([, raw]) => { const row = basicSchema.parse(raw); return row.SeasonID === 1 && row.SeasonPhaseID === phase && row.TalentType >= 1 && row.TalentType <= 3; });
  tables.basic = Object.fromEntries(basicRows);
  const ids = new Set(basicRows.flatMap(([, raw]) => skillIds(basicSchema.parse(raw))));
  tables.params = Object.fromEntries(Object.entries(tables.params).filter(([key]) => ids.has(Number(key))));
  tables.mgeDescriptions = Object.fromEntries(Object.entries(tables.mgeDescriptions).filter(([, raw]) => ids.has(Number((raw as Record<string, unknown>).MGEId))));
  tables.skillDescriptions = Object.fromEntries(Object.entries(tables.skillDescriptions).filter(([, raw]) => ids.has(Number((raw as Record<string, unknown>).SkillId))));
  const activeIds = new Set(basicRows.map(([, raw]) => basicSchema.parse(raw).SeasonSkill).filter((id) => id > 0));
  tables.activeSkills = Object.fromEntries(Object.entries(tables.activeSkills).filter(([key]) => activeIds.has(Number(key))));
  for (const name of ["types", "structure1", "structure2", "structure3", "adaptWeapons"] as const) tables[name] = Object.fromEntries(Object.entries(tables[name] ?? {}).filter(([, raw]) => {
    const row = raw as Record<string, unknown>; return row.SeasonID === 1 && row.SeasonPhaseID === phase;
  }));
  const selected = new Set<number>();
  for (const name of ["structure1", "structure2", "structure3"] as const) for (const raw of Object.values(tables[name])) {
    const row = structureSchema.parse(raw); for (let column = 1; column <= 9; column++) if (row[`TalentColumn${column}`]) selected.add(row[`TalentColumn${column}`]);
  }
  const excluded: Evidence["excluded"] = [];
  for (const [key, raw] of basicRows) {
    const row = basicSchema.parse(raw);
    if (selected.has(row.TalentID)) continue;
    const existing = excluded.find((item) => item.id === String(row.TalentID));
    if (existing) existing.basicRows.push(key);
    else excluded.push({ id: String(row.TalentID), name: localText(row.TalentName), basicRows: [key], reason: "Basic 存在，但该赛季 Structure1/2/3 未选择；不进入树。" });
  }
  const valueEvidence = season === "s0"
    ? { s0: compactS0ReviewEvidence(readS0ReviewEvidence(root)) }
    : { s1: compactS1ReviewEvidence(readS1ReviewInput(root, options)) };
  return { schemaVersion: 1, season, sources, tables, excluded, valueEvidence, visualVerification: {
    nodes: "not-verified", basis: "仅有用户提供的分支录像结论，未独立逐项核验录像节点。", assets: [],
  } };
}

export function projectLegacyTalents() {
  // Replay both snapshots before writing: invalid S1 evidence must not leave S0 updated.
  const projections = (["s0", "s1"] as const).map(season => {
    const evidence: Evidence = JSON.parse(readFileSync(join(process.cwd(), "data/season-talents", season, "audit.json"), "utf8"));
    if (evidence.schemaVersion !== 1 || evidence.season !== season) throw new Error(`${season}: invalid evidence snapshot`);
    return { season, trees: buildTrees(evidence) };
  });
  for (const { season, trees } of projections) {
    writeFileSync(join(process.cwd(), "data/season-talents", season, "trees.json"), JSON.stringify(trees, null, 2) + "\n");
    console.log(`${season}: replayed committed evidence and current Numerical Lock.`);
  }
}

export function extract(options: { tabooScriptFile?: string; assetPath?: string } = {}) {
  const { tabooScriptFile, assetPath } = options;
  const priorPath = join(process.cwd(), "data/season-talents/s1/audit.json");
  if (!tabooScriptFile && existsSync(priorPath)) {
    const prior: Evidence = JSON.parse(readFileSync(priorPath, "utf8"));
    if (prior.valueEvidence?.s1?.taboo) throw new Error("S1_BLUEPRINT_REQUIRED: pass --s1-taboo-script=<ReadScriptData export> to preserve the reviewed execution evidence.");
  }
  // Validate both seasons before overwriting either projection.
  const inputs = (["s0", "s1"] as const).map(season => readEvidence(season, process.cwd(), { tabooScriptFile }));
  const projections = inputs.map(evidence => {
    const trees = buildTrees(evidence);
    evidence.semanticReview = summarizeSemanticReview(trees);
    if (assetPath) {
      const assets = z.array(z.object({ name: z.string(), missing: z.boolean().optional(), review: z.object({ nodeId: z.string(), videoSeconds: z.number() }).optional() })).parse(JSON.parse(readFileSync(assetPath, "utf8")));
      const names = new Set(trees.flatMap((tree) => [tree.icon, ...tree.nodes.map((node) => node.icon)]).map((path) => path.split("/").at(-1)!.replace(/\.webp$/, "")));
      evidence.visualVerification.assets = assets.filter((asset) => names.has(asset.name)).map((asset) => ({ name: asset.name, status: asset.missing ? "missing" : asset.review ? "video-matched" : "pending-visual-review" }));
    }
    return { evidence, trees };
  });
  for (const { evidence, trees } of projections) {
    const season = evidence.season;
    for (const [name, data] of [["trees.json", trees], ["audit.json", evidence]] as const) {
      const path = join(process.cwd(), "data/season-talents", season, name);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
    }
    console.log(`${season}: ${trees.map((tree) => `${tree.id}=${tree.nodeCount}`).join(", ")}; excluded=${evidence.excluded.length}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) extract({
  tabooScriptFile: process.argv.find(arg => arg.startsWith("--s1-taboo-script="))?.slice("--s1-taboo-script=".length),
  assetPath: process.argv.find(arg => arg.startsWith("--assets="))?.slice("--assets=".length),
});
