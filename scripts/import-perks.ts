/**
 * 从 refs 审计并导入武器插件。
 *
 * 默认只输出差异，不修改文件：
 *   pnpm exec tsx scripts/import-perks.ts
 *   pnpm exec tsx scripts/import-perks.ts 肾上腺素
 *   pnpm exec tsx scripts/import-perks.ts --ids 20703040432 --json
 *
 * 显式写入时会：
 * - 为缺失插件创建 draft MDX
 * - 补齐已有 MDX 中为空的 id、icon、weaponType、description
 * - 复制缺失的插件图标
 *
 * 已有非空字段和 MDX 正文永远不会被覆盖。
 */
import fs from "fs";
import path from "path";
import matter from "gray-matter";

const ROOT_DIR = process.cwd();
const REFS_DIR = path.join(ROOT_DIR, "refs/Exports/NZM/Content");
const PERKS_DIR = path.join(ROOT_DIR, "data/perks");
const ICONS_DIR = path.join(ROOT_DIR, "public/icons/perks");

const REF_FILES = {
  mods: "DataTables/LuaDataTable/WeaponModItemData.json",
  items: "DataTables/System/Items/CommonItemDataTable.json",
  descriptions: "DataTables/MGE/DT_GPMGESkillDesConfigTable_Main.json",
  modifiers: "Attributes/AutoGenerate/numerical_modifier_config.json",
  tags: "DataTables/LuaDataTable/WeaponModItemTagData.json",
  sets: "DataTables/LuaDataTable/WeaponModSetTable.json",
} as const;

const NUMERICAL_FILES = [
  "DataTables/numerical_config_composite.json",
  "DataTables/numerical_config_equip.json",
  "DataTables/numerical_config_playerskill.json",
];

interface LocalizedText {
  LocalizedString?: string;
  SourceString?: string;
}

interface ValueList {
  Values?: number[];
}

interface AssetRef {
  AssetPathName?: string;
}

interface ModRow {
  MODItemID?: number;
  MODName?: LocalizedText;
  MODSlotIndex?: ValueList;
  PassiveSkill_ID?: string;
  SuitableWeaponType?: ValueList;
  SuitableWeaponTypeList?: ValueList;
  SuittableWeaponItem?: ValueList;
  TagList?: ValueList;
  ModSets?: string;
  CollectMODItem?: number;
  MakeMODItem?: number;
  IsCooked?: boolean;
}

interface ItemRow {
  ItemID?: number;
  Quality?: number;
  IconPath?: {
    NormalIcon?: AssetRef;
  };
}

interface DescriptionRow {
  MGEDescription?: LocalizedText;
}

interface ModifierRow {
  BaseValue?: number;
  CoefValue?: number;
  [key: string]: unknown;
}

interface TagRow {
  TagID?: number;
  TagName?: LocalizedText;
}

interface SetRow {
  SetId?: number;
  SetName?: LocalizedText;
}

interface ExistingPerk {
  filePath: string;
  content: string;
  data: Record<string, unknown>;
  id: string;
  name: string;
}

interface PerkRecord {
  id: string;
  name: string;
  slot: number;
  rarity: number;
  icon: string;
  iconAssetPath: string;
  iconSourcePath: string;
  weaponType: number[];
  weaponItems: number[];
  tags: string[];
  sets: string[];
  passiveSkillId: string;
  description: string;
  unresolvedTokens: string[];
  collectable: boolean;
  craftable: boolean;
}

interface Options {
  write: boolean;
  includeHidden: boolean;
  json: boolean;
  season: string;
  ids: Set<string>;
  names: Set<string>;
  limit: number;
  help: boolean;
}

interface FieldPatch {
  key: string;
  value: unknown;
}

function refPath(relativePath: string): string {
  return path.join(REFS_DIR, ...relativePath.split("/"));
}

function loadRows<T>(relativePath: string): Record<string, T> {
  const filePath = refPath(relativePath);
  if (!fs.existsSync(filePath)) {
    throw new Error(`缺少 refs 文件: ${filePath}`);
  }

  const data = JSON.parse(fs.readFileSync(filePath, "utf8")) as Array<{
    Rows?: Record<string, T>;
  }>;
  return data[0]?.Rows ?? {};
}

