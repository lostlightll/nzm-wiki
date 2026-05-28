import fs from "fs";
import path from "path";

const REFS_DIR = path.join(process.cwd(), "refs/Exports/NZM/Content");

// ── Cache ────────────────────────────────────────────

let _prototypeMap: Map<string, RawPrototypeEntry[]> | null = null;
let _prototypeById: Map<string, RawPrototypeEntry[]> | null = null;
let _ascMap: Map<string, RawASCEntry> | null = null;
let _feelParamMap: Map<string, RawFeelParamEntry> | null = null;
let _numericalMap: Map<string, RawNumericalEntry> | null = null;

// ── Raw Types (matching JSON field names) ───────────

interface RawPrototypeEntry {
  name: string;
  PrototypeID: string;
  Mode: number;
  ASCTypeID: string;
  NumericalID: number;
  WeaponType: number;
}

interface RawASCEntry {
  FireIntervalBase: number;
  ClipAmmoCountBase: number;
  MaxAmmoCount: number;
  SplinterNum: number;
}

interface RawFeelParamEntry {
  WeaponChangeClipTimeBase: number;
  WeaponChangeClipEndToFireTime: number;
}

interface RawNumericalEntry {
  id: number;
  Level: number;
  ElementType: string;
  ElementAddRate: number;
  HpCalScale: number;
  ImpulseBase: number;
  ToughnessBase: number;
  FleshDamageBase: number;
  HurtableBase: number;
  bEnableCriticalDamage: boolean;
  bDamageIgnoreShield: boolean;
  EnableWeaknessDamage: boolean;
  WeaknessDamageAddScale: number;
  ToughnessDamageType: string;
}

// ── Enum Mappings ──────────────────────────────────

function mapElement(raw: string): string {
  if (!raw) return "物理";
  if (raw.includes("Kinetic") || raw.includes("Normal")) return "物理";
  if (raw.includes("Fire")) return "火焰";
  if (raw.includes("Cryo")) return "寒冷";
  if (raw.includes("Shock")) return "电弧";
  if (raw.includes("Corossive")) return "腐蚀";
  return "物理";
}

function mapToughness(raw: string): string {
  if (!raw) return "冲击";
  if (raw.includes("Impulse")) return "冲击";
  return "冲击";
}

// ── Loaders (lazy, cached) ──────────────────────────

function loadPrototypeConfig(): void {
  if (_prototypeMap) return;

  const filePath = path.join(REFS_DIR, "DataTables/WeaponPrototypeConfig.json");
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const rows: Record<string, unknown> = (data as Array<{ Rows: Record<string, unknown> }>)[0].Rows;

  _prototypeMap = new Map();
  _prototypeById = new Map();

  for (const [name, entry] of Object.entries(rows)) {
    const e = entry as Record<string, unknown>;
    const raw: RawPrototypeEntry = {
      name,
      PrototypeID: String(e.PrototypeID ?? ""),
      Mode: Number(e.Mode ?? 0),
      ASCTypeID: String(e.ASCTypeID ?? ""),
      NumericalID: Number(e.NumericalID ?? 0),
      WeaponType: Number(e.WeaponType ?? 0),
    };

    const existing = _prototypeMap.get(name);
    if (existing) {
      existing.push(raw);
    } else {
      _prototypeMap.set(name, [raw]);
    }

    const byId = _prototypeById.get(raw.PrototypeID);
    if (byId) {
      byId.push(raw);
    } else {
      _prototypeById.set(raw.PrototypeID, [raw]);
    }
  }
}

function loadASC(): void {
  if (_ascMap) return;

  const filePath = path.join(REFS_DIR, "Attributes/AutoGenerate/attr_weapon_asc.json");
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const rows: Record<string, unknown> = (data as Array<{ Rows: Record<string, unknown> }>)[0].Rows;

  _ascMap = new Map();
  for (const [id, entry] of Object.entries(rows)) {
    const e = entry as Record<string, unknown>;
    _ascMap.set(id, {
      FireIntervalBase: Number(e.FireIntervalBase ?? 0),
      ClipAmmoCountBase: Number(e.ClipAmmoCountBase ?? 0),
      MaxAmmoCount: Number(e.MaxAmmoCount ?? 0),
      SplinterNum: Number(e.SplinterNum ?? 1),
    });
  }
}

