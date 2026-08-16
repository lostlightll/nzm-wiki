import { z } from "zod";

const nonEmptyStringSchema = z.string().trim().min(1);
const positiveIdStringSchema = z.string().regex(/^[1-9]\d*$/);
const finiteNonNegativeSchema = z.number().finite().nonnegative();
const attackIntervalSourceSchema = z
  .string()
  .regex(/^NZM\/Content\/.+#[^#]+$/, {
    message: "attack_interval_source must use NZM/Content/...#field syntax",
  });
const positiveSafeIntegerSchema = z
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER);
const nonNegativeSafeIntegerSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);

export const numericalTableSchema = z.enum(["lc", "td"]);

export const damageSectionSchema = z.enum([
  "fire_mode",
  "skill",
  "special",
  "variant",
  "dot",
  "melee",
]);

// Internal projected reference used by readers, Lock and Resolver.
export const numericalReferenceSchema = z.strictObject({
  table: numericalTableSchema,
  id: positiveSafeIntegerSchema,
  level: positiveSafeIntegerSchema,
});

export const modeNumericalReferenceSchema = z.strictObject({
  id: positiveSafeIntegerSchema,
  level: positiveSafeIntegerSchema,
});

export const weaponDataSourceRefSchema = z.strictObject({
  prototype_mode: z.number().int().nonnegative().optional(),
  numerical: numericalReferenceSchema.optional(),
  asc_type_id: positiveIdStringSchema.optional(),
  feel_param_id: positiveIdStringSchema.optional(),
});

const numericalDamageOverridesSchema = z
  .strictObject({
    base: finiteNonNegativeSchema.optional(),
    impulse: finiteNonNegativeSchema.optional(),
    toughness: finiteNonNegativeSchema.optional(),
    flesh: finiteNonNegativeSchema.optional(),
    hurtable: finiteNonNegativeSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "damage override must contain at least one field",
  });

const numericalHealthOverridesSchema = z
  .strictObject({
    scale: finiteNonNegativeSchema.optional(),
    base: finiteNonNegativeSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "health override must contain at least one field",
  });

export const numericalOverridesSchema = z
  .strictObject({
    damage: numericalDamageOverridesSchema.optional(),
    health: numericalHealthOverridesSchema.optional(),
    element: z.enum(["物理", "火焰", "寒冷", "电弧", "腐蚀"]).optional(),
    element_add_rate: finiteNonNegativeSchema.optional(),
    weakness_multiplier: finiteNonNegativeSchema.optional(),
    enable_critical: z.boolean().optional(),
    enable_weakness: z.boolean().optional(),
    toughness_type: z.enum(["冲击", "贯穿", "爆炸"]).optional(),
    ignore_shield: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "numerical override must contain at least one field",
  })
  .refine(
    (value) =>
      value.damage?.base === undefined || value.health?.scale === undefined,
    {
      message: "damage.base and health.scale cannot both override HpCalScale",
    },
  );

export const attenuationOverrideSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("not_applicable") }),
  z
    .strictObject({
      status: z.literal("applicable"),
      begin_meters: finiteNonNegativeSchema,
      end_meters: finiteNonNegativeSchema,
      min_scale: z.number().finite().min(0).max(1),
    })
    .refine((value) => value.end_meters > value.begin_meters, {
      path: ["end_meters"],
      message: "end_meters must be greater than begin_meters",
    })
    .refine((value) => value.end_meters > 0, {
      path: ["end_meters"],
      message: "end_meters must be greater than zero",
    }),
]);

export const ascOverridesSchema = z
  .strictObject({
    attenuation: attenuationOverrideSchema.optional(),
    fire_interval: finiteNonNegativeSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "asc override must contain at least one field",
  });

export const damageSourceOverridesSchema = z
  .strictObject({
    numerical: numericalOverridesSchema.optional(),
    asc: ascOverridesSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "overrides must contain at least one namespace",
  });

export const damageSourceVerificationSchema = z.strictObject({
  status: z.literal("pending"),
  reason: nonEmptyStringSchema,
});

