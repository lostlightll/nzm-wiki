import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { generatePreviewCards } from "./preview-cards";

test("preview uses its own structured Numerical values, excludes hidden rows, and leaves its source untouched", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "overlimit-preview-"));
  const root = path.join(dir, "Content");
  function table(file: string, rows: Record<string, unknown>) {
    const target = path.join(root, file); mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, JSON.stringify([{ Rows: rows }]));
  }
  try {
    const source = "DataTables/HuntingGroundRoguelike/HuntingGroundRoguelikeWeaponModTable.json";
    table(source, {
      1315204001: { ModId: 1315204001, Name: { LocalizedString: "射击碎片" }, OverrideDesc: { LocalizedString: "伤害+999%" }, IsShow: true, Quality: 4, IconPath: { AssetPathName: "/Game/UI/icon.icon" }, ModSetIdList: { Values: [1003] } },
      999: { IsShow: false },
    });
    table("DataTables/LuaDataTable/WeaponModItemData.json", {});
    table("DataTables/MGE/MGEPassive_BD.json", { "1315204001_1": { MGE: { Id: "2001004001" }, MGEConfig: { Id: "1315204001" } } });
    table("DataTables/MGE/GPModularGameplayEffectTable.json", {});
    table("DataTables/MGE/MGEConfig_Season.json", { "1315204001": { Parameters: [{ Name: "CharacterModifierList", Value: "131520400" }] } });
    table("DataTables/Buff/BuffConfigDatatableNew.json", {});
    table("DataTables/LuaDataTable/WeaponModSetTable.json", { "1003": { SetName: { LocalizedString: "游击" }, SetColor: "E012" } });
    table("Attributes/AutoGenerate/numerical_modifier_config.json", { "131520400_1_0": { ID: 131520400, Level: 1, AttributeName: "GPAttributeSetGiveDamageRatio.WeaponHitDamageRatio", GPModifierOp: "B1", BaseValue: 0.36, CoefValue: 0, Description: "伤害+10%" } });
    mkdirSync(path.join(root, "UI"), { recursive: true });
    await sharp({ create: { width: 4, height: 4, channels: 4, background: "red" } }).png().toFile(path.join(root, "UI/icon.png"));
    const before = readFileSync(path.join(root, source));
    const result = await generatePreviewCards(root, { publicRoot: path.join(dir, "public") });
    assert.equal(result.cards.length, 1);
    assert.match(result.cards[0].description, /36%/);
    assert.doesNotMatch(result.cards[0].description, /999%|10%/);
    assert.equal(result.cards[0].perkItemId, undefined);
    assert.equal(result.cards[0].applicabilityKnown, false);
    assert.deepEqual(result.cards[0].weaponItems, []);
    assert.deepEqual(result.independentDamage, {});
    assert.deepEqual(readFileSync(path.join(root, source)), before);
    assert.equal(result.evidence[0].numericAudit, "verified");
    assert.ok(result.provenanceFiles.some(file => file.path === "UI/icon.png"));
    assert.equal(result.cards[0].slot, undefined);

    // Same-ID perk slots are a fallback; the preview card's explicit fourth slot wins.
    for (const slot of [1, 2, 3, 4]) {
      table("DataTables/LuaDataTable/WeaponModItemData.json", {
        differentRowKey: { MODItemID: 1315204001, PassiveSkill_ID: "1315204001:1", MODSlotIndex: { Values: [slot] } },
      });
      const fallback = await generatePreviewCards(root, { publicRoot: path.join(dir, "public") });
      assert.equal(fallback.cards[0].slot, slot);
      assert.ok(JSON.stringify(fallback.evidence[0].verifiedDetails).includes('"fallback":true'));
    }
    for (const slots of [[], [1, 2], [5], ["3"]]) {
      table("DataTables/LuaDataTable/WeaponModItemData.json", {
        differentRowKey: { MODItemID: 1315204001, PassiveSkill_ID: "1315204001:1", MODSlotIndex: { Values: slots } },
      });
      assert.equal((await generatePreviewCards(root, { publicRoot: path.join(dir, "public") })).cards[0].slot, undefined);
    }
    table("DataTables/LuaDataTable/WeaponModItemData.json", {
      differentRowKey: { MODItemID: 1315204001, PassiveSkill_ID: "1315204001:1", MODSlotIndex: { Values: [3] } },
    });
    const originalTable = JSON.parse(before.toString());
    originalTable[0].Rows["1315204001"].bSlot4 = true;
    table(source, originalTable[0].Rows);
    const explicit = await generatePreviewCards(root, { publicRoot: path.join(dir, "public") });
    assert.equal(explicit.cards[0].slot, 4);
    assert.ok(JSON.stringify(explicit.evidence[0].verifiedDetails).includes('"fallback":false'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
