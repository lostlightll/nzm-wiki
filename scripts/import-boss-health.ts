/**
 * 从游戏导出表计算并写入猎场首领的折磨/超限血量。
 *
 * 默认仅 dry-run：
 *   pnpm exec tsx scripts/import-boss-health.ts
 *   pnpm exec tsx scripts/import-boss-health.ts --map 昆仑神宫 --difficulty torment
 *   pnpm exec tsx scripts/import-boss-health.ts --difficulty all --write
 */

import fs from "fs";
import path from "path";
import matter from "gray-matter";
import healthSourcesData from "@/data/enemies/lc/boss/health-sources.json";
import { LC_MAPS } from "@/lib/lc-maps";
import type { BossDifficulty, BossHealthValue } from "@/types";

type ImportDifficulty = Extract<BossDifficulty, "torment" | "overlimit">;

type RowMap<T> = Record<string, T>;

interface LocalizedText {
  SourceString?: string;
  LocalizedString?: string;
}

interface ModeRow {
  map_name?: LocalizedText;
  dungeonid_list?: string;
}

interface EntranceRow {
  dungeon_difficulty_des?: LocalizedText;
  quest_id?: number;
  attribute_type?: number;
  dungeon_monster_level?: number;
}

interface QuestRow {
  DungeonID?: number;
  MonsterPlanID?: number;
}

interface PlanMonsterRow {
  MonsterPlanID?: number;
  UniqueMonsterID?: number;
  Health?: number;
}

interface UniqueMonsterRow {
  Name?: string;
  MonsterType?: number;
}

interface BaseMonsterRow {
  Health?: number;
}

interface AttributeRow {
  AttributeType?: number;
  MonsterType?: number;
  MonsterLevel?: number;
  MaxHealth?: number;
}

interface HealthSource {
  map: string;
  stages: number[];
}

interface Calculation {
  slug: string;
  map: string;
  difficulty: ImportDifficulty;
  stage: number;
  sourceId: number;
  baseHealth: number;
  planHealth: number;
  difficultyHealth: number;
  value: number;
}

interface ScopeResult {
  map: string;
  difficulty: ImportDifficulty;
  values: Map<string, BossHealthValue>;
  calculations: Calculation[];
  extras: string[];
  blockers: string[];
}

const ROOT = process.cwd();
const TABLE_DIR = path.join(ROOT, "refs", "Exports", "NZM", "Content", "DataTables");
const BOSS_DIR = path.join(ROOT, "data", "enemies", "lc", "boss");
const HEALTH_SOURCES = healthSourcesData as Record<string, HealthSource>;
const MULTI_PHASE_SLUGS = new Set([
  "幽魂骑士",
  "芮文",
  "精绝女王",
  "终蔫之樱",
  "鬼面将军",
]);
const DIFFICULTY_LABELS: Record<ImportDifficulty, string> = {
  torment: "折磨",
  overlimit: "超限",
};

function readRows<T>(relativePath: string): RowMap<T> {
  const filePath = path.join(TABLE_DIR, relativePath);
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as
    | { Rows?: RowMap<T> }
    | Array<{ Rows?: RowMap<T> }>;
  const root = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!root?.Rows) throw new Error(`Data table rows not found: ${relativePath}`);
  return root.Rows;
}

function localized(value: LocalizedText | undefined): string | undefined {
  return value?.LocalizedString ?? value?.SourceString;
}

function parseArgs(): {
  maps: string[];
  difficulties: ImportDifficulty[];
  write: boolean;
} {
  const args = process.argv.slice(2);
  let mapArg = "all";
  let difficultyArg = "all";
  let write = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--write") {
      write = true;
    } else if (arg === "--map") {
      mapArg = args[++index] ?? "";
    } else if (arg === "--difficulty") {
      difficultyArg = args[++index] ?? "";
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  const allMaps = LC_MAPS.map((map) => map.name);
  const maps = mapArg === "all" ? allMaps : [mapArg];
  for (const map of maps) {
    if (!allMaps.includes(map)) throw new Error(`Unknown map: ${map}`);
  }

  const difficulties: ImportDifficulty[] =
    difficultyArg === "all"
      ? ["torment", "overlimit"]
      : difficultyArg === "torment" || difficultyArg === "overlimit"
        ? [difficultyArg]
        : (() => {
            throw new Error(`Unknown difficulty: ${difficultyArg}`);
          })();

  return { maps, difficulties, write };
}

function validateManifest(): string[] {
  const blockers: string[] = [];
  const files = new Set(
    fs
      .readdirSync(BOSS_DIR)
      .filter((file) => file.endsWith(".mdx"))
      .map((file) => file.replace(/\.mdx$/, "")),
  );

  for (const slug of files) {
    if (!HEALTH_SOURCES[slug]) blockers.push(`来源清单缺少 slug：${slug}`);
  }
  for (const [slug, source] of Object.entries(HEALTH_SOURCES)) {
    if (!files.has(slug)) blockers.push(`来源清单引用不存在的 slug：${slug}`);
    const expected = MULTI_PHASE_SLUGS.has(slug) ? 2 : 1;
    if (source.stages.length !== expected) {
      blockers.push(
        `${slug} 阶段数不符：清单 ${source.stages.length}，预期 ${expected}`,
      );
    }
  }

  return blockers;
}

