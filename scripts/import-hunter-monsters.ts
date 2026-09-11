/** Reviewed hunter monster identities + explicit plan rows; never guesses missing multipliers. */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import matter from "gray-matter";
import manifest from "../data/enemies/lc/monsters/import-sources.json";
import { BOSS_DIFFICULTIES } from "../lib/boss-health";
import { MONSTER_KINDS, type HunterMonster, type MonsterAppearance } from "../lib/hunter-monster-health";
import type { BossDifficulty } from "../types";

type Text = { LocalizedString?: string; SourceString?: string };
type Mode = { map_name: Text; dungeonid_list: string };
type Entrance = { quest_id: number; attribute_type: number; dungeon_monster_level: number; dungeon_difficulty_des: Text; monster_tips_id: string };
type Quest = { DungeonID: number; MonsterPlanID: number; OrderID: number; AreaDisplayName: Text };
type Plan = { MonsterPlanID: number; UniqueMonsterID: number; Health: number };
type Identity = { Name: string; MonsterType: number; NarrativeContent: string; bShouldCook: boolean };
type Attribute = { AttributeType: number; MonsterType: number; MonsterLevel: number; MaxHealth: number };
type RecordEvidence = { difficulty: BossDifficulty; area: string; plan_id: number; plan_health: number; max_health: number; health: number };

const root = process.cwd();
const output = path.join(root, "data/enemies/lc/monsters");
const tableDir = path.join(root, "refs/Exports/NZM/Content/DataTables");
function readRows<T>(file: string): Record<string, T> {
  const value = JSON.parse(fs.readFileSync(path.join(tableDir, `${file}.json`), "utf8"));
  const rows = (Array.isArray(value) ? value[0] : value).Rows;
  if (!rows) throw new Error(`Missing table rows: ${file}`);
  return rows;
}
const localized = (text: Text) => text.LocalizedString ?? text.SourceString ?? "";

export function explicitHealth(base: number, matches: Plan[], maxHealth: number): number | undefined {
  if (!matches.length) return undefined;
  if (matches.length !== 1) throw new Error("Ambiguous monster plan rows");
  if (![base, matches[0].Health, maxHealth].every(value => Number.isFinite(value) && value > 0)) {
    throw new Error("Invalid monster health factor");
  }
  return Math.round(base * matches[0].Health * maxHealth);
}

