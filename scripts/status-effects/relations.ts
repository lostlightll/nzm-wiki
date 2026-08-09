import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

type Row = Record<string, unknown>;

type StatusEffectRelationPerk = {
  itemId: string;
  title: string;
  slot: 1 | 2 | 3 | 4;
  slug: string;
  collectModItem: number;
};

export type StatusEffectRelationSourceTables = {
  weaponModRows: Record<string, Row>;
  passiveRows: Record<string, Row>;
  mgeRows: Record<string, Row>;
  buffRows: Record<string, Row>;
  mgeAssets: Record<string, unknown>;
  perks: StatusEffectRelationPerk[];
  overlimitCardIds: ReadonlySet<string>;
};

export type StatusEffectRelation = {
  sourceId: string;
  sourceType: "perk";
  itemId: string;
  title: string;
  slot: 1 | 2 | 3 | 4;
  slug: string;
  overlimitCard: boolean;
  buffId: number;
  rowName: string;
  configName: string;
  evidence: {
    kind: "mge-add-buff";
    passiveSkillId: string;
    mgeId: string;
    addCall: string;
  };
};

export type StatusEffectRelationLock = {
  schemaVersion: 1;
  source: {
    statusEffects: "data/status-effects.json";
    weaponMods: "refs/Exports/NZM/Content/DataTables/LuaDataTable/WeaponModItemData.json";
    passives: "refs/Exports/NZM/Content/DataTables/MGE/MGEPassive_BD.json";
    mgeTable: "refs/Exports/NZM/Content/DataTables/MGE/GPModularGameplayEffectTable.json";
    buffTable: "refs/Exports/NZM/Content/DataTables/Buff/BuffConfigDatatableNew.json";
  };
  summary: {
    relations: number;
    sources: number;
    overlimitCards: number;
  };
  relations: StatusEffectRelation[];
};

type StatusEffectLockInput = {
  effects: readonly {
    buffId: number;
    variants: readonly { rowName: string }[];
  }[];
};

const ADD_BUFF_CALLS = [
  "CallFunc_AddBuffByName_ReturnValue",
  "CallFunc_MGEAddBuff_ReturnValue",
  "CallFunc_AddBuffToWeapon_ReturnValue",
] as const;

const SOURCE_PATHS = {
  statusEffects: "data/status-effects.json",
  weaponMods:
    "refs/Exports/NZM/Content/DataTables/LuaDataTable/WeaponModItemData.json",
  passives: "refs/Exports/NZM/Content/DataTables/MGE/MGEPassive_BD.json",
  mgeTable:
    "refs/Exports/NZM/Content/DataTables/MGE/GPModularGameplayEffectTable.json",
  buffTable:
    "refs/Exports/NZM/Content/DataTables/Buff/BuffConfigDatatableNew.json",
} as const;