function calculateScope(
  map: string,
  difficulty: ImportDifficulty,
  tables: {
    modes: RowMap<ModeRow>;
    entrances: RowMap<EntranceRow>;
    quests: RowMap<QuestRow>;
    plans: RowMap<PlanMonsterRow>;
    unique: RowMap<UniqueMonsterRow>;
    base: RowMap<BaseMonsterRow>;
    attributes: RowMap<AttributeRow>;
  },
): ScopeResult {
  const result: ScopeResult = {
    map,
    difficulty,
    values: new Map(),
    calculations: [],
    extras: [],
    blockers: [],
  };
  const sources = Object.entries(HEALTH_SOURCES).filter(
    ([, source]) => source.map === map,
  );
  const entranceIds = Object.values(tables.modes)
    .filter((mode) => localized(mode.map_name) === map)
    .flatMap((mode) => mode.dungeonid_list?.split(";") ?? []);
  const entrances = entranceIds
    .map((id) => tables.entrances[id])
    .filter(
      (row): row is EntranceRow =>
        Boolean(row) &&
        localized(row.dungeon_difficulty_des) === DIFFICULTY_LABELS[difficulty],
    );

  if (difficulty === "overlimit" && entrances.length === 0) {
    for (const [slug] of sources) result.values.set(slug, "unsupported");
    return result;
  }
  if (entrances.length !== 1) {
    result.blockers.push(
      `${map}/${DIFFICULTY_LABELS[difficulty]} 入口数量为 ${entrances.length}，预期 1`,
    );
    return result;
  }

  const entrance = entrances[0];
  const { quest_id: questId, attribute_type: attributeType } = entrance;
  const monsterLevel = entrance.dungeon_monster_level;
  if (
    typeof questId !== "number" ||
    typeof attributeType !== "number" ||
    typeof monsterLevel !== "number"
  ) {
    result.blockers.push(`${map}/${DIFFICULTY_LABELS[difficulty]} 入口字段不完整`);
    return result;
  }

  const planIds = new Set(
    Object.values(tables.quests)
      .filter((quest) => quest.DungeonID === questId)
      .map((quest) => quest.MonsterPlanID)
      .filter((id): id is number => typeof id === "number"),
  );
  if (planIds.size === 0) {
    result.blockers.push(`${map}/${DIFFICULTY_LABELS[difficulty]} 未找到怪物计划`);
    return result;
  }

  const scopePlans = Object.values(tables.plans).filter(
    (row) => typeof row.MonsterPlanID === "number" && planIds.has(row.MonsterPlanID),
  );
  const configuredIds = new Set(sources.flatMap(([, source]) => source.stages));
  const reportedExtraIds = new Set<number>();
  for (const row of scopePlans) {
    const sourceId = row.UniqueMonsterID;
    if (typeof sourceId !== "number" || configuredIds.has(sourceId)) continue;
    const unique = tables.unique[String(sourceId)];
    if (
      unique &&
      typeof unique.MonsterType === "number" &&
      unique.MonsterType >= 6 &&
      !reportedExtraIds.has(sourceId)
    ) {
      result.extras.push(`${unique.Name ?? "未命名"} (${sourceId})`);
      reportedExtraIds.add(sourceId);
    }
  }

  for (const [slug, source] of sources) {
    const sourceMatches = source.stages.map((sourceId) =>
      scopePlans.filter((row) => row.UniqueMonsterID === sourceId),
    );
    if (
      difficulty === "overlimit" &&
      sourceMatches.some((matches) => matches.length === 0)
    ) {
      result.values.set(slug, "unsupported");
      continue;
    }

    const values: number[] = [];
    for (const [stageIndex, sourceId] of source.stages.entries()) {
      const matches = sourceMatches[stageIndex];
      if (matches.length !== 1) {
        result.blockers.push(
          `${slug} 第 ${stageIndex + 1} 阶段来源 ${sourceId} 命中 ${matches.length} 条计划`,
        );
        continue;
      }

      const planHealth = matches[0].Health;
      const baseHealth = tables.base[String(sourceId)]?.Health;
      const unique = tables.unique[String(sourceId)];
      if (typeof planHealth !== "number" || typeof baseHealth !== "number") {
        result.blockers.push(`${slug} 来源 ${sourceId} 缺少基础或计划 Health`);
        continue;
      }
      if (typeof unique?.MonsterType !== "number") {
        result.blockers.push(`${slug} 来源 ${sourceId} 缺少 MonsterType`);
        continue;
      }

      const attributeMatches = Object.values(tables.attributes).filter(
        (row) =>
          row.AttributeType === attributeType &&
          row.MonsterType === unique.MonsterType &&
          row.MonsterLevel === monsterLevel,
      );
      if (attributeMatches.length !== 1) {
        result.blockers.push(
          `${slug} 来源 ${sourceId} 的难度倍率命中 ${attributeMatches.length} 条`,
        );
        continue;
      }

      const difficultyHealth = attributeMatches[0].MaxHealth;
      if (typeof difficultyHealth !== "number") {
        result.blockers.push(`${slug} 来源 ${sourceId} 缺少 MaxHealth`);
        continue;
      }

      const value = Math.round(baseHealth * planHealth * difficultyHealth);
      values.push(value);
      result.calculations.push({
        slug,
        map,
        difficulty,
        stage: stageIndex + 1,
        sourceId,
        baseHealth,
        planHealth,
        difficultyHealth,
        value,
      });
    }
    if (values.length === source.stages.length) result.values.set(slug, values);
  }

  return result;
}