function validateMechanicalConfig(
  source: {
    overrides?: unknown;
    override_reason?: string;
    attack_interval?: number;
    attack_count?: number;
    attack_interval_source?: string;
  },
  context: z.RefinementCtx,
): void {
  if (source.overrides && !source.override_reason) {
    context.addIssue({
      code: "custom",
      path: ["override_reason"],
      message: "override_reason is required when overrides are present",
    });
  }
  if (!source.overrides && source.override_reason) {
    context.addIssue({
      code: "custom",
      path: ["override_reason"],
      message: "override_reason cannot be used without overrides",
    });
  }
  if (source.attack_interval !== undefined && !source.attack_interval_source) {
    context.addIssue({
      code: "custom",
      path: ["attack_interval_source"],
      message: "attack_interval_source is required when attack_interval is present",
    });
  }
  if (source.attack_interval === undefined && source.attack_interval_source) {
    context.addIssue({
      code: "custom",
      path: ["attack_interval_source"],
      message: "attack_interval_source cannot be used without attack_interval",
    });
  }
  if (source.attack_count !== undefined && source.attack_interval === undefined) {
    context.addIssue({
      code: "custom",
      path: ["attack_count"],
      message: "attack_count requires attack_interval",
    });
  }
}

export const weaponModeSourceSchema = z
  .strictObject({
    prototype_mode: z.number().int().nonnegative().optional(),
    numerical: modeNumericalReferenceSchema.optional(),
    asc_type_id: positiveIdStringSchema.optional(),
    feel_param_id: positiveIdStringSchema.optional(),
    fire_interval: finiteNonNegativeSchema.optional(),
    attack_interval: finiteNonNegativeSchema.optional(),
    attack_count: positiveSafeIntegerSchema.optional(),
    attack_interval_source: attackIntervalSourceSchema.optional(),
    pellets: positiveSafeIntegerSchema.optional(),
    overrides: damageSourceOverridesSchema.optional(),
    override_reason: nonEmptyStringSchema.optional(),
    verification: damageSourceVerificationSchema.optional(),
  })
  .superRefine(validateMechanicalConfig);

const modeSourcesSchema = z
  .strictObject({
    lc: weaponModeSourceSchema.optional(),
    td: weaponModeSourceSchema.optional(),
  })
  .refine((value) => value.lc !== undefined || value.td !== undefined, {
    message: "sources must contain at least one mode",
  });

export const damageSourceV2Schema = z
  .strictObject({
    id: z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/),
    name: nonEmptyStringSchema,
    section: damageSectionSchema,
    inherits: z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/).optional(),
    label: nonEmptyStringSchema.optional(),
    source: weaponModeSourceSchema.optional(),
    sources: modeSourcesSchema.optional(),
  })
  .superRefine((source, context) => {
    if (Boolean(source.source) === Boolean(source.sources)) {
      context.addIssue({
        code: "custom",
        path: ["source"],
        message: "a damage source must contain exactly one of source or sources",
      });
    }
  });

export const projectedDamageSourceV2Schema = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/),
  name: nonEmptyStringSchema,
  section: damageSectionSchema,
  inherits: z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/).optional(),
  source: weaponDataSourceRefSchema.optional(),
  label: nonEmptyStringSchema.optional(),
  fire_interval: finiteNonNegativeSchema.optional(),
  attack_interval: finiteNonNegativeSchema.optional(),
  attack_count: positiveSafeIntegerSchema.optional(),
  attack_interval_source: attackIntervalSourceSchema.optional(),
  pellets: positiveSafeIntegerSchema.optional(),
  overrides: damageSourceOverridesSchema.optional(),
  override_reason: nonEmptyStringSchema.optional(),
  verification: damageSourceVerificationSchema.optional(),
});

const stringListSchema = z.union([
  nonEmptyStringSchema,
  z.array(nonEmptyStringSchema).min(1),
]);

const itemIdModeValueSchema = z.union([
  positiveIdStringSchema,
  z
    .strictObject({
      lc: positiveIdStringSchema.optional(),
      td: positiveIdStringSchema.optional(),
    })
    .refine((value) => value.lc !== undefined || value.td !== undefined, {
      message: "item_id mode map must contain at least one mode",
    }),
]);

