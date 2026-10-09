import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";
import { independentDamageEntrySchema } from "../../lib/overlimit-catalog";
import { getTriggerDamageByOverlimitId } from "../../lib/trigger-damage";
import { checkCatalog, readCatalog, sha256 } from "./catalog";

// These assets and the parsed execution graph were individually reviewed.
// New bytecode requires a new review, even if its CDO values are unchanged.
const asset = "Abilities/Build/CBT3/Perk02/MGE_1316200001";
const reviewedHashes = {
  uasset: "f0ea496ddd1860832a609d2cba7e2e6702fed30e45c023b560cbca22a30a259b",
  uexp: "4db29fd8589322e9003973040fc9e416d6d6ecc4e753a84cb824b14d03126375",
  bytecode: "d8fde093b242d411db3c24f6ae8f87aaf1534182f435f20f0305b9c4ce8dad5b",
};
const { values } = parseArgs({ options: {
  "content-root": { type: "string" }, bytecode: { type: "string" },
  "output-directory": { type: "string" },
} });
if (!values["content-root"] || !values.bytecode || !values["output-directory"]) {
  throw new Error("Specify --content-root, --bytecode and --output-directory");
}
const root = path.resolve(values["content-root"]);
const output = path.resolve(values["output-directory"]);
const relative = path.relative(path.resolve("MD/_local"), output);
if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Candidates belong in MD/_local");
const files: { path: string; sha256: string }[] = [];
function read(file: string) {
  const bytes = fs.readFileSync(path.join(root, file));
  files.push({ path: file, sha256: sha256(bytes) });
  return JSON.parse(bytes.toString("utf8"));
}
function row(file: string, key: string) {
  return read(file).find((entry: { Rows?: unknown }) => entry.Rows).Rows[key];
}
for (const extension of ["uasset", "uexp"] as const) {
  const file = `${asset}.${extension}`;
  const hash = sha256(fs.readFileSync(path.join(root, file)));
  assert.equal(hash, reviewedHashes[extension], `Execution asset changed: ${file}`);
  files.push({ path: file, sha256: hash });
}
const bytecodeBytes = fs.readFileSync(values.bytecode);
assert.equal(sha256(bytecodeBytes), reviewedHashes.bytecode, "Parsed execution evidence changed");
assert.equal(row("DataTables/LuaDataTable/WeaponModItemData.json", "20703040437").PassiveSkill_ID, "1316200001:1");
assert.equal(row("DataTables/MGE/MGEPassive_BD.json", "1316200001_1").MGE.Id, "1316200001");
assert.equal(row("DataTables/MGE/GPModularGameplayEffectTable.json", "1316200001").MGEClass.AssetPathName,
  `/Game/${asset}.MGE_1316200001_C`);
for (const file of ["MGEConfig_Common", "MGEConfig_Season", "DT_MGEParamConfig_Main"]) {
  assert.equal(row(`DataTables/MGE/${file}.json`, "1316200001"), undefined, `Recheck parameter overrides in ${file}`);
}
const cdoSchema = z.object({ Probability: z.number().min(0).max(1), CooldownDuration: z.number().nonnegative(), AOEInterval: z.number().nonnegative() });
const cdo = cdoSchema.parse(read(`${asset}.json`).find((entry: { Name: string }) => entry.Name === "Default__MGE_1316200001_C").Properties);
assert.deepEqual(cdo, cdoSchema.parse(JSON.parse(bytecodeBytes.toString("utf8"))
  .find((entry: { Name: string }) => entry.Name === "Default__MGE_1316200001_C").Properties), "CDO disagrees with reviewed execution asset");
const aoe = z.object({ AOEId: z.literal(1316200001), AOERadius: z.number().positive() })
  .parse(row("DataTables/NZAOEGlobalConfigTable.json", "1316200001"));
const numericalRaw = row("DataTables/numerical_config_composite.json", "130103014_1");
const numerical = z.object({
  id: z.literal(130103014), Level: z.literal(1), HpCalScale: z.number(), HpCalBase: z.literal(0), HpFloatCoef: z.literal(0),
  ToughnessBase: z.number(), ToughnessScale: z.literal(0), ElementType: z.literal("EElementEffectType::EDamageType_Kinetic"),
  bEnableCriticalDamage: z.boolean(), EnableWeaknessDamage: z.literal(false),
  Settlements: z.array(z.object({ TagName: z.string() })),
}).parse(numericalRaw);
assert.equal(numerical.Settlements[0].TagName, "Numerical.SettlementType.Health.SkillDamage");
const entry = independentDamageEntrySchema.parse({
  name: "致命爆炸", href: "/overlimit/20703040437", perkSlug: "slot-4/致命爆炸", overlimitId: "20703040437",
  trigger: `武器命中有 ${cdo.Probability * 100}% 概率产生 ${aoe.AOERadius / 100} 米爆炸`,
  interval: `${cdo.CooldownDuration} 秒`, numericalId: String(numerical.id), damageType: "技能伤害",
  damageValue: String(numerical.HpCalScale * 500), toughness: numerical.ToughnessBase,
  element: "物理", critical: numerical.bEnableCriticalDamage, weakpoint: numerical.EnableWeaknessDamage, weakpointMultiplier: 1,
});
assert.deepEqual(getTriggerDamageByOverlimitId("20703040437"), entry, "Trigger catalog differs from reviewed source projection");
const catalog = readCatalog("data/overlimit/current.json");
assert.ok(catalog.cards.some(card => card.id === entry.overlimitId));
catalog.independentDamage["20703040437"] = [entry];
// Keep the other cards' provenance intact; this selected supplement has its own ledger.
const evidencePath = "scripts/overlimit/fatal-explosion-evidence.json";
const evidence = { schemaVersion: 1, cardId: "20703040437", reviewedAt: "2026-10-09", files,
  parsedBytecodeSha256: reviewedHashes.bytecode, cdo, aoe, numerical: numericalRaw, entry,
  basis: "Item20703040437→Passive1316200001_1→MGE1316200001；OnMakeDamage进入1115检查冷却，1226读取Probability，成功后跳转15，93提交冷却，560以AOE1316200001/Numerical130103014创建爆炸。AOE完成后1324使用AOEInterval，1100→RetriggerAOE→1703→198按StackCount继续，不是CooldownDuration。Native冷却和AOE内部未展开；这里发布配置冷却及单次结算，不宣称实测触发频率。" };
const serialize = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
const evidenceBytes = serialize(evidence);
catalog.provenance.files = catalog.provenance.files.filter(file => file.path !== evidencePath);
catalog.provenance.files.push({ path: evidencePath, sha256: sha256(evidenceBytes) });
checkCatalog(catalog, process.cwd());
const catalogBytes = serialize(catalog);
fs.mkdirSync(output, { recursive: true });
for (const [file, value] of Object.entries({ "catalog.json": catalogBytes,
  "fatal-explosion-evidence.json": evidenceBytes,
  "review.json": serialize({ status: "approved", catalogSha256: sha256(catalogBytes), basis: evidence.basis }),
})) fs.writeFileSync(path.join(output, file), value);
console.log(`Selected fatal explosion candidate: ${output}; ${entry.interval}, ${entry.trigger}, damage ${entry.damageValue}`);
