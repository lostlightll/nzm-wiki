import type {
  DamageMode,
  ElementType,
  Rarity,
  ToughnessType,
  Weapon,
  WeaponChangeClip,
  WeaponDamage,
  WeaponMeleeDamage,
  WeaponTag,
  WeaponType,
} from "@/types";

export function legacyNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const number = Number(value);
  return Number.isNaN(number) ? undefined : number;
}

export function parseLegacyTags(rawTags: unknown): WeaponTag[] {
  if (Array.isArray(rawTags)) {
    return rawTags.filter(
      (tag): tag is string => typeof tag === "string" && tag.length > 0,
    ) as WeaponTag[];
  }
  if (typeof rawTags === "string" && rawTags.length > 0) {
    return [rawTags as WeaponTag];
  }
  return [];
}

function buildSyntheticMode(input: {
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
    name: input.name,
    damage: input.damage,
    element: input.element || "物理",
    elementAddRate: input.elementAddRate ?? 0,
    weaknessMultiplier: input.weaknessMultiplier ?? 1,
    enableWeakness: input.enableWeakness ?? false,
    enableCritical: input.enableCritical ?? false,
    fireIntervalBase: input.fireIntervalBase,
    toughnessType: input.toughnessType || "冲击",
    ignoreShield: input.ignoreShield ?? false,
  };

  if (input.pellets && input.pellets > 1) mode.pellets = input.pellets;
  return mode;
}

function buildModeFromEntry(
  entry: Record<string, unknown>,
  defaultInterval: number,
): DamageMode | null {
  const name = typeof entry.name === "string" ? entry.name : "";
  if (!name) return null;
  const interval =
    "fire_interval" in entry ? Number(entry.fire_interval ?? 0) : defaultInterval;
  const rawDamage = (entry.damage as Record<string, unknown>) || {};
  const mode = buildSyntheticMode({
    name,
    fireIntervalBase: interval,
    damage: {
      base: Number(rawDamage.base ?? 0),
      impulse: Number(rawDamage.impulse ?? 0),
      toughness: Number(rawDamage.toughness ?? 0),
      flesh: Number(rawDamage.flesh ?? 0),
      hurtable: Number(rawDamage.hurtable ?? 0),
    },
    element:
      typeof entry.element === "string"
        ? (entry.element as ElementType)
        : undefined,
    elementAddRate:
      typeof entry.element_add_rate === "number"
        ? entry.element_add_rate
        : undefined,
    weaknessMultiplier:
      typeof entry.weakness_multiplier === "number"
        ? entry.weakness_multiplier
        : undefined,
    enableCritical:
      typeof entry.enable_critical === "boolean"
        ? entry.enable_critical
        : undefined,
    enableWeakness:
      typeof entry.enable_weakness === "boolean"
        ? entry.enable_weakness
        : undefined,
    toughnessType:
      typeof entry.toughness_type === "string"
        ? (entry.toughness_type as ToughnessType)
        : undefined,
    ignoreShield:
      typeof entry.ignore_shield === "boolean"
        ? entry.ignore_shield
        : undefined,
    pellets: typeof entry.pellets === "number" ? entry.pellets : undefined,
  });
  if (typeof entry.label === "string") mode.damageLabel = entry.label;
  return mode;
}

function buildPrimaryMode(raw: Record<string, unknown>): DamageMode {
  const rawDamage = (raw.damage as Record<string, unknown>) || {};
  const fileRate = legacyNumber(raw.file_rate);
  const fireIntervalBase =
    fileRate && fileRate > 0 ? Math.round((60 / fileRate) * 100) / 100 : 0;
  const mode: DamageMode = {
    name: "普通射击",
    damage: {
      base: Number(rawDamage.base ?? 0),
      impulse: Number(rawDamage.impulse ?? 0),
      toughness: Number(rawDamage.toughness ?? 0),
      flesh: Number(rawDamage.flesh ?? 0),
      hurtable: Number(rawDamage.hurtable ?? 0),
    },
    element: (raw.element as ElementType) || "物理",
    elementAddRate: Number(raw.element_add_rate ?? 0),
    weaknessMultiplier: Number(raw.weekness_multiplier ?? 1),
    enableWeakness: true,
    enableCritical: Boolean(raw.enable_critical),
    fireIntervalBase,
    toughnessType: (raw.toughness_type as ToughnessType) || "冲击",
    ignoreShield: Boolean(raw.ignore_shield),
  };
  const pellets = legacyNumber(raw.pellets);
  if (pellets !== undefined) mode.pellets = pellets;
  return mode;
}