const numberModeValueSchema = z.union([
  finiteNonNegativeSchema,
  z
    .strictObject({
      lc: finiteNonNegativeSchema.optional(),
      td: finiteNonNegativeSchema.optional(),
    })
    .refine((value) => value.lc !== undefined || value.td !== undefined, {
      message: "mode value must contain at least one mode",
    }),
]);

const weaponSourceV2BaseSchema = z.strictObject({
  schema_version: z.literal(2),
  title: nonEmptyStringSchema,
  nickname: nonEmptyStringSchema.optional(),
  keywords: stringListSchema.optional(),
  tag: stringListSchema.optional(),
  toc: z.boolean().optional(),
  "page-width": nonEmptyStringSchema.optional(),
  draft: z.boolean().optional(),

  game_modes: z.array(numericalTableSchema).min(1).max(2),
  prototype_id: positiveIdStringSchema,
  item_id: itemIdModeValueSchema.optional(),
  use_type: nonEmptyStringSchema,
  weapon_type: nonEmptyStringSchema.optional(),
  element: z.enum(["物理", "火焰", "寒冷", "电弧", "腐蚀"]),
  rarity: z.enum(["稀有", "史诗", "传说"]),
  tags: stringListSchema.optional(),
  scope: nonEmptyStringSchema.optional(),

  damage_sources: z.array(damageSourceV2Schema),

  magazine: z.number().int().nonnegative().optional(),
  total_ammo: z.number().int().nonnegative().optional(),
  accuracy: z.number().finite().min(0).max(100).optional(),
  stability: z.number().finite().min(0).max(100).optional(),
  changeClip: z
    .strictObject({
      timeBase: finiteNonNegativeSchema,
      reloadRecovery: finiteNonNegativeSchema,
    })
    .optional(),
  range: finiteNonNegativeSchema.optional(),
  explosion_range: numberModeValueSchema.optional(),
  attenuation_begin: finiteNonNegativeSchema.optional(),
  attenuation_end: finiteNonNegativeSchema.optional(),
  attenuation_scale: finiteNonNegativeSchema.optional(),
  skill_cooldown: finiteNonNegativeSchema.optional(),
  skill_duration: finiteNonNegativeSchema.optional(),
  skill_blocking: z.boolean().optional(),
  show_duration: z.boolean().optional(),
  shooting_energy: z.boolean().optional(),
  shooting_energy_count: z.number().int().positive().optional(),
  weapon_type_id: z.number().int().nonnegative().optional(),
  active_skill_id: nonNegativeSafeIntegerSchema.optional(),
});

type WeaponSourceV2Base = z.infer<typeof weaponSourceV2BaseSchema>;

interface ProtocolIssue {
  path: PropertyKey[];
  message: string;
}

export interface ResolvedDamageSourceReference {
  source?: WeaponDataSourceRef;
  label?: string;
  fire_interval?: number;
  attack_interval?: number;
  attack_count?: number;
  attack_interval_source?: string;
  pellets?: number;
  pending: boolean;
  origins: {
    numerical?: string;
    prototype_mode?: string;
    asc_type_id?: string;
    feel_param_id?: string;
    label?: string;
    fire_interval?: string;
    attack_interval?: string;
    attack_count?: string;
    attack_interval_source?: string;
    pellets?: string;
  };
  overrideChain: readonly DamageSourceOverrideStep[];
}

export interface DamageSourceOverrideStep {
  sourceId: string;
  reason: string;
  overrides: DamageSourceOverrides;
}

function mergeSourceReference(
  parent: WeaponDataSourceRef | undefined,
  local: WeaponDataSourceRef | undefined,
): WeaponDataSourceRef | undefined {
  if (!parent && !local) return undefined;
  const merged: WeaponDataSourceRef = { ...parent, ...local };
  if (local?.asc_type_id !== undefined && local.feel_param_id === undefined) {
    merged.feel_param_id = local.asc_type_id;
  } else if (merged.asc_type_id && !merged.feel_param_id) {
    merged.feel_param_id = merged.asc_type_id;
  }
  return merged;
}