function collect() {
  const modes = readRows<Mode>("LuaDataTable/HunterModeinfoTable");
  const entrances = readRows<Entrance>("System/Dungeon/NewEntranceInfoTable");
  const tips = readRows<{ monster_ids: string; elite_ids: string }>("System/Dungeon/DungeonMonsterTipsTable");
  const quests = Object.values(readRows<Quest>("HunterIntraquestTable"));
  const plans = Object.values(readRows<Plan>("HunterIntraMonsterTable"));
  const unique = readRows<Identity>("MonsterUniqueIDTable");
  const base = readRows<{ Health: number }>("HunterBaseMonsterTable");
  const attrs = Object.values(readRows<Attribute>("MonsterAttrTypeConfig"));
  const entranceIds = [...new Set(Object.values(modes).filter(row => localized(row.map_name) === manifest.map).flatMap(row => row.dungeonid_list.split(";")))];
  for (const id of entranceIds) if (!entrances[id]) throw new Error(`Missing entrance ${id}`);
  const scopes = BOSS_DIFFICULTIES.map(({ value: difficulty, label }) => {
    const matches = entranceIds.filter(id => localized(entrances[id].dungeon_difficulty_des) === label);
    if (matches.length !== 1) throw new Error(`${manifest.map}/${label}: ${matches.length} entrances`);
    const entrance = entrances[matches[0]];
    const tasks = quests.filter(q => q.DungeonID === entrance.quest_id).sort((a, b) => a.OrderID - b.OrderID);
    if (!tasks.length) throw new Error(`${label}: no quest plans`);
    return { difficulty, entranceId: Number(matches[0]), entrance, tasks };
  });
  const planIds = new Set(scopes.flatMap(scope => scope.tasks.map(q => q.MonsterPlanID)));
  const scopedIds = new Set(plans.filter(p => planIds.has(p.MonsterPlanID)).map(p => p.UniqueMonsterID));
  const covered = new Set([...manifest.monsters.map(m => m.id), ...manifest.exclusions.map(m => m.id)]);
  for (const scope of scopes) {
    const tip = tips[scope.entrance.monster_tips_id];
    if (!tip) throw new Error(`Missing monster tips ${scope.entrance.monster_tips_id}`);
    for (const id of `${tip.monster_ids}|${tip.elite_ids}`.split("|").filter(Boolean).map(Number)) {
      if (!covered.has(id)) throw new Error(`Unreviewed map-tip identity ${id}`);
    }
  }
  if (covered.size !== manifest.monsters.length + manifest.exclusions.length) throw new Error("Duplicate reviewed identity");
  if (new Set(manifest.monsters.map(m => m.slug)).size !== manifest.monsters.length) throw new Error("Duplicate monster slug");
  for (const id of covered) if (!scopedIds.has(id) && !manifest.monsters.some(m => m.id === id && "appearance_source" in m)) throw new Error(`Reviewed identity missing from map plans: ${id}`);
  for (const id of scopedIds) if (!covered.has(id)) throw new Error(`Unreviewed identity ${id}: ${unique[id]?.Name ?? "unnamed"}`);
  const kinds = { 3: "normal", 4: "captain", 5: "elite" } as const;
  const entries: { file: string; data: HunterMonster; body: string }[] = [];
  const evidence = {
    schema_version: 1,
    scope: `${manifest.map}；直接计划行及有独立地图证据的怪物，未记录不代表不出现；实际波次完整性尚未确认`,
    formula: "Math.round(base_health * plan_health * max_health)",
    sources: { identity: "MonsterUniqueIDTable", base_health: "HunterBaseMonsterTable", plan_health: "HunterIntraMonsterTable", max_health: "MonsterAttrTypeConfig", entrance: "NewEntranceInfoTable", area: "HunterIntraquestTable" },
    entrances: Object.fromEntries(scopes.map(s => [s.difficulty, { id: s.entranceId, quest_id: s.entrance.quest_id, attribute_type: s.entrance.attribute_type, monster_level: s.entrance.dungeon_monster_level }])),
    exclusions: manifest.exclusions,
    monsters: [] as { monster_id: number; title: string; monster_type: number; base_health: number; appearance_source?: string; records: RecordEvidence[] }[],
  };
  for (const item of manifest.monsters) {
    const identity = unique[item.id];
    if (!identity || !identity.bShouldCook || !(identity.MonsterType in kinds)) throw new Error(`Invalid published identity ${item.id}`);
    const kind = kinds[identity.MonsterType as keyof typeof kinds];
    const baseHealth = base[item.id]?.Health;
    if (!Number.isFinite(baseHealth) || baseHealth <= 0) throw new Error(`Missing base health ${item.id}`);
    let image: string | undefined = `/webp/icons/enemies/npc-${item.id}.webp`;
    if (!fs.existsSync(path.join(root, "public", image))) {
      if (!("allow_missing_image" in item && item.allow_missing_image)) throw new Error(`Missing portrait ${item.id}`);
      image = undefined;
    }
    const records: RecordEvidence[] = [];
    const byArea = new Map<string, MonsterAppearance>();
    for (const scope of scopes) {
      const multipliers = attrs.filter(a => a.AttributeType === scope.entrance.attribute_type && a.MonsterLevel === scope.entrance.dungeon_monster_level && a.MonsterType === identity.MonsterType);
      if (multipliers.length !== 1) throw new Error(`Ambiguous attribute multiplier ${item.id}/${scope.difficulty}`);
      for (const q of scope.tasks) {
        const matches = plans.filter(p => p.MonsterPlanID === q.MonsterPlanID && p.UniqueMonsterID === item.id);
        const health = explicitHealth(baseHealth, matches, multipliers[0].MaxHealth);
        if (health === undefined) continue;
        const area = localized(q.AreaDisplayName);
        if (!byArea.has(area)) byArea.set(area, { map: manifest.map, area, health: {}, source_plans: {} });
        const row = byArea.get(area)!;
        if (row.health[scope.difficulty] !== undefined) throw new Error(`Duplicate area ${item.id}/${scope.difficulty}/${area}`);
        row.health[scope.difficulty] = health;
        row.source_plans[scope.difficulty] = q.MonsterPlanID;
        records.push({ difficulty: scope.difficulty, area, plan_id: q.MonsterPlanID, plan_health: matches[0].Health, max_health: multipliers[0].MaxHealth, health });
      }
    }
    const appearances = [...byArea.values()].sort((a, b) => manifest.areas.indexOf(a.area) - manifest.areas.indexOf(b.area));
    if (appearances.some(row => !manifest.areas.includes(row.area))) throw new Error(`Unreviewed area ${item.id}`);
    if (!appearances.length && "unknown_area" in item && item.unknown_area) appearances.push({ map: manifest.map, area: item.unknown_area, health: {}, source_plans: {} });
    if (!appearances.length) throw new Error(`No evidenced appearances ${item.id}`);
    const file = path.join(output, `${item.slug}.mdx`);
    const existing = fs.existsSync(file) ? matter(fs.readFileSync(file, "utf8")) : null;
    const narrative = identity.NarrativeContent;
    const data: HunterMonster = { ...existing?.data, slug: item.slug, title: item.title, monster_id: item.id, kind, image, description: narrative && narrative !== "None" ? narrative : `${manifest.map}${MONSTER_KINDS[kind]}怪物`, appearances };
    if (!image) delete data.image;
    const body = existing?.content ?? `\n血量按地图、难度与区域分别记录。未确认的数值标为待核实，不代表该怪物不出现。\n`;
    entries.push({ file, data, body });
    evidence.monsters.push({ monster_id: item.id, title: item.title, monster_type: identity.MonsterType, base_health: baseHealth, ...("appearance_source" in item ? { appearance_source: item.appearance_source } : {}), records });
  }
  return { entries, evidence };
}

