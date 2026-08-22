import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

type LocalizedText = {
  LocalizedString?: string | null;
  SourceString?: string | null;
};

type AssetReference = { AssetPathName: string };

type BasicRow = {
  SeasonID: number;
  TalentID: number;
  BeforeTalentID: string;
  TalentILevel: number;
  TalentName: LocalizedText;
  TalentIcon: AssetReference;
  TalentSkillsID: number;
  AttributeSkillsID: number;
  TalentType: number;
  TalentUpgradeMaterial: string;
  PhaseID: number;
  ColumnID: number;
  AdaptWeapon: number;
  SeasonSkill: number;
  Group: number;
  MutualGroup: string;
  PowerfulTalent: number;
};

type TalentTypeRow = {
  SeasonID: number;
  TalentType: number;
  TypeName: LocalizedText;
  TypeText: LocalizedText;
  TypeIcon: AssetReference;
};

type PhaseRow = {
  SeasonID: number;
  TalentType: number;
  PhaseID: number;
  UnlockSeasonLevel: number;
};

type PassiveRow = {
  UniqueID: number;
  SeasonID: number;
  TalentID: number;
  PassiveSkillType: number;
  PassiveSkillName: LocalizedText;
  PassiveSkillIcon: AssetReference;
  PassiveSkillsID: number;
  TagList: LocalizedText;
  IsDarkEnergy: number;
  IsDefault: number;
};

type MgeDescriptionRow = {
  MGEId: number;
  TextID: number;
  MGEDescription: LocalizedText;
};

type SkillDescriptionRow = {
  SkillId: number;
  SkillDescription: LocalizedText;
};

type AdaptWeaponRow = {
  SeasonID: number;
  TextID: number;
  TextContent: LocalizedText;
};

type StructureRow = {
  SeasonID: number;
  PhaseID: number;
  [key: `TalentColumn${number}`]: number;
};

const repoRoot = process.cwd();
const contentRoot = path.join(repoRoot, "refs-test", "Exports", "NZM", "Content");
const tableRoot = path.join(contentRoot, "DataTables", "SeasonTalent");
const dataOutput = path.join(repoRoot, "data", "season-talents", "s4");
const imageOutput = path.join(
  repoRoot,
  "public",
  "webp",
  "images",
  "season-talents",
  "s4",
  "details",
);
const publicImageRoot = "/webp/images/season-talents/s4/details";

function readRows<T>(file: string): Record<string, T> {
  const source = JSON.parse(fs.readFileSync(file, "utf8")) as Array<{
    Rows: Record<string, T>;
  }>;
  return source[0].Rows;
}

function text(value: LocalizedText | undefined) {
  return value?.LocalizedString ?? value?.SourceString ?? "";
}