function buildChangeClip(
  raw: Record<string, unknown>,
): WeaponChangeClip | undefined {
  if (raw.changeClip && typeof raw.changeClip === "object") {
    const clip = raw.changeClip as Record<string, unknown>;
    return {
      timeBase: Number(clip.timeBase ?? 0),
      reloadRecovery:
        clip.reloadRecovery !== undefined
          ? Number(clip.reloadRecovery)
          : Number(clip.endToFireTime ?? 0),
    };
  }
  const reloadTime = legacyNumber(raw.reload_time);
  return reloadTime === undefined
    ? undefined
    : { timeBase: reloadTime, reloadRecovery: 0 };
}

function buildMelee(
  raw: Record<string, unknown>,
): WeaponMeleeDamage | undefined {
  if (!raw.melee_damage || typeof raw.melee_damage !== "object") return undefined;
  const melee = raw.melee_damage as Record<string, unknown>;
  const light = legacyNumber(melee.light);
  const heavy = legacyNumber(melee.heavy);
  return light === undefined && heavy === undefined ? undefined : { light, heavy };
}

export function transformWeaponV1Legacy(
  raw: Record<string, unknown>,
  slug: string,
): Weapon {
  let damageModes: DamageMode[] = [buildPrimaryMode(raw)];
  let extraModes: DamageMode[] | undefined;
  const modeEntries = new Map<number, Record<string, unknown>>();
  if (Array.isArray(raw.damage_modes)) {
    for (const entry of raw.damage_modes as Record<string, unknown>[]) {
      const mode = Number(entry.mode ?? -1);
      if (mode >= 0) modeEntries.set(mode, entry);
    }
  }
  if (modeEntries.has(0)) {
    const primary = buildModeFromEntry(modeEntries.get(0)!, 0);
    if (primary) damageModes = [primary];
  }
  const primary = damageModes[0];
  if (primary) {
    for (const [mode, entry] of modeEntries) {
      if (mode === 0) continue;
      const built = buildModeFromEntry(entry, primary.fireIntervalBase);
      if (built) damageModes.push(built);
    }
    if (Array.isArray(raw.extra_modes)) {
      const built = (raw.extra_modes as Record<string, unknown>[])
        .map((entry) => buildModeFromEntry(entry, primary.fireIntervalBase))
        .filter((mode): mode is DamageMode => mode !== null);
      if (built.length > 0) extraModes = built;
    }
  }
  const labelType = legacyNumber(raw.damage_label) ?? 0;
  if (labelType > 0) {
    const label =
      labelType === 1
        ? "爆炸伤害"
        : typeof raw.damage_label_text === "string"
          ? raw.damage_label_text
          : "爆炸伤害";
    for (const mode of damageModes.slice(1)) mode.damageLabel = label;
    if (extraModes) for (const mode of extraModes) mode.damageLabel = label;
  }

  return {
    slug,
    title: String(raw.title ?? slug),
    use_type: typeof raw.use_type === "string" ? raw.use_type : undefined,
    weapon_type: raw.weapon_type as WeaponType | undefined,
    weaponTypeId: legacyNumber(raw.weapon_type_id),
    rarity: raw.rarity as Rarity | undefined,
    tags: parseLegacyTags(raw.tags),
    scope: raw.scope as string | undefined,
    magazine: legacyNumber(raw.magazine),
    totalAmmo: legacyNumber(raw.total_ammo),
    accuracy: legacyNumber(raw.accuracy),
    stability: legacyNumber(raw.stability),
    range: legacyNumber(raw.range),
    explosionRange: legacyNumber(raw.explosion_range),
    attenuation_begin:
      raw.attenuation_begin !== undefined
        ? (raw.attenuation_begin as number | string | null)
        : undefined,
    attenuation_end:
      raw.attenuation_end !== undefined
        ? (raw.attenuation_end as number | string | null)
        : undefined,
    attenuation_scale:
      raw.attenuation_scale !== undefined
        ? (raw.attenuation_scale as number | string | null)
        : undefined,
    skillCooldown: legacyNumber(raw.skill_cooldown),
    skillDuration: legacyNumber(raw.skill_duration),
    skillBlocking: Boolean(raw.skill_blocking),
    showDuration: Boolean(raw.show_duration),
    shootingEnergy: Boolean(raw.shooting_energy),
    shootingEnergyCount: legacyNumber(raw.shooting_energy_count),
    changeClip: buildChangeClip(raw),
    damageModes,
    meleeDamage: buildMelee(raw),
    extraModes,
    draft: Boolean(raw.draft),
    game_mode:
      typeof raw.game_mode === "string" && raw.game_mode === "td"
        ? "td"
        : undefined,
  };
}
