/** Validate and export room-independent Origin Hunting Ground boss health. */
import fs from "fs";
import path from "path";
import sources from "@/data/enemies/lc/boss/origin-health-sources.json";

type Difficulty = "heroic" | "inferno" | "torment";
type Row = Record<string, unknown>;
type Named = { SourceString?: string; LocalizedString?: string };

const root = process.cwd();
const tableDir = path.join(root, "refs/Exports/NZM/Content/DataTables");
const outputPath = path.join(root, "data/enemies/lc/boss/origin-health.json");
const labels: Record<Difficulty, string> = {
  heroic: "英雄",
  inferno: "炼狱",
  torment: "折磨",
};

function rows(relativePath: string): Row[] {
  const parsed = JSON.parse(fs.readFileSync(path.join(tableDir, relativePath), "utf8"));
  return Object.values((Array.isArray(parsed) ? parsed[0] : parsed).Rows) as Row[];
}

function name(value: unknown): string | undefined {
  const text = value as Named | undefined;
  return text?.LocalizedString ?? text?.SourceString;
}

function single<T>(items: T[], description: string): T {
  if (items.length !== 1) throw new Error(`${description}: expected 1 row, got ${items.length}`);
  return items[0];
}

const entrances = rows("System/Dungeon/NewEntranceInfoTable.json").filter(
  (row) => name(row.mode_type) === "原点猎场",
);
const base = rows("Roguelike/RoguelikeMonsterBaseTable.json");
const intra = rows("Roguelike/RoguelikeMonsterIntraTable.json");
const rooms = rows("Roguelike/RoguelikeRoomMonsterNumericalTable.json");
const attributes = rows("MonsterAttrTypeConfig.json");
const unique = rows("MonsterUniqueIDTable.json");

const result: {
  rooms: Partial<Record<Difficulty, number[]>>;
  bosses: Record<string, Partial<Record<Difficulty, number[]>>>;
} = { rooms: {}, bosses: {} };

for (const [slug, ids] of Object.entries(sources)) {
  if (!fs.existsSync(path.join(root, "data/enemies/lc/boss", `${slug}.mdx`))) {
    throw new Error(`Missing boss page: ${slug}`);
  }
  result.bosses[slug] = {};
  for (const difficulty of Object.keys(labels) as Difficulty[]) {
    const matchingEntrances = entrances.filter(
      (row) => name(row.dungeon_difficulty_des) === labels[difficulty],
    );
    const stages = ids.map((id) => {
      const matches = matchingEntrances.flatMap((entrance) =>
        intra.filter((row) => row.DungeonID === entrance.dungeon_id && row.UniqueMonsterID === id)
          .map((row) => ({ entrance, row })),
      );
      if (!matches.length) return null;
      const { entrance, row } = single(matches, `${slug}/${difficulty}/${id} entrance`);
      const baseRow = single(
        base.filter((item) => item.DungeonID === 2001201 && item.UniqueMonsterID === id),
        `${slug}/${id} base`,
      );
      const identity = single(
        unique.filter((item) => item.UniqueMonsterID === id),
        `${slug}/${id} identity`,
      );
      const attr = single(
        attributes.filter((item) => item.AttributeType === entrance.attribute_type &&
          item.MonsterLevel === entrance.dungeon_monster_level && item.MonsterType === identity.MonsterType),
        `${slug}/${difficulty}/${id} attribute`,
      );
      for (const [label, value] of Object.entries({ base: baseRow.Health, intra: row.Health, max: attr.MaxHealth })) {
        if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${slug}/${difficulty}/${id} invalid ${label}`);
      }
      return Math.round((baseRow.Health as number) * (row.Health as number) * (attr.MaxHealth as number));
    });
    if (stages.some((stage) => stage !== null)) {
      if (stages.some((stage) => stage === null)) throw new Error(`${slug}/${difficulty}: incomplete stages`);
      result.bosses[slug][difficulty] = stages as number[];
    }
  }
}

for (const difficulty of Object.keys(labels) as Difficulty[]) {
  const matchingEntrances = entrances.filter(
    (row) => name(row.dungeon_difficulty_des) === labels[difficulty],
  );
  if (!matchingEntrances.length) throw new Error(`Missing origin entrance: ${difficulty}`);
  const roomSets = matchingEntrances.map((entrance) =>
    rooms.filter((row) => row.DungeonID === entrance.dungeon_id)
      .sort((a, b) => (a.RoomIndex as number) - (b.RoomIndex as number))
      .map((row, index) => {
        if (row.RoomIndex !== index || typeof row.Health !== "number") {
          throw new Error(`Invalid room factor: ${entrance.dungeon_id}/${index}`);
        }
        return row.Health;
      }),
  );
  if (roomSets.some((set) => !set.length || JSON.stringify(set) !== JSON.stringify(roomSets[0]))) {
    throw new Error(`Inconsistent room factors: ${difficulty}`);
  }
  result.rooms[difficulty] = roomSets[0];
}

const output = `${JSON.stringify(result, null, 2)}\n`;
if (process.argv.slice(2).some((arg) => arg !== "--write" && arg !== "--check") ||
  (process.argv.includes("--write") && process.argv.includes("--check"))) {
  throw new Error("Usage: tsx scripts/import-origin-boss-health.ts [--write|--check]");
}
const current = fs.existsSync(outputPath) && fs.readFileSync(outputPath, "utf8") === output;
if (process.argv.includes("--write")) {
  fs.writeFileSync(outputPath, output);
  console.log(`Wrote ${outputPath}`);
} else {
  console.log(`Validated ${Object.keys(result.bosses).length} bosses.`);
  console.log(current ? "Data is current." : "Data differs; pass --write to update.");
  if (!current && process.argv.includes("--check")) process.exitCode = 1;
}
