import { z } from "zod";

const nonEmptyStringSchema = z.string().trim().min(1);
const positiveIdStringSchema = z.string().regex(/^[1-9]\d*$/);
const finiteNonNegativeSchema = z.number().finite().nonnegative();
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

export const numericalReferenceSchema = z.strictObject({
  table: numericalTableSchema,
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

export const numericalOverridesSchema = z
  .strictObject({
    damage: numericalDamageOverridesSchema.optional(),
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
  });

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

export const ascOverridesSchema = z.strictObject({
  attenuation: attenuationOverrideSchema,
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

export const damageSourceV2Schema = z
  .strictObject({
    id: z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/),
    name: nonEmptyStringSchema,
    section: damageSectionSchema,
    inherits: z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/).optional(),
    source: weaponDataSourceRefSchema.optional(),
    label: nonEmptyStringSchema.optional(),
    fire_interval: finiteNonNegativeSchema.optional(),
    pellets: positiveSafeIntegerSchema.optional(),
    overrides: damageSourceOverridesSchema.optional(),
    override_reason: nonEmptyStringSchema.optional(),
    verification: damageSourceVerificationSchema.optional(),
  })
  .superRefine((source, context) => {
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
  });

const stringListSchema = z.union([
  nonEmptyStringSchema,
  z.array(nonEmptyStringSchema).min(1),
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

  prototype_id: positiveIdStringSchema,
  item_id: positiveIdStringSchema.optional(),
  use_type: nonEmptyStringSchema,
  weapon_type: nonEmptyStringSchema.optional(),
  element: z.enum(["物理", "火焰", "寒冷", "电弧", "腐蚀"]),
  rarity: z.enum(["稀有", "史诗", "传说"]),
  tags: stringListSchema.optional(),
  scope: nonEmptyStringSchema.optional(),
  game_mode: numericalTableSchema.optional(),

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
  explosion_range: finiteNonNegativeSchema.optional(),
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
  pellets?: number;
  pending: boolean;
  origins: {
    numerical?: string;
    prototype_mode?: string;
    asc_type_id?: string;
    feel_param_id?: string;
    label?: string;
    fire_interval?: string;
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

  const merged: WeaponDataSourceRef = {
    ...parent,
    ...local,
  };

  if (local?.asc_type_id !== undefined && local.feel_param_id === undefined) {
    merged.feel_param_id = local.asc_type_id;
  } else if (merged.asc_type_id && !merged.feel_param_id) {
    merged.feel_param_id = merged.asc_type_id;
  }

  return merged;
}

function analyzeWeaponSource(weapon: WeaponSourceV2Base): {
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
        message: `inherited damage source "${source.inherits}" does not exist`,
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

    const tables = new Set<NumericalTable>();
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

      if (effective.source?.numerical) {
        tables.add(effective.source.numerical.table);
      }
    }

    if (tables.size > 1) {
      issues.push({
        path: ["damage_sources"],
        message: "all effective numerical references in one weapon must use the same table",
      });
    }
  }

  if (weapon.damage_sources.some((source) => source.verification) && !weapon.draft) {
    issues.push({
      path: ["draft"],
      message: "a weapon with pending damage sources must set draft: true",
    });
  }

  return { issues, resolved };
}

export const weaponSourceV2Schema = weaponSourceV2BaseSchema.superRefine(
  (weapon, context) => {
    const { issues } = analyzeWeaponSource(weapon);
    for (const issue of issues) {
      context.addIssue({
        code: "custom",
        path: issue.path,
        message: issue.message,
      });
    }
  },
);

export interface ValidateWeaponSourceV2Options {
  expectedTable: NumericalTable;
}

export function validateWeaponSourceV2(
  input: unknown,
  { expectedTable }: ValidateWeaponSourceV2Options,
): WeaponSourceV2 {
  return weaponSourceV2Schema
    .superRefine((weapon, context) => {
      if (weapon.game_mode && weapon.game_mode !== expectedTable) {
        context.addIssue({
          code: "custom",
          path: ["game_mode"],
          message: `game_mode "${weapon.game_mode}" does not match expected table "${expectedTable}"`,
        });
      }

      const { resolved } = analyzeWeaponSource(weapon);
      for (const [index, source] of weapon.damage_sources.entries()) {
        const table = resolved.get(source.id)?.source?.numerical?.table;
        if (table && table !== expectedTable) {
          context.addIssue({
            code: "custom",
            path: ["damage_sources", index, "source", "numerical", "table"],
            message: `effective numerical table "${table}" does not match expected table "${expectedTable}"`,
          });
        }
      }
    })
    .parse(input);
}

export function resolveDamageSourceReferences(
  weapon: WeaponSourceV2,
): ReadonlyMap<string, ResolvedDamageSourceReference> {
  const parsed = weaponSourceV2Schema.parse(weapon);
  return analyzeWeaponSource(parsed).resolved;
}

export type NumericalTable = z.infer<typeof numericalTableSchema>;
export type DamageSection = z.infer<typeof damageSectionSchema>;
export type NumericalReference = z.infer<typeof numericalReferenceSchema>;
export type WeaponDataSourceRef = z.infer<typeof weaponDataSourceRefSchema>;
export type NumericalOverrides = z.infer<typeof numericalOverridesSchema>;
export type AttenuationOverride = z.infer<typeof attenuationOverrideSchema>;
export type AscOverrides = z.infer<typeof ascOverridesSchema>;
export type DamageSourceOverrides = z.infer<typeof damageSourceOverridesSchema>;
export type DamageSourceV2 = z.infer<typeof damageSourceV2Schema>;
export type WeaponSourceV2 = z.infer<typeof weaponSourceV2Schema>;
