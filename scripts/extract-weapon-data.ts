/**
 * 为指定武器提取候选证据 JSON。
 *
 * 输出不可直接复制为 frontmatter。来源 label、group、继承与 override 必须按照
 * docs/standards/weapon-mdx.md 和 weapon-numerical-v2.md 人工裁决。
 *
 * 用法:
 *   pnpm exec tsx scripts/extract-weapon-data.ts 飓风之龙 精绝兽神
 *   pnpm exec tsx scripts/extract-weapon-data.ts 飓风之龙 --out MD/_local/weapon-data.json
 */
import fs from "fs";
import path from "path";
import { pathToFileURL } from "node:url";

const REFS_DIR = path.join(process.cwd(), "refs/Exports/NZM/Content");

// ── Loaders ──

function loadPrototypeConfig(): Map<string, RawProto[]> {
  const filePath = path.join(REFS_DIR, "DataTables/WeaponPrototypeConfig.json");
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const rows: Record<string, unknown> = (data as Array<{ Rows: Record<string, unknown> }>)[0].Rows;

  const byPid = new Map<string, RawProto[]>();
  for (const [name, entry] of Object.entries(rows)) {
    const e = entry as Record<string, unknown>;
    const pid = String(e.PrototypeID ?? "");
    const raw: RawProto = {
      name,
      PrototypeID: pid,
      Mode: Number(e.Mode ?? 0),
      ASCTypeID: String(e.ASCTypeID ?? ""),
      NumericalID: Number(e.NumericalID ?? 0),
      WeaponType: Number(e.WeaponType ?? 0),
      ExplosionNumericalID: Number(e.ExplosionNumericalID ?? 0),
    };
    const arr = byPid.get(pid);
    if (arr) arr.push(raw);
    else byPid.set(pid, [raw]);
  }
  return byPid;
}

function loadASC(): Map<string, RawASC> {
  const filePath = path.join(REFS_DIR, "Attributes/AutoGenerate/attr_weapon_asc.json");
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const rows: Record<string, unknown> = (data as Array<{ Rows: Record<string, unknown> }>)[0].Rows;
  const map = new Map<string, RawASC>();
  for (const [id, entry] of Object.entries(rows)) {
    const e = entry as Record<string, unknown>;
    map.set(id, {
      FireIntervalBase: Number(e.FireIntervalBase ?? 0),
      ClipAmmoCountBase: Number(e.ClipAmmoCountBase ?? 0),
      MaxAmmoCount: Number(e.MaxAmmoCount ?? 0),
      SplinterNum: Number(e.SplinterNum ?? 1),
    });
  }
  return map;
}

function loadFeelParam(): Map<string, RawFeel> {
  const filePath = path.join(REFS_DIR, "DataTables/WeaponFeelParamTable.json");
  if (!fs.existsSync(filePath)) return new Map();
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const rows: Record<string, unknown> = (data as Array<{ Rows: Record<string, unknown> }>)[0].Rows;
  const map = new Map<string, RawFeel>();
  for (const [id, entry] of Object.entries(rows)) {
    const e = entry as Record<string, unknown>;
    map.set(id, {
      WeaponChangeClipTimeBase: Number(e.WeaponChangeClipTimeBase ?? 0),
      WeaponChangeClipEndToFireTime: Number(e.WeaponChangeClipEndToFireTime ?? 0),
    });
  }
  return map;
}

function loadNumerical(): Map<string, RawNumerical> {
  const map = new Map<string, RawNumerical>();
  const files = [
    "DataTables/numerical_config_composite.json",
    "DataTables/numerical_config_equip.json",
    "DataTables/numerical_config_playerskill.json",
  ];
  for (const relPath of files) {
    const fp = path.join(REFS_DIR, relPath);
    if (!fs.existsSync(fp)) continue;
    const data = JSON.parse(fs.readFileSync(fp, "utf-8"));
    const rows: Record<string, unknown> = (data as Array<{ Rows: Record<string, unknown> }>)[0].Rows || {};
    for (const [key, entry] of Object.entries(rows)) {
      if (map.has(key)) continue;
      const e = entry as Record<string, unknown>;
      const settlements = Array.isArray(e.Settlements)
        ? e.Settlements
            .map((item) => (item as Record<string, unknown>).TagName)
            .filter((tag): tag is string => typeof tag === "string")
        : [];
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
        Settlements: settlements,
      });
    }
  }
  return map;
}