function splitIds(value: string) {
  return value
    .split(/[|;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function sourceImagePath(reference: AssetReference) {
  const unrealPath = reference.AssetPathName.split(".")[0].replace(/^\/Game\//, "");
  return path.join(contentRoot, ...unrealPath.split("/")) + ".png";
}

function outputImagePath(reference: AssetReference) {
  const source = sourceImagePath(reference);
  return `${publicImageRoot}/${path.basename(source, ".png")}.webp`;
}

async function convertImage(source: string, outputName = path.basename(source, ".png")) {
  if (!fs.existsSync(source)) throw new Error(`Missing S4 image: ${source}`);
  const output = path.join(imageOutput, `${outputName}.webp`);
  await sharp(source).webp({ quality: 88, effort: 5 }).toFile(output);
}

const slugByTalentType = {
  1: "dual-star",
  2: "matrix-symbiosis",
  3: "black-hole",
} as const;

async function main() {
  const basicRows = Object.values(
    readRows<BasicRow>(path.join(tableRoot, "SeasonTalentBasicTable.json")),
  ).filter(
    (row) =>
      row.SeasonID === 4 && row.PhaseID <= 6 && row.TalentType in slugByTalentType,
  );
  const typeRows = Object.values(
    readRows<TalentTypeRow>(path.join(tableRoot, "SeasonTalentTypeTable.json")),
  ).filter((row) => row.SeasonID === 4 && row.TalentType in slugByTalentType);
  const phaseRows = Object.values(
    readRows<PhaseRow>(path.join(tableRoot, "SeasonTalentPhaseTable.json")),
  ).filter((row) => row.SeasonID === 4);
  const passiveRows = Object.values(
    readRows<PassiveRow>(path.join(tableRoot, "SeasonTalentPassiveConfigTable.json")),
  ).filter((row) => row.SeasonID === 4 && row.PassiveSkillType in slugByTalentType);
  const adaptWeaponRows = Object.values(
    readRows<AdaptWeaponRow>(path.join(tableRoot, "AdaptWeaponTable.json")),
  ).filter((row) => row.SeasonID === 4);
  const mgeRows = Object.values(
    readRows<MgeDescriptionRow>(
      path.join(contentRoot, "DataTables", "MGE", "DT_GPMGESkillDesConfigTable_Main.json"),
    ),
  );
  const skillRows = Object.values(
    readRows<SkillDescriptionRow>(
      path.join(contentRoot, "DataTables", "Ability", "DT_SkillDesConfig_Main.json"),
    ),
  );

  fs.rmSync(dataOutput, { recursive: true, force: true });
  fs.rmSync(imageOutput, { recursive: true, force: true });
  fs.mkdirSync(dataOutput, { recursive: true });
  fs.mkdirSync(imageOutput, { recursive: true });

  const assets = new Map<string, AssetReference>();
  const descriptionsByMge = new Map<number, MgeDescriptionRow[]>();
  for (const row of mgeRows) {
    const rows = descriptionsByMge.get(row.MGEId) ?? [];
    rows.push(row);
    descriptionsByMge.set(row.MGEId, rows);
  }
  for (const rows of descriptionsByMge.values()) {
    rows.sort((a, b) => a.TextID - b.TextID);
  }

  const skillDescriptions = new Map(
    skillRows.map((row) => [row.SkillId, text(row.SkillDescription)]),
  );
  const passivesByTree: Record<string, { light: unknown[]; dark: unknown[] }> = {};

  for (const typeRow of typeRows.sort((a, b) => a.TalentType - b.TalentType)) {
    const slug = slugByTalentType[typeRow.TalentType as keyof typeof slugByTalentType];
    const rowsForTree = basicRows.filter((row) => row.TalentType === typeRow.TalentType);
    const grouped = new Map<number, BasicRow[]>();
    for (const row of rowsForTree) {
      const rows = grouped.get(row.TalentID) ?? [];
      rows.push(row);
      grouped.set(row.TalentID, rows);
    }

    const structureRows = Object.values(
      readRows<StructureRow>(
        path.join(tableRoot, `SeasonTalentStructure${typeRow.TalentType}Table.json`),
      ),
    ).filter((row) => row.SeasonID === 4 && row.PhaseID <= 6);
    const structureTalentIds = new Set(
      structureRows.flatMap((row) =>
        Object.entries(row)
          .filter(([key, value]) => key.startsWith("TalentColumn") && Number(value) > 0)
          .map(([, value]) => Number(value)),
      ),
    );
    for (const talentId of structureTalentIds) {
      if (!grouped.has(talentId)) throw new Error(`Missing basic row for ${talentId}`);
    }

    const root = [...grouped.values()]
      .map((rows) => rows[0])
      .find((row) => row.SeasonSkill > 0);
    if (!root) throw new Error(`Missing root talent for ${slug}`);

    const phaseUnlocks = new Map(
      phaseRows
        .filter((row) => row.TalentType === typeRow.TalentType)
        .map((row) => [row.PhaseID, row.UnlockSeasonLevel]),
    );

    const nodes = [...grouped.values()]
      .map((rows) => {
        rows.sort((a, b) => a.TalentILevel - b.TalentILevel);
        const row = rows[0];
        assets.set(sourceImagePath(row.TalentIcon), row.TalentIcon);
        const mgeId = row.TalentSkillsID || row.AttributeSkillsID;
        const descriptions = row.SeasonSkill
          ? [skillDescriptions.get(row.SeasonSkill) ?? "暂无技能说明"]
          : (descriptionsByMge.get(mgeId) ?? []).map((description) =>
              text(description.MGEDescription),
            );
        const mutualIds = [row.Group, ...splitIds(row.MutualGroup).map(Number)]
          .filter((value) => value > 0)
          .sort((a, b) => a - b);
        return {
          id: String(row.TalentID),
          name: text(row.TalentName),
          descriptions: descriptions.length > 0 ? descriptions : ["暂无技能说明"],
          icon: outputImagePath(row.TalentIcon),
          phase: row.PhaseID,
          column: row.ColumnID,
          maxLevel: rows.length,
          prerequisites: splitIds(row.BeforeTalentID),
          mutualGroup: mutualIds.length > 1 ? mutualIds.join("-") : null,
          isRoot: row.TalentID === root.TalentID,
          unlockLevel: phaseUnlocks.get(row.PhaseID) ?? 0,
          powerful: row.PowerfulTalent === 1,
        };
      })
      .sort((a, b) => a.phase - b.phase || a.column - b.column);

    assets.set(sourceImagePath(typeRow.TypeIcon), typeRow.TypeIcon);
    const applicable = adaptWeaponRows.find((row) => row.TextID === root.AdaptWeapon);
    const tree = {
      draft: true,
      id: slug,
      talentType: typeRow.TalentType,
      name: text(typeRow.TypeName),
      subtitle: text(typeRow.TypeText),
      applicableWeapons: text(applicable?.TextContent),
      icon: outputImagePath(typeRow.TypeIcon),
      pointLimit: 40,
      nodes,
    };
    fs.writeFileSync(
      path.join(dataOutput, `${slug}.json`),
      `${JSON.stringify(tree, null, 2)}\n`,
    );

    const treePassives = passiveRows
      .filter((row) => row.PassiveSkillType === typeRow.TalentType)
      .sort((a, b) => a.UniqueID - b.UniqueID)
      .map((row) => {
        assets.set(sourceImagePath(row.PassiveSkillIcon), row.PassiveSkillIcon);
        return {
          id: String(row.TalentID),
          name: text(row.PassiveSkillName),
          description:
            text(descriptionsByMge.get(row.PassiveSkillsID)?.[0]?.MGEDescription) ||
            "暂无技能说明",
          icon: outputImagePath(row.PassiveSkillIcon),
          energy: row.IsDarkEnergy === 2 ? "dark" : "light",
          isDefault: row.IsDefault === 1,
          tags: splitIds(text(row.TagList)),
        };
      });
    passivesByTree[slug] = {
      light: treePassives.filter((passive) => passive.energy === "light"),
      dark: treePassives.filter((passive) => passive.energy === "dark"),
    };
  }

  fs.writeFileSync(
    path.join(dataOutput, "passives.json"),
    `${JSON.stringify({ draft: true, trees: passivesByTree }, null, 2)}\n`,
  );

  await Promise.all([...assets.keys()].map((source) => convertImage(source)));
  const hudRoot = path.join(
    contentRoot,
    "UI",
    "UI_Textures",
    "SeasonalTalent",
    "SeasonalTalentS4",
    "SP",
  );
  await Promise.all([
    convertImage(path.join(hudRoot, "T_TalentS4_MainBg_1.png"), "main-background"),
    convertImage(path.join(hudRoot, "T_TalentS4_Bg_1.png"), "grid-orange"),
    convertImage(path.join(hudRoot, "T_TalentS4_Bg_2.png"), "grid-blue"),
    convertImage(path.join(hudRoot, "T_TalentS4_GeneralTalents_Bg.png"), "general-grid"),
    convertImage(path.join(hudRoot, "T_TalentS4_02_SP.png"), "hud-frame"),
  ]);

  console.log(`Generated ${typeRows.length} S4 trees and ${passiveRows.length} passives.`);
  console.log(`Converted ${assets.size + 5} S4 detail images.`);
}

void main();
