import fs from "fs";
import path from "path";
import matter from "gray-matter";
import type {
  Weapon,
  WeaponDamage,
  WeaponChangeClip,
  DamageMode,
  WeaponTag,
  ElementType,
  ToughnessType,
  Rarity,
  WeaponType,
} from "@/types";
import { RARITY_ORDER } from "@/constants/common";
import {
  lookupPrototypeModes,
  lookupASC,
  lookupChangeClip,
  lookupNumerical,
  getModeName,
  getEffectiveNumericalId,
} from "@/lib/weapon-data";

const WEAPONS_DIR = path.join(process.cwd(), "data/weapons");
const isDev = process.env.NODE_ENV === "development";

function toNum(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

function parseTags(rawTags: unknown): WeaponTag[] {
  if (Array.isArray(rawTags)) {
    return rawTags.filter(
      (t): t is string => typeof t === "string" && t.length > 0
    ) as WeaponTag[];
  }
  if (typeof rawTags === "string" && rawTags.length > 0) {
    return [rawTags as WeaponTag];
  }
  return [];
}

// ── DamageMode builder from game data ────────────────

function buildModeFromGameData(
  modeEntry: ReturnType<typeof lookupPrototypeModes> extends (infer T)[] | undefined
    ? T
    : never,
  baseWeaponName: string,
  modeIndex: number
): DamageMode | null {
  const asc = lookupASC(modeEntry.ascTypeId);
  const effectiveId = getEffectiveNumericalId(
    baseWeaponName,
    modeEntry.mode,
    modeEntry.numericalId
  );
  const num = lookupNumerical(effectiveId, 1);

  if (!asc && !num) return null;

  const name = getModeName(modeEntry.name, baseWeaponName, modeEntry.mode);

  const damage: WeaponDamage = {
    base: num?.hpCalScale ?? 0,
    impulse: num?.impulseBase ?? 0,
    toughness: num?.toughnessBase ?? 0,
    flesh: num?.fleshBase ?? 0,
    hurtable: num?.hurtableBase ?? 0,
  };

  const mode: DamageMode = {
    name,
    damage,
    element: (num?.elementType as ElementType) || "物理",
    elementAddRate: num?.elementAddRate ?? 0,
    weaknessMultiplier: num?.weaknessMultiplier ?? 1,
    enableWeakness: num?.enableWeakness ?? true,
    enableCritical: num?.enableCritical ?? false,
    fireIntervalBase: asc?.fireIntervalBase ?? 0,
    toughnessType: (num?.toughnessType as ToughnessType) || "冲击",
    ignoreShield: num?.ignoreShield ?? false,
  };

  if (asc && asc.splinterNum > 1) {
    mode.pellets = asc.splinterNum;
  }

  return mode;
}

// ── Synthetic mode builder (no ASC lookup, hardcoded fireIntervalBase) ─

function buildSyntheticMode(synth: {
  name: string;
  numericalId: number;
  fireIntervalBase: number;
}): DamageMode | null {
  const num = lookupNumerical(synth.numericalId, 1);
  if (!num) return null;

  const damage: WeaponDamage = {
    base: num.hpCalScale,
    impulse: num.impulseBase,
    toughness: num.toughnessBase,
    flesh: num.fleshBase,
    hurtable: num.hurtableBase,
  };

  const mode: DamageMode = {
    name: synth.name,
    damage,
    element: (num.elementType as ElementType) || "物理",
    elementAddRate: num.elementAddRate,
    weaknessMultiplier: num.weaknessMultiplier,
    enableWeakness: num.enableWeakness,
    enableCritical: num.enableCritical,
    fireIntervalBase: synth.fireIntervalBase,
    toughnessType: (num.toughnessType as ToughnessType) || "冲击",
    ignoreShield: num.ignoreShield,
  };

  if (synth.pellets && synth.pellets > 1) {
    mode.pellets = synth.pellets;
  }

  return mode;
}

// ── MDX fallback: build DamageMode from old flat fields ─

function buildModeFromMDX(raw: Record<string, unknown>): DamageMode {
  const rawDamage = (raw.damage as Record<string, unknown>) || {};
  const damage: WeaponDamage = {
    base: Number(rawDamage.base ?? 0),
    impulse: Number(rawDamage.impulse ?? 0),
    toughness: Number(rawDamage.toughness ?? 0),
    flesh: Number(rawDamage.flesh ?? 0),
    hurtable: Number(rawDamage.hurtable ?? 0),
  };

  const fileRate = toNum(raw.file_rate);
  const fireIntervalBase =
    fileRate && fileRate > 0 ? Math.round((60 / fileRate) * 100) / 100 : 0;

  const mode: DamageMode = {
    name: "普通射击",
    damage,
    element: (raw.element as ElementType) || "物理",
    elementAddRate: Number(raw.element_add_rate ?? 0),
    weaknessMultiplier: Number(raw.weekness_multiplier ?? 1),
    enableWeakness: true,
    enableCritical: Boolean(raw.enable_critical),
    fireIntervalBase,
    toughnessType: (raw.toughness_type as ToughnessType) || "冲击",
    ignoreShield: Boolean(raw.ignore_shield),
  };

  const pellets = toNum(raw.pellets);
  if (pellets !== undefined) {
    mode.pellets = pellets;
  }

  return mode;
}

function buildChangeClipFromMDX(raw: Record<string, unknown>): WeaponChangeClip | undefined {
  if (raw.changeClip && typeof raw.changeClip === "object") {
    const cc = raw.changeClip as Record<string, unknown>;
    return {
      timeBase: Number(cc.timeBase ?? 0),
      endToFireTime: Number(cc.endToFireTime ?? 0),
    };
  }
  const reloadTime = toNum(raw.reload_time);
  if (reloadTime !== undefined) {
    return { timeBase: reloadTime, endToFireTime: 0 };
  }
  return undefined;
}

// ── Main transform ───────────────────────────────────

function transformWeapon(raw: Record<string, unknown>, slug: string): Weapon {
  const weaponTitle = String(raw.title ?? slug);
  const prototypeId = raw.prototype_id ? String(raw.prototype_id) : undefined;

  // MDX metadata (always from frontmatter)
  const useType = typeof raw.use_type === "string" ? raw.use_type : undefined;
  const weaponType = raw.weapon_type as WeaponType | undefined;
  const rarity = raw.rarity as Rarity | undefined;
  const tags = parseTags(raw.tags);
  const scope = raw.scope as string | undefined;
  const skillCooldown = toNum(raw.skill_cooldown);
  const accuracy = toNum(raw.accuracy);
  const stability = toNum(raw.stability);
  const range = toNum(raw.range);
  const explosionRange = toNum(raw.explosion_range);
  const draft = Boolean(raw.draft);

  let damageModes: DamageMode[];
  let extraModes: DamageMode[] | undefined;
  let changeClip: WeaponChangeClip | undefined;
  let magazine: number | undefined;
  let totalAmmo: number | undefined;

  // Try game data
  const protoModes = lookupPrototypeModes(weaponTitle, prototypeId);

  if (protoModes && protoModes.length > 0) {
    // Primary mode (Mode 0)
    const primaryMode = protoModes.find((m) => m.mode === 0) ?? protoModes[0];
    const asc = lookupASC(primaryMode.ascTypeId);
    const clip = lookupChangeClip(primaryMode.ascTypeId);

    if (asc) {
      magazine = asc.clipAmmo;
      totalAmmo = asc.maxAmmo;
    }
    if (clip) {
      changeClip = { timeBase: clip.timeBase, endToFireTime: clip.endToFireTime };
    }

    const primaryDamageMode = buildModeFromGameData(primaryMode, weaponTitle, 0);
    if (primaryDamageMode) {
      damageModes = [primaryDamageMode];
    } else {
      // Game data had prototype entry but no numerical/ASC → fall back to MDX
      damageModes = [buildModeFromMDX(raw)];
      changeClip = buildChangeClipFromMDX(raw);
      magazine = toNum(raw.magazine);
      totalAmmo = toNum(raw.total_ammo);
    }

    // Classify non-primary modes
    // New NumericalID → weapon fire mode (damageModes)
    // Already-seen NumericalID → fire-rate variant / alt-fire (extraModes)
    if (primaryDamageMode) {
      const seenIds = new Set([primaryMode.numericalId]);
      const otherModes = protoModes.filter((m) => m !== primaryMode);

      for (const m of otherModes) {
        const built = buildModeFromGameData(m, weaponTitle, m.mode);
        if (!built) continue;
        if (seenIds.has(m.numericalId)) {
          (extraModes ??= []).push(built);
        } else {
          seenIds.add(m.numericalId);
          damageModes.push(built);
        }
      }
    }

    // Read extra_modes from MDX frontmatter (prepended before PrototypeConfig extra modes)
    if (primaryDamageMode && Array.isArray(raw.extra_modes)) {
      const synthList = raw.extra_modes as Record<string, unknown>[];
      const defaultInterval = primaryDamageMode.fireIntervalBase;
      const built = synthList
        .map((s) => {
          const name = typeof s.name === "string" ? s.name : "";
          const numId = Number(s.numerical_id ?? 0);
          const hasInterval = "fire_interval" in s;
          const interval = hasInterval
            ? Number(s.fire_interval ?? 0)
            : defaultInterval;
          if (!name || !numId) return null;
          const mode = buildSyntheticMode({
            name,
            numericalId: numId,
            fireIntervalBase: interval,
          });
          if (mode && typeof s.label === "string") {
            mode.damageLabel = s.label;
          }
          return mode;
        })
        .filter((m): m is DamageMode => m !== null);
      if (built.length > 0) {
        extraModes = [...built, ...(extraModes || [])];
      }
    }
  } else {
    // Fallback: use old MDX fields
    damageModes = [buildModeFromMDX(raw)];
    changeClip = buildChangeClipFromMDX(raw);
    magazine = toNum(raw.magazine);
    totalAmmo = toNum(raw.total_ammo);
  }

  // Apply MDX damage label override: 0=命中(默认), 1=爆炸, 2=自定义
  const damageLabelType = toNum(raw.damage_label) ?? 0;
  if (damageLabelType > 0) {
    let label: string;
    if (damageLabelType === 1) {
      label = "爆炸伤害";
    } else {
      label =
        typeof raw.damage_label_text === "string"
          ? raw.damage_label_text
          : "爆炸伤害";
    }
    // Apply to extraModes and non-primary damageModes
    for (const m of damageModes.slice(1)) m.damageLabel = label;
    if (extraModes) for (const m of extraModes) m.damageLabel = label;
  }

  return {
    slug,
    title: weaponTitle,
    use_type: useType,
    weapon_type: weaponType,
    rarity,
    tags,
    scope,
    magazine,
    totalAmmo,
    accuracy,
    stability,
    range,
    explosionRange,
    skillCooldown,
    changeClip,
    damageModes,
    extraModes,
    draft,
  };
}

// ── Public API ───────────────────────────────────────

/**
 * 从 MDX frontmatter 获取所有武器数据
 */
export async function getAllWeapons(): Promise<Weapon[]> {
  if (!fs.existsSync(WEAPONS_DIR)) {
    console.warn(`Weapons directory not found: ${WEAPONS_DIR}`);
    return [];
  }

  const files = fs.readdirSync(WEAPONS_DIR).filter((f) => f.endsWith(".mdx"));

  return files
    .map((file) => {
      const filePath = path.join(WEAPONS_DIR, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const { data } = matter(content);
      const slug = file.replace(/\.mdx$/, "");

      return transformWeapon(data, slug);
    })
    .filter((w) => !w.draft || isDev)
    .sort((a, b) => {
      const orderA = a.rarity ? RARITY_ORDER[a.rarity] : 0;
      const orderB = b.rarity ? RARITY_ORDER[b.rarity] : 0;
      return orderB - orderA;
    });
}

/**
 * 根据 slug 获取单个武器数据
 */
export async function getWeaponBySlug(slug: string): Promise<Weapon | null> {
  const decodedSlug = decodeURIComponent(slug);
  const filePath = path.join(WEAPONS_DIR, `${decodedSlug}.mdx`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const { data } = matter(content);

  return transformWeapon(data, decodedSlug);
}
