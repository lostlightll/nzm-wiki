/**
 * 从导出的猎场数据中导入经典地图的首领名称、地图归属和图标。
 *
 * 用法：
 *   pnpm exec tsx scripts/import-lc-bosses.ts
 *   pnpm exec tsx scripts/import-lc-bosses.ts --write
 *
 * 不导入血量、攻击或文案。缺少图标的 Boss 会被跳过。
 */

import fs from "fs";
import path from "path";
import matter from "gray-matter";
import sharp from "sharp";

const WRITE = process.argv.includes("--write");
const TARGET_MAPS = new Set(["丛林魅影", "销金之城"]);
const CONTENT_DIR = path.join(process.cwd(), "refs", "Exports", "NZM", "Content");
const DATA_TABLES_DIR = path.join(CONTENT_DIR, "DataTables");
const BOSS_DIR = path.join(process.cwd(), "data", "enemies", "lc", "boss");
const ICON_DIR = path.join(process.cwd(), "public", "icons", "enemies", "lc", "boss");
const WEBP_ICON_DIR = path.join(
  process.cwd(),
  "public",
  "webp",
  "icons",
  "enemies",
  "lc",
  "boss",
);

interface LocalizedText {
  SourceString?: string;
}

interface HunterModeRow {
  map_name?: LocalizedText;
  mode_name?: LocalizedText;
  dungeonid_list?: string;
}

interface EntranceRow {
  quest_id?: number;
}

interface HunterQuestRow {
  DungeonID?: number;
  MonsterPlanID?: number;
}

interface MonsterRow {
  MonsterType?: number;
  Name?: string;
  MonsterIcon?: { AssetPathName?: string };
}

interface BossCandidate {
  title: string;
  maps: string[];
  iconSource: string;
}

interface ExistingBoss {
  title: string;
  maps: string[];
  filePath: string;
}

function readRows<T>(relativePath: string): Record<string, T> {
  const filePath = path.join(DATA_TABLES_DIR, relativePath);
  const data = JSON.parse(fs.readFileSync(filePath, "utf8")) as Array<{
    Rows?: Record<string, T>;
  }>;
  const rows = data[0]?.Rows;

  if (!rows) {
    throw new Error(`Data table rows not found: ${relativePath}`);
  }

  return rows;
}

function normalizeMaps(map: unknown): string[] {
  if (Array.isArray(map)) return map.filter((value): value is string => typeof value === "string");
  return typeof map === "string" ? [map] : [];
}

function getIconSource(assetPath: string | undefined): string | null {
  if (!assetPath || assetPath === "None") return null;

  const packagePath = assetPath.split(".")[0];
  if (!packagePath.startsWith("/Game/")) return null;

  const source = path.join(
    CONTENT_DIR,
    `${packagePath.slice("/Game/".length)}.png`,
  );

  return fs.existsSync(source) ? source : null;
}

function getCandidates(): { candidates: BossCandidate[]; skipped: string[] } {
  const modes = readRows<HunterModeRow>("LuaDataTable/HunterModeinfoTable.json");
  const entrances = readRows<EntranceRow>("System/Dungeon/NewEntranceInfoTable.json");
  const quests = readRows<HunterQuestRow>("HunterIntraquestTable.json");
  const planMonsters = readRows<object>("HunterIntraMonsterTable.json");
  const monsters = readRows<MonsterRow>("MonsterUniqueIDTable.json");
  const mapQuestIds = new Map<string, Set<number>>();

  for (const mode of Object.values(modes)) {
    const map = mode.map_name?.SourceString;
    if (!map || !TARGET_MAPS.has(map) || mode.mode_name?.SourceString !== "经典") {
      continue;
    }

    const questIds = mapQuestIds.get(map) ?? new Set<number>();
    for (const entranceId of mode.dungeonid_list?.split(";") ?? []) {
      const questId = entrances[entranceId]?.quest_id;
      if (typeof questId === "number") questIds.add(questId);
    }
    mapQuestIds.set(map, questIds);
  }

  const candidates = new Map<string, BossCandidate>();
  const skipped = new Set<string>();

  for (const [map, questIds] of mapQuestIds) {
    const planIds = new Set(
      Object.values(quests)
        .filter((quest) => quest.DungeonID && questIds.has(quest.DungeonID))
        .map((quest) => quest.MonsterPlanID)
        .filter((planId): planId is number => typeof planId === "number"),
    );

    for (const planKey of Object.keys(planMonsters)) {
      const [planIdText, monsterId] = planKey.split("_");
      if (!planIds.has(Number(planIdText))) continue;

      const monster = monsters[monsterId];
      const title = monster?.Name;
      if (monster?.MonsterType !== 7 || !title) continue;

      const iconSource = getIconSource(monster.MonsterIcon?.AssetPathName);
      if (!iconSource) {
        skipped.add(`${map}: ${title} (${monsterId})`);
        continue;
      }

      // 同名 Boss 可能属于不同地图并使用不同资源，不能只按显示名合并。
      const candidateKey = `${title}\0${iconSource}`;
      const candidate = candidates.get(candidateKey) ?? {
        title,
        maps: [],
        iconSource,
      };
      if (!candidate.maps.includes(map)) candidate.maps.push(map);
      candidates.set(candidateKey, candidate);
    }
  }

  return {
    candidates: [...candidates.values()].sort((a, b) =>
      a.title.localeCompare(b.title, "zh-CN"),
    ),
    skipped: [...skipped].sort((a, b) => a.localeCompare(b, "zh-CN")),
  };
}

