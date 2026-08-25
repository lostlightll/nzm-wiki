import fs from "fs";
import path from "path";
import matter from "gray-matter";
import type {
  EffectValueStage,
  Perk,
  PerkEffectValue,
  PerkIndependentDamageSourceReference,
  PerkSlot,
  Rarity,
} from "@/types";
import { isValidDateKey } from "@/lib/date-key";
import {
  NUM_MODIFIER_RESOLVER,
  NUM_MODIFIER_SEMANTICS,
} from "@/lib/num-modifier-data";
import type {
  NumModifierRowKey,
  NumModifierValueBindings,
  NumModifierValueExpression,
  NumModifierValueFormat,
} from "@/lib/num-modifier";

const PERKS_DATA_DIR = path.join(process.cwd(), "data/perks");
const FACETS = new Map(
  Object.entries(NUM_MODIFIER_SEMANTICS.attribute_types).flatMap(
    ([typeId, type]) =>
      Object.values(type.facets).flatMap((facet) =>
        facet ? [[facet.id, { ...facet, typeId }] as const] : [],
      ),
  ),
);

function requireNonEmptyString(
  value: unknown,
  field: string,
  filePath: string,
): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`插件 ${field} 必须是非空字符串: ${filePath}`);
  }
  return value.trim();
}

function parseEffectValueStages(
  value: unknown,
  field: string,
  filePath: string,
  bindings: NumModifierValueBindings,
): EffectValueStage[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`插件 ${field} 必须包含至少一个阶段: ${filePath}`);
  }

  return value.map((stage, index) => {
    if (!stage || typeof stage !== "object" || Array.isArray(stage)) {
      throw new Error(`插件 ${field}[${index}] 格式无效: ${filePath}`);
    }
    const record = stage as Record<string, unknown>;
    const condition =
      record.condition === undefined
        ? undefined
        : requireNonEmptyString(
            record.condition,
            `${field}[${index}].condition`,
            filePath,
          );
    const rawValue = record.value;
    if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
      throw new Error(
        `插件 ${field}[${index}].value 必须使用 Num 引用或带依据的 literal: ${filePath}`,
      );
    }
    const valueRecord = rawValue as Record<string, unknown>;
    let resolvedValue: string;
    if (typeof valueRecord.ref === "string") {
      const ref = requireNonEmptyString(
        valueRecord.ref,
        `${field}[${index}].value.ref`,
        filePath,
      );
      const expression = bindings[ref];
      if (!expression) {
        throw new Error(
          `插件 ${field}[${index}].value 引用了未知 Num 别名 ${ref}: ${filePath}`,
        );
      }
      const format = requireNonEmptyString(
        valueRecord.format,
        `${field}[${index}].value.format`,
        filePath,
      ) as NumModifierValueFormat;
      if (
        !["number", "percent", "signed-number", "signed-percent"].includes(
          format,
        )
      ) {
        throw new Error(
          `插件 ${field}[${index}].value.format 无效: ${filePath}`,
        );
      }
      if (Object.keys(valueRecord).some((key) => key !== "ref" && key !== "format")) {
        throw new Error(
          `插件 ${field}[${index}].value Num 引用包含未知字段: ${filePath}`,
        );
      }
      resolvedValue = NUM_MODIFIER_RESOLVER.resolveValue(
        expression,
        format,
        `${filePath}#${field}[${index}]`,
      ).text;
    } else {
      const literal = requireNonEmptyString(
        valueRecord.literal,
        `${field}[${index}].value.literal`,
        filePath,
      );
      requireNonEmptyString(
        valueRecord.reason,
        `${field}[${index}].value.reason`,
        filePath,
      );
      if (Object.keys(valueRecord).some((key) => key !== "literal" && key !== "reason")) {
        throw new Error(
          `插件 ${field}[${index}].value literal 包含未知字段: ${filePath}`,
        );
      }
      resolvedValue = literal;
    }
    return {
      ...(condition ? { condition } : {}),
      value: resolvedValue,
    };
  });
}