function textValue(value?: LocalizedText): string {
  return (value?.LocalizedString ?? value?.SourceString ?? "").trim();
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    write: false,
    includeHidden: false,
    json: false,
    season: "pending",
    ids: new Set(),
    names: new Set(),
    limit: 30,
    help: false,
  };

  const addList = (target: Set<string>, raw: string) => {
    for (const value of raw.split(/[，,]/).map((item) => item.trim())) {
      if (value) target.add(value);
    }
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--write") {
      options.write = true;
    } else if (arg === "--include-hidden" || arg === "--all") {
      options.includeHidden = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--ids" || arg === "--id") {
      addList(options.ids, argv[++index] ?? "");
    } else if (arg.startsWith("--ids=") || arg.startsWith("--id=")) {
      addList(options.ids, arg.slice(arg.indexOf("=") + 1));
    } else if (arg === "--season") {
      options.season = argv[++index] ?? options.season;
    } else if (arg.startsWith("--season=")) {
      options.season = arg.slice("--season=".length) || options.season;
    } else if (arg === "--limit") {
      options.limit = Number(argv[++index] ?? options.limit);
    } else if (arg.startsWith("--limit=")) {
      options.limit = Number(arg.slice("--limit=".length));
    } else if (arg.startsWith("-")) {
      throw new Error(`未知参数: ${arg}`);
    } else {
      addList(options.names, arg);
    }
  }

  if (!Number.isFinite(options.limit) || options.limit < 0) {
    throw new Error("--limit 必须是大于或等于 0 的数字");
  }

  return options;
}

function printHelp() {
  console.log(`插件 refs 导入器

用法:
  pnpm exec tsx scripts/import-perks.ts
  pnpm exec tsx scripts/import-perks.ts 插件名 [插件名...]
  pnpm exec tsx scripts/import-perks.ts --ids 20703040432 --write --season s2

参数:
  --write            创建缺失草稿，并补齐已有页面的空字段
  --include-hidden   包含 refs 中未标记为可收集的测试、旧版或隐藏插件
  --ids <id,...>     按插件 ID 筛选
  --season <value>   新草稿的 season，默认 pending
  --json             输出完整 JSON 报告
  --limit <number>   文本报告每组最多显示多少项，默认 30
`);
}

function loadNumericalRows(): Map<string, Record<string, unknown>> {
  const result = new Map<string, Record<string, unknown>>();
  for (const relativePath of NUMERICAL_FILES) {
    const filePath = refPath(relativePath);
    if (!fs.existsSync(filePath)) continue;
    const rows = loadRows<Record<string, unknown>>(relativePath);
    for (const [key, row] of Object.entries(rows)) {
      if (!result.has(key)) result.set(key, row);
    }
  }
  return result;
}

function getCaseInsensitive(row: Record<string, unknown>, key: string): unknown {
  const actualKey = Object.keys(row).find(
    (candidate) => candidate.toLowerCase() === key.toLowerCase(),
  );
  return actualKey ? row[actualKey] : undefined;
}

