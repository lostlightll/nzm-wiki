import { z } from "zod";
import snapshot from "@/data/perk-preview-damage.json";
import type { TriggerDamageEntry } from "@/lib/trigger-damage";
import { getHealthSettlementDefinition, isWeaponHealthSettlementType, HEALTH_SETTLEMENT_PREFIX } from "@/lib/weapon-health-settlement";

const evidenceSchema = z.object({
  schema_version: z.literal(1),
  source: z.object({ path: z.literal("DataTables/numerical_config_composite.json"), sha256: z.string().regex(/^[a-f0-9]{64}$/) }),
  entries: z.array(z.object({
    itemId: z.string(), name: z.string(), slug: z.string(), trigger: z.string(), interval: z.string(), rowName: z.string(),
    raw: z.object({
      id: z.number().int().positive(), Level: z.literal(1),
      HpCalScale: z.number().finite().nonnegative(), HpCalBase: z.literal(0),
      ToughnessBase: z.literal(0), ToughnessScale: z.literal(0),
      ElementType: z.literal("EElementEffectType::EDamageType_Cryo"),
      bEnableCriticalDamage: z.boolean(), EnableWeaknessDamage: z.boolean(),
      WeaknessDamageAddScale: z.number().finite(),
      Settlements: z.array(z.object({ TagName: z.string() })),
    }).passthrough(),
  })),
});

const evidence = evidenceSchema.parse(snapshot);
const entries = new Map(evidence.entries.map(entry => [entry.itemId, entry]));
if (entries.size !== evidence.entries.length) throw new Error("Duplicate preview damage ItemID");
for (const entry of entries.values()) {
  if (entry.rowName !== `${entry.raw.id}_${entry.raw.Level}`) throw new Error(`Preview damage identity mismatch: ${entry.rowName}`);
}

const number = (value: number) => String(Math.round(value * 10000) / 10000);

/** Only explicitly registered preview perks may consume this isolated snapshot. */
export function resolvePreviewDamageDescription(description: string | undefined, itemId: string, season?: string): string | undefined {
  if (!description?.includes("{GPNumericalID:")) return description;
  const entry = season === "s4-preview" ? entries.get(itemId) : undefined;
  return description.replace(/\{GPNumericalID:([^}]+)\}/g, (token, fields: string) => {
    if (!entry || fields !== `${entry.raw.id}:HpCalScale:13`) {
      throw new Error(`Unregistered damage token for perk ${itemId}: ${token}`);
    }
    return `${number(entry.raw.HpCalScale * 100)}%`;
  });
}

export function getPreviewPerkDamage(itemId: string, season?: string): TriggerDamageEntry | undefined {
  const entry = season === "s4-preview" ? entries.get(itemId) : undefined;
  if (!entry) return undefined;
  const health = entry.raw.Settlements.map(tag => tag.TagName).filter(tag => tag.startsWith(HEALTH_SETTLEMENT_PREFIX));
  const type = health[0]?.slice(HEALTH_SETTLEMENT_PREFIX.length);
  if (health.length !== 1 || !type || !isWeaponHealthSettlementType(type)) {
    throw new Error(`Invalid preview damage settlement: ${entry.rowName}`);
  }
  const definition = getHealthSettlementDefinition(type);
  if (definition.kind !== "damage" || definition.valueFormat !== "attack-coefficient") {
    throw new Error(`Unsupported preview damage settlement: ${type}`);
  }
  return {
    name: entry.name, perkSlug: entry.slug, trigger: entry.trigger, interval: entry.interval,
    numericalId: String(entry.raw.id), damageType: definition.label,
    damageValue: number(entry.raw.HpCalScale * 500), toughness: "0", element: "寒冷",
    critical: entry.raw.bEnableCriticalDamage, weakpoint: entry.raw.EnableWeaknessDamage,
    weakpointMultiplier: 1 + entry.raw.WeaknessDamageAddScale,
  };
}
