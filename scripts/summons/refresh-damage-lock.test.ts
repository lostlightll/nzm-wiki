import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { refreshSummonDamageLock } from "./refresh-damage-lock";

test("refreshes selected Numerical rows and rejects unsupported damage before writing", () => {
  const root = mkdtempSync(path.join(tmpdir(), "summon-lock-"));
  try {
    mkdirSync(path.join(root, "DataTables"));
    const lockPath = path.join(root, "lock.json");
    writeFileSync(lockPath, JSON.stringify({
      schemaVersion: 1, mode: "lc", baseAttack: 500,
      entries: [{
        id: "reviewed", sourceTable: "numerical_config_others", rows: [{ id: 123, level: 1, coefficient: 0.9 }],
        attackStat: "攻击力", element: "物理", enableCritical: false, enableWeakness: false,
        settlements: ["Numerical.SettlementType.Health.SkillDamage"],
      }],
    }));
    const tablePath = path.join(root, "DataTables/numerical_config_others.json");
    const row = {
      id: 123, Level: 1, HpCalScale: 0.6, HpCalBase: 0,
      ElementType: "EElementEffectType::EDamageType_Fire", bEnableCriticalDamage: true,
      EnableWeaknessDamage: true, WeaknessDamageAddScale: 0.3,
      Settlements: [{ TagName: "Numerical.SettlementType.Health.SkillDamage" }],
    };
    const writeSource = () => writeFileSync(tablePath, JSON.stringify([{ Rows: { "123_1": row } }]));
    writeSource();
    assert.deepEqual(refreshSummonDamageLock(root, lockPath), ["reviewed"]);
    const entry = JSON.parse(readFileSync(lockPath, "utf8")).entries[0];
    assert.equal(entry.rows[0].coefficient, 0.6);
    assert.equal(entry.attackStat, "攻击力");
    assert.equal(entry.element, "火焰");
    assert.equal(entry.weaknessMultiplier, 1.3);
    assert.equal(entry.enableCritical, true);
    assert.deepEqual(refreshSummonDamageLock(root, lockPath), []);
    const before = readFileSync(lockPath, "utf8");
    row.HpCalBase = 100;
    writeSource();
    assert.throws(() => refreshSummonDamageLock(root, lockPath), /HpCalBase/);
    assert.equal(readFileSync(lockPath, "utf8"), before);
    row.HpCalBase = 0;
    row.Level = 2;
    writeSource();
    assert.throws(() => refreshSummonDamageLock(root, lockPath), /level mismatch/);
    assert.equal(readFileSync(lockPath, "utf8"), before);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