function parseNumModifierValues(
  value: unknown,
  filePath: string,
): NumModifierValueBindings {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`插件 num_modifier_values 必须是对象: ${filePath}`);
  }
  const bindings: Record<string, NumModifierValueExpression> = {};
  for (const [alias, rawExpression] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (!/^[a-z][a-z0-9-]*$/.test(alias)) {
      throw new Error(`插件 Num 别名必须是 kebab-case: ${alias}: ${filePath}`);
    }
    if (
      !rawExpression ||
      typeof rawExpression !== "object" ||
      Array.isArray(rawExpression)
    ) {
      throw new Error(`插件 Num 表达式 ${alias} 格式无效: ${filePath}`);
    }
    const record = rawExpression as Record<string, unknown>;
    const row = requireNonEmptyString(
      record.row,
      `num_modifier_values.${alias}.row`,
      filePath,
    );
    if (!/^lc:.+/.test(row)) {
      throw new Error(`插件 Num 表达式 ${alias}.row 必须使用 lc: 引用: ${filePath}`);
    }
    const field = requireNonEmptyString(
      record.field,
      `num_modifier_values.${alias}.field`,
      filePath,
    );
    if (field !== "base" && field !== "coefficient") {
      throw new Error(`插件 Num 表达式 ${alias}.field 无效: ${filePath}`);
    }
    const scale = record.scale === undefined ? undefined : Number(record.scale);
    if (scale !== undefined && (!Number.isFinite(scale) || scale <= 0)) {
      throw new Error(`插件 Num 表达式 ${alias}.scale 无效: ${filePath}`);
    }
    if (
      Object.keys(record).some(
        (key) => key !== "row" && key !== "field" && key !== "scale",
      )
    ) {
      throw new Error(`插件 Num 表达式 ${alias} 包含未知字段: ${filePath}`);
    }
    const expression: NumModifierValueExpression = {
      row: row as NumModifierRowKey,
      field,
      ...(scale === undefined ? {} : { scale }),
    };
    NUM_MODIFIER_RESOLVER.resolveValue(
      expression,
      "number",
      `${filePath}#num_modifier_values.${alias}`,
    );
    bindings[alias] = expression;
  }
  return bindings;
}

function resolveDescription(
  value: unknown,
  filePath: string,
  bindings: NumModifierValueBindings,
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new Error(`插件 description 必须是字符串: ${filePath}`);
  }
  return NUM_MODIFIER_RESOLVER.resolveTemplate(
    value,
    bindings,
    `${filePath}#description`,
  );
}

