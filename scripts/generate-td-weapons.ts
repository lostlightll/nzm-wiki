/**
 * 从 data/weapons/ 生成 data/weapons_td/
 * 用 TD_numerical_config 替换伤害数值，×400 倍率
 * 用法: npx tsx scripts/generate-td-weapons.ts [武器名...]
 */
import fs from "fs";
import path from "path";
import matter from "gray-matter";

const REFS_DIR = path.join(process.cwd(), "refs/Exports/NZM/Content");
const SRC_DIR = path.join(process.cwd(), "data/weapons");
const OUT_DIR = path.join(process.cwd(), "data/weapons_td");

// ── Types ──

// Hardcoded numerical ID overrides for modes that can't be auto-detected from proto config.
// Format: "weapon-slug:mode-index" → TD numerical ID (without _1 suffix)
// These are manually maintained. When adding a new weapon with榴弹爆炸/激光/穿透等
// non-standard modes, add an entry here instead of relying on fallback heuristics.
const MODE_NUMERICAL_OVERRIDE: Record<string, number> = {
  // 榴弹爆炸 → proto 前一个 Mode 的 ExplosionNumericalID
  "幽冥毒王:2": 120600042,
  "幽冥毒皇:2": 120600062,
  "收割者:1": 120800010,
  "春雷震:1": 121600060,
  "猪猪榴弹发射器:1": 120800110,
  "生命线:1": 120800020,
  "维和者:1": 121600020,
  "钢铁轰鸣:1": 121600010,
  "沙丘之怒:1": 120400141,
  "哈士奇好友:1": 121600110,
  // 浪里白条 一段激光 → LaserNumericalID
  "浪里白条:1": 120900012,
  // 钢铁轰鸣 榴弹穿透 → 不在 proto 里的独立 numerical
  "钢铁轰鸣:2": 121600012,
  // 右键近战 / 爆炸弹 → proto 只有 Mode 0，mode 1 不在 proto 里
  "刺隐:1": 120300251,
  "夜影之逝:1": 120300241,
  "密林杀机:1": 120200091,
  "暗夜之殇:1": 17000011,
};

// Hardcoded numerical ID overrides for extra modes whose base damage is not unique.
const EXTRA_MODE_NUMERICAL_OVERRIDE: Record<string, number> = {
  "哈士奇好友:0": 121600115,
  "哈士奇好友:1": 121600114,
  "哈士奇好友:2": 121600112,
};

interface ProtoEntry {
  name: string;
  PrototypeID: string;
  Mode: number;
  ASCTypeID: string;
  NumericalID: number;
  ExplosionNumericalID: number;
  LaserNumericalID: number;
}

interface ModeNumInfo {
  numId: number;
  expId: number;
  laserId: number;
}

interface NumericalRow {
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
  ElementDebuffTypeID: number;
  Description: string;
}

// ── Loaders ──

function loadPrototypeConfig(): Map<string, ProtoEntry[]> {
  const fp = path.join(REFS_DIR, "DataTables/WeaponPrototypeConfig.json");
  const data = JSON.parse(fs.readFileSync(fp, "utf-8"));
  const rows: Record<string, unknown> = (data as Array<{ Rows: Record<string, unknown> }>)[0].Rows;
  const byPid = new Map<string, ProtoEntry[]>();
  for (const [name, entry] of Object.entries(rows)) {
    const e = entry as Record<string, unknown>;
    const pid = String(e.PrototypeID ?? "");
    const proto: ProtoEntry = {
      name,
      PrototypeID: pid,
      Mode: Number(e.Mode ?? 0),
      ASCTypeID: String(e.ASCTypeID ?? ""),
      NumericalID: Number(e.NumericalID ?? 0),
      ExplosionNumericalID: Number((e as any).ExplosionNumericalID ?? 0),
      LaserNumericalID: Number((e as any).LaserNumericalID ?? 0),
    };
    const arr = byPid.get(pid);
    if (arr) arr.push(proto);
    else byPid.set(pid, [proto]);
  }
  return byPid;
}

