import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import type { SummonDamageLock, SummonDamageLockEntry, SummonElement } from "../../types/summons";

const numericalSchema = z.object({
  id: z.number().int().positive(),
  Level: z.number().int().positive(),
  HpCalScale: z.number().finite().positive(),
  HpCalBase: z.literal(0),
  ElementType: z.string(),
  bEnableCriticalDamage: z.boolean(),
  EnableWeaknessDamage: z.boolean(),
  WeaknessDamageAddScale: z.number().finite(),
  Settlements: z.array(z.object({ TagName: z.string() })),
});

const tableSchema = z.array(z.object({ Rows: z.record(z.string(), z.unknown()) })).length(1);
const elements: Record<string, SummonElement> = {
  "EElementEffectType::EDamageType_Normal": "物理",
  "EElementEffectType::EDamageType_Kinetic": "物理",
  "EElementEffectType::EDamageType_Fire": "火焰",
  "EElementEffectType::EDamageType_Cryo": "寒冷",
  "EElementEffectType::EDamageType_Shock": "电弧",
  "EElementEffectType::EDamageType_Corossive": "腐蚀",
};
const tables = new Set(["numerical_config_equip", "numerical_config_others", "numerical_config_playerskill"]);

/** Refresh only already-reviewed references; attackStat remains an audited Actor semantic. */
export function refreshSummonDamageLock(contentRoot: string, lockPath: string): string[] {
  const lock: SummonDamageLock = JSON.parse(readFileSync(lockPath, "utf8"));
  assert.equal(lock.schemaVersion, 1);
  assert.equal(lock.mode, "lc");
  assert.ok(Number.isFinite(lock.baseAttack) && lock.baseAttack > 0);
  const cache = new Map<string, Record<string, unknown>>();
  const ids = new Set<string>();
  const changed: string[] = [];
  const entries = lock.entries.map((entry): SummonDamageLockEntry => {
    assert.ok(entry.id && !ids.has(entry.id), `Duplicate/empty entry: ${entry.id}`);
    ids.add(entry.id);
    assert.ok(tables.has(entry.sourceTable), `Unsupported sourceTable: ${entry.sourceTable}`);
    assert.ok(entry.rows.length > 0, `${entry.id}: empty rows`);
    if (!cache.has(entry.sourceTable)) {
      const sourcePath = path.join(contentRoot, "DataTables", `${entry.sourceTable}.json`);
      cache.set(entry.sourceTable, tableSchema.parse(JSON.parse(readFileSync(sourcePath, "utf8")))[0].Rows);
    }
    const sourceRows = cache.get(entry.sourceTable)!;
    const resolved = entry.rows.map((reference) => {
      const key = `${reference.id}_${reference.level}`;
      const row = numericalSchema.parse(sourceRows[key]);
      assert.equal(row.id, reference.id, `${entry.id}: ${key} identity mismatch`);
      assert.equal(row.Level, reference.level, `${entry.id}: ${key} level mismatch`);
      const element = elements[row.ElementType];
      assert.ok(element, `${entry.id}: unknown element ${row.ElementType}`);
      const settlements = [...new Set(row.Settlements.map(({ TagName }) => TagName)
        .filter((tag) => tag.startsWith("Numerical.SettlementType.Health.")))].sort();
      assert.equal(settlements.length, 1, `${entry.id}: expected one Health settlement`);
      assert.ok([
        "Numerical.SettlementType.Health.WeaponDamage",
        "Numerical.SettlementType.Health.SkillDamage",
      ].includes(settlements[0]), `${entry.id}: unsupported Health settlement ${settlements[0]}`);
      return {
        reference: { id: reference.id, level: reference.level, coefficient: row.HpCalScale },
        fields: {
          element,
          enableCritical: row.bEnableCriticalDamage,
          enableWeakness: row.EnableWeaknessDamage,
          ...(row.EnableWeaknessDamage ? { weaknessMultiplier: 1 + row.WeaknessDamageAddScale } : {}),
          settlements,
        },
      };
    });
    for (const row of resolved.slice(1)) {
      assert.deepEqual(row.fields, resolved[0].fields, `${entry.id}: multi-hit combat fields differ; split the entry before refreshing`);
    }
    const next: SummonDamageLockEntry = {
      id: entry.id,
      sourceTable: entry.sourceTable,
      rows: resolved.map((row) => row.reference),
      attackStat: entry.attackStat,
      ...resolved[0].fields,
    };
    if (JSON.stringify(next) !== JSON.stringify(entry)) changed.push(entry.id);
    return next;
  });
  // Resolve and validate every reference before touching the committed lock.
  writeFileSync(lockPath, `${JSON.stringify({ ...lock, entries }, null, 2)}\n`);
  return changed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    assert.ok(args.length === 2 && args[0] === "--content-root" && args[1] && !args[1].startsWith("--"),
      "Usage: tsx scripts/summons/refresh-damage-lock.ts --content-root PATH");
    const changed = refreshSummonDamageLock(path.resolve(args[1]), path.resolve("data/summon-damage-lock.json"));
    console.log(`Summon damage lock refreshed; changed entries (${changed.length}): ${changed.join(", ") || "none"}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