function loadFeelParam(): void {
  if (_feelParamMap) return;

  const filePath = path.join(REFS_DIR, "DataTables/WeaponFeelParamTable.json");
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const rows: Record<string, unknown> = (data as Array<{ Rows: Record<string, unknown> }>)[0].Rows;

  _feelParamMap = new Map();
  for (const [id, entry] of Object.entries(rows)) {
    const e = entry as Record<string, unknown>;
    _feelParamMap.set(id, {
      WeaponChangeClipTimeBase: Number(e.WeaponChangeClipTimeBase ?? 0),
      WeaponChangeClipEndToFireTime: Number(e.WeaponChangeClipEndToFireTime ?? 0),
    });
  }
}

function loadNumericalConfig(): void {
  if (_numericalMap) return;

  _numericalMap = new Map();

  const jsonFiles = [
    "DataTables/numerical_config_composite.json",
    "DataTables/numerical_config_equip.json",
    "DataTables/numerical_config_playerskill.json",
  ];

  for (const relPath of jsonFiles) {
    const filePath = path.join(REFS_DIR, relPath);
    if (!fs.existsSync(filePath)) continue;

    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const rows: Record<string, unknown> =
      (data as Array<{ Rows: Record<string, unknown> }>)[0].Rows || {};

    for (const [key, entry] of Object.entries(rows)) {
      if (_numericalMap.has(key)) continue; // composite has priority

      const e = entry as Record<string, unknown>;
      _numericalMap.set(key, {
        id: Number(e.id ?? 0),
        Level: Number(e.Level ?? 1),
        ElementType: String(e.ElementType ?? ""),
        ElementAddRate: Number(e.ElementAddRate ?? 0),
        HpCalScale: Number(e.HpCalScale ?? 0),
        ImpulseBase: Number(e.ImpulseBase ?? 0),
        ToughnessBase: Number(e.ToughnessBase ?? 0),
        FleshDamageBase: Number(e.FleshDamageBase ?? 0),
        HurtableBase: Number(e.HurtableBase ?? 0),
        bEnableCriticalDamage: Boolean(e.bEnableCriticalDamage),
        bDamageIgnoreShield: Boolean(e.bDamageIgnoreShield),
        EnableWeaknessDamage: Boolean(e.EnableWeaknessDamage),
        WeaknessDamageAddScale: Number(e.WeaknessDamageAddScale ?? 0),
        ToughnessDamageType: String(e.ToughnessDamageType ?? ""),
      });
    }
  }
}

function ensureAllLoaded(): void {
  loadPrototypeConfig();
  loadASC();
  loadFeelParam();
  loadNumericalConfig();
}

// ── Public Types ─────────────────────────────────────

export interface PrototypeModeEntry {
  name: string;
  mode: number;
  ascTypeId: string;
  numericalId: number;
}

// ── Mode Name Overrides ────────────────────────────

const MODE_NAME_OVERRIDES: Record<string, Record<number, string>> = {
  精绝兽神: { 0: "速射模式", 1: "爆发模式", 2: "秘法榴弹" },
  飓风之龙: { 0: "霰弹射击" },
};

/**
 * 技能伤害 NumericalID 覆盖 — 部分模式的 PrototypeConfig.NumericalID 指向
 * 武器本体伤害，实际技能伤害在 numerical_config_playerskill 的其他 ID 下。
 */
const SKILL_NUMERICAL_OVERRIDES: Record<string, Record<number, number>> = {
  精绝兽神: { 2: 120100242 }, // 秘法榴弹爆炸伤害
};



/**
 * 获取模式显示名，优先查手动覆盖表
 */
export function getModeName(
  fullName: string,
  baseWeaponName: string,
  mode: number
): string {
  const overrides = MODE_NAME_OVERRIDES[baseWeaponName];
  if (overrides && overrides[mode] !== undefined) {
    return overrides[mode];
  }
  if (mode === 0) return "普通射击";
  return extractModeName(fullName, baseWeaponName);
}

/**
 * 获取模式实际使用的 NumericalID，优先查技能伤害覆盖表
 */
export function getEffectiveNumericalId(
  baseWeaponName: string,
  mode: number,
  defaultId: number
): number {
  const overrides = SKILL_NUMERICAL_OVERRIDES[baseWeaponName];
  if (overrides && overrides[mode] !== undefined) {
    return overrides[mode];
  }
  return defaultId;
}


// ── Public Lookup Functions ─────────────────────────

/**
 * 根据武器名或 PrototypeID 查找所有模式，按 Mode 排序并去重
 */
