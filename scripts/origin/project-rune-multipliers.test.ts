import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { mergeOriginRuneSources, projectOriginRuneSources } from "./project-rune-multipliers";
import { parseModifierProviderRegistry } from "../../lib/modifier-provider-registry";

const content = path.join(process.cwd(), "refs/Exports/NZM/Content");
const readJson = (file: string) => JSON.parse(fs.readFileSync(path.join(content, file), "utf8"));
const rows = (file: string) => readJson(file)[0].Rows;

test("rune refresh preserves other providers and their positions", () => {
  const registry = parseModifierProviderRegistry(JSON.parse(fs.readFileSync("data/modifier-providers.json", "utf8")));
  const projected = projectOriginRuneSources(rows("DataTables/MGE/MGEPassiveMainTable.json"));
  const merged = mergeOriginRuneSources(registry, projected);
  for (const group of ["providers", "exclusions"] as const) {
    assert.deepEqual(merged[group].map(entry => entry.id), registry[group].map(entry => entry.id));
    const unrelated = registry[group].filter(entry => entry.source.type !== "origin-rune");
    for (const entry of unrelated) assert.equal(merged[group].find(next => next.id === entry.id), entry);
  }
  const refund = merged.providers.find(entry => entry.id === "origin-rune:1378042640");
  assert.deepEqual(refund?.applications?.map(application => application.expression.row),
    ["lc:130042640_1_0", "lc:130042640_1_1"]);
  assert.ok(!merged.exclusions.some(entry => entry.id === refund?.id));
});

test("one-shot rune only indexes its own attack buff", () => {
  const mge = readJson("Abilities/Build/RoguePerk/S4/MGE_1378044210.json");
  const buffs = rows("DataTables/Buff/BuffConfigDatatableNew.json");
  assert.ok(mge.some((entry: { Properties?: { AddDamageBuff?: string } }) =>
    entry.Properties?.AddDamageBuff === "Buff_Rogue_1378044210"));
  assert.deepEqual(buffs.Buff_Rogue_1378044210.GPModifyIDs, [130044210]);
  assert.deepEqual(buffs.Buff_Rogue_1317107001.GPModifyIDs, [130044211]);

  const passiveRows = rows("DataTables/MGE/MGEPassiveMainTable.json");
  const projected = projectOriginRuneSources(passiveRows);
  const rune = projected.providers.find((entry) => entry.id === "origin-rune:1378044210");
  assert.deepEqual(rune?.applications?.map((application) => application.expression.row),
    ["lc:130044210_1_0"]);
});

test("single-shot rune excludes the overlimit card's damage modifier", () => {
  const mge = readJson("Abilities/Build/RoguePerk/S4/MGE_1378045110.json");
  const buffs = rows("DataTables/Buff/BuffConfigDatatableNew.json");
  assert.ok(mge.some((entry: { Properties?: { BuffName?: string } }) =>
    entry.Properties?.BuffName === "Buff_Rogue_1378045110"));
  assert.deepEqual(buffs.Buff_Rogue_1378045110.GPModifyIDs, [130045110]);

  const evidence = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/overlimit/current-evidence.json"), "utf8"));
  const overlimitCard = evidence.cards.find((card: { id: string }) => card.id === "1317109001");
  assert.deepEqual(overlimitCard.selected.map((selection: { expression: { row: string } }) => selection.expression.row),
    ["lc:130045113_1_0"]);

  const projected = projectOriginRuneSources(rows("DataTables/MGE/MGEPassiveMainTable.json"));
  const rune = projected.providers.find((entry) => entry.id === "origin-rune:1378045110");
  assert.deepEqual(rune?.applications?.map((application) => application.expression.row),
    ["lc:130045111_1_1"]);
});

test("runes with shared Numerical prefixes only index their reviewed modifiers", () => {
  const buffs = rows("DataTables/Buff/BuffConfigDatatableNew.json");
  assert.deepEqual(buffs.Buff_Rogue_1378044311.GPModifyIDs, [130044311]);
  assert.deepEqual(buffs.Buff_Rogue_1378044380.GPModifyIDs, [130044380]);
  assert.deepEqual(buffs.Buff_Rogue_1317113001.GPModifyIDs, [130044381]);
  assert.deepEqual(buffs.Buff_Rogue_1378045120.GPModifyIDs, [130045120]);
  assert.deepEqual(buffs.Buff_Rogue_1317111001.GPModifyIDs, [130045121]);

  const projected = projectOriginRuneSources(rows("DataTables/MGE/MGEPassiveMainTable.json"));
  const expected = [
    ["1378044310", []],
    ["1378044380", ["lc:130044380_1_0", "lc:130044380_1_1"]],
    ["1378044410", ["lc:130044410_1_0"]],
    ["1378045120", ["lc:130045120_1_0"]],
  ] as const;
  for (const [id, rows] of expected) {
    const provider = projected.providers.find((entry) => entry.id === `origin-rune:${id}`);
    assert.deepEqual(provider?.applications?.map((application) => application.expression.row) ?? [], rows, id);
  }
  assert.ok(projected.exclusions.some((entry) => entry.id === "origin-rune:1378044310"));
});
