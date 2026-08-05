import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import matter from "gray-matter";
import {
  auditMigrationDecisions,
  currentMigrationConsumerDifferences,
  DEFAULT_MIGRATION_DECISIONS_PATH,
  migrationDecisionsV2Schema,
} from "./bulk-migration";
import {
  PROTOTYPE_NUMERICAL_FIELDS,
  WEAPON_DATA_SOURCE_FILES,
  createWeaponDataSourceReader,
  type PrototypeNumericalField,
} from "./source-reader";
import type {
  DamageSection,
  NumericalTable,
  WeaponDataSourceRef,
} from "../../lib/weapon-source-v2";

const ROOT = process.cwd();
const CONTENT_ROOT = path.join(ROOT, "refs", "Exports", "NZM", "Content");
const WEAPON_ITEM_TABLE = "DataTables/WeaponItemTable.json";

type Locator =
  | { readonly kind: "primary" }
  | { readonly kind: "damage_mode"; readonly mode: number }
  | { readonly kind: "extra_mode"; readonly name: string };

interface AssetEvidenceConfig {
  readonly path: string;
  readonly value: number;
}

interface SourceConfig {
  readonly key: string;
  readonly locator: Locator;
  readonly id: string;
  readonly name: string;
  readonly section: DamageSection;
  readonly label?: string | null;
  readonly numericalId: number;
  readonly ascTypeId?: string;
  readonly prototypeMode?: number;
  readonly inherits?: string;
  readonly addition?: boolean;
  readonly assetEvidence?: AssetEvidenceConfig;
  readonly manualEvidenceIds?: readonly string[];
  readonly confirmedFields?: Readonly<
    Record<
      string,
      {
        readonly value: unknown;
        readonly owner: "game_data" | "wiki_semantics";
        readonly reason: string;
        readonly evidenceIds: readonly string[];
      }
    >
  >;
}

interface WeaponConfig {
  readonly prototypeId: string;
  readonly identityName?: string;
  readonly tables?: readonly NumericalTable[];
  readonly activeSkillId?: number;
  readonly activeSkillCorrection?: {
    readonly from: number;
    readonly to: number;
    readonly reason: string;
  };
  readonly cooldownCorrection?: {
    readonly from: number;
    readonly to: number;
    readonly reason: string;
  };
  readonly sources: readonly SourceConfig[];
  readonly preexistingV2?: boolean;
}

interface AuditRow {
  readonly title?: unknown;
  readonly status?: unknown;
  readonly error?: unknown;
  readonly gaps?: readonly { readonly source: string; readonly field: string }[];
  readonly snapshot_gaps?: readonly { readonly pointer: string }[];
}

interface AuditReport {
  readonly tables: Record<NumericalTable, readonly AuditRow[]>;
}

const mode = (value: number): Locator => ({ kind: "damage_mode", mode: value });
const extra = (name: string): Locator => ({ kind: "extra_mode", name });
const primary: Locator = { kind: "primary" };

const ATTENUATION_OVERRIDE = {
  value: { status: "not_applicable" },
  owner: "wiki_semantics" as const,
  reason: "实测确认该武器不适用距离衰减，忽略 ASC 中的非法衰减区间",
  evidenceIds: ["manual-task77-attenuation"],
};