function main() {
  const mode = process.argv[2] ?? "--dry-run";
  if (!["--dry-run", "--check", "--write"].includes(mode)) throw new Error("Use --dry-run, --check or --write");
  const { entries, evidence } = collect();
  let differences = 0;
  for (const entry of entries) {
    const previous = fs.existsSync(entry.file) ? matter(fs.readFileSync(entry.file, "utf8")).data : null;
    const data: Partial<HunterMonster> = { ...entry.data };
    delete data.slug;
    if (JSON.stringify(previous) !== JSON.stringify(data)) {
      differences++;
      if (mode === "--write") fs.writeFileSync(entry.file, matter.stringify(entry.body, data));
    }
    console.log(`${entry.data.title} (${entry.data.monster_id}): ${entry.data.appearances.length} areas, ${entry.data.appearances.reduce((n, r) => n + Object.keys(r.health).length, 0)} values`);
  }
  const evidenceFile = path.join(output, "evidence.json");
  const previous = fs.existsSync(evidenceFile) ? JSON.parse(fs.readFileSync(evidenceFile, "utf8")) : null;
  if (JSON.stringify(previous) !== JSON.stringify(evidence)) {
    differences++;
    if (mode === "--write") fs.writeFileSync(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`);
  }
  console.log(`${mode}: ${entries.length} monsters; ${differences} changed files; ${evidence.monsters.reduce((n, m) => n + m.records.length, 0)} explicit health values.`);
  if (mode === "--check" && differences) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
