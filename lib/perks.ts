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
import { MODIFIER_TYPES } from "@/lib/multiplier-data";

const PERKS_DATA_DIR = path.join(process.cwd(), "data/perks");
const MODIFIER_TYPE_IDS = new Set(MODIFIER_TYPES.map((type) => type.id));
const STAT_IDS = new Set([
  "toughness-efficiency",
  "critical-rate",
  "charge-efficiency",
  "fire-rate",
]);

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
    return {
      ...(condition ? { condition } : {}),
      value: requireNonEmptyString(
        record.value,
        `${field}[${index}].value`,
        filePath,
      ),
    };
  });
}

function parseEffectValues(
  value: unknown,
  filePath: string,
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
    const kind = requireNonEmptyString(
      record.kind,
      `effect_values[${index}].kind`,
      filePath,
    );
    const label = requireNonEmptyString(
      record.label,
      `effect_values[${index}].label`,
      filePath,
    );
    const stages = parseEffectValueStages(
      record.stages,
      `effect_values[${index}].stages`,
      filePath,
    );

    if (kind === "damage") {
      const modifierTypeId = requireNonEmptyString(
        record.modifierTypeId,
        `effect_values[${index}].modifierTypeId`,
        filePath,
      );
      if (!MODIFIER_TYPE_IDS.has(modifierTypeId)) {
        throw new Error(
          `插件 effect_values[${index}] 使用未知增伤类型 ${modifierTypeId}: ${filePath}`,
        );
      }
      const identity = `damage:${modifierTypeId}`;
      if (identities.has(identity)) {
        throw new Error(`插件 effect_values 存在重复类型 ${identity}: ${filePath}`);
      }
      identities.add(identity);
      return { kind, modifierTypeId, label, stages };
    }

    if (kind === "stat") {
      const statId = requireNonEmptyString(
        record.statId,
        `effect_values[${index}].statId`,
        filePath,
      );
      if (!STAT_IDS.has(statId)) {
        throw new Error(
          `插件 effect_values[${index}] 使用未知属性类型 ${statId}: ${filePath}`,
        );
      }
      const identity = `stat:${statId}`;
      if (identities.has(identity)) {
        throw new Error(`插件 effect_values 存在重复类型 ${identity}: ${filePath}`);
      }
      identities.add(identity);
      return {
        kind,
        statId: statId as Extract<PerkEffectValue, { kind: "stat" }>["statId"],
        label,
        stages,
      };
    }

    throw new Error(`插件 effect_values[${index}] 使用未知 kind ${kind}: ${filePath}`);
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
        description: data.description,
        effectValues: parseEffectValues(data.effect_values, filePath),
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
        description: data.description,
        effectValues: parseEffectValues(data.effect_values, filePath),
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