const configs: Readonly<Record<string, WeaponConfig>> = {
  暗夜之殇: {
    prototypeId: "20007000004",
    activeSkillId: 5100101,
    activeSkillCorrection: {
      from: 0,
      to: 5100101,
      reason: "Prototype 与 PVE 技能链确认主动技能为 5100101",
    },
    cooldownCorrection: {
      from: 30,
      to: 45,
      reason: "PVE 5100101_1 ChargeNeedTime 确认为 45 秒",
    },
    sources: [
      {
        key: "damage-mode:0",
        locator: mode(0),
        id: "pu-tong-she-ji",
        name: "普通射击",
        section: "fire_mode",
        numericalId: 120700010,
        ascTypeId: "36",
        prototypeMode: 0,
      },
      {
        key: "damage-mode:1",
        locator: mode(1),
        id: "bao-zha-dan",
        name: "爆炸弹",
        section: "special",
        numericalId: 17000011,
        assetEvidence: {
          path: "Weapon/Data/Pistol/Pistol_20007000004_ZZ_AYZS/MGE/MGE_1007004001_AYZS.json",
          value: 17000011,
        },
      },
    ],
  },
  春雷震: {
    prototypeId: "20016000006",
    sources: [
      {
        key: "damage-mode:0",
        locator: mode(0),
        id: "liu-dan-ming-zhong",
        name: "榴弹命中",
        section: "fire_mode",
        numericalId: 121600061,
        ascTypeId: "329",
        prototypeMode: 0,
      },
      {
        key: "damage-mode:1",
        locator: mode(1),
        id: "liu-dan-bao-zha",
        name: "榴弹爆炸",
        section: "special",
        numericalId: 121600060,
        prototypeMode: 0,
      },
    ],
  },
  杜瓦瓶: {
    prototypeId: "20015000001",
    sources: [
      {
        key: "damage-mode:0",
        locator: mode(0),
        id: "pu-tong-she-ji",
        name: "普通射击",
        section: "fire_mode",
        numericalId: 121500010,
        ascTypeId: "122",
        prototypeMode: 0,
        confirmedFields: { attenuation: ATTENUATION_OVERRIDE },
      },
    ],
  },
  钢铁轰鸣: {
    prototypeId: "20016000004",
    sources: [
      {
        key: "damage-mode:0",
        locator: mode(0),
        id: "liu-dan-ming-zhong",
        name: "榴弹命中",
        section: "fire_mode",
        numericalId: 121600011,
        ascTypeId: "117",
        prototypeMode: 0,
      },
      {
        key: "damage-mode:1",
        locator: mode(1),
        id: "liu-dan-bao-zha",
        name: "榴弹爆炸",
        section: "special",
        numericalId: 121600010,
        prototypeMode: 0,
      },
      {
        key: "damage-mode:2",
        locator: mode(2),
        id: "liu-dan-chuan-tou",
        name: "榴弹穿透",
        section: "special",
        numericalId: 121600012,
      },
    ],
  },
  鬼铜蚀: {
    prototypeId: "20015000006",
    sources: [
      {
        key: "damage-mode:0",
        locator: mode(0),
        id: "pu-tong-she-ji",
        name: "普通射击",
        section: "fire_mode",
        numericalId: 121500063,
        ascTypeId: "263",
        prototypeMode: 0,
        confirmedFields: { attenuation: ATTENUATION_OVERRIDE },
      },
      {
        key: "extra-mode:换弹爆炸",
        locator: extra("换弹爆炸"),
        id: "huan-tan-bao-zha",
        name: "换弹爆炸",
        section: "special",
        numericalId: 121500062,
        assetEvidence: {
          path: "Weapon/Data/Blaster/Blaster_20015000006_null_QTPSQ/MGE/BP_ReloadlThrowGunProjectile_QTPSQ.json",
          value: 121500062,
        },
      },
      {
        key: "extra-mode:Dot池伤害",
        locator: extra("Dot池伤害"),
        id: "d-o-t-chi-shang-hai",
        name: "Dot池伤害",
        section: "dot",
        numericalId: 121500061,
      },
      {
        key: "extra-mode:回血恢复",
        locator: extra("Dot池伤害（回血插件）"),
        id: "hui-xue-hui-fu",
        name: "回血恢复",
        section: "special",
        label: null,
        numericalId: 121500065,
        manualEvidenceIds: ["manual-task77-guitong"],
        assetEvidence: {
          path: "DataTables/Buff/BuffConfigDatatableNew.json",
          value: 121500065,
        },
      },
      {
        key: "extra-mode:Dot池伤害（减速插件）",
        locator: extra("Dot池伤害（减速插件）"),
        id: "d-o-t-chi-shang-hai-jian-su-cha-jian",
        name: "Dot池伤害（减速插件）",
        section: "dot",
        numericalId: 121500064,
        manualEvidenceIds: ["manual-task77-guitong"],
        assetEvidence: {
          path: "DataTables/Buff/BuffConfigDatatableNew.json",
          value: 121500064,
        },
      },
    ],
  },
  哈士奇好友: {
    prototypeId: "20016000011",
    sources: [
      {
        key: "damage-mode:0",
        locator: mode(0),
        id: "liu-dan-ming-zhong",
        name: "榴弹命中",
        section: "fire_mode",
        numericalId: 121600111,
        ascTypeId: "371",
        prototypeMode: 0,
      },
      {
        key: "damage-mode:1",
        locator: mode(1),
        id: "liu-dan-bao-zha",
        name: "榴弹爆炸",
        section: "special",
        numericalId: 121600110,
        prototypeMode: 0,
      },
      {
        key: "extra-mode:哈士奇命中",
        locator: extra("哈士奇命中"),
        id: "ha-shi-qi-ming-zhong",
        name: "哈士奇命中",
        section: "special",
        numericalId: 121600115,
      },
      {
        key: "extra-mode:哈士奇爆炸",
        locator: extra("哈士奇爆炸"),
        id: "ha-shi-qi-bao-zha",
        name: "哈士奇爆炸",
        section: "special",
        numericalId: 121600114,
      },
      {
        key: "extra-mode:丢枪爆炸",
        locator: extra("换弹爆炸"),
        id: "diu-qiang-bao-zha",
        name: "丢枪爆炸",
        section: "special",
        numericalId: 121600112,
      },
    ],
  },
  葫芦: {
    prototypeId: "20013000058",
    sources: [
      {
        key: "primary",
        locator: primary,
        id: "hu-lu-hui-xue",
        name: "葫芦回血",
        section: "special",
        numericalId: 121300580,
        manualEvidenceIds: ["manual-task77-gourd"],
      },
    ],
  },
  木葫芦: {
    prototypeId: "20013000079",
    tables: ["lc"],
    preexistingV2: true,
    sources: [
      {
        key: "primary",
        locator: primary,
        id: "he-shui-hui-xue",
        name: "喝水回血",
        section: "special",
        numericalId: 121300790,
        manualEvidenceIds: ["manual-task77-gourd"],
      },
    ],
  },
  火神炎帝: {
    prototypeId: "20006000030",
    activeSkillId: 5103601,
    cooldownCorrection: {
      from: 45,
      to: 0,
      reason: "PVE 缺行且 GP 5103601 CooldownDuration 确认为 0 秒",
    },
    sources: [
      {
        key: "damage-mode:0",
        locator: mode(0),
        id: "pu-tong-she-ji",
        name: "普通射击",
        section: "fire_mode",
        numericalId: 120600300,
        ascTypeId: "365",
        prototypeMode: 0,
      },
    ],
  },
  密林杀机: {
    prototypeId: "20002000009",
    sources: [
      {
        key: "damage-mode:0",
        locator: mode(0),
        id: "pu-tong-she-ji",
        name: "普通射击",
        section: "fire_mode",
        numericalId: 120200090,
        ascTypeId: "56",
        prototypeMode: 0,
      },
      {
        key: "damage-mode:1",
        locator: mode(1),
        id: "bao-zha-dan",
        name: "爆炸弹",
        section: "special",
        numericalId: 120200091,
      },
    ],
  },
  能源之影: {
    prototypeId: "20007000015",
    sources: [
      {
        key: "damage-mode:0",
        locator: mode(0),
        id: "pu-tong-she-ji",
        name: "普通射击",
        section: "fire_mode",
        numericalId: 120700150,
        ascTypeId: "236",
        prototypeMode: 0,
      },
      {
        key: "extra-mode:浮游模式",
        locator: extra("浮游模式"),
        id: "fu-you-mo-shi",
        name: "浮游模式",
        section: "variant",
        numericalId: 120700152,
        manualEvidenceIds: ["manual-task77-energy"],
        assetEvidence: {
          path: "Abilities/WeaponSkill/Gold/FloatingMode/BP_FloatingMode_Bullet.json",
          value: 120700152,
        },
        confirmedFields: {
          "fire.interval": {
            value: 0.65,
            owner: "wiki_semantics",
            reason: "人工确认浮游模式使用 MGE 硬编码射击间隔 0.65 秒",
            evidenceIds: ["manual-task77-energy"],
          },
        },
      },
      {
        key: "extra-mode:换弹爆炸",
        locator: extra("换弹爆炸"),
        id: "huan-tan-bao-zha",
        name: "换弹爆炸",
        section: "special",
        numericalId: 120700151,
        assetEvidence: {
          path: "Weapon/Data/Pistol/Pistol_20007000015_null_NYZY/MGE/BP_ReloadlThrowGunProjectile_NYZY.json",
          value: 120700151,
        },
      },
      {
        key: "extra-mode:强袭激光",
        locator: extra("强袭激光"),
        id: "qiang-xi-ji-guang",
        name: "强袭激光",
        section: "special",
        numericalId: 120700153,
        manualEvidenceIds: ["manual-task77-energy"],
        assetEvidence: {
          path: "Abilities/WeaponSkill/Gold/FloatingMode/SKT_FloatingMode.json",
          value: 120700153,
        },
      },
    ],
  },
  逆光之刃: {
    prototypeId: "20013000011",
    identityName: "逆光之刃-短",
    sources: [
      {
        key: "primary",
        locator: primary,
        id: "zhong-ji",
        name: "重击",
        section: "melee",
        numericalId: 121300110,
        ascTypeId: "138",
        prototypeMode: 0,
      },
      {
        key: "light-hit",
        locator: primary,
        id: "qing-ji",
        name: "轻击",
        section: "melee",
        numericalId: 121300111,
        ascTypeId: "138",
        prototypeMode: 0,
        addition: true,
      },
    ],
  },
  沙丘之怒: {
    prototypeId: "20004000014",
    sources: [
      {
        key: "damage-mode:0",
        locator: mode(0),
        id: "dao-dan-ming-zhong",
        name: "导弹命中",
        section: "fire_mode",
        numericalId: 120400142,
        ascTypeId: "160",
        prototypeMode: 0,
      },
      {
        key: "damage-mode:1",
        locator: mode(1),
        id: "dao-dan-bao-zha",
        name: "导弹爆炸",
        section: "special",
        numericalId: 120400141,
        prototypeMode: 0,
      },
      {
        key: "extra-mode:分裂弹",
        locator: extra("分裂弹"),
        id: "fen-lie-dan",
        name: "分裂弹",
        section: "special",
        numericalId: 120400143,
      },
    ],
  },
  生命线: {
    prototypeId: "20008000002",
    sources: [
      {
        key: "damage-mode:0",
        locator: mode(0),
        id: "liu-dan-ming-zhong",
        name: "榴弹命中",
        section: "fire_mode",
        numericalId: 120800021,
        ascTypeId: "116",
        prototypeMode: 0,
      },
      {
        key: "damage-mode:1",
        locator: mode(1),
        id: "liu-dan-bao-zha",
        name: "榴弹爆炸",
        section: "special",
        numericalId: 120800020,
        prototypeMode: 0,
      },
      {
        key: "extra-mode:冰池Dot",
        locator: extra("冰池Dot"),
        id: "bing-chi-dot",
        name: "冰池Dot",
        section: "dot",
        numericalId: 120800023,
      },
    ],
  },
  收割者: {
    prototypeId: "20008000001",
    sources: [
      {
        key: "damage-mode:0",
        locator: mode(0),
        id: "liu-dan-ming-zhong",
        name: "榴弹命中",
        section: "fire_mode",
        numericalId: 120800011,
        ascTypeId: "89",
        prototypeMode: 0,
      },
      {
        key: "damage-mode:1",
        locator: mode(1),
        id: "liu-dan-bao-zha",
        name: "榴弹爆炸",
        section: "special",
        numericalId: 120800010,
        prototypeMode: 0,
      },
    ],
  },
  元宵来袭: {
    prototypeId: "20005000018",
    sources: [
      {
        key: "damage-mode:0",
        locator: mode(0),
        id: "pu-tong-she-ji",
        name: "普通射击",
        section: "fire_mode",
        numericalId: 120500180,
        ascTypeId: "264",
        prototypeMode: 0,
      },
      {
        key: "extra-mode:汤圆命中",
        locator: extra("汤圆命中"),
        id: "tang-yuan-ming-zhong",
        name: "汤圆命中",
        section: "special",
        numericalId: 120500181,
      },
      {
        key: "extra-mode:抛体模式",
        locator: extra("抛体模式"),
        id: "pao-ti-mo-shi",
        name: "抛体模式",
        section: "fire_mode",
        numericalId: 120500180,
        ascTypeId: "337",
        prototypeMode: 1,
        inherits: "pu-tong-she-ji",
      },
    ],
  },
  猪猪榴弹发射器: {
    prototypeId: "20008000011",
    sources: [
      {
        key: "damage-mode:0",
        locator: mode(0),
        id: "liu-dan-ming-zhong",
        name: "榴弹命中",
        section: "fire_mode",
        numericalId: 120800111,
        ascTypeId: "352",
        prototypeMode: 0,
      },
      {
        key: "damage-mode:1",
        locator: mode(1),
        id: "liu-dan-bao-zha",
        name: "榴弹爆炸",
        section: "special",
        numericalId: 120800110,
        prototypeMode: 0,
      },
    ],
  },
  刺隐: {
    prototypeId: "20003000030",
    tables: ["lc"],
    sources: [
      {
        key: "damage-mode:0",
        locator: mode(0),
        id: "pu-tong-she-ji",
        name: "普通射击",
        section: "fire_mode",
        numericalId: 120300250,
        ascTypeId: "348",
        prototypeMode: 0,
      },
      {
        key: "damage-mode:1",
        locator: mode(1),
        id: "you-jian-jin-zhan",
        name: "右键近战",
        section: "melee",
        numericalId: 120300251,
      },
    ],
  },
  夜影之逝: {
    prototypeId: "20003000024",
    tables: ["lc"],
    sources: [
      {
        key: "damage-mode:0",
        locator: mode(0),
        id: "pu-tong-she-ji",
        name: "普通射击",
        section: "fire_mode",
        numericalId: 120300240,
        ascTypeId: "342",
        prototypeMode: 0,
      },
      {
        key: "damage-mode:1",
        locator: mode(1),
        id: "you-jian-jin-zhan",
        name: "右键近战",
        section: "melee",
        numericalId: 120300241,
      },
      {
        key: "extra-mode:切刀近战",
        locator: extra("切刀近战"),
        id: "qie-dao-jin-zhan",
        name: "切刀近战",
        section: "melee",
        numericalId: 120300242,
      },
      {
        key: "extra-mode:贯长虹剑气",
        locator: extra("贯长虹剑气"),
        id: "guan-chang-hong-jian-qi",
        name: "贯长虹剑气",
        section: "special",
        numericalId: 120300245,
      },
      {
        key: "extra-mode:连斩前7刀",
        locator: extra("连斩前7刀"),
        id: "lian-zhan-qian-7-dao",
        name: "连斩前7刀",
        section: "special",
        numericalId: 120300243,
      },
      {
        key: "extra-mode:连斩第8刀",
        locator: extra("连斩第8刀"),
        id: "lian-zhan-di-8-dao",
        name: "连斩第8刀",
        section: "special",
        numericalId: 120300244,
      },
      {
        key: "extra-mode:近战回血",
        locator: extra("近战回血"),
        id: "jin-zhan-hui-xue",
        name: "近战回血",
        section: "special",
        numericalId: 120300246,
      },
    ],
  },
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right, "en"))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