async function importCandidates(candidates: BossCandidate[]) {
  const existingBosses: ExistingBoss[] = [];
  for (const file of fs.readdirSync(BOSS_DIR).filter((file) => file.endsWith(".mdx"))) {
    const filePath = path.join(BOSS_DIR, file);
    const { data } = matter(fs.readFileSync(filePath, "utf8"));
    if (typeof data.title === "string") {
      existingBosses.push({
        title: data.title,
        maps: normalizeMaps(data.map),
        filePath,
      });
    }
  }

  fs.mkdirSync(ICON_DIR, { recursive: true });
  fs.mkdirSync(WEBP_ICON_DIR, { recursive: true });

  for (const candidate of candidates) {
    const existing = existingBosses.find(
      (boss) =>
        boss.title === candidate.title &&
        candidate.maps.some((map) => boss.maps.includes(map)),
    );
    const defaultPath = path.join(BOSS_DIR, `${candidate.title}.mdx`);
    const mapPath = path.join(
      BOSS_DIR,
      `${candidate.title}（${candidate.maps.join("、")}）.mdx`,
    );
    const bossPath = existing?.filePath ??
      (fs.existsSync(defaultPath) ? mapPath : defaultPath);
    const slug = path.basename(bossPath, ".mdx");
    const iconPath = path.join(ICON_DIR, `${slug}.png`);
    const webpIconPath = path.join(WEBP_ICON_DIR, `${slug}.webp`);

    if (existing) {
      const parsed = matter(fs.readFileSync(existing.filePath, "utf8"));
      const maps = [...new Set([...normalizeMaps(parsed.data.map), ...candidate.maps])];
      fs.writeFileSync(
        existing.filePath,
        matter.stringify(parsed.content, { ...parsed.data, map: maps }),
        "utf8",
      );
    } else {
      const frontmatter = {
        title: candidate.title,
        map: candidate.maps,
      };
      const frontmatterOnly = `${matter.stringify("", frontmatter).trimEnd()}\n`;
      fs.writeFileSync(bossPath, frontmatterOnly, "utf8");
      existingBosses.push({
        title: candidate.title,
        maps: candidate.maps,
        filePath: bossPath,
      });
    }

    fs.copyFileSync(candidate.iconSource, iconPath);
    await sharp(candidate.iconSource)
      .webp({ quality: 80, alphaQuality: 100 })
      .toFile(webpIconPath);
  }
}

async function main() {
  const { candidates, skipped } = getCandidates();

  console.log(`${WRITE ? "Importing" : "Dry run"} ${candidates.length} boss candidates:`);
  for (const candidate of candidates) {
    console.log(`- ${candidate.title}: ${candidate.maps.join("、")}`);
  }

  if (skipped.length > 0) {
    console.log("Skipped without an icon:");
    for (const entry of skipped) console.log(`- ${entry}`);
  }

  if (WRITE) {
    await importCandidates(candidates);
    console.log(`Imported ${candidates.length} bosses.`);
  } else {
    console.log("Run with --write to import names, maps, and icons.");
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
