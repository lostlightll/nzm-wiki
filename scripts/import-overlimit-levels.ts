/**
 * 从 refs 导入超限猎场等级概率、玩法常量和重抽费用。
 *
 * 用法：pnpm exec tsx scripts/import-overlimit-levels.ts
 */
import fs from "fs";
import path from "path";

const ROOT_DIR = process.cwd();
const REFS_DIR = path.join(
  ROOT_DIR,
  "refs/Exports/NZM/Content/DataTables/HuntingGroundRoguelike",
);
const OUTPUT_FILE = path.join(ROOT_DIR, "data/overlimit-levels.json");

const REF_FILES = {
  quality: "HuntingGroundRoguelikeQualityWeightTable.json",
  constants: "HuntingGroundRoguelikeConstantsTable.json",
  reroll: "HuntingGroundRoguelikeRerollCostTable.json",
} as const;

type Quality = 3 | 4 | 5;

interface UnrealList {
  Values?: number[] | string;
  SourceString?: string;
}

interface QualityRow {
  Level: number;
  QualityList: UnrealList;
  QualityWeightList: UnrealList;
}

interface ConstantsRow {
  Slot4RandomRate: number;
  AllSlot4PlayerLevelList: number[];
  RandomRateBonusFromDepositMod: number;
  CriticalProbability: number;
  WeaponModCount_NotSlot4: number;
  WeaponModCount_Slot4: number;
}

interface RerollRow {
  Time: number;
  Cost: number;
}

interface DataTableExport<T> {
  Rows?: Record<string, T>;
}

function assertValue(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new Error(message);
}

function loadRows<T>(fileName: string): T[] {
  const filePath = path.join(REFS_DIR, fileName);
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as
    | DataTableExport<T>
    | DataTableExport<T>[];
  const exports = Array.isArray(parsed) ? parsed : [parsed];
  const rows = exports.find((entry) => entry.Rows)?.Rows;

  assertValue(rows, `Rows not found: ${fileName}`);
  return Object.values(rows);
}

function parseNumericList(value: UnrealList, label: string): number[] {
  const source = value.SourceString?.trim() || value.Values;
  const values = Array.isArray(source)
    ? source
    : String(source ?? "")
        .trim()
        .split(/[;\s]+/)
        .filter(Boolean)
        .map(Number);

  assertValue(
    values.length > 0 && values.every(Number.isFinite),
    `Invalid numeric list: ${label}`,
  );
  return values;
}

function assertProbability(value: number, label: string) {
  assertValue(
    Number.isFinite(value) && value >= 0 && value <= 1,
    `${label} must be between 0 and 1`,
  );
}

function assertNormalized(
  weights: Record<Quality, number>,
  expected: Record<Quality, number>,
  label: string,
) {
  const total = weights[3] + weights[4] + weights[5];
  for (const quality of [3, 4, 5] as const) {
    assertValue(
      Math.abs(weights[quality] / total - expected[quality]) < 0.0001,
      `Unexpected normalized probability at ${label}, Q${quality}`,
    );
  }
}

function main() {
  const qualityRows = loadRows<QualityRow>(REF_FILES.quality).sort(
    (a, b) => a.Level - b.Level,
  );
  assertValue(qualityRows.length === 100, "Expected exactly 100 level rows");

  const levels = qualityRows.map((row, index) => {
    assertValue(row.Level === index + 1, `Missing or duplicate level ${index + 1}`);

    const qualities = parseNumericList(
      row.QualityList,
      `level ${row.Level} qualities`,
    );
    assertValue(
      qualities.length === 3 &&
        qualities[0] === 3 &&
        qualities[1] === 4 &&
        qualities[2] === 5,
      `Expected Q3/Q4/Q5 at level ${row.Level}`,
    );

    const weights = parseNumericList(
      row.QualityWeightList,
      `level ${row.Level} weights`,
    );
    assertValue(weights.length === 3, `Expected three weights at level ${row.Level}`);
    assertValue(
      weights.every((weight) => weight >= 0),
      `Negative quality weight at level ${row.Level}`,
    );
    assertValue(
      weights.reduce((sum, weight) => sum + weight, 0) > 0,
      `Zero total quality weight at level ${row.Level}`,
    );

    return {
      level: row.Level,
      qualityWeights: {
        3: weights[0],
        4: weights[1],
        5: weights[2],
      } satisfies Record<Quality, number>,
    };
  });

  const constantsRows = loadRows<ConstantsRow>(REF_FILES.constants);
  assertValue(constantsRows.length === 1, "Expected exactly one constants row");
  const constants = constantsRows[0];
  assertProbability(constants.Slot4RandomRate, "Slot4RandomRate");
  assertProbability(
    constants.RandomRateBonusFromDepositMod,
    "RandomRateBonusFromDepositMod",
  );
  assertProbability(constants.CriticalProbability, "CriticalProbability");

  const guaranteedLevels = [...new Set(constants.AllSlot4PlayerLevelList)].sort(
    (a, b) => a - b,
  );
  assertValue(
    guaranteedLevels.length === constants.AllSlot4PlayerLevelList.length,
    "Duplicate guaranteed slot-4 level",
  );
  assertValue(
    guaranteedLevels.every(
      (level) => Number.isInteger(level) && level >= 1 && level <= levels.length,
    ),
    "Guaranteed slot-4 level is outside the imported level range",
  );
  assertValue(
    Number.isFinite(constants.WeaponModCount_NotSlot4) &&
      constants.WeaponModCount_NotSlot4 > 0 &&
      Number.isFinite(constants.WeaponModCount_Slot4) &&
      constants.WeaponModCount_Slot4 > 0,
    "Mixed-pool weights must be positive numbers",
  );

  const rerollRows = loadRows<RerollRow>(REF_FILES.reroll).sort(
    (a, b) => a.Time - b.Time,
  );
  assertValue(rerollRows.length === 100, "Expected exactly 100 reroll rows");
  const rerollCosts = rerollRows.map((row, index) => {
    assertValue(row.Time === index + 1, `Missing or duplicate reroll time ${index + 1}`);
    assertValue(
      Number.isFinite(row.Cost) && row.Cost >= 0,
      `Invalid reroll cost at time ${row.Time}`,
    );
    return { time: row.Time, cost: row.Cost };
  });

  assertNormalized(levels[1].qualityWeights, { 3: 0.5, 4: 0.5, 5: 0 }, "level 2");
  assertNormalized(
    levels[8].qualityWeights,
    { 3: 0, 4: 1 / 6, 5: 5 / 6 },
    "level 9",
  );
  assertNormalized(levels[18].qualityWeights, { 3: 0, 4: 0.5, 5: 0.5 }, "level 19");

  const catalog = {
    levels,
    slot4: {
      baseProbability: constants.Slot4RandomRate,
      guaranteedLevels,
      bonusPerObtainedSlot4: constants.RandomRateBonusFromDepositMod,
      mixedPoolWeights: {
        nonSlot4: constants.WeaponModCount_NotSlot4,
        slot4: constants.WeaponModCount_Slot4,
      },
    },
    criticalProbability: constants.CriticalProbability,
    rerollCosts,
  };

  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  console.log(`Imported ${levels.length} overlimit levels.`);
  console.log(`Guaranteed slot-4 levels: ${guaranteedLevels.join(", ")}.`);
  console.log(`Reroll costs: ${rerollCosts.length} rows.`);
  console.log(`Output: ${path.relative(ROOT_DIR, OUTPUT_FILE)}`);
}

main();
