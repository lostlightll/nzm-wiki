import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// Maintenance evidence only. No descriptions or numerical values here are approved for publication.
export const OVERLIMIT_INSPECTION_FILES = {
  cards: "DataTables/HuntingGroundRoguelike/HuntingGroundRoguelikeWeaponModTable.json",
  mods: "DataTables/LuaDataTable/WeaponModItemData.json",
  items: "DataTables/System/Items/CommonItemDataTable.json",
  passives: "DataTables/MGE/MGEPassive_BD.json",
  sets: "DataTables/LuaDataTable/WeaponModSetTable.json",
  rerollCosts: "DataTables/HuntingGroundRoguelike/HuntingGroundRoguelikeRerollCostTable.json",
  registry: "DataTables/MainDataTablesLoadConfig.json",
} as const;

type Row = Record<string, unknown>;
type Rows = Record<string, Row>;

function object(value: unknown): Row {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Row : {};
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b, "en")).map(([key, child]) => [key, stable(child)]));
  }
  return value;
}

function localized(value: unknown): string {
  if (typeof value === "string") return value;
  const row = object(value);
  return String(row.LocalizedString ?? row.SourceString ?? row.CultureInvariantString ?? "");
}

function id(value: unknown): string | undefined {
  return typeof value === "string" || typeof value === "number" ? String(value) : undefined;
}

function fieldNames(rows: Rows): string[] {
  return [...new Set(Object.values(rows).flatMap(Object.keys))].sort();
}