function analyzeWeaponSource(weapon: ProjectedWeaponSourceV2): {
  issues: ProtocolIssue[];
  resolved: Map<string, ResolvedDamageSourceReference>;
} {
  const issues: ProtocolIssue[] = [];
  const indexes = new Map<string, number>();
  let graphIsValid = true;

  for (const [index, source] of weapon.damage_sources.entries()) {
    const previousIndex = indexes.get(source.id);
    if (previousIndex !== undefined) {
      issues.push({
        path: ["damage_sources", index, "id"],
        message: `duplicate damage source id "${source.id}" (first used at index ${previousIndex})`,
      });
      graphIsValid = false;
      continue;
    }
    indexes.set(source.id, index);
  }

  for (const [index, source] of weapon.damage_sources.entries()) {
    if (!source.inherits) continue;
    if (source.inherits === source.id) {
      issues.push({
        path: ["damage_sources", index, "inherits"],
        message: "a damage source cannot inherit itself",
      });
      graphIsValid = false;
    } else if (!indexes.has(source.inherits)) {
      issues.push({
        path: ["damage_sources", index, "inherits"],
        message: `inherited damage source "${source.inherits}" is unavailable in ${weapon.table}`,
      });
      graphIsValid = false;
    }
  }

  if (graphIsValid) {
    const states = new Map<string, "visiting" | "visited">();
    const visit = (id: string): void => {
      const state = states.get(id);
      if (state === "visited") return;
      if (state === "visiting") {
        const index = indexes.get(id)!;
        issues.push({
          path: ["damage_sources", index, "inherits"],
          message: `inheritance cycle detected at "${id}"`,
        });
        graphIsValid = false;
        return;
      }
      states.set(id, "visiting");
      const source = weapon.damage_sources[indexes.get(id)!];
      if (source.inherits) visit(source.inherits);
      states.set(id, "visited");
    };
    for (const source of weapon.damage_sources) visit(source.id);
  }

  const resolved = new Map<string, ResolvedDamageSourceReference>();
  if (graphIsValid) {
    const resolve = (id: string): ResolvedDamageSourceReference => {
      const cached = resolved.get(id);
      if (cached) return cached;
      const source = weapon.damage_sources[indexes.get(id)!];
      const parent = source.inherits ? resolve(source.inherits) : undefined;
      const mergedSource = mergeSourceReference(parent?.source, source.source);
      const localSource = source.source;
      const ascChanged = localSource?.asc_type_id !== undefined;
      const result: ResolvedDamageSourceReference = {
        source: mergedSource,
        label: source.label ?? parent?.label,
        fire_interval: source.fire_interval ?? parent?.fire_interval,
        attack_interval: source.attack_interval ?? parent?.attack_interval,
        attack_count: source.attack_count ?? parent?.attack_count,
        attack_interval_source:
          source.attack_interval_source ?? parent?.attack_interval_source,
        pellets: source.pellets ?? parent?.pellets,
        pending: Boolean(source.verification),
        origins: {
          numerical:
            localSource?.numerical !== undefined
              ? source.id
              : parent?.origins.numerical,
          prototype_mode:
            localSource?.prototype_mode !== undefined
              ? source.id
              : parent?.origins.prototype_mode,
          asc_type_id: ascChanged ? source.id : parent?.origins.asc_type_id,
          feel_param_id:
            localSource?.feel_param_id !== undefined || ascChanged
              ? source.id
              : parent?.origins.feel_param_id,
          label: source.label !== undefined ? source.id : parent?.origins.label,
          fire_interval:
            source.fire_interval !== undefined
              ? source.id
              : parent?.origins.fire_interval,
          attack_interval:
            source.attack_interval !== undefined
              ? source.id
              : parent?.origins.attack_interval,
          attack_count:
            source.attack_count !== undefined
              ? source.id
              : parent?.origins.attack_count,
          attack_interval_source:
            source.attack_interval_source !== undefined
              ? source.id
              : parent?.origins.attack_interval_source,
          pellets:
            source.pellets !== undefined ? source.id : parent?.origins.pellets,
        },
        overrideChain: [
          ...(parent?.overrideChain ?? []),
          ...(source.overrides && source.override_reason
            ? [
                {
                  sourceId: source.id,
                  reason: source.override_reason,
                  overrides: source.overrides,
                },
              ]
            : []),
        ],
      };
      resolved.set(id, result);
      return result;
    };

    for (const source of weapon.damage_sources) resolve(source.id);

    for (const [index, source] of weapon.damage_sources.entries()) {
      const effective = resolved.get(source.id)!;
      if (!effective.source?.numerical && !effective.pending) {
        issues.push({
          path: ["damage_sources", index, "source", "numerical"],
          message: "the effective damage source must contain a numerical reference",
        });
      }
      if (effective.source?.feel_param_id && !effective.source.asc_type_id) {
        issues.push({
          path: ["damage_sources", index, "source", "feel_param_id"],
          message: "feel_param_id requires an effective asc_type_id",
        });
      }
      if (effective.attack_interval !== undefined && effective.source?.asc_type_id) {
        issues.push({
          path: ["damage_sources", index, "attack_interval"],
          message: "attack_interval cannot be used with an effective asc_type_id",
        });
      }
      if (effective.attack_count !== undefined && effective.attack_interval === undefined) {
        issues.push({
          path: ["damage_sources", index, "attack_count"],
          message: "attack_count requires an effective attack_interval",
        });
      }
    }
  }
  return { issues, resolved };
}