function formatNumber(value: number): string {
  const rounded = Math.round(value * 10000) / 10000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function formatModifierValue(value: number, format: string): string {
  if (format === "2" || format === "13" || format === "10" || format === "15") {
    return `${formatNumber(value * 100)}%`;
  }
  return formatNumber(value);
}

function formatNumericalValue(value: number, format: string): string {
  if (format === "2") return formatNumber(value * 100);
  if (format === "13") return `${formatNumber(value * 100)}%`;
  return formatNumber(value);
}

function resolveDescription(
  raw: string,
  modifiers: Record<string, ModifierRow>,
  numericals: Map<string, Record<string, unknown>>,
): { description: string; unresolvedTokens: string[] } {
  let description = raw;

  description = description.replace(
    /\{GPModifier:(\d+):([^:}]+):(\d+):([^:}]+)(?::[^}]+)?\}/gi,
    (token, id: string, field: string, index: string, format: string) => {
      const row = modifiers[`${id}_1_${index}`];
      const value = row ? getCaseInsensitive(row, field) : undefined;
      return typeof value === "number" ? formatModifierValue(value, format) : token;
    },
  );

  description = description.replace(
    /\{GPNumericalID:(\d+):([^:}]+):([^:}]+)(?::[^}]+)?\}/gi,
    (token, id: string, field: string, format: string) => {
      const row = numericals.get(`${id}_1`);
      const value = row ? getCaseInsensitive(row, field) : undefined;
      return typeof value === "number" ? formatNumericalValue(value, format) : token;
    },
  );

  description = description
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<(?:qiangdiao|emphasize|Shock|T\d+)>/gi, "**")
    .replace(/<\/>/g, "**")
    .replace(/<[^>]+>/g, "")
    .replace(/\*{4,}/g, "**")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const unresolvedTokens = Array.from(new Set(description.match(/\{[^}]+\}/g) ?? []));
  return { description, unresolvedTokens };
}

function iconInfo(assetPath: string): {
  icon: string;
  sourcePath: string;
} {
  if (!assetPath || assetPath === "None") return { icon: "", sourcePath: "" };

  const packagePath = assetPath.split(".")[0];
  const baseName = path.posix.basename(packagePath);
  const icon = baseName.match(/MGE_(\d+)/i)?.[1] ?? baseName.match(/(\d+)$/)?.[1] ?? "";
  const relativePath = packagePath.startsWith("/Game/")
    ? `${packagePath.slice("/Game/".length)}.png`
    : "";

  return {
    icon,
    sourcePath: relativePath ? refPath(relativePath) : "",
  };
}

function splitNumberList(value?: ValueList): number[] {
  return Array.from(new Set(value?.Values ?? []));
}

function buildRecords(): PerkRecord[] {
  const mods = loadRows<ModRow>(REF_FILES.mods);
  const items = loadRows<ItemRow>(REF_FILES.items);
  const descriptions = loadRows<DescriptionRow>(REF_FILES.descriptions);
  const modifiers = loadRows<ModifierRow>(REF_FILES.modifiers);
  const tags = loadRows<TagRow>(REF_FILES.tags);
  const sets = loadRows<SetRow>(REF_FILES.sets);
  const numericals = loadNumericalRows();

  const tagNames = new Map<number, string>();
  for (const row of Object.values(tags)) {
    if (row.TagID) tagNames.set(row.TagID, textValue(row.TagName));
  }

  const setNames = new Map<number, string>();
  for (const row of Object.values(sets)) {
    if (row.SetId) setNames.set(row.SetId, textValue(row.SetName));
  }

  const records: PerkRecord[] = [];
  for (const row of Object.values(mods)) {
    const id = String(row.MODItemID ?? "");
    const name = textValue(row.MODName);
    const slot = row.MODSlotIndex?.Values?.[0] ?? 0;
    const item = items[id];
    const quality = item?.Quality ?? 0;

    if (!id || !name || name === "占位符" || slot < 1 || slot > 4 || !item) continue;

    const passiveSkillId = row.PassiveSkill_ID ?? "";
    const descriptionKey = passiveSkillId.replace(":", "_");
    const rawDescription = textValue(descriptions[descriptionKey]?.MGEDescription);
    const resolved = resolveDescription(rawDescription, modifiers, numericals);
    const assetPath = item.IconPath?.NormalIcon?.AssetPathName ?? "";
    const icon = iconInfo(assetPath);
    const primaryWeaponTypes = splitNumberList(row.SuitableWeaponType);
    const fallbackWeaponTypes = splitNumberList(row.SuitableWeaponTypeList);

    records.push({
      id,
      name,
      slot,
      rarity: Math.max(0, quality - 1),
      icon: icon.icon,
      iconAssetPath: assetPath,
      iconSourcePath: icon.sourcePath,
      weaponType: primaryWeaponTypes.length > 0 ? primaryWeaponTypes : fallbackWeaponTypes,
      weaponItems: splitNumberList(row.SuittableWeaponItem),
      tags: splitNumberList(row.TagList)
        .map((tagId) => tagNames.get(tagId) ?? String(tagId))
        .filter(Boolean),
      sets: (row.ModSets ?? "")
        .split(";")
        .map(Number)
        .filter(Boolean)
        .map((setId) => setNames.get(setId) ?? String(setId)),
      passiveSkillId,
      description: resolved.description,
      unresolvedTokens: resolved.unresolvedTokens,
      collectable: row.CollectMODItem === 1,
      craftable: row.MakeMODItem === 1,
    });
  }

  return records.sort((a, b) => Number(a.id) - Number(b.id));
}

