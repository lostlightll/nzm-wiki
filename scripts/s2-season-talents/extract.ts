import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { s2PrerequisiteGroups, type S2TalentTree } from "../../lib/s2-season-talent-builder";
import { S2_DESCRIPTIONS, S2_PROPERTY_BINDINGS, S2_AUDIT_NOTES } from "./descriptions";

type Text = { LocalizedString?: string; SourceString?: string };
type Asset = { AssetPathName: string };
interface Basic {
  UniqueID: number; SeasonID: number; TalentType: number; TalentID: number;
  TalentILevel: number; TalentName: Text; TalentIcon: Asset; PhaseID: number;
  ColumnID: number; BeforeTalentID: string; TalentUpgradeMaterial: string;
  Group: number; MutualGroup: string; SeasonSkill: number; TalentSkillsID: number; AdaptWeapon: number;
}
interface Kind { SeasonID: number; TalentType: number; TypeName: Text; TypeText: Text; TypeIcon: Asset }
interface Passive { SeasonID: number; PassiveSkillType: number; TalentID: number; PassiveSkillName: Text; PassiveSkillIcon: Asset; PassiveSkillsID: number }
interface Parameter { Name: string; Value: string }
const root = path.resolve("refs/Exports/NZM/Content_S2");
const output = path.resolve("data/season-talents/s2");
const imageOutput = path.resolve("public/webp/images/season-talents/s2");
const imageBase = "/webp/images/season-talents/s2";
const check = process.argv.includes("--check");
const sourceHashes: Record<string, string> = {};
function rows<T>(file: string): Record<string, T> {
  const raw = fs.readFileSync(path.join(root, file + ".json"), "utf8");
  sourceHashes[file] = createHash("sha256").update(raw).digest("hex");
  return JSON.parse(raw)[0].Rows;
}
const text = (t: Text) => (t.LocalizedString ?? t.SourceString ?? "").replace(/[\u200b-\u200d\ufeff]/g, "");
const basic = Object.values(rows<Basic>("DataTables/SeasonTalent/SeasonTalentBasicTable")).filter(r => r.SeasonID === 2);
const kinds = Object.values(rows<Kind>("DataTables/SeasonTalent/SeasonTalentTypeTable")).filter(r => r.SeasonID === 2);
const passiveRows = Object.values(rows<Passive>("DataTables/SeasonTalent/SeasonTalentPassiveConfigTable")).filter(r => r.SeasonID === 2);
const phases = Object.values(rows<{ SeasonID: number; TalentType: number; PhaseID: number; UnlockRequire: number }>("DataTables/SeasonTalent/SeasonTalentPhaseTable")).filter(r => r.SeasonID === 2);
const weapons = Object.values(rows<{ SeasonID: number; TextID: number; TextContent: Text }>("DataTables/SeasonTalent/AdaptWeaponTable")).filter(r => r.SeasonID === 2);
const passiveConfig = rows<{ MGEConfig: { Id: string } }>("DataTables/MGE/MGEPassive_Season");
const params = rows<{ Parameters: Parameter[] }>("DataTables/MGE/MGEConfig_Season");
const historical = rows<Record<string, unknown>>("Attributes/AutoGenerate/numerical_modifier_config");
const historicalRows = Object.entries(historical);
const numericalRows: Record<string, Record<string, unknown>> = {};
const descriptionRows = rows<{ MGEDescription: Text }>("DataTables/MGE/DT_GPMGESkillDesConfig_BD");
const activeSkills = rows<Record<string, unknown>>("DataTables/GPActiveSkillDataTable");
const structures = [1, 2, 3].map(type => Object.values(rows<Record<string, number>>(`DataTables/SeasonTalent/SeasonTalentStructure${type}Table`)).filter(row => row.SeasonID === 2));
const assets = new Map<string, string>();
const evidence: Record<string, { rows: string[]; parameters: string[]; descriptionSourceId: number }> = {};
function asset(relative: string, name = path.basename(relative, ".png")) {
  const source = path.join(root, relative);
  if (!fs.existsSync(source)) throw new Error(`Missing S2 image: ${source}`);
  const target = `${name}.webp`;
  if (assets.has(target) && assets.get(target) !== source) throw new Error(`Image collision: ${target}`);
  assets.set(target, source);
  return `${imageBase}/${target}`;
}
function icon(ref: Asset) { return asset(ref.AssetPathName.split(".")[0].replace(/^\/Game\//, "") + ".png"); }
function description(id: number, level: number) {
  const template = [1319032006, 1319032007].includes(id)
    ? text(descriptionRows[`${id}_${level}`].MGEDescription).replace(/<[^>]*>/g, "")
    : S2_DESCRIPTIONS[id];
  if (!template) throw new Error(`Missing reviewed S2 template: ${id}`);
  const ev = { rows: [] as string[], parameters: [] as string[], descriptionSourceId: id };
  const result = template.replace(/\{num:(\d+):(\d+):(base|coefficient):(number|percent|signed-number|signed-percent)\}/g,
    (_, rawId: string, rawIndex: string, field: string, format: string) => {
      const candidates = historicalRows.filter(([, row]) => row.ID === Number(rawId));
      const first = historical[`${rawId}_1_${rawIndex}`];
      if (!first) throw new Error(`Missing baseline ${rawId}:${rawIndex}`);
      const matches = candidates.filter(([, row]) => row.Level === level && row.AttributeName === first.AttributeName);
      if (matches.length !== 1) throw new Error(`Ambiguous or missing S2 level ${rawId}:${level}`);
      const [rowName, row] = matches[0];
      if (row.GPModifierOp !== "B1") throw new Error(`Unreviewed S2 operation: ${rowName}`);
      numericalRows[rowName] = row;
      ev.rows.push(`s2:${rowName}`);
      const value = row[field === "base" ? "BaseValue" : "CoefValue"];
      if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Invalid S2 number: ${rowName}`);
      const amount = Number((value * (format.includes("percent") ? 100 : 1)).toFixed(6));
      return `${format.startsWith("signed") && amount > 0 ? "+" : ""}${amount}${format.includes("percent") ? "%" : ""}`;
    }).replace(/\{param:(\w+)\}/g, (_, key: string) => {
      const configId = passiveConfig[`${id}_${level}`]?.MGEConfig.Id;
      const param = params[configId]?.Parameters.find(p => p.Name === key);
      if (!param || !Number.isFinite(Number(param.Value))) throw new Error(`Missing parameter ${id}:${level}:${key}`);
      ev.parameters.push(`MGEConfig_Season:${configId}:Parameters.${key}`);
      return param.Value;
    }).replace(/\{skill:(\d+):(\w+)\}/g, (_, skill: string, field: string) => {
      const value = activeSkills[skill]?.[field];
      if (typeof value !== "number") throw new Error(`Missing skill property: ${skill}.${field}`);
      ev.parameters.push(`GPActiveSkillDataTable:${skill}.${field}`);
      return String(value);
    }).replace(/\{source:(\w+)\}/g, (_, key: string) => {
      const binding = S2_PROPERTY_BINDINGS[key];
      if (!binding) throw new Error(`Missing source binding: ${key}`);
      const raw = fs.readFileSync(path.join(root, binding.file + ".json"), "utf8");
      sourceHashes[binding.file] = createHash("sha256").update(raw).digest("hex");
      const parsed = JSON.parse(raw);
      const props = binding.buff ? parsed[0].Rows[binding.buff] : parsed.find((o: { Name: string }) => o.Name.startsWith("Default__"))?.Properties;
      const value = props?.[binding.field];
      if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Invalid property ${key}`);
      ev.parameters.push(`${binding.file}:${binding.buff ?? "Default__"}.${binding.field} * ${binding.scale}`);
      return String(Number((value * binding.scale).toFixed(6)));
    });
  evidence[`${id}_${level}`] = ev;
  return result;
}
const slugs = ["invisibility", "inferno-arm", "holographic-sync"];
const hud = "UI/UI_Textures/SeasonalTalent/SeasonalTalentS2/SP";

async function main() {
  const trees: S2TalentTree[] = [];
  for (const kind of kinds) {
    const source = basic.filter(r => r.TalentType === kind.TalentType);
    const ids = [...new Set(source.map(r => r.TalentID))];
    if (ids.length !== 23) throw new Error(`Expected 23 S2 nodes: ${kind.TalentType}`);
    const rootNode = source.find(r => r.SeasonSkill);
    if (!rootNode) throw new Error("Missing S2 root");
    const tree: S2TalentTree = {
      id: slugs[kind.TalentType - 1], name: text(kind.TypeName), subtitle: text(kind.TypeText),
      applicableWeapons: text(weapons.find(r => r.TextID === rootNode.AdaptWeapon)!.TextContent).replace(/<[^>]*>/g, ""),
      icon: icon(kind.TypeIcon), core: asset(`${hud}/T_SeasonalTalentS2_00${kind.TalentType}_Normal.png`),
      pointLimit: 40,
      nodes: ids.map(id => {
        const levels = source.filter(r => r.TalentID === id).sort((a, b) => a.TalentILevel - b.TalentILevel);
        if (levels.some((r, i) => r.TalentILevel !== i + 1)) throw new Error(`Nonconsecutive levels: ${id}`);
        const r = levels[0];
        const structure = structures[kind.TalentType - 1].find(row => row.PhaseID === r.PhaseID);
        if (structure?.[`TalentColumn${r.ColumnID}`] !== id) throw new Error(`S2 structure mismatch: ${id}`);
        const prerequisite = r.BeforeTalentID;
        if (s2PrerequisiteGroups(prerequisite).flat().some(p => !ids.includes(Number(p)))) throw new Error(`Missing prerequisite: ${id}`);
        const phase = phases.find(p => p.TalentType === kind.TalentType && p.PhaseID === r.PhaseID);
        if (!phase) throw new Error(`Missing S2 phase: ${id}`);
        return {
          id: String(id), name: text(r.TalentName), icon: icon(r.TalentIcon), phase: r.PhaseID, column: r.ColumnID,
          maxLevel: levels.length, prerequisite, unlockPoints: phase.UnlockRequire,
          group: r.Group, mutualGroups: r.MutualGroup.split(";").filter(Boolean).map(Number), isRoot: !!r.SeasonSkill,
          costs: levels.map(row => {
            if (!row.TalentUpgradeMaterial && row.SeasonSkill) return 0;
            const match = /^40502000028:(\d+)$/.exec(row.TalentUpgradeMaterial);
            if (!match) throw new Error(`Unknown S2 cost: ${row.UniqueID}`);
            return Number(match[1]);
          }),
          descriptions: levels.map(row => description(row.SeasonSkill || row.TalentSkillsID, row.TalentILevel)),
          sourceIds: levels.map(row => row.UniqueID),
          auditNote: S2_AUDIT_NOTES[r.SeasonSkill || r.TalentSkillsID] ?? null,
        };
      }).sort((a, b) => a.phase - b.phase || a.column - b.column),
      passives: passiveRows.filter(r => r.PassiveSkillType === kind.TalentType).map(r => ({
        id: String(r.TalentID), name: text(r.PassiveSkillName), icon: icon(r.PassiveSkillIcon), sourceId: r.PassiveSkillsID,
        description: description(r.PassiveSkillsID, 1),
      })),
    };
    if (tree.passives.length !== 6) throw new Error(`Expected six passives: ${tree.id}`);
    trees.push(tree);
  }
  const background = asset(`${hud}/T_SeasonalTalentS2_bg_001.png`, "background");
  const logo = asset(`${hud}/T_SeasonalTalentS2_Logo_002.png`, "logo");
  // Original branches are separate transparent layers, not a screenshot reconstruction.
  const decorations = ["002", "003", "004"].map(n => asset(`${hud}/T_SeasonalTalentS2_bg_${n}.png`));
  const markers = [1, 2, 3].map((type, index) => ({
    shell: asset(`${hud}/T_SeasonalTalentS2_00${type}_1.png`),
    glow: asset(`${hud}/T_SeasonalTalentS2_00${type}_Icon.png`),
    title: asset(`${hud}/T_SeasonalTalentS2_bg_00${[7, 8, 6][index]}.png`),
  }));
  const frame = asset(`${hud}/T_SeasonalTalentS2_Selected.png`);
  const files: Record<string, unknown> = Object.fromEntries(trees.map(tree => [tree.id, tree]));
  files.catalog = { background, logo, decorations, markers, frame, trees: trees.map(({ nodes, passives, ...tree }) => ({ ...tree, nodeCount: nodes.length, passiveCount: passives.length })) };
  files.evidence = {
    source: "refs/Exports/NZM/Content_S2", sourceHashes, numericalSource: "Content_S2/Attributes/AutoGenerate/numerical_modifier_config.json", numericalRows,
    pointLimit: { value: 40, status: "Simulator budget, not a verified game cap; exported reward previews do not contain reward quantities" },
    prerequisites: "BeforeTalentID: & = all, | = any; predecessors must be fully allocated; phase thresholds count earlier phases only",
    evidence,
    limitations: "Only Content_S2 is read. Description-only duration values for 1319032006/1319032007 are explicitly labeled, not treated as configuration facts. BeforeTalentID full-level and phase-spend behavior are simulator assumptions; exports contain identities and thresholds, not executable UI rules.",
    conflicts: [
      { source: "MGE_1379020190.Default__.CooldownDuration", configured: 2, described: 1, action: "Use blueprint property; Numerical does not carry this cooldown" },
      { rows: ["111031054_1_0", "111031054_1_1", "111031054_1_2"].map(key => ({ key, raw: historical[key] })), chain: "SKT_S3_YHFS2.DamagePercentBuff -> SeasonTalent_S3_YHFS_004.GPModifyIDs -> 111031054", status: "Historical B5 execution, toughness and impulse rows preserved; no dependency on current season lock. B5 runtime formula is not inferred from description." },
    ],
  };
  if (!check) { fs.mkdirSync(output, { recursive: true }); fs.mkdirSync(imageOutput, { recursive: true }); }
  for (const [name, value] of Object.entries(files)) {
    const target = path.join(output, name + ".json");
    const serialized = JSON.stringify(value, null, 2) + "\n";
    if (check) { if (fs.readFileSync(target, "utf8") !== serialized) throw new Error(`Stale S2 data: ${target}`); }
    else fs.writeFileSync(target, serialized);
  }
  for (const [target, source] of assets) {
    if (check) { if (!fs.existsSync(path.join(imageOutput, target))) throw new Error(`Missing generated S2 image: ${target}`); }
    else await sharp(source).resize({ width: 1920, withoutEnlargement: true }).webp({ quality: 88 }).toFile(path.join(imageOutput, target));
  }
  console.log(`S2 ${check ? "checked" : "extracted"}: ${trees.length} trees, 69 nodes, 18 passive entries, ${assets.size} images.`);
}
void main();