function selectModeValue<T>(
  value: T | Partial<Record<NumericalTable, T>> | undefined,
  table: NumericalTable,
): T | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value as T;
  }
  return (value as Partial<Record<NumericalTable, T>>)[table];
}

function projectModeSource(
  source: WeaponModeSource,
  table: NumericalTable,
): ProjectedDamageSourceV2["source"] {
  return {
    ...(source.prototype_mode !== undefined
      ? { prototype_mode: source.prototype_mode }
      : {}),
    ...(source.numerical
      ? {
          numerical: {
            table,
            id: source.numerical.id,
            level: source.numerical.level,
          },
        }
      : {}),
    ...(source.asc_type_id !== undefined
      ? { asc_type_id: source.asc_type_id }
      : {}),
    ...(source.feel_param_id !== undefined
      ? { feel_param_id: source.feel_param_id }
      : {}),
  };
}

function projectParsedWeaponSourceV2(
  weapon: WeaponSourceV2Base,
  table: NumericalTable,
): ProjectedWeaponSourceV2 {
  if (!weapon.game_modes.includes(table)) {
    throw new Error(`weapon does not declare game mode "${table}"`);
  }
  const damageSources: ProjectedDamageSourceV2[] = [];
  for (const source of weapon.damage_sources) {
    const modeSource = source.source ?? source.sources?.[table];
    if (!modeSource) continue;
    damageSources.push({
      id: source.id,
      name: source.name,
      section: source.section,
      inherits: source.inherits,
      label: source.label,
      source: projectModeSource(modeSource, table),
      fire_interval: modeSource.fire_interval,
      attack_interval: modeSource.attack_interval,
      attack_count: modeSource.attack_count,
      attack_interval_source: modeSource.attack_interval_source,
      pellets: modeSource.pellets,
      overrides: modeSource.overrides,
      override_reason: modeSource.override_reason,
      verification: modeSource.verification,
    });
  }
  return {
    ...weapon,
    table,
    item_id: selectModeValue(weapon.item_id, table),
    explosion_range: selectModeValue(weapon.explosion_range, table),
    damage_sources: damageSources,
  };
}

function validateSharedGraph(
  weapon: WeaponSourceV2Base,
  context: z.RefinementCtx,
): void {
  const indexes = new Map<string, number>();
  for (const [index, source] of weapon.damage_sources.entries()) {
    const previous = indexes.get(source.id);
    if (previous !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["damage_sources", index, "id"],
        message: `duplicate damage source id "${source.id}" (first used at index ${previous})`,
      });
    } else {
      indexes.set(source.id, index);
    }
  }
  for (const [index, source] of weapon.damage_sources.entries()) {
    if (!source.inherits) continue;
    if (source.inherits === source.id) {
      context.addIssue({
        code: "custom",
        path: ["damage_sources", index, "inherits"],
        message: "a damage source cannot inherit itself",
      });
    } else if (!indexes.has(source.inherits)) {
      context.addIssue({
        code: "custom",
        path: ["damage_sources", index, "inherits"],
        message: `inherited damage source "${source.inherits}" does not exist`,
      });
    }
  }
}