function loadExistingPerks(): ExistingPerk[] {
  const result: ExistingPerk[] = [];
  for (let slot = 1; slot <= 4; slot++) {
    const slotDir = path.join(PERKS_DIR, `slot-${slot}`);
    if (!fs.existsSync(slotDir)) continue;

    for (const file of fs.readdirSync(slotDir).filter((name) => name.endsWith(".mdx"))) {
      const filePath = path.join(slotDir, file);
      const content = fs.readFileSync(filePath, "utf8");
      const parsed = matter(content);
      result.push({
        filePath,
        content,
        data: parsed.data,
        id: String(parsed.data.id ?? ""),
        name: String(parsed.data.title ?? file.replace(/\.mdx$/, "")),
      });
    }
  }
  return result;
}

function isBlank(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

function comparableArray(value: unknown): string {
  return JSON.stringify(Array.isArray(value) ? value.map(Number).sort((a, b) => a - b) : []);
}

function yamlValue(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return JSON.stringify(value);
  return JSON.stringify(value);
}

function patchFrontmatter(content: string, patches: FieldPatch[]): string {
  const frontmatterMatch = content.match(/^(---\r?\n)([\s\S]*?)(\r?\n---)/);
  if (!frontmatterMatch) return content;

  let frontmatter = frontmatterMatch[2];
  for (const patch of patches) {
    const fieldPattern = new RegExp(`^${patch.key}:.*$`, "m");
    const line = `${patch.key}: ${yamlValue(patch.value)}`;
    if (fieldPattern.test(frontmatter)) {
      frontmatter = frontmatter.replace(fieldPattern, line);
    } else {
      frontmatter = `${frontmatter.replace(/\s*$/, "")}\n${line}`;
    }
  }

  return `${frontmatterMatch[1]}${frontmatter}${frontmatterMatch[3]}${content.slice(frontmatterMatch[0].length)}`;
}

function safeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "-").replace(/[. ]+$/g, "");
}

function createMdx(record: PerkRecord, season: string): string {
  const lines = [
    "---",
    `title: ${yamlValue(record.name)}`,
    `id: ${yamlValue(record.id)}`,
    `slot: ${record.slot}`,
    `rarity: ${record.rarity}`,
    `icon: ${yamlValue(record.icon)}`,
    `weaponType: ${yamlValue(record.weaponType)}`,
    `season: ${yamlValue(season)}`,
    `description: ${yamlValue(record.description)}`,
    "draft: true",
  ];

  if (record.tags.length > 0) {
    lines.push("keywords:", ...record.tags.map((tag) => `  - ${yamlValue(tag)}`));
  }

  lines.push("---", "");
  return lines.join("\n");
}