// ── Types ──

interface RawProto {
  name: string;
  PrototypeID: string;
  Mode: number;
  ASCTypeID: string;
  NumericalID: number;
  WeaponType: number;
  ExplosionNumericalID: number;
}

interface RawASC {
  FireIntervalBase: number;
  ClipAmmoCountBase: number;
  MaxAmmoCount: number;
  SplinterNum: number;
}

interface RawFeel {
  WeaponChangeClipTimeBase: number;
}

interface RawNumerical {
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
  Settlements: string[];
}

// ── Helpers ──

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

export interface WeaponPrototypeModeEvidence {
  readonly [key: string]: unknown;
  readonly mode: number;
  readonly name: string;
  readonly ascTypeId: string;
  readonly numericalId: number;
  readonly gameDataAvailable: boolean;
}

export interface WeaponSkillNumericalEvidence {
  readonly [key: string]: unknown;
  readonly key: string;
}

export interface WeaponEvidenceRecord {
  readonly prototype_id: string;
  readonly proto_modes: readonly WeaponPrototypeModeEvidence[];
  readonly num_modes: number;
  readonly unique_numerical_ids: readonly number[];
  readonly skill_numerical?: readonly WeaponSkillNumericalEvidence[];
}

export interface BuildWeaponEvidenceRecordInput {
  readonly prototypeId: string;
  readonly protoModes: readonly WeaponPrototypeModeEvidence[];
  readonly numModes: number;
  readonly uniqueNumericalIds: readonly number[];
  readonly skillNumerical?: readonly WeaponSkillNumericalEvidence[];
}

export function buildWeaponEvidenceRecord(
  input: BuildWeaponEvidenceRecordInput,
): WeaponEvidenceRecord {
  return {
    prototype_id: input.prototypeId,
    proto_modes: input.protoModes,
    num_modes: input.numModes,
    unique_numerical_ids: input.uniqueNumericalIds,
    ...(input.skillNumerical && input.skillNumerical.length > 0
      ? { skill_numerical: input.skillNumerical }
      : {}),
  };
}

function parseArgs(argv: string[]): { weaponNames: string[]; outPath?: string } {
  const weaponNames: string[] = [];
  let outPath: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--out" || arg === "-o") {
      outPath = argv[i + 1];
      i++;
      continue;
    }
    if (arg.startsWith("--out=")) {
      outPath = arg.slice("--out=".length);
      continue;
    }
    for (const name of arg.split(/[，,]/).map((item) => item.trim())) {
      if (name) weaponNames.push(name);
    }
  }

  return { weaponNames, outPath };
}

// ── Main ──