export function lookupPrototypeModes(
  weaponName: string,
  prototypeId?: string | null
): PrototypeModeEntry[] | undefined {
  ensureAllLoaded();

  let entries: RawPrototypeEntry[] | undefined;

  // 1. Exact name match → get PrototypeID → find ALL entries with that ID (includes multi-mode)
  const exactMatch = _prototypeMap!.get(weaponName);
  if (exactMatch && exactMatch.length > 0) {
    const pid = exactMatch[0].PrototypeID;
    entries = _prototypeById!.get(pid);
  }

  // 2. Try by explicit PrototypeID if name match failed
  if (!entries && prototypeId) {
    entries = _prototypeById!.get(String(prototypeId));
  }

  if (!entries || entries.length === 0) return undefined;

  // Deduplicate by (Mode, ASCTypeID, NumericalID), keep first
  const seen = new Set<string>();
  const deduped: RawPrototypeEntry[] = [];
  for (const e of entries) {
    const key = `${e.Mode}|${e.ASCTypeID}|${e.NumericalID}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(e);
    }
  }

  return deduped
    .sort((a, b) => a.Mode - b.Mode)
    .map((e) => ({
      name: e.name,
      mode: e.Mode,
      ascTypeId: e.ASCTypeID,
      numericalId: e.NumericalID,
    }));
}

/**
 * 从原型配置条目名提取模式显示名
 */
export function extractModeName(fullName: string, baseWeaponName: string): string {
  let name = fullName;

  // Remove base weapon name prefix
  if (name.startsWith(baseWeaponName)) {
    name = name.slice(baseWeaponName.length);
  }

  // Extract text from first set of parentheses
  const match = name.match(/[（(]([^）)]+)[）)]/);
  if (match) return match[1];

  // Clean up remaining text
  const trimmed = name.replace(/^[-_]/g, "").trim();
  if (trimmed) return trimmed;

  return fullName;
}

/**
 * 获取 ASC 属性（射速、弹匣、备弹、弹丸数）
 */
export function lookupASC(ascTypeId: string): {
  fireIntervalBase: number;
  clipAmmo: number;
  maxAmmo: number;
  splinterNum: number;
} | undefined {
  ensureAllLoaded();
  const entry = _ascMap!.get(ascTypeId);
  if (!entry) return undefined;
  return {
    fireIntervalBase: entry.FireIntervalBase,
    clipAmmo: Math.round(entry.ClipAmmoCountBase),
    maxAmmo: Math.round(entry.MaxAmmoCount),
    splinterNum: entry.SplinterNum || 1,
  };
}

/**
 * 获取换弹时间
 */
export function lookupChangeClip(ascTypeId: string): {
  timeBase: number;
  endToFireTime: number;
} | undefined {
  ensureAllLoaded();
  const entry = _feelParamMap!.get(ascTypeId);
  if (!entry) return undefined;
  return {
    timeBase: entry.WeaponChangeClipTimeBase,
    endToFireTime: entry.WeaponChangeClipEndToFireTime,
  };
}

/**
 * 获取数值配置（伤害、元素、弱点等），按 {NumericalID}_{Level} 查询
 */
export function lookupNumerical(
  numericalId: number,
  level: number = 1
): {
  hpCalScale: number;
  impulseBase: number;
  toughnessBase: number;
  fleshBase: number;
  hurtableBase: number;
  elementType: string;
  elementAddRate: number;
  enableCritical: boolean;
  ignoreShield: boolean;
  enableWeakness: boolean;
  weaknessMultiplier: number;
  toughnessType: string;
} | undefined {
  ensureAllLoaded();
  const key = `${numericalId}_${level}`;
  const entry = _numericalMap!.get(key);
  if (!entry) return undefined;
  return {
    hpCalScale: entry.HpCalScale,
    impulseBase: entry.ImpulseBase,
    toughnessBase: entry.ToughnessBase,
    fleshBase: entry.FleshDamageBase,
    hurtableBase: entry.HurtableBase,
    elementType: mapElement(entry.ElementType),
    elementAddRate: entry.ElementAddRate,
    enableCritical: entry.bEnableCriticalDamage,
    ignoreShield: entry.bDamageIgnoreShield,
    enableWeakness: entry.EnableWeaknessDamage,
    weaknessMultiplier: Math.round((1.0 + entry.WeaknessDamageAddScale) * 100) / 100,
    toughnessType: mapToughness(entry.ToughnessDamageType),
  };
}
