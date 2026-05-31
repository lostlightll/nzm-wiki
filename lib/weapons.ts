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

// ── Synthetic mode builder (no ASC lookup, hardcoded fireIntervalBase) ─

function buildSyntheticMode(synth: {
  name: string;
  fireIntervalBase: number;
  damage: WeaponDamage;
  element?: ElementType;
  elementAddRate?: number;
  weaknessMultiplier?: number;
  enableCritical?: boolean;
  enableWeakness?: boolean;
  toughnessType?: ToughnessType;
  ignoreShield?: boolean;
  pellets?: number;
}): DamageMode {
  const mode: DamageMode = {
    name: synth.name,
    damage: synth.damage,
    element: synth.element || "物理",
    elementAddRate: synth.elementAddRate ?? 0,
    weaknessMultiplier: synth.weaknessMultiplier ?? 1,
    enableWeakness: synth.enableWeakness ?? false,
    enableCritical: synth.enableCritical ?? false,
    fireIntervalBase: synth.fireIntervalBase,
    toughnessType: synth.toughnessType || "冲击",
    ignoreShield: synth.ignoreShield ?? false,
  };

  if (synth.pellets && synth.pellets > 1) {
    mode.pellets = synth.pellets;
  }

  return mode;
}

// ── Build DamageMode from MDX inline data (shared by extra_modes & damage_modes) ─

function buildModeFromMDXEntry(
  s: Record<string, unknown>,
  defaultInterval: number
): DamageMode | null {
  const name = typeof s.name === "string" ? s.name : "";
  if (!name) return null;
  const hasInterval = "fire_interval" in s;
  const interval = hasInterval
    ? Number(s.fire_interval ?? 0)
    : defaultInterval;

  const rawDamage = (s.damage as Record<string, unknown>) || {};
  const damage: WeaponDamage = {
    base: Number(rawDamage.base ?? 0),
    impulse: Number(rawDamage.impulse ?? 0),
    toughness: Number(rawDamage.toughness ?? 0),
    flesh: Number(rawDamage.flesh ?? 0),
    hurtable: Number(rawDamage.hurtable ?? 0),
  };

  const mode = buildSyntheticMode({
    name,
    fireIntervalBase: interval,
    damage,
    element: typeof s.element === "string" ? (s.element as ElementType) : undefined,
    elementAddRate: typeof s.element_add_rate === "number" ? s.element_add_rate : undefined,
    weaknessMultiplier: typeof s.weakness_multiplier === "number" ? s.weakness_multiplier : undefined,
    enableCritical: typeof s.enable_critical === "boolean" ? s.enable_critical : undefined,
    enableWeakness: typeof s.enable_weakness === "boolean" ? s.enable_weakness : undefined,
    toughnessType: typeof s.toughness_type === "string" ? (s.toughness_type as ToughnessType) : undefined,
    ignoreShield: typeof s.ignore_shield === "boolean" ? s.ignore_shield : undefined,
    pellets: typeof s.pellets === "number" ? s.pellets : undefined,
  });

  if (typeof s.label === "string") {
    mode.damageLabel = s.label;
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

  // Always build from MDX frontmatter
  let damageModes: DamageMode[] = [buildModeFromMDX(raw)];
  let extraModes: DamageMode[] | undefined;
  const changeClip = buildChangeClipFromMDX(raw);
  const magazine = toNum(raw.magazine);
  const totalAmmo = toNum(raw.total_ammo);

  // Parse damage_modes from MDX (mode index → inline data)
  const damageModesMDX = new Map<number, Record<string, unknown>>();
  if (Array.isArray(raw.damage_modes)) {
    for (const entry of raw.damage_modes as Record<string, unknown>[]) {
      const modeIdx = Number(entry.mode ?? -1);
      if (modeIdx >= 0) damageModesMDX.set(modeIdx, entry);
    }
  }

  // Override mode 0 from damage_modes[0] if present
  if (damageModesMDX.has(0)) {
    const mdxPrimary = buildModeFromMDXEntry(damageModesMDX.get(0)!, 0);
    if (mdxPrimary) damageModes = [mdxPrimary];
  }

  const primaryDamageMode = damageModes[0] ?? null;

  // Add non-mode-0 damage_modes entries
  if (primaryDamageMode) {
    for (const [modeIdx, mdxData] of damageModesMDX) {
      if (modeIdx === 0) continue;
      const built = buildModeFromMDXEntry(
        mdxData,
        primaryDamageMode.fireIntervalBase
      );
      if (built) damageModes.push(built);
    }

    // Read extra_modes from MDX frontmatter
    if (Array.isArray(raw.extra_modes)) {
      const defaultInterval = primaryDamageMode.fireIntervalBase;
      const built = (raw.extra_modes as Record<string, unknown>[])
        .map((s) => buildModeFromMDXEntry(s, defaultInterval))
        .filter((m): m is DamageMode => m !== null);
      if (built.length > 0) {
        extraModes = built;
      }
    }
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