function main() {
  const { weaponNames, outPath } = parseArgs(process.argv.slice(2));

  console.error(`Found ${weaponNames.length} weapons in args`);

  if (weaponNames.length === 0) {
    console.error("Usage: pnpm exec tsx scripts/extract-weapon-data.ts 武器名1 武器名2 [--out tmp/weapon-data.json]");
    return;
  }

  const protoByPid = loadPrototypeConfig();
  const ascMap = loadASC();
  const feelMap = loadFeelParam();
  const numMap = loadNumerical();

  const result: Record<string, unknown> = {};

  for (const weaponName of weaponNames) {
    // Read current MDX frontmatter
    const mdxPath = path.join(process.cwd(), "data/weapons", `${weaponName}.mdx`);
    let currentPrototypeId: string | null = null;
    if (fs.existsSync(mdxPath)) {
      const content = fs.readFileSync(mdxPath, "utf-8");
      // Simple regex to extract prototype_id from frontmatter
      const pidMatch = content.match(/prototype_id:\s*['"]?(\d+)['"]?/);
      if (pidMatch) currentPrototypeId = pidMatch[1];
    }

    if (!currentPrototypeId) {
      console.error(`  SKIP ${weaponName}: no prototype_id found`);
      result[weaponName] = { error: "no prototype_id" };
      continue;
    }

    // Look up prototype config
    let protoEntries = protoByPid.get(currentPrototypeId);
    if (!protoEntries || protoEntries.length === 0) {
      // Try lookup by name
      // Search through all entries to find one with matching name
      for (const [, entries] of protoByPid) {
        if (entries[0]?.name === weaponName) {
          protoEntries = entries;
          break;
        }
      }
    }

    if (!protoEntries || protoEntries.length === 0) {
      console.error(`  SKIP ${weaponName} (${currentPrototypeId}): no prototype data`);
      result[weaponName] = { prototype_id: currentPrototypeId, error: "no prototype data in refs" };
      continue;
    }

    // Deduplicate by (Mode, ASCTypeID, NumericalID)
    const seen = new Set<string>();
    const deduped: RawProto[] = [];
    for (const e of protoEntries) {
      const key = `${e.Mode}|${e.ASCTypeID}|${e.NumericalID}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(e);
      }
    }
    deduped.sort((a, b) => a.Mode - b.Mode);

    // Build neutral evidence. Wiki semantics are assigned manually in MDX.
    const modes: WeaponPrototypeModeEvidence[] = [];
    const allNumericalIds: number[] = [];
    const allExplosionIds: number[] = [];

    for (const proto of deduped) {
      const asc = ascMap.get(proto.ASCTypeID);
      const numKey = `${proto.NumericalID}_1`;
      const num = numMap.get(numKey);

      if (!asc && !num) {
        modes.push({
          mode: proto.Mode,
          name: proto.name,
          ascTypeId: proto.ASCTypeID,
          numericalId: proto.NumericalID,
          gameDataAvailable: false,
        });
        continue;
      }

      // Explosion NumericalID
      let explosionNum: RawNumerical | undefined;
      if (proto.ExplosionNumericalID && proto.ExplosionNumericalID > 0) {
        const expKey = `${proto.ExplosionNumericalID}_1`;
        explosionNum = numMap.get(expKey);
        if (explosionNum) allExplosionIds.push(proto.ExplosionNumericalID);
      }

      allNumericalIds.push(proto.NumericalID);

      const fireInterval = asc?.FireIntervalBase ?? 0;
      const fileRate = fireInterval > 0 ? Math.round((60 / fireInterval) * 100) / 100 : 0;

      modes.push({
        mode: proto.Mode,
        name: proto.name,
        ascTypeId: proto.ASCTypeID,
        numericalId: proto.NumericalID,
        explosionNumericalId: proto.ExplosionNumericalID || 0,
        gameDataAvailable: true,
        // ASC data
        fire_interval: fireInterval,
        fire_rate_rpm: fileRate,
        magazine: asc ? Math.round(asc.ClipAmmoCountBase) : null,
        total_ammo: asc ? Math.round(asc.MaxAmmoCount) : null,
        pellets: (asc && asc.SplinterNum > 1) ? asc.SplinterNum : undefined,
        // Feel param
        reload_time_base: feelMap.get(proto.ASCTypeID)?.WeaponChangeClipTimeBase ?? null,
        // 需从 Appearance/<WeaponType>/<SkinDir>/1P/*_1P_M_ChangeClipEnd.json
        // 提取 EarlyExitFromReloadAnim_C LinkValue
        reload_recovery: null,
        // Numerical data
        damage: num ? {
          base: num.HpCalScale,
          impulse: num.ImpulseBase,
          toughness: num.ToughnessBase,
          flesh: num.FleshDamageBase,
          hurtable: num.HurtableBase,
        } : null,
        element: num ? mapElement(num.ElementType) : null,
        element_add_rate: num?.ElementAddRate ?? 0,
        weakness_multiplier: num ? Math.round((1.0 + num.WeaknessDamageAddScale) * 100) / 100 : 1,
        enable_critical: num?.bEnableCriticalDamage ?? false,
        enable_weakness: num?.EnableWeaknessDamage ?? false,
        toughness_type: num ? mapToughness(num.ToughnessDamageType) : "冲击",
        ignore_shield: num?.bDamageIgnoreShield ?? false,
        element_debuff_type_id: num?.ElementDebuffTypeID ?? 0,
        // Explosion numerical data
        explosion_damage: explosionNum ? {
          base: explosionNum.HpCalScale,
          impulse: explosionNum.ImpulseBase,
          toughness: explosionNum.ToughnessBase,
          flesh: explosionNum.FleshDamageBase,
          hurtable: explosionNum.HurtableBase,
        } : null,
        explosion_element: explosionNum ? mapElement(explosionNum.ElementType) : null,
        explosion_element_add_rate: explosionNum?.ElementAddRate ?? 0,
        explosion_weakness_multiplier: explosionNum ? Math.round((1.0 + explosionNum.WeaknessDamageAddScale) * 100) / 100 : 1,
        explosion_enable_critical: explosionNum?.bEnableCriticalDamage ?? false,
        explosion_enable_weakness: explosionNum?.EnableWeaknessDamage ?? false,
        explosion_toughness_type: explosionNum ? mapToughness(explosionNum.ToughnessDamageType) : "冲击",
        explosion_ignore_shield: explosionNum?.bDamageIgnoreShield ?? false,
        explosion_element_debuff_type_id: explosionNum?.ElementDebuffTypeID ?? 0,
      });
    }

    // Collect unique numerical IDs for skill data lookup
    const uniqueNumIds = [...new Set([...allNumericalIds, ...allExplosionIds])];

    // Also look up active_skill numerical data if available
    const skillNumericalData: WeaponSkillNumericalEvidence[] = [];
    // Try common skill numerical IDs from playerskill table (if weapon has active_skill_id in MDX)
    if (currentPrototypeId && fs.existsSync(mdxPath)) {
      const content = fs.readFileSync(mdxPath, "utf-8");
      const skillMatch = content.match(/active_skill_id:\s*(\d+)/);
      if (skillMatch) {
        const skillId = skillMatch[1];
        // Try to find skill data
        for (const [key, num] of numMap) {
          if (key.startsWith(skillId + "_") || key.startsWith("51" + skillId.slice(2) + "_")) {
            skillNumericalData.push({
              key,
              damage: {
                base: num.HpCalScale,
                impulse: num.ImpulseBase,
                toughness: num.ToughnessBase,
                flesh: num.FleshDamageBase,
                hurtable: num.HurtableBase,
              },
              element: mapElement(num.ElementType),
              element_add_rate: num.ElementAddRate,
              weakness_multiplier: Math.round((1.0 + num.WeaknessDamageAddScale) * 100) / 100,
              enable_critical: num.bEnableCriticalDamage,
              enable_weakness: num.EnableWeaknessDamage,
              toughness_type: mapToughness(num.ToughnessDamageType),
              ignore_shield: num.bDamageIgnoreShield,
              element_debuff_type_id: num.ElementDebuffTypeID,
              settlements: num.Settlements,
            });
          }
        }
      }
    }

    result[weaponName] = buildWeaponEvidenceRecord({
      prototypeId: currentPrototypeId,
      protoModes: modes,
      numModes: deduped.length,
      uniqueNumericalIds: uniqueNumIds,
      skillNumerical: skillNumericalData,
    });

    console.error(`  OK ${weaponName} (${currentPrototypeId}): ${deduped.length} modes, ${uniqueNumIds.length} numerical IDs`);
  }

  const output = JSON.stringify(result, null, 2);
  if (outPath) {
    const resolvedOutPath = path.resolve(process.cwd(), outPath);
    fs.mkdirSync(path.dirname(resolvedOutPath), { recursive: true });
    fs.writeFileSync(resolvedOutPath, output);
    console.error(`\nWritten to ${outPath}`);
    return;
  }

  console.log(output);
}

if (
  process.argv[1] &&
  fs.existsSync(process.argv[1]) &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  main();
}