function parseEffectValues(
  value: unknown,
  filePath: string,
  bindings: NumModifierValueBindings,
): PerkEffectValue[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`插件 effect_values 必须是非空数组: ${filePath}`);
  }

  const identities = new Set<string>();
  return value.map((effect, index) => {
    if (!effect || typeof effect !== "object" || Array.isArray(effect)) {
      throw new Error(`插件 effect_values[${index}] 格式无效: ${filePath}`);
    }
    const record = effect as Record<string, unknown>;
    if (
      Object.hasOwn(record, "kind") ||
      Object.hasOwn(record, "statId") ||
      Object.hasOwn(record, "modifierTypeId")
    ) {
      throw new Error(
        `插件 effect_values[${index}] 不得手写 kind/statId/modifierTypeId: ${filePath}`,
      );
    }
    const stages = parseEffectValueStages(
      record.stages,
      `effect_values[${index}].stages`,
      filePath,
      bindings,
    );
    const referencedAliases = (record.stages as unknown[]).flatMap((stage) => {
      if (!stage || typeof stage !== "object" || Array.isArray(stage)) return [];
      const rawStageValue = (stage as Record<string, unknown>).value;
      if (
        !rawStageValue ||
        typeof rawStageValue !== "object" ||
        Array.isArray(rawStageValue)
      ) {
        return [];
      }
      const ref = (rawStageValue as Record<string, unknown>).ref;
      return typeof ref === "string" ? [ref] : [];
    });
    const semantic = record.semantic;
    let facetId: string;
    if (referencedAliases.length > 0) {
      if (semantic !== undefined) {
        throw new Error(
          `插件 effect_values[${index}] 的 Num 引用不得覆写 semantic: ${filePath}`,
        );
      }
      const resolved = referencedAliases.map((alias, stageIndex) => {
        const expression = bindings[alias];
        if (!expression) {
          throw new Error(
            `插件 effect_values[${index}] 引用了未知 Num 别名 ${alias}: ${filePath}`,
          );
        }
        const resolvedEffect = NUM_MODIFIER_RESOLVER.resolveEffect(
          expression,
          undefined,
          `${filePath}#effect_values[${index}].stages[${stageIndex}]`,
        );
        if (resolvedEffect.facets.length !== 1 || !resolvedEffect.attribute.typeId) {
          throw new Error(
            `插件 effect_values[${index}] 无法从 ${expression.row} 唯一派生语义分面: ${filePath}`,
          );
        }
        return resolvedEffect;
      });
      facetId = resolved[0].facets[0].id;
      if (
        resolved.some(
          (item) =>
            item.facets[0].id !== facetId ||
            item.attribute.typeId !== resolved[0].attribute.typeId,
        )
      ) {
        throw new Error(
          `插件 effect_values[${index}] 的 stages 属于不兼容的属性语义: ${filePath}`,
        );
      }
    } else {
      if (!semantic || typeof semantic !== "object" || Array.isArray(semantic)) {
        throw new Error(
          `插件 effect_values[${index}] 的 literal 必须显式声明 semantic.facetId: ${filePath}`,
        );
      }
      const semanticRecord = semantic as Record<string, unknown>;
      facetId = requireNonEmptyString(
        semanticRecord.facetId,
        `effect_values[${index}].semantic.facetId`,
        filePath,
      );
      if (Object.keys(semanticRecord).some((key) => key !== "facetId")) {
        throw new Error(
          `插件 effect_values[${index}].semantic 包含未知字段: ${filePath}`,
        );
      }
    }
    const facet = FACETS.get(facetId);
    if (!facet || facet.consumer === "index") {
      throw new Error(
        `插件 effect_values[${index}] 使用不可展示的分面 ${facetId}: ${filePath}`,
      );
    }
    const label =
      record.label === undefined
        ? facet.label
        : requireNonEmptyString(
            record.label,
            `effect_values[${index}].label`,
            filePath,
          );
    const kind = facet.consumer;
    const identity = `${kind}:${facetId}`;
    if (identities.has(identity)) {
      throw new Error(`插件 effect_values 存在重复类型 ${identity}: ${filePath}`);
    }
    identities.add(identity);
    return kind === "damage"
      ? { kind, modifierTypeId: facetId, label, stages }
      : { kind, statId: facetId, label, stages };
  });
}

function parseIndependentDamageSources(
  value: unknown,
  filePath: string,
): PerkIndependentDamageSourceReference[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(
      `插件 independent_damage_sources 必须是非空数组: ${filePath}`,
    );
  }

  const identities = new Set<string>();
  return value.map((reference, index) => {
    if (!reference || typeof reference !== "object" || Array.isArray(reference)) {
      throw new Error(
        `插件 independent_damage_sources[${index}] 格式无效: ${filePath}`,
      );
    }
    const record = reference as Record<string, unknown>;
    const weaponSlug = requireNonEmptyString(
      record.weapon_slug,
      `independent_damage_sources[${index}].weapon_slug`,
      filePath,
    );
    const damageSourceId = requireNonEmptyString(
      record.damage_source_id,
      `independent_damage_sources[${index}].damage_source_id`,
      filePath,
    );
    const identity = `${weaponSlug}:${damageSourceId}`;
    if (identities.has(identity)) {
      throw new Error(
        `插件 independent_damage_sources 存在重复引用 ${identity}: ${filePath}`,
      );
    }
    identities.add(identity);
    return {
      weaponSlug,
      damageSourceId,
      trigger: requireNonEmptyString(
        record.trigger,
        `independent_damage_sources[${index}].trigger`,
        filePath,
      ),
      interval: requireNonEmptyString(
        record.interval,
        `independent_damage_sources[${index}].interval`,
        filePath,
      ),
    };
  });
}

function parseNumberArray(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined;

  return value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
}

function parseStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseReleaseDate(
  value: unknown,
  filePath: string,
): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (!isValidDateKey(value)) {
    throw new Error(
      `插件 release_date 必须是有效的 YYYY-MM-DD 日期: ${filePath}`,
    );
  }
  return value;
}