function inspectRoot(contentRoot: string) {
  const root = path.resolve(contentRoot);
  const inputs: { path: string; sha256: string | null }[] = [];
  function readTable(relativePath: string, required = false): Rows {
    const file = path.join(root, relativePath);
    if (!existsSync(file)) {
      if (required) throw new Error(`Missing required overlimit source: ${file}`);
      inputs.push({ path: relativePath, sha256: null });
      return {};
    }
    const bytes = readFileSync(file);
    inputs.push({ path: relativePath, sha256: createHash("sha256").update(bytes).digest("hex") });
    const parsed: unknown = JSON.parse(bytes.toString("utf8"));
    const exports = Array.isArray(parsed) ? parsed : [parsed];
    const table = exports.map(object).find((entry) => entry.Rows !== undefined);
    if (!table || !table.Rows || typeof table.Rows !== "object" || Array.isArray(table.Rows)) {
      throw new Error(`Expected exported DataTable Rows: ${file}`);
    }
    return Object.fromEntries(Object.entries(object(table.Rows)).map(([key, value]) => [key, object(value)]));
  }

  const tables = Object.fromEntries(Object.entries(OVERLIMIT_INSPECTION_FILES).map(([key, file]) => [key, readTable(file, key === "cards")])) as Record<keyof typeof OVERLIMIT_INSPECTION_FILES, Rows>;
  const diagnostics: string[] = [];
  const modsById = new Map<string, Row>();
  for (const [rowId, mod] of Object.entries(tables.mods)) {
    const itemId = id(mod.MODItemID);
    if (!itemId) continue;
    if (modsById.has(itemId)) throw new Error(`Duplicate MODItemID ${itemId} in source row ${rowId}`);
    modsById.set(itemId, mod);
  }

  const cards = Object.entries(tables.cards).sort(([a], [b]) => a.localeCompare(b, "en")).map(([rowId, card]) => {
    const cardId = id(card.ModId);
    if (!cardId || cardId !== rowId) throw new Error(`Card row ${rowId} does not match ModId ${String(card.ModId)}`);
    const mod = modsById.get(cardId);
    const item = tables.items[cardId];
    const passiveRowId = `${cardId}_1`;
    const passive = tables.passives[passiveRowId];
    const isSkill = !mod && passive && id(passive.PassiveSkillID) === cardId && id(passive.PassiveSkillLevel) === "1";
    if (!mod && !isSkill) diagnostics.push(`Unresolved card identity: ${cardId}`);
    const tagList = object(card.ModSetIdList).Values;
    return {
      id: cardId,
      name: localized(card.Name) || localized(item?.Name) || localized(mod?.MODName),
      rawDescription: localized(card.OverrideDesc),
      quality: card.Quality ?? card.OverrideQuality ?? item?.Quality ?? null,
      bSlot4: typeof card.bSlot4 === "boolean" ? card.bSlot4 : null,
      isShow: typeof card.IsShow === "boolean" ? card.IsShow : null,
      tagIds: Array.isArray(tagList) ? tagList.map(String) : [],
      rawIconPath: object(card.IconPath).AssetPathName ?? null,
      ...(mod ? { perkItemId: cardId, rawPassiveSkillId: mod.PassiveSkill_ID ?? null } : {}),
      ...(isSkill ? { skillId: cardId, passiveRowId, mgeId: id(object(passive.MGE).Id) ?? null, mgeConfigId: id(object(passive.MGEConfig).Id) ?? null } : {}),
    };
  });

  const sourceOnlyServerGaps = Object.entries(tables.registry)
    .filter(([key, row]) => key.startsWith("HuntingGroundRoguelike") && row.LoadNetMode === "EDataTableLoadNetMode::OnlyServer")
    .sort(([a], [b]) => a.localeCompare(b, "en"))
    .flatMap(([tableName, row]) => {
      const assetPath = object(row.DataTablePath).AssetPathName;
      if (typeof assetPath !== "string" || !assetPath.startsWith("/Game/")) return [];
      const relativePath = `${assetPath.slice(6).split(".")[0]}.json`;
      if (relativePath.split("/").includes("..")) throw new Error(`Invalid source asset path: ${assetPath}`);
      const present = existsSync(path.join(root, relativePath));
      readTable(relativePath);
      return present ? [] : [{ tableName, path: relativePath, loadNetMode: row.LoadNetMode, registryPath: OVERLIMIT_INSPECTION_FILES.registry }];
    });

  return {
    contentRoot: root.replaceAll("\\", "/"),
    inputs: inputs.sort((a, b) => a.path.localeCompare(b.path, "en")),
    facts: {
      cardCount: cards.length,
      visibleCardCount: cards.filter((card) => card.isShow === true).length,
      perkCardCount: cards.filter((card) => "perkItemId" in card).length,
      skillCardCount: cards.filter((card) => "skillId" in card).length,
      unresolvedCardCount: diagnostics.length,
      cardFields: fieldNames(tables.cards),
      setFields: fieldNames(tables.sets),
    },
    cards,
    sets: stable(tables.sets),
    rerollCosts: stable(tables.rerollCosts),
    sourceOnlyServerGaps,
    diagnostics,
    rawCardRows: tables.cards,
  };
}

/** Returns deterministic, unreviewed evidence. Reads existing JSON files in place; never writes files. */
export function inspectOverlimit(contentRoot: string, againstRoot?: string) {
  const { rawCardRows: currentRows, ...current } = inspectRoot(contentRoot);
  if (!againstRoot) return { schemaVersion: 1, publicationStatus: "unreviewed-candidates", ...current, comparison: null };
  const { rawCardRows: previousRows, ...previous } = inspectRoot(againstRoot);
  const currentIds = Object.keys(currentRows).sort();
  const previousIds = Object.keys(previousRows).sort();
  const sharedIds = currentIds.filter((key) => key in previousRows);
  return {
    schemaVersion: 1,
    publicationStatus: "unreviewed-candidates",
    ...current,
    comparison: {
      againstRoot: previous.contentRoot,
      inputs: previous.inputs,
      facts: previous.facts,
      addedIds: currentIds.filter((key) => !(key in previousRows)),
      removedIds: previousIds.filter((key) => !(key in currentRows)),
      sharedIds,
      changedIds: sharedIds.filter((key) => JSON.stringify(stable(currentRows[key])) !== JSON.stringify(stable(previousRows[key]))),
      removedCardFields: previous.facts.cardFields.filter((key) => !current.facts.cardFields.includes(key)),
      addedCardFields: current.facts.cardFields.filter((key) => !previous.facts.cardFields.includes(key)),
    },
  };
}