function copyIcon(record: PerkRecord): "copied" | "existing" | "missing" | "none" {
  if (!record.icon) return "none";
  if (!record.iconSourcePath || !fs.existsSync(record.iconSourcePath)) return "missing";

  fs.mkdirSync(ICONS_DIR, { recursive: true });
  const destination = path.join(ICONS_DIR, `${record.icon}.png`);
  if (fs.existsSync(destination)) return "existing";
  fs.copyFileSync(record.iconSourcePath, destination);
  return "copied";
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const allRecords = buildRecords();
  const existing = loadExistingPerks();
  const recordsById = new Map(allRecords.map((record) => [record.id, record]));
  const recordsByName = new Map(allRecords.map((record) => [record.name, record]));
  const existingById = new Map(existing.filter((perk) => perk.id).map((perk) => [perk.id, perk]));
  const existingByName = new Map(existing.map((perk) => [perk.name, perk]));
  const hasSelector = options.ids.size > 0 || options.names.size > 0;

  const unknownIds = Array.from(options.ids).filter((id) => !recordsById.has(id));
  const unknownNames = Array.from(options.names).filter((name) => !recordsByName.has(name));
  if (unknownIds.length > 0 || unknownNames.length > 0) {
    throw new Error(
      `refs 中未找到: ${[...unknownIds, ...unknownNames].join(", ")}`,
    );
  }

  const selected = allRecords.filter((record) => {
    if (hasSelector) return options.ids.has(record.id) || options.names.has(record.name);
    if (options.includeHidden) return true;
    return record.collectable;
  });

  const missing: PerkRecord[] = [];
  const matchedByName: Array<{ record: PerkRecord; existing: ExistingPerk }> = [];
  const patches: Array<{ record: PerkRecord; existing: ExistingPerk; fields: FieldPatch[] }> = [];
  const drifts: Array<{
    id: string;
    name: string;
    filePath: string;
    fields: Record<string, { local: unknown; refs: unknown }>;
  }> = [];

  for (const record of selected) {
    const byId = existingById.get(record.id);
    const byName = existingByName.get(record.name);
    const local = byId ?? byName;
    if (!local) {
      missing.push(record);
      continue;
    }
    if (!byId && byName) matchedByName.push({ record, existing: byName });

    const fields: FieldPatch[] = [];
    if (isBlank(local.data.id)) fields.push({ key: "id", value: record.id });
    if (isBlank(local.data.icon) && record.icon) fields.push({ key: "icon", value: record.icon });
    if (isBlank(local.data.weaponType) && record.weaponType.length > 0) {
      fields.push({ key: "weaponType", value: record.weaponType });
    }
    if (isBlank(local.data.description) && record.description) {
      fields.push({ key: "description", value: record.description });
    }
    if (fields.length > 0) patches.push({ record, existing: local, fields });

    const driftFields: Record<string, { local: unknown; refs: unknown }> = {};
    if (local.name !== record.name) {
      driftFields.title = { local: local.name, refs: record.name };
    }
    if (Number(local.data.slot) !== record.slot) {
      driftFields.slot = { local: local.data.slot, refs: record.slot };
    }
    if (Number(local.data.rarity) !== record.rarity) {
      driftFields.rarity = { local: local.data.rarity, refs: record.rarity };
    }
    if (!isBlank(local.data.icon) && record.icon && String(local.data.icon) !== record.icon) {
      driftFields.icon = { local: local.data.icon, refs: record.icon };
    }
    if (
      !isBlank(local.data.weaponType) &&
      record.weaponType.length > 0 &&
      comparableArray(local.data.weaponType) !== comparableArray(record.weaponType)
    ) {
      driftFields.weaponType = { local: local.data.weaponType, refs: record.weaponType };
    }
    if (Object.keys(driftFields).length > 0) {
      drifts.push({
        id: record.id,
        name: record.name,
        filePath: local.filePath,
        fields: driftFields,
      });
    }
  }

  const orphanExisting = existing.filter(
    (perk) => !recordsById.has(perk.id) && !recordsByName.has(perk.name),
  );
  const hiddenExisting = existing.filter((perk) => {
    const record = recordsById.get(perk.id) ?? recordsByName.get(perk.name);
    return record ? !record.collectable : false;
  });
  const unresolved = selected.filter((record) => record.unresolvedTokens.length > 0);

  const writeResult = {
    created: [] as string[],
    patched: [] as Array<{ filePath: string; fields: string[] }>,
    copiedIcons: [] as string[],
    missingIcons: [] as string[],
  };

  if (options.write) {
    for (const item of patches) {
      const updated = patchFrontmatter(item.existing.content, item.fields);
      if (updated !== item.existing.content) {
        fs.writeFileSync(item.existing.filePath, updated, "utf8");
        writeResult.patched.push({
          filePath: item.existing.filePath,
          fields: item.fields.map((field) => field.key),
        });
      }

      const iconStatus = copyIcon(item.record);
      if (iconStatus === "copied") writeResult.copiedIcons.push(item.record.icon);
      if (iconStatus === "missing") writeResult.missingIcons.push(item.record.iconAssetPath);
    }

    for (const record of missing) {
      const slotDir = path.join(PERKS_DIR, `slot-${record.slot}`);
      const filePath = path.join(slotDir, `${safeFileName(record.name)}.mdx`);
      fs.mkdirSync(slotDir, { recursive: true });
      if (fs.existsSync(filePath)) {
        throw new Error(`拒绝覆盖已有文件: ${filePath}`);
      }
      fs.writeFileSync(filePath, createMdx(record, options.season), "utf8");
      writeResult.created.push(filePath);

      const iconStatus = copyIcon(record);
      if (iconStatus === "copied") writeResult.copiedIcons.push(record.icon);
      if (iconStatus === "missing") writeResult.missingIcons.push(record.iconAssetPath);
    }
  }

  const report = {
    mode: options.write ? "write" : "audit",
    scope: hasSelector ? "selected" : options.includeHidden ? "all" : "collectable",
    refs: {
      total: allRecords.length,
      selected: selected.length,
      collectable: allRecords.filter((record) => record.collectable).length,
      craftable: allRecords.filter((record) => record.craftable).length,
    },
    local: {
      total: existing.length,
      orphan: orphanExisting.map((perk) => ({
        id: perk.id,
        name: perk.name,
        filePath: perk.filePath,
      })),
      hidden: hiddenExisting.map((perk) => ({
        id: perk.id,
        name: perk.name,
        filePath: perk.filePath,
      })),
    },
    missing: missing.map((record) => ({
      id: record.id,
      name: record.name,
      slot: record.slot,
      rarity: record.rarity,
      description: record.description,
      unresolvedTokens: record.unresolvedTokens,
    })),
    matchedByName: matchedByName.map(({ record, existing: local }) => ({
      id: record.id,
      name: record.name,
      filePath: local.filePath,
    })),
    patchable: patches.map(({ record, existing: local, fields }) => ({
      id: record.id,
      name: record.name,
      filePath: local.filePath,
      fields: fields.map((field) => field.key),
    })),
    drifts,
    unresolved: unresolved.map((record) => ({
      id: record.id,
      name: record.name,
      tokens: record.unresolvedTokens,
    })),
    writeResult,
  };

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const printItems = <T>(title: string, items: T[], format: (item: T) => string) => {
    console.log(`\n${title}: ${items.length}`);
    for (const item of items.slice(0, options.limit)) console.log(`  ${format(item)}`);
    if (items.length > options.limit) console.log(`  ... 其余 ${items.length - options.limit} 项`);
  };

  console.log(
    `refs 插件 ${allRecords.length}，当前范围 ${selected.length}，本地 MDX ${existing.length}`,
  );
  console.log(
    `缺失 ${missing.length}，可补空字段 ${patches.length}，字段漂移 ${drifts.length}，未解析描述 ${unresolved.length}`,
  );

  printItems("待创建", report.missing, (item) => `${item.id} [${item.slot}] ${item.name}`);
  printItems(
    "待补字段",
    report.patchable,
    (item) => `${item.id} ${item.name}: ${item.fields.join(", ")}`,
  );
  printItems(
    "需人工判断的漂移",
    report.drifts,
    (item) => `${item.id} ${item.name}: ${Object.keys(item.fields).join(", ")}`,
  );
  printItems(
    "未解析描述",
    report.unresolved,
    (item) => `${item.id} ${item.name}: ${item.tokens.join(", ")}`,
  );

  if (options.write) {
    console.log(
      `\n已创建 ${writeResult.created.length}，已补字段 ${writeResult.patched.length}，已复制图标 ${writeResult.copiedIcons.length}`,
    );
    if (writeResult.missingIcons.length > 0) {
      console.log(`缺失图标 ${writeResult.missingIcons.length}`);
    }
  } else {
    console.log("\n当前为审计模式；确认范围后加 --write 才会修改文件。");
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