export function getAllPerks(): Perk[] {
  if (!fs.existsSync(PERKS_DATA_DIR)) return [];

  const perks: Perk[] = [];

  // 遍历 slot-1 到 slot-4 子目录
  for (let slot = 1; slot <= 4; slot++) {
    const slotDir = path.join(PERKS_DATA_DIR, `slot-${slot}`);
    if (!fs.existsSync(slotDir)) continue;

    const files = fs.readdirSync(slotDir).filter((f) => f.endsWith(".mdx"));
    for (const file of files) {
      const filePath = path.join(slotDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const { data } = matter(content);
      const numModifierValues = parseNumModifierValues(
        data.num_modifier_values,
        filePath,
      );
      const description = resolveDescription(
        data.description,
        filePath,
        numModifierValues,
      );
      const perk: Perk = {
        id: file.replace(".mdx", ""),
        itemId: requireNonEmptyString(data.id, "id", filePath),
        slug: `slot-${slot}/${file.replace(".mdx", "")}`,
        name: data.title,
        slot: data.slot as PerkSlot,
        rarity: data.rarity as Rarity,
        category: data.category || "其他",
        icon: data.icon,
        effects: [],
        description,
        effectValues: parseEffectValues(
          data.effect_values,
          filePath,
          numModifierValues,
        ),
        independentDamageSources: parseIndependentDamageSources(
          data.independent_damage_sources,
          filePath,
        ),
        weaponType: parseNumberArray(data.weaponType),
        weaponNames: parseStringArray(data.weaponNames),
        collectModItem: data.CollectMODItem as 0 | 1 | undefined,
        makeModItem: data.MakeMODItem as 0 | 1 | undefined,
        isCooked: data.IsCooked as boolean | undefined,
        releaseDate: parseReleaseDate(data.release_date, filePath),
      };
      perks.push(perk);
    }
  }

  return perks;
}

export function getPerkByName(name: string): Perk | null {
  // 在所有槽位目录中查找
  for (let slot = 1; slot <= 4; slot++) {
    const slotDir = path.join(PERKS_DATA_DIR, `slot-${slot}`);
    if (!fs.existsSync(slotDir)) continue;

    const filePath = path.join(slotDir, `${name}.mdx`);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      const { data } = matter(content);
      const numModifierValues = parseNumModifierValues(
        data.num_modifier_values,
        filePath,
      );
      const description = resolveDescription(
        data.description,
        filePath,
        numModifierValues,
      );
      return {
        id: name,
        itemId: requireNonEmptyString(data.id, "id", filePath),
        slug: `slot-${slot}/${name}`,
        name: data.title,
        slot: data.slot as PerkSlot,
        rarity: data.rarity as Rarity,
        category: data.category || "其他",
        icon: data.icon,
        effects: [],
        description,
        effectValues: parseEffectValues(
          data.effect_values,
          filePath,
          numModifierValues,
        ),
        independentDamageSources: parseIndependentDamageSources(
          data.independent_damage_sources,
          filePath,
        ),
        weaponType: parseNumberArray(data.weaponType),
        weaponNames: parseStringArray(data.weaponNames),
        collectModItem: data.CollectMODItem as 0 | 1 | undefined,
        makeModItem: data.MakeMODItem as 0 | 1 | undefined,
        isCooked: data.IsCooked as boolean | undefined,
        releaseDate: parseReleaseDate(data.release_date, filePath),
      };
    }
  }
  return null;
}

export function getPerksByCategory(category: string): Perk[] {
  return getAllPerks().filter((perk) => perk.category === category);
}

export function getPerkBySlug(slug: string): Perk | undefined {
  return getAllPerks().find((perk) => perk.slug === slug);
}

export function getPerkByItemId(itemId: string): Perk | undefined {
  return getAllPerks().find((perk) => perk.itemId === itemId);
}

export function getPerksBySlot(slot: PerkSlot): Perk[] {
  return getAllPerks().filter((perk) => perk.slot === slot);
}

export function getPerksByRarity(rarity: Rarity): Perk[] {
  return getAllPerks().filter((perk) => perk.rarity === rarity);
}