export const weaponSourceV2Schema = weaponSourceV2BaseSchema.superRefine(
  (weapon, context) => {
    const modes = new Set(weapon.game_modes);
    if (modes.size !== weapon.game_modes.length) {
      context.addIssue({
        code: "custom",
        path: ["game_modes"],
        message: "game_modes must not contain duplicates",
      });
    }

    for (const [index, source] of weapon.damage_sources.entries()) {
      for (const table of ["lc", "td"] as const) {
        if (source.sources?.[table] && !modes.has(table)) {
          context.addIssue({
            code: "custom",
            path: ["damage_sources", index, "sources", table],
            message: `source mode "${table}" is not declared by game_modes`,
          });
        }
      }
    }

    for (const [field, value] of [
      ["item_id", weapon.item_id],
      ["explosion_range", weapon.explosion_range],
    ] as const) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      for (const table of Object.keys(value) as NumericalTable[]) {
        if (!modes.has(table)) {
          context.addIssue({
            code: "custom",
            path: [field, table],
            message: `mode "${table}" is not declared by game_modes`,
          });
        }
      }
    }

    validateSharedGraph(weapon, context);

    for (const table of weapon.game_modes) {
      const projected = projectParsedWeaponSourceV2(weapon, table);
      const { issues } = analyzeWeaponSource(projected);
      for (const issue of issues) {
        context.addIssue({
          code: "custom",
          path: issue.path,
          message: `[${table}] ${issue.message}`,
        });
      }
    }

    const hasPending = weapon.damage_sources.some((source) => {
      if (source.source?.verification) return true;
      return Boolean(source.sources?.lc?.verification || source.sources?.td?.verification);
    });
    if (hasPending && !weapon.draft) {
      context.addIssue({
        code: "custom",
        path: ["draft"],
        message: "a weapon with pending damage sources must set draft: true",
      });
    }
  },
);

export function validateWeaponSourceV2(input: unknown): WeaponSourceV2 {
  return weaponSourceV2Schema.parse(input);
}

export function projectWeaponSourceV2(
  weapon: WeaponSourceV2,
  table: NumericalTable,
): ProjectedWeaponSourceV2 {
  const parsed = weaponSourceV2Schema.parse(weapon);
  return projectParsedWeaponSourceV2(parsed, table);
}

export function resolveDamageSourceReferences(
  weapon: WeaponSourceV2,
  table: NumericalTable,
): ReadonlyMap<string, ResolvedDamageSourceReference> {
  const projected = projectWeaponSourceV2(weapon, table);
  return analyzeWeaponSource(projected).resolved;
}

export type NumericalTable = z.infer<typeof numericalTableSchema>;
export type DamageSection = z.infer<typeof damageSectionSchema>;
export type NumericalReference = z.infer<typeof numericalReferenceSchema>;
export type ModeNumericalReference = z.infer<typeof modeNumericalReferenceSchema>;
export type WeaponDataSourceRef = z.infer<typeof weaponDataSourceRefSchema>;
export type NumericalOverrides = z.infer<typeof numericalOverridesSchema>;
export type AttenuationOverride = z.infer<typeof attenuationOverrideSchema>;
export type AscOverrides = z.infer<typeof ascOverridesSchema>;
export type DamageSourceOverrides = z.infer<typeof damageSourceOverridesSchema>;
export type WeaponModeSource = z.infer<typeof weaponModeSourceSchema>;
export type DamageSourceV2 = z.infer<typeof damageSourceV2Schema>;
export type ProjectedDamageSourceV2 = z.infer<typeof projectedDamageSourceV2Schema>;
export type WeaponSourceV2 = z.infer<typeof weaponSourceV2Schema>;
export type ProjectedWeaponSourceV2 = Omit<
  WeaponSourceV2,
  "item_id" | "explosion_range" | "damage_sources"
> & {
  table: NumericalTable;
  item_id?: string;
  explosion_range?: number;
  damage_sources: ProjectedDamageSourceV2[];
};