function isRecord(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRows(filePath: string): Record<string, Row> {
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
  if (!Array.isArray(parsed) || !isRecord(parsed[0]) || !isRecord(parsed[0].Rows)) {
    throw new Error(`状态来源表结构无效：${filePath}`);
  }
  return parsed[0].Rows as Record<string, Row>;
}

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function asSlot(value: unknown): 1 | 2 | 3 | 4 | null {
  const slot = Number(value);
  return slot === 1 || slot === 2 || slot === 3 || slot === 4 ? slot : null;
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function getPassiveIdentity(value: unknown): { id: string; level: string } | null {
  const [id, level = "1"] = asString(value).split(":");
  return id ? { id, level } : null;
}

function getMgeId(passiveRow: Row | undefined): string {
  const config = isRecord(passiveRow?.MGEConfig) ? passiveRow.MGEConfig : undefined;
  return asString(config?.Id);
}

function getMgeAssetPath(refsRoot: string, mgeRow: Row | undefined): string | null {
  const mgeClass = isRecord(mgeRow?.MGEClass) ? mgeRow.MGEClass : undefined;
  const assetPath = asString(mgeClass?.AssetPathName);
  if (!assetPath.startsWith("/Game/")) return null;

  const relativeAssetPath = `${assetPath.slice("/Game/".length).split(".")[0]}.json`;
  const resolved = path.resolve(refsRoot, relativeAssetPath);
  const relative = path.relative(refsRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return resolved;
}

function visit(value: unknown, visitor: (record: Row) => void) {
  if (Array.isArray(value)) {
    for (const item of value) visit(item, visitor);
    return;
  }
  if (!isRecord(value)) return;
  visitor(value);
  for (const child of Object.values(value)) visit(child, visitor);
}

function getAddBuffEvidence(asset: unknown): {
  configName: string;
  addCall: string;
} | null {
  const configNames = new Set<string>();
  const propertyNames = new Set<string>();

  if (Array.isArray(asset)) {
    for (const exportedObject of asset) {
      if (!isRecord(exportedObject)) continue;
      const objectName = asString(exportedObject.Name);
      const properties = isRecord(exportedObject.Properties)
        ? exportedObject.Properties
        : undefined;
      if (objectName.startsWith("Default__")) {
        const configName = asString(properties?.BuffName);
        if (configName && configName !== "None") configNames.add(configName);
      }
    }
  }

  visit(asset, (record) => {
    const name = asString(record.Name);
    if (name) propertyNames.add(name);
  });

  if (configNames.size !== 1) return null;
  const addCall = ADD_BUFF_CALLS.find((candidate) =>
    [...propertyNames].some(
      (propertyName) =>
        propertyName === candidate || propertyName.startsWith(`${candidate}_`),
    ),
  );
  if (!addCall) return null;

  return { configName: [...configNames][0], addCall };
}

function readPerks(root: string): StatusEffectRelationPerk[] {
  const perkRoot = path.join(root, "data", "perks");
  const perks: StatusEffectRelationPerk[] = [];
  for (const slotDirectory of fs.readdirSync(perkRoot, { withFileTypes: true })) {
    if (!slotDirectory.isDirectory()) continue;
    const directorySlot = asSlot(slotDirectory.name.replace(/^slot-/, ""));
    if (!directorySlot) continue;

    for (const fileName of fs.readdirSync(path.join(perkRoot, slotDirectory.name))) {
      if (!fileName.endsWith(".mdx")) continue;
      const parsed = matter(
        fs.readFileSync(path.join(perkRoot, slotDirectory.name, fileName), "utf8"),
      );
      const itemId = asString(parsed.data.id);
      const title = asString(parsed.data.title);
      const slot = asSlot(parsed.data.slot) ?? directorySlot;
      if (!itemId || !title) continue;
      perks.push({
        itemId,
        title,
        slot,
        slug: fileName.slice(0, -4),
        collectModItem: Number(parsed.data.CollectMODItem ?? 0),
      });
    }
  }
  return perks.sort((left, right) => compareStrings(left.itemId, right.itemId));
}

export function readStatusEffectRelationSourceTables(
  root: string,
): StatusEffectRelationSourceTables {
  const refsRoot = path.join(root, "refs", "Exports", "NZM", "Content");
  const weaponModRows = readRows(path.join(root, SOURCE_PATHS.weaponMods));
  const passiveRows = readRows(path.join(root, SOURCE_PATHS.passives));
  const mgeRows = readRows(path.join(root, SOURCE_PATHS.mgeTable));
  const buffRows = readRows(path.join(root, SOURCE_PATHS.buffTable));
  const perks = readPerks(root);
  const overlimitCards = JSON.parse(
    fs.readFileSync(path.join(root, "data", "overlimit-cards.json"), "utf8"),
  ) as { id?: unknown }[];
  const overlimitCardIds = new Set(
    overlimitCards.map((card) => asString(card.id)).filter(Boolean),
  );
  const mgeAssets: Record<string, unknown> = {};

  for (const perk of perks) {
    if (perk.collectModItem !== 1 && !overlimitCardIds.has(perk.itemId)) continue;
    const passiveIdentity = getPassiveIdentity(weaponModRows[perk.itemId]?.PassiveSkill_ID);
    if (!passiveIdentity) continue;
    const passiveRow = passiveRows[`${passiveIdentity.id}_${passiveIdentity.level}`];
    const mgeId = getMgeId(passiveRow);
    if (!mgeId || mgeAssets[mgeId]) continue;
    const assetPath = getMgeAssetPath(refsRoot, mgeRows[mgeId]);
    if (!assetPath || !fs.existsSync(assetPath)) continue;
    mgeAssets[mgeId] = JSON.parse(fs.readFileSync(assetPath, "utf8")) as unknown;
  }

  return {
    weaponModRows,
    passiveRows,
    mgeRows,
    buffRows,
    mgeAssets,
    perks,
    overlimitCardIds,
  };
}

export function extractStatusEffectRelations(
  tables: StatusEffectRelationSourceTables,
  statusEffects: StatusEffectLockInput,
): StatusEffectRelationLock {
  const publishedRows = new Map<string, number>();
  for (const effect of statusEffects.effects) {
    for (const variant of effect.variants) publishedRows.set(variant.rowName, effect.buffId);
  }

  const buffRowsByConfigName = new Map<
    string,
    { rowName: string; buffId: number; configName: string }[]
  >();
  for (const [rowName, row] of Object.entries(tables.buffRows)) {
    const configName = asString(row.BuffName);
    const buffId = Number(row.BuffID);
    if (!configName || !Number.isFinite(buffId)) continue;
    const values = buffRowsByConfigName.get(configName) ?? [];
    values.push({ rowName, buffId, configName });
    buffRowsByConfigName.set(configName, values);
  }

  const relations: StatusEffectRelation[] = [];
  for (const perk of tables.perks) {
    const overlimitCard = tables.overlimitCardIds.has(perk.itemId);
    if (perk.collectModItem !== 1 && !overlimitCard) continue;

    const passiveIdentity = getPassiveIdentity(
      tables.weaponModRows[perk.itemId]?.PassiveSkill_ID,
    );
    if (!passiveIdentity) continue;
    const passiveRow = tables.passiveRows[`${passiveIdentity.id}_${passiveIdentity.level}`];
    const mgeId = getMgeId(passiveRow);
    if (!mgeId || !tables.mgeRows[mgeId]) continue;
    const evidence = getAddBuffEvidence(tables.mgeAssets[mgeId]);
    if (!evidence) continue;

    for (const buffRow of buffRowsByConfigName.get(evidence.configName) ?? []) {
      const publishedBuffId = publishedRows.get(buffRow.rowName);
      if (publishedBuffId === undefined || publishedBuffId !== buffRow.buffId) continue;
      relations.push({
        sourceId: `perk:${perk.itemId}`,
        sourceType: "perk",
        itemId: perk.itemId,
        title: perk.title,
        slot: perk.slot,
        slug: perk.slug,
        overlimitCard,
        buffId: publishedBuffId,
        rowName: buffRow.rowName,
        configName: buffRow.configName,
        evidence: {
          kind: "mge-add-buff",
          passiveSkillId: passiveIdentity.id,
          mgeId,
          addCall: evidence.addCall,
        },
      });
    }
  }

  relations.sort(
    (left, right) =>
      compareStrings(left.itemId, right.itemId) ||
      left.buffId - right.buffId ||
      compareStrings(left.rowName, right.rowName),
  );
  const sources = new Set(relations.map((relation) => relation.sourceId));
  const overlimitSources = new Set(
    relations.filter((relation) => relation.overlimitCard).map((relation) => relation.sourceId),
  );

  return {
    schemaVersion: 1,
    source: SOURCE_PATHS,
    summary: {
      relations: relations.length,
      sources: sources.size,
      overlimitCards: overlimitSources.size,
    },
    relations,
  };
}