function mergeHealthField(
  data: Record<string, unknown>,
  updates: Partial<Record<BossDifficulty, BossHealthValue>>,
): Record<string, unknown> {
  const previous =
    data.health && typeof data.health === "object"
      ? (data.health as Partial<Record<BossDifficulty, BossHealthValue>>)
      : {};
  const health = { ...previous, ...updates };
  const next: Record<string, unknown> = {};
  let inserted = false;

  for (const [key, value] of Object.entries(data)) {
    if (key === "hp" || key === "hp2") {
      if (!inserted) {
        next.health = health;
        inserted = true;
      }
      continue;
    }
    if (key === "health") {
      next.health = health;
      inserted = true;
    } else {
      next[key] = value;
      if (key === "map" && !inserted && !("hp" in data) && !("health" in data)) {
        next.health = health;
        inserted = true;
      }
    }
  }
  if (!inserted) next.health = health;
  return next;
}

function stringifyMdx(
  content: string,
  data: Record<string, unknown>,
): string {
  let output = matter.stringify(content, data);

  if (content.trim().length === 0) output = output.replace(/\n+$/, "\n");
  return output;
}

function writeResults(results: ScopeResult[]): number {
  const updatesBySlug = new Map<
    string,
    Partial<Record<BossDifficulty, BossHealthValue>>
  >();
  for (const result of results) {
    for (const [slug, value] of result.values) {
      const update = updatesBySlug.get(slug) ?? {};
      update[result.difficulty] = value;
      updatesBySlug.set(slug, update);
    }
  }

  let changed = 0;
  for (const [slug, updates] of updatesBySlug) {
    const filePath = path.join(BOSS_DIR, `${slug}.mdx`);
    const original = fs.readFileSync(filePath, "utf8");
    const parsed = matter(original);
    const data = mergeHealthField(parsed.data, updates);
    const output = stringifyMdx(parsed.content, data);
    if (output !== original) {
      fs.writeFileSync(filePath, output, "utf8");
      changed += 1;
    }
  }
  return changed;
}

function main(): void {
  const options = parseArgs();
  const manifestBlockers = validateManifest();
  const tables = {
    modes: readRows<ModeRow>("LuaDataTable/HunterModeinfoTable.json"),
    entrances: readRows<EntranceRow>("System/Dungeon/NewEntranceInfoTable.json"),
    quests: readRows<QuestRow>("HunterIntraquestTable.json"),
    plans: readRows<PlanMonsterRow>("HunterIntraMonsterTable.json"),
    unique: readRows<UniqueMonsterRow>("MonsterUniqueIDTable.json"),
    base: readRows<BaseMonsterRow>("HunterBaseMonsterTable.json"),
    attributes: readRows<AttributeRow>("MonsterAttrTypeConfig.json"),
  };
  const results = options.maps.flatMap((map) =>
    options.difficulties.map((difficulty) =>
      calculateScope(map, difficulty, tables),
    ),
  );

  console.log(options.write ? "Boss health import" : "Boss health dry-run");
  for (const result of results) {
    console.log(`\n[${result.map} / ${DIFFICULTY_LABELS[result.difficulty]}]`);
    for (const calculation of result.calculations) {
      console.log(
        `${calculation.slug} | stage=${calculation.stage} | source=${calculation.sourceId} | ` +
          `base=${calculation.baseHealth} | plan=${calculation.planHealth} | ` +
          `difficulty=${calculation.difficultyHealth} | health=${calculation.value}`,
      );
    }
    for (const [slug, value] of result.values) {
      if (value === "unsupported") console.log(`${slug} | unsupported`);
    }
    if (result.extras.length > 0) {
      console.log(`Extra monsters ignored: ${result.extras.join("、")}`);
    }
  }

  const blockers = [
    ...manifestBlockers,
    ...results.flatMap((result) => result.blockers),
  ];
  if (blockers.length > 0) {
    console.error("\nBlockers:");
    for (const blocker of blockers) console.error(`- ${blocker}`);
    process.exitCode = 1;
    return;
  }

  const calculated = results.reduce(
    (total, result) => total + result.calculations.length,
    0,
  );
  const unsupported = results.reduce(
    (total, result) =>
      total + [...result.values.values()].filter((value) => value === "unsupported").length,
    0,
  );
  console.log(`\nValidated ${calculated} stage values; ${unsupported} unsupported entries.`);
  if (options.write) {
    console.log(`Updated ${writeResults(results)} MDX files.`);
  } else {
    console.log("No files changed. Add --write after reviewing this output.");
  }
}

main();