function loadTDNumerical(): Map<string, NumericalRow> {
  const map = new Map<string, NumericalRow>();
  const files = [
    "DataTables/TD_numerical_config_composite.json",
    "DataTables/TD_numerical_config_equip.json",
    "DataTables/TD_numerical_config_playerskill.json",
  ];
  for (const rel of files) {
    const fp = path.join(REFS_DIR, rel);
    if (!fs.existsSync(fp)) continue;
    const data = JSON.parse(fs.readFileSync(fp, "utf-8"));
    const rows: Record<string, unknown> = (data as Array<{ Rows: Record<string, unknown> }>)[0].Rows || {};
    for (const [key, entry] of Object.entries(rows)) {
      if (map.has(key)) continue;
      const e = entry as Record<string, unknown>;
      map.set(key, {
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
        ElementDebuffTypeID: Number(e.ElementDebuffTypeID ?? 0),
        Description: String(e.Description ?? ""),
      });
    }
  }
  return map;
}

function loadLCNumerical(): Map<string, NumericalRow> {
  const map = new Map<string, NumericalRow>();
  const files = [
    "DataTables/numerical_config_composite.json",
    "DataTables/numerical_config_equip.json",
    "DataTables/numerical_config_playerskill.json",
  ];
  for (const rel of files) {
    const fp = path.join(REFS_DIR, rel);
    if (!fs.existsSync(fp)) continue;
    const data = JSON.parse(fs.readFileSync(fp, "utf-8"));
    const rows: Record<string, unknown> = (data as Array<{ Rows: Record<string, unknown> }>)[0].Rows || {};
    for (const [key, entry] of Object.entries(rows)) {
      if (map.has(key)) continue;
      const e = entry as Record<string, unknown>;
      map.set(key, {
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
        ElementDebuffTypeID: Number(e.ElementDebuffTypeID ?? 0),
        Description: String(e.Description ?? ""),
      });
    }
  }
  return map;
}

// Find numerical ID by matching damage values (for extra_modes that lack numerical_id)
function findNumericalIdByValues(
  dmg: Record<string, unknown>,
  lcNum: Map<string, NumericalRow>
): number | null {
  const base = dmg.base;
  const impulse = dmg.impulse;
  const toughness = dmg.toughness;
  // Search LC numerical for a row with matching base+impulse+toughness
  for (const [, row] of lcNum) {
    if (
      row.HpCalScale === base &&
      row.ImpulseBase === impulse &&
      row.ToughnessBase === toughness
    ) {
      return row.id;
    }
  }
  return null;
}

// ── Mappers ──

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

// ── Damage replacement ──

function applyNumerical(dmg: Record<string, unknown>, num: NumericalRow) {
  dmg.base = num.HpCalScale;
  dmg.impulse = num.ImpulseBase;
  dmg.toughness = num.ToughnessBase;
  dmg.flesh = num.FleshDamageBase;
  dmg.hurtable = num.HurtableBase;
}

function applyNumericalToMode(modeEntry: Record<string, unknown>, num: NumericalRow) {
  const dmg = (modeEntry.damage || {}) as Record<string, unknown>;
  applyNumerical(dmg, num);
  modeEntry.damage = dmg;
  modeEntry.element = mapElement(num.ElementType);
  modeEntry.element_add_rate = num.ElementAddRate;
  modeEntry.weakness_multiplier = Math.round((1.0 + num.WeaknessDamageAddScale) * 100) / 100;
  modeEntry.enable_critical = num.bEnableCriticalDamage;
  modeEntry.enable_weakness = num.EnableWeaknessDamage;
  modeEntry.toughness_type = mapToughness(num.ToughnessDamageType);
  modeEntry.ignore_shield = num.bDamageIgnoreShield;
  modeEntry.element_debuff_type_id = num.ElementDebuffTypeID;
}

// ── YAML serializer (preserves structure, no anchors) ──