function serialize(value: unknown): string {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

function sha256(absolutePath: string): string {
  return createHash("sha256").update(readFileSync(absolutePath)).digest("hex");
}

function pointerToken(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

export function task77EvidenceId(value: string): string {
  return `e-${Buffer.from(value, "utf8").toString("hex")}`;
}

function findValuePointer(value: unknown, expected: number, pointer = ""): string | undefined {
  if (value === expected) return pointer;
  if (Array.isArray(value)) {
    for (const [index, child] of value.entries()) {
      const found = findValuePointer(child, expected, `${pointer}/${index}`);
      if (found) return found;
    }
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const found = findValuePointer(child, expected, `${pointer}/${pointerToken(key)}`);
      if (found) return found;
    }
  }
  return undefined;
}

function sourceRef(table: NumericalTable, source: SourceConfig): WeaponDataSourceRef {
  return {
    ...(source.prototypeMode !== undefined ? { prototype_mode: source.prototypeMode } : {}),
    ...(!source.inherits
      ? { numerical: { table, id: source.numericalId, level: 1 } }
      : {}),
    ...(source.ascTypeId ? { asc_type_id: source.ascTypeId } : {}),
  };
}

function effectiveSourceRef(
  table: NumericalTable,
  source: SourceConfig,
  allSources: readonly SourceConfig[],
): WeaponDataSourceRef {
  const parent = source.inherits
    ? allSources.find((candidate) => candidate.id === source.inherits)
    : undefined;
  if (source.inherits && !parent) throw new Error(`${source.key}: inheritance target is missing`);
  const merged = {
    ...(parent ? effectiveSourceRef(table, parent, allSources) : {}),
    ...sourceRef(table, source),
  };
  if (source.ascTypeId) merged.feel_param_id = source.ascTypeId;
  return merged;
}

function tableFile(table: NumericalTable): string {
  return WEAPON_DATA_SOURCE_FILES[table === "lc" ? "numerical-lc" : "numerical-td"];
}

function repoEvidencePath(relativeContentPath: string): string {
  return path.posix.join("refs/Exports/NZM/Content", relativeContentPath.replaceAll("\\", "/"));
}

function findAuditRow(
  report: Record<string, unknown>,
  table: NumericalTable,
  title: string,
): AuditRow | undefined {
  return (report as unknown as AuditReport).tables[table].find(
    (candidate) => candidate.title === title,
  );
}

function prepare(): void {
  const reader = createWeaponDataSourceReader({ contentRoot: CONTENT_ROOT });
  const decisions = migrationDecisionsV2Schema.parse(
    JSON.parse(readFileSync(DEFAULT_MIGRATION_DECISIONS_PATH, "utf8")),
  );
  const mutable: ReturnType<typeof migrationDecisionsV2Schema.parse> =
    structuredClone(decisions);
  for (const id of Object.keys(mutable.evidence)) {
    if (
      id.startsWith("weapon-item-task77-") ||
      id.startsWith("prototype-task77-") ||
      id.startsWith("asset-task77-") ||
      id.startsWith("numerical-task77-")
    ) {
      delete mutable.evidence[id];
    }
  }
  for (const weapon of Object.values(mutable.weapons)) {
    for (const selected of Object.values(weapon.tables)) {
      if (!selected) continue;
      if (
        selected.compatibility_field_corrections &&
        Object.keys(selected.compatibility_field_corrections).length === 0
      ) {
        delete selected.compatibility_field_corrections;
      }
      if ("source_additions" in selected && selected.source_additions?.length === 0) {
        delete selected.source_additions;
      }
    }
  }
  const itemPath = path.join(CONTENT_ROOT, ...WEAPON_ITEM_TABLE.split("/"));
  const itemRows = JSON.parse(readFileSync(itemPath, "utf8"))[0].Rows as Record<
    string,
    Record<string, unknown>
  >;

  Object.assign(mutable.evidence, {
    "manual-task77-attenuation": {
      kind: "manual_verification",
      note: "用户确认杜瓦瓶与鬼铜蚀不应具有距离衰减，非法 ASC 衰减按 not_applicable 处理",
    },
    "manual-task77-energy": {
      kind: "manual_verification",
      note: "用户确认能源之影浮游模式使用 0.65 秒人工射击间隔，强袭激光不填写射速，二者均无 ASC",
    },
    "manual-task77-guitong": {
      kind: "manual_verification",
      note: "用户确认鬼铜蚀 121500064 为减速插件 Dot，121500065 为回血恢复，忽略 TD 写反的 Description",
    },
    "manual-task77-gourd": {
      kind: "manual_verification",
      note: "用户确认葫芦使用恢复 Numerical 121300580_1，不能沿用 Prototype 错误攻击关联",
    },
    "manual-task77-skill-cooldown": {
      kind: "manual_verification",
      note: "Task 7.7 确认暗夜之殇使用 PVE 45 秒，火神炎帝使用 GP fallback 0 秒",
    },
  });

  for (const [title, config] of Object.entries(configs)) {
    const identityName = config.identityName ?? title;
    const identityMatches = Object.entries(itemRows).filter(
      ([, row]) => row.WeaponName === identityName && String(row.ModelID) === config.prototypeId,
    );
    if (identityMatches.length !== 1) {
      throw new Error(`${title}: WeaponItem identity matched ${identityMatches.length} rows`);
    }
    const [identityRowName, identityRow] = identityMatches[0];
    const identityEvidenceId = `weapon-item-task77-${task77EvidenceId(title)}`;
    mutable.evidence[identityEvidenceId] = {
      kind: "weapon_item_identity",
      path: repoEvidencePath(WEAPON_ITEM_TABLE),
      pointer: `/0/Rows/${pointerToken(identityRowName)}`,
      row_name: identityRowName,
      weapon_name: identityName,
      model_id: config.prototypeId,
      observed_value: identityRow,
      sha256: sha256(itemPath),
      note: `确认 ${title} 的名称到 ModelID/PrototypeID 身份链`,
    };

    const weaponDecision = mutable.weapons[title] ?? { sources: {}, tables: {} };
    mutable.weapons[title] = weaponDecision;
    const configuredKeys = new Set(
      config.sources.filter((source) => !source.addition).map((source) => source.key),
    );
    for (const [key, identity] of Object.entries(weaponDecision.sources)) {
      if (
        identity.reason === "Task 7.7 冻结已核验的来源身份与页面领域分组" &&
        !configuredKeys.has(key)
      ) {
        delete weaponDecision.sources[key];
      }
    }
    const tables = config.tables ?? (["lc", "td"] as const);
    const lcPath = path.join(ROOT, "data", "weapons", `${title}.mdx`);
    const legacyData = matter(readFileSync(lcPath, "utf8")).data as Record<string, unknown>;
    const candidates = reader.findItemsByPrototypeId(config.prototypeId);
    if (candidates.length !== 1) {
      throw new Error(`${title}: ItemConfig candidate count is ${candidates.length}`);
    }

    const anchorSource = config.sources.find((source) => source.prototypeMode !== undefined);
    for (const table of tables) {
      const tablePath = path.join(
        ROOT,
        table === "lc" ? "data/weapons" : "data/weapons_td",
        `${title}.mdx`,
      );
      const tableData = matter(readFileSync(tablePath, "utf8")).data as Record<string, unknown>;
      const existingTable = weaponDecision.tables[table];
      const preserveGenerated =
        tableData.schema_version === 2 && existingTable?.migration_batch === "task7.7";
      const sourceReviews: Record<string, unknown> = {};
      const tableSources: Record<string, WeaponDataSourceRef> = {};
      const fieldDecisions: Record<string, Record<string, unknown>> = preserveGenerated
        ? structuredClone(existingTable.field_decisions)
        : {};
      const additions: unknown[] = [];

      const prototypeEvidence = (
        source: SourceConfig,
      ): string | undefined => {
        const direct = source.prototypeMode !== undefined ? source : anchorSource;
        if (!direct || direct.prototypeMode === undefined) return undefined;
        const prototypeCandidates = reader.getPrototypeCandidates(
          config.prototypeId,
          direct.prototypeMode,
        );
        const preferredNames = new Set([
          identityName,
          `${identityName}_${direct.prototypeMode}`,
          title,
          `${title}_${direct.prototypeMode}`,
        ]);
        const preferred = prototypeCandidates.filter((candidate) =>
          preferredNames.has(candidate.rowName)
        );
        const row = preferred.length === 1
          ? preferred[0]
          : prototypeCandidates.length === 1
            ? prototypeCandidates[0]
            : undefined;
        if (!row) {
          throw new Error(
            `${title}:${direct.key}: cannot disambiguate Prototype mode ${direct.prototypeMode}`,
          );
        }
        const matchingFields = PROTOTYPE_NUMERICAL_FIELDS.filter(
          (field) => Number(row.raw[field]) === direct.numericalId,
        );
        if (matchingFields.length === 0) {
          throw new Error(
            `${title}:${direct.key}: Numerical ${direct.numericalId} is not direct in Prototype mode ${direct.prototypeMode}`,
          );
        }
        const field = matchingFields[0] as PrototypeNumericalField;
        const id = `prototype-task77-${task77EvidenceId(title)}-${direct.prototypeMode}-${task77EvidenceId(field)}`;
        const relativePath = WEAPON_DATA_SOURCE_FILES.prototype;
        const absolutePath = path.join(CONTENT_ROOT, ...relativePath.split("/"));
        mutable.evidence[id] = {
          kind: "prototype_field",
          path: repoEvidencePath(relativePath),
          pointer: `/0/Rows/${pointerToken(row.rowName)}/${pointerToken(field)}`,
          observed_value: row.raw[field],
          sha256: sha256(absolutePath),
          note: `确认 ${title} Mode ${direct.prototypeMode} 的 ${field} 锚点`,
        };
        return id;
      };

      for (const source of config.sources) {
        const numerical = reader.getNumerical({ table, id: source.numericalId, level: 1 });
        const numericalEvidenceId = `numerical-task77-${table}-${source.numericalId}-1`;
        const numericalRelativePath = tableFile(table);
        const numericalAbsolutePath = path.join(
          CONTENT_ROOT,
          ...numericalRelativePath.split("/"),
        );
        mutable.evidence[numericalEvidenceId] = {
          kind: "numerical_row",
          path: repoEvidencePath(numericalRelativePath),
          pointer: `/0/Rows/${pointerToken(numerical.rowName)}/id`,
          observed_value: numerical.raw.id,
          sha256: sha256(numericalAbsolutePath),
          note: `确认 ${table.toUpperCase()} Numerical ${numerical.rowName} 原始行`,
        };

        const evidenceIds = [identityEvidenceId, numericalEvidenceId];
        const prototypeEvidenceId = prototypeEvidence(source);
        if (prototypeEvidenceId) evidenceIds.push(prototypeEvidenceId);
        if (source.assetEvidence) {
          const absolutePath = path.join(
            CONTENT_ROOT,
            ...source.assetEvidence.path.split("/"),
          );
          const raw = JSON.parse(readFileSync(absolutePath, "utf8"));
          const pointer = findValuePointer(raw, source.assetEvidence.value);
          if (!pointer) {
            throw new Error(`${title}:${source.key}: asset evidence value is missing`);
          }
          const id = `asset-task77-${task77EvidenceId(title)}-${task77EvidenceId(source.key)}`;
          mutable.evidence[id] = {
            kind: "asset_property",
            path: repoEvidencePath(source.assetEvidence.path),
            pointer,
            observed_value: source.assetEvidence.value,
            sha256: sha256(absolutePath),
            note: `确认 ${title} ${source.name} 的结构化资源引用`,
          };
          evidenceIds.push(id);
        }
        evidenceIds.push(...(source.manualEvidenceIds ?? []));

        const explicitSource = sourceRef(table, source);
        const effectiveSource = effectiveSourceRef(table, source, config.sources);
        const review = {
          resolution: "resolved",
          effective_source: effectiveSource,
          reason: "Task 7.7 依据名称链、Prototype 锚点与 Numerical/资源证据首次解析该来源",
          evidence_ids: [...new Set(evidenceIds)],
        };
        if (source.addition) {
          const existingAddition = preserveGenerated
            ? existingTable.source_additions?.find(
                (addition: { key: string }) => addition.key === source.key,
              )
            : undefined;
          additions.push({
            key: source.key,
            after_locator: source.locator,
            identity: {
              id: source.id,
              name: source.name,
              section: source.section,
              ...(source.inherits ? { inherits: source.inherits } : {}),
              reason: "Task 7.7 将一个 V1 来源拆分为经证据确认的多个 V2 结算来源",
            },
            source: explicitSource,
            source_review: review,
            snapshot_differences: existingAddition?.snapshot_differences ?? [],
          });
          continue;
        }

        const existingIdentity = weaponDecision.sources[source.key];
        weaponDecision.sources[source.key] = {
          id: source.id,
          name: source.name,
          section: source.section,
          ...(source.label !== undefined ? { label: source.label } : {}),
          ...(source.inherits ? { inherits: source.inherits } : {}),
          locator: source.locator,
          table_scope: [...new Set([...(existingIdentity?.table_scope ?? []), table])],
          reason: "Task 7.7 冻结已核验的来源身份与页面领域分组",
        };
        tableSources[source.key] = explicitSource;
        sourceReviews[source.key] = review;
        fieldDecisions[source.key] ??= {};
        Object.assign(
          fieldDecisions[source.key],
          Object.fromEntries(
            Object.entries(source.confirmedFields ?? {}).map(([field, decision]) => [
              field,
              {
                action: "confirmed_override",
                reason: decision.reason,
                owner: decision.owner,
                value: decision.value,
                evidence_ids: decision.evidenceIds,
              },
            ]),
          ),
        );
      }

      const activeSkillId = config.activeSkillId ?? Number(legacyData.active_skill_id ?? 0);
      weaponDecision.tables[table] = {
        migration_batch: "task7.7",
        item_id: candidates[0].key,
        active_skill_id: activeSkillId,
        ...(config.activeSkillCorrection
          ? {
              active_skill_correction: {
                ...config.activeSkillCorrection,
                owner: "skill_chain",
              },
            }
          : {}),
        ...(config.cooldownCorrection
          ? { compatibility_field_corrections: {
              skill_cooldown: {
                ...config.cooldownCorrection,
                owner: "skill_chain",
                evidence_ids: ["manual-task77-skill-cooldown"],
              },
            } }
          : {}),
        sources: tableSources,
        field_decisions: fieldDecisions,
        source_reviews: sourceReviews,
        ...(additions.length > 0 ? { source_additions: additions } : {}),
        snapshot_differences: preserveGenerated
          ? existingTable.snapshot_differences
          : [],
      };
    }
  }

  const write = () => {
    const parsed = migrationDecisionsV2Schema.parse(mutable);
    writeFileSync(DEFAULT_MIGRATION_DECISIONS_PATH, serialize(parsed), "utf8");
  };
  write();

  const firstAudit = auditMigrationDecisions({ root: ROOT, contentRoot: CONTENT_ROOT });
  for (const [title, config] of Object.entries(configs)) {
    if (config.preexistingV2) continue;
    for (const table of config.tables ?? (["lc", "td"] as const)) {
      const data = matter(readFileSync(path.join(
        ROOT,
        table === "lc" ? "data/weapons" : "data/weapons_td",
        `${title}.mdx`,
      ), "utf8")).data;
      if (data.schema_version === 2) continue;
      const row = findAuditRow(firstAudit, table, title);
      if (!row || row.error) throw new Error(`${table}:${title}: ${row?.error ?? "audit row missing"}`);
      const selected = mutable.weapons[title].tables[table];
      for (const gap of row.gaps ?? []) {
        const fields = (selected.field_decisions[gap.source] ??= {});
        fields[gap.field] ??= {
          action: "accept_source",
          reason: "Task 7.7 采用已核验 V2 来源值替代 V1 手填或派生值",
          owner: "game_data",
        };
      }
    }
  }
  write();

  const secondAudit = auditMigrationDecisions({ root: ROOT, contentRoot: CONTENT_ROOT });
  for (const [title, config] of Object.entries(configs)) {
    if (config.preexistingV2) continue;
    for (const table of config.tables ?? (["lc", "td"] as const)) {
      const data = matter(readFileSync(path.join(
        ROOT,
        table === "lc" ? "data/weapons" : "data/weapons_td",
        `${title}.mdx`,
      ), "utf8")).data;
      if (data.schema_version === 2) continue;
      const row = findAuditRow(secondAudit, table, title);
      if (!row || row.error) throw new Error(`${table}:${title}: ${row?.error ?? "audit row missing"}`);
      const selected = mutable.weapons[title].tables[table];
      const decisions = (row.snapshot_gaps ?? []).map((difference: { pointer: string }) => ({
        pointer: difference.pointer,
        classification: "accepted_correction",
        reason: `Task 7.7 已核验 V1 排除项迁移差异：${difference.pointer}`,
      }));
      if ((selected.source_additions?.length ?? 0) > 0) {
        selected.source_additions![0].snapshot_differences = decisions;
      } else {
        selected.snapshot_differences = decisions;
      }
    }
  }
  write();

  const finalAudit = auditMigrationDecisions({ root: ROOT, contentRoot: CONTENT_ROOT });
  const failures: string[] = [];
  for (const [title, config] of Object.entries(configs)) {
    if (config.preexistingV2) continue;
    for (const table of config.tables ?? (["lc", "td"] as const)) {
      const data = matter(readFileSync(path.join(
        ROOT,
        table === "lc" ? "data/weapons" : "data/weapons_td",
        `${title}.mdx`,
      ), "utf8")).data;
      if (data.schema_version === 2) continue;
      const row = findAuditRow(finalAudit, table, title);
      if (!row || row.status !== "ready") {
        failures.push(`${table}:${title}: ${row?.error ?? row?.status ?? "missing"}`);
      }
    }
  }
  if (failures.length > 0) {
    throw new Error(`Task 7.7 decisions are not ready:\n${failures.join("\n")}`);
  }
  console.log("Prepared and audited Task 7.7 migration decisions.");
}

function updateSnapshots(): void {
  const decisions = migrationDecisionsV2Schema.parse(
    JSON.parse(readFileSync(DEFAULT_MIGRATION_DECISIONS_PATH, "utf8")),
  );
  const mutable: ReturnType<typeof migrationDecisionsV2Schema.parse> =
    structuredClone(decisions);
  const differences = currentMigrationConsumerDifferences({ root: ROOT });
  for (const [title, config] of Object.entries(configs)) {
    for (const table of config.tables ?? (["lc", "td"] as const)) {
      const selected = mutable.weapons[title]?.tables[table];
      if (!selected || selected.exclude || selected.migration_batch !== "task7.7") continue;
      const reviewed = (differences[`${table}:${title}`] ?? []).map((difference) => ({
        pointer: difference.pointer,
        classification: "accepted_correction" as const,
        reason: `Task 7.7 已核验 V1 排除项迁移差异：${difference.pointer}`,
      }));
      if ((selected.source_additions?.length ?? 0) > 0) {
        selected.source_additions![0].snapshot_differences = reviewed;
        selected.snapshot_differences = [];
      } else {
        selected.snapshot_differences = reviewed;
      }
    }
  }
  writeFileSync(
    DEFAULT_MIGRATION_DECISIONS_PATH,
    serialize(migrationDecisionsV2Schema.parse(mutable)),
    "utf8",
  );
  console.log("Updated Task 7.7 snapshot difference decisions.");
}

const entryPath = process.argv[1];
if (entryPath && pathToFileURL(path.resolve(entryPath)).href === import.meta.url) {
  const command = process.argv[2] ?? "prepare";
  if (command === "prepare") prepare();
  else if (command === "snapshots") updateSnapshots();
  else throw new Error("usage: task77.ts <prepare|snapshots>");
}
