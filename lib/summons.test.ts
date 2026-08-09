import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import summonDamageLockData from "@/data/summon-damage-lock.json";
import summonData from "@/data/summons.json";
import {
  assertSummonDamageLock,
  assertSummonDataLock,
  getSummonCatalog,
  getSummonSearchDocuments,
} from "./summons";
import type { SummonDamageLock, SummonDataLock } from "@/types";

test("summon lock has unique stable identities and local public assets", () => {
  const data = summonData as SummonDataLock;
  const damageLock = summonDamageLockData as SummonDamageLock;
  assert.doesNotThrow(() => assertSummonDamageLock(damageLock));
  assert.doesNotThrow(() => assertSummonDataLock(data));
  assert.equal(new Set(data.summons.map((summon) => summon.id)).size, data.summons.length);
  assert.ok(data.summons.length >= 6);

  const assets = [
    ...data.summons.flatMap((summon) => [summon.icon, ...summon.mechanics.map((item) => item.icon)]),
    ...data.sharedSystems.map((system) => system.icon),
  ].filter((asset): asset is string => Boolean(asset));
  for (const asset of assets) {
    assert.ok(asset.startsWith("/"), `${asset} 必须是公开绝对路径`);
    assert.ok(
      fs.existsSync(path.join(process.cwd(), "public", asset.slice(1))),
      `${asset} 对应的公开文件不存在`,
    );
  }
  assert.doesNotMatch(JSON.stringify(data), /refs[\\/]/i);
  assert.doesNotMatch(JSON.stringify(data), /"configured"/);
  const lockIds = new Set(damageLock.entries.map((entry) => entry.id));
  assert.ok(
    data.summons
      .flatMap((summon) => summon.damageSources)
      .filter((damage) => damage.lockSource)
      .every((damage) => lockIds.has(damage.lockSource!)),
  );
  assert.deepEqual(
    damageLock.entries.find((entry) => entry.id === "iron-fist-combo")?.rows.map((row) => row.id),
    [160303001, 160303002, 160303003],
  );
});

test("catalog resolves locked damage, configured rates, Buffs and published perks", async () => {
  const catalog = await getSummonCatalog();
  const bully = catalog.entries.find((entry) => entry.id === "bully-drone");
  const husky = catalog.entries.find((entry) => entry.id === "husky-companion");
  const ironFist = catalog.entries.find((entry) => entry.id === "s3-iron-fist");
  const turrets = catalog.entries.find((entry) => entry.id === "spacetime-turrets");
  const energyShadow = catalog.entries.find((entry) => entry.id === "energy-shadow-floating-gun");
  assert.ok(bully && husky && ironFist && turrets && energyShadow);

  assert.equal(bully.damageSources.find((item) => item.id === "drone-shot")?.coefficient, 0.08);
  assert.equal(bully.damageSources.find((item) => item.id === "drone-shot")?.roundsPerMinute, 300);
  assert.equal(husky.damageSources.find((item) => item.id === "husky-hit")?.baseDamage, 125);
  assert.equal(turrets.damageSources.find((item) => item.id === "judicator-shell")?.baseDamage, 450);
  assert.ok(
    catalog.entries
      .flatMap((entry) => entry.damageSources)
      .filter((damage) => damage.coefficient !== undefined)
      .every((damage) => damage.baseDamage === damage.coefficient! * 500),
  );
  assert.equal(ironFist.damageSources.find((item) => item.id === "iron-fist-earth-wave")?.coefficient, 1.9);
  assert.equal(ironFist.damageSources.find((item) => item.id === "iron-fist-arrival")?.enableCritical, false);
  assert.equal(turrets.damageSources.find((item) => item.id === "destroyer-laser")?.intervalSeconds, undefined);
  assert.equal(
    turrets.damageSources.find((item) => item.id === "destroyer-laser")?.attackStatLabel,
    "技能攻击力",
  );
  assert.ok(ironFist.buffs.some((buff) => buff.buffId === 160403101));
  assert.match(energyShadow.perkSelectionNote ?? "", /4 号专属插件.*只能装备其中一个/);
  assert.deepEqual(energyShadow.perks.map((perk) => perk.slot), [4, 4]);
  assert.ok(catalog.sharedBuffs.some((buff) => buff.buffId === 160400005));
  assert.ok(catalog.sharedPerks.every((perk) => perk.href.startsWith("/perks/")));
});

test("summon search documents are unique and carry related Buff/multiplier terms", () => {
  const documents = getSummonSearchDocuments();
  assert.equal(new Set(documents.map((document) => document.id)).size, documents.length);
  const shockwave = documents.find((document) =>
    document.id === "s3-iron-fist:iron-fist-shockwave",
  );
  assert.ok(shockwave);
  assert.ok(shockwave.keywords.includes("160403101"));
  assert.ok(shockwave.keywords.some((keyword) => keyword.includes("易伤")));
  assert.ok(documents.some((document) => document.title.includes("哈士奇")));
  assert.ok(documents.some((document) => document.title.includes("毁灭者")));
});