function yamlDump(obj: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);
  const pad1 = "  ".repeat(indent + 1);

  if (obj === null || obj === undefined) return "null";
  if (typeof obj === "string") {
    if (obj === "") return "''";
    // Quote if contains special chars
    if (/[:{}\[\]",#&*!|>'"@`]/.test(obj) || obj.includes("\n")) {
      return JSON.stringify(obj);
    }
    return obj;
  }
  if (typeof obj === "number") return String(obj);
  if (typeof obj === "boolean") return obj ? "true" : "false";
  if (Array.isArray(obj)) {
    if (obj.length === 0) return "[]";
    return obj.map((item) => {
      if (typeof item === "object" && item !== null && !Array.isArray(item)) {
        const keys = Object.keys(item);
        const firstKey = keys[0];
        const firstVal = (item as Record<string, unknown>)[firstKey];
        // Inline scalar first field
        if (keys.length === 1 && typeof firstVal !== "object") {
          return `${pad}- ${firstKey}: ${yamlDump(firstVal)}`;
        }
        // Multi-line
        let out = `${pad}- ${firstKey}: ${typeof firstVal === "object" ? "" : yamlDump(firstVal)}`;
        if (typeof firstVal === "object") {
          out += "\n" + yamlDump(firstVal, indent + 1).split("\n").map(l => l ? `  ${l}` : l).join("\n");
        }
        for (let i = 1; i < keys.length; i++) {
          const k = keys[i];
          const v = (item as Record<string, unknown>)[k];
          if (typeof v === "object" && v !== null) {
            out += `\n${pad1}${k}:\n${yamlDump(v, indent + 2)}`;
          } else {
            out += `\n${pad1}${k}: ${yamlDump(v)}`;
          }
        }
        return out;
      }
      return `${pad}- ${yamlDump(item)}`;
    }).join("\n");
  }
  if (typeof obj === "object") {
    const entries = Object.entries(obj as Record<string, unknown>);
    if (entries.length === 0) return "{}";
    return entries.map(([k, v]) => {
      if (typeof v === "object" && v !== null) {
        return `${pad}${k}:\n${yamlDump(v, indent + 1)}`;
      }
      return `${pad}${k}: ${yamlDump(v)}`;
    }).join("\n");
  }
  return String(obj);
}

function serializeFrontmatter(data: Record<string, unknown>): string {
  return yamlDump(data);
}

// ── Main ──

function main() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const protoByPid = loadPrototypeConfig();
  const tdNum = loadTDNumerical();
  const lcNum = loadLCNumerical();

  const targets = new Set(process.argv.slice(2));
  const files = fs.readdirSync(SRC_DIR).filter((f) =>
    f.endsWith(".mdx") && (targets.size === 0 || targets.has(f.replace(/\.mdx$/, "")))
  );
  let ok = 0;
  let partial = 0;
  let skipped = 0;
  const skippedList: string[] = [];

  for (const file of files) {
    const slug = file.replace(/\.mdx$/, "");
    const srcPath = path.join(SRC_DIR, file);
    const raw = fs.readFileSync(srcPath, "utf-8");
    const parsed = matter(raw);
    const data = { ...parsed.data } as Record<string, unknown>;
    const pid = String(data.prototype_id ?? "");

    if (!pid) {
      skipped++;
      skippedList.push(`${slug}: no prototype_id`);
      continue;
    }

    // Find proto entries
    let protoEntries = protoByPid.get(pid);
    if (!protoEntries || protoEntries.length === 0) {
      // Try lookup by weapon name
      for (const [, entries] of protoByPid) {
        if (entries[0]?.name === data.title) {
          protoEntries = entries;
          break;
        }
      }
    }

    if (!protoEntries || protoEntries.length === 0) {
      skipped++;
      skippedList.push(`${slug} (${pid}): not in prototype config`);
      continue;
    }

    // Deduplicate by (Mode, ASCTypeID, NumericalID)
    const seen = new Set<string>();
    const deduped: ProtoEntry[] = [];
    for (const e of protoEntries) {
      const key = `${e.Mode}|${e.ASCTypeID}|${e.NumericalID}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(e);
      }
    }
    deduped.sort((a, b) => a.Mode - b.Mode);

    // Map Mode → NumericalID
    const modeNumMap = new Map<number, ModeNumInfo>();
    for (const e of deduped) {
      modeNumMap.set(e.Mode, { numId: e.NumericalID, expId: e.ExplosionNumericalID, laserId: e.LaserNumericalID });
    }

    // Check TD coverage
    let modeMatchCount = 0;
    let modeTotalCount = 0;

    // Handle damage_modes — only direct proto match + hardcoded overrides. No fallback guessing.
    if (Array.isArray(data.damage_modes)) {
      const modes = data.damage_modes as Record<string, unknown>[];
      modeTotalCount = modes.length;

      for (const modeEntry of modes) {
        const modeIdx = Number(modeEntry.mode ?? -1);
        const numInfo = modeNumMap.get(modeIdx);

        // 1) Hardcoded override
        const overrideKey = `${slug}:${modeIdx}`;
        const overrideNumId = MODE_NUMERICAL_OVERRIDE[overrideKey];
        if (overrideNumId) {
          const num = tdNum.get(`${overrideNumId}_1`);
          if (num) {
            applyNumericalToMode(modeEntry, num);
            modeMatchCount++;
          }
          continue;
        }

        // 2) Direct proto Mode → NumericalID
        if (numInfo && numInfo.numId > 0) {
          const num = tdNum.get(`${numInfo.numId}_1`);
          if (num) {
            applyNumericalToMode(modeEntry, num);
            modeMatchCount++;
          }
        }

        // Handle explosion sub-damage within a mode entry
        if (numInfo && numInfo.expId > 0) {
          const expNum = tdNum.get(`${numInfo.expId}_1`);
          if (expNum && modeEntry.explosion_damage) {
            applyNumerical(modeEntry.explosion_damage as Record<string, unknown>, expNum);
          }
        }
      }
    } else if (data.damage === null) {
      // 无法攻击的武器也需要生成塔防条目。
      modeTotalCount = 0;
    } else if (data.damage && typeof data.damage === "object") {
      // Flat format: only Mode 0
      modeTotalCount = 1;
      const numInfo = modeNumMap.get(0);
      if (numInfo && numInfo.numId > 0) {
        const numKey = `${numInfo.numId}_1`;
        const num = tdNum.get(numKey);
        if (num) {
          applyNumerical(data.damage as Record<string, unknown>, num);
          data.element = mapElement(num.ElementType);
          data.element_add_rate = num.ElementAddRate;
          if (data.weekness_multiplier !== undefined || data.weakness_multiplier !== undefined) {
            const key = data.weakness_multiplier !== undefined ? "weakness_multiplier" : "weekness_multiplier";
            data[key] = Math.round((1.0 + num.WeaknessDamageAddScale) * 100) / 100;
          }
          data.enable_critical = num.bEnableCriticalDamage;
          data.toughness_type = mapToughness(num.ToughnessDamageType);
          modeMatchCount++;
        }
      }
    } else {
      skipped++;
      skippedList.push(`${slug}: no damage_modes or damage field`);
      continue;
    }

    // Add game_mode
    data.game_mode = "td";

    // Extra modes — value match → same-ID TD, fallback to cross-ID via weapon name + base damage
    if (Array.isArray(data.extra_modes)) {
      const extras = data.extra_modes as Record<string, unknown>[];
      let extraMatched = 0;
      const weaponTitle = String(data.title || "");

      for (let extraIndex = 0; extraIndex < extras.length; extraIndex++) {
        const extra = extras[extraIndex];
        const dmg = (extra.damage || {}) as Record<string, unknown>;
        const overrideNumId = EXTRA_MODE_NUMERICAL_OVERRIDE[`${slug}:${extraIndex}`];

        // Step 1: value match → LC numerical ID → same ID in TD
        const lcNumId = overrideNumId ?? findNumericalIdByValues(dmg, lcNum);
        let num: NumericalRow | undefined = overrideNumId
          ? tdNum.get(`${overrideNumId}_1`)
          : undefined;
        if (!num && lcNumId !== null) {
          num = tdNum.get(`${lcNumId}_1`);
        }

        // Step 2: cross-ID remap — find TD entry with same weapon name + same base damage
        if (!num && typeof dmg.base === "number" && weaponTitle) {
          for (const [, row] of tdNum) {
            if (
              row.HpCalScale === dmg.base &&
              row.Description &&
              row.Description.startsWith(weaponTitle)
            ) {
              num = row;
              break;
            }
          }
        }

        if (num) {
          applyNumerical(dmg, num);
          extra.damage = dmg;
          extra.element = mapElement(num.ElementType);
          extra.element_add_rate = num.ElementAddRate;
          extra.enable_critical = num.bEnableCriticalDamage;
          extra.toughness_type = mapToughness(num.ToughnessDamageType);
          extraMatched++;
        }
      }

      if (extraMatched > 0) {
        modeMatchCount += extraMatched;
        modeTotalCount += extras.length;
      }
    }

    // Serialize
    const newFM = serializeFrontmatter(data);
    const body = parsed.content || "";
    const newContent = `---\n${newFM}\n---\n${body}`;

    const outPath = path.join(OUT_DIR, file);
    fs.writeFileSync(outPath, newContent, "utf-8");

    if (modeMatchCount === modeTotalCount) {
      ok++;
      console.log(`  OK ${slug}: ${modeMatchCount}/${modeTotalCount} modes matched`);
    } else {
      partial++;
      console.log(`  PARTIAL ${slug}: ${modeMatchCount}/${modeTotalCount} modes matched`);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`OK: ${ok}`);
  console.log(`Partial: ${partial}`);
  console.log(`Skipped: ${skipped}`);
  if (skippedList.length > 0) {
    console.log(`\nSkipped weapons:`);
    for (const s of skippedList) console.log(`  ${s}`);
  }
}

main();
