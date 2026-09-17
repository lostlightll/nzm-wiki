import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import type { Perk } from "../../types";
import type { TriggerDamageEntry } from "../../lib/trigger-damage";
import type { MultiplierRelation } from "../../lib/multiplier-data";
import { parseOverlimitCatalog } from "../../lib/overlimit-catalog";
import { catalogAssets, CURRENT_FILE } from "../overlimit/catalog";

export interface CaptureOptions { includePreview?: boolean }
export interface CaptureInput {
  perks: Perk[];
  independentDamage: Record<string, TriggerDamageEntry[]>;
  relations: readonly MultiplierRelation[];
}

const json = (value: unknown) => Buffer.from(JSON.stringify(value, null, 2) + "\n");
const isPreview = (perk: Perk) => Boolean(perk.season?.endsWith("-preview"));

/** Assemble selected site files; references are preserved as evidence, never activation input. */
export function assembleCapture(root: string, input: CaptureInput, options: CaptureOptions = {}) {
  const files: Record<string, Buffer> = {};
  const read = (relative: string) => fs.readFileSync(path.join(root, relative));
  files[CURRENT_FILE] = read(CURRENT_FILE);
  const catalog = parseOverlimitCatalog(JSON.parse(files[CURRENT_FILE].toString("utf8")));
  files["data/overlimit/links.json"] = read("data/overlimit/links.json");
  const identities = new Set<string>();
  const slugs = new Set<string>();
  for (const perk of input.perks) {
    if (!perk.itemId || identities.has(perk.itemId)) throw new Error(`Duplicate or missing perk ItemID: ${perk.itemId}`);
    if (!/^slot-[1-4]\/[^/\\]+$/.test(perk.slug) || perk.slug.includes("..") || slugs.has(perk.slug)) {
      throw new Error(`Invalid or duplicate perk slug: ${perk.slug}`);
    }
    identities.add(perk.itemId);
    slugs.add(perk.slug);
  }
  const perks = input.perks.filter(perk => options.includePreview || !isPreview(perk));
  const selectedSlugs = new Set(perks.map(perk => perk.slug));
  const assets = new Set(catalogAssets(catalog));
  for (const perk of perks) {
    const relative = `data/perks/${perk.slug}.mdx`;
    files[relative] = read(relative);
    const raw = matter(files[relative].toString("utf8")).data;
    if (String(raw.id) !== perk.itemId || raw.season !== perk.season) {
      throw new Error(`Perk source changed during capture: ${relative}`);
    }
    if (perk.icon) {
      if (!/^[^/\\.?#]+$/.test(perk.icon)) throw new Error(`Invalid perk icon: ${perk.icon}`);
      assets.add(`public/icons/perks/${perk.icon}.png`);
      assets.add(`public/webp/icons/perks/${perk.icon}.webp`);
    }
  }
  for (const asset of [...assets].sort()) files[asset] = read(asset);
  files["frozen/perks.json"] = json({
    schemaVersion: 1,
    perks,
    independentDamage: Object.fromEntries(Object.entries(input.independentDamage)
      .filter(([slug, entries]) => selectedSlugs.has(slug) && entries.length)),
  });
  const cardIds = new Set(catalog.cards.map(card => card.id));
  files["frozen/relations.json"] = json(input.relations.filter(({ source }) => {
    if (source?.type === "perk") return selectedSlugs.has(`slot-${source.slot}/${source.slug}`);
    if (source?.type === "overlimit-card") return cardIds.has(source.id);
    if (source?.type === "overlimit-bond") return catalog.bonds?.some(bond =>
      bond.name === source.name && bond.effects.some(effect => effect.count === source.count));
    return false;
  }));
  // Exact shared locks are archival evidence only. Weapons remain outside this version domain.
  const evidence = ["data/num-modifier-lock.json", "data/num-modifier-semantics.json"];
  if (perks.some(isPreview)) evidence.push("data/perk-preview-modifiers.json", "scripts/s4-preview-perks-review.json");
  for (const relative of evidence) files[`evidence/${relative}`] = read(relative);
  return {
    files,
    summary: {
      perks: perks.length,
      previewPerks: perks.filter(isPreview).length,
      excludedPreviewPerks: input.perks.length - perks.length,
      overlimit: { season: catalog.season, cards: catalog.cards.length,
        bonds: catalog.bonds?.length ?? 0, mapPeriods: catalog.mapRotation?.periods.length ?? 0,
        hasLevels: catalog.levels !== null },
      assets: assets.size,
    },
  };
}

/** Runtime resolvers are project-bound: refuse a misleading capture of a different root. */
export async function captureCurrent(root: string, options: CaptureOptions = {}) {
  const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
  if (fs.realpathSync(root) !== fs.realpathSync(process.cwd()) ||
      fs.realpathSync(root) !== fs.realpathSync(projectRoot)) {
    throw new Error("Capture must run from this project's root; runtime readers are bound to cwd and imported project data");
  }
  const [{ getAllPerks }, { getIndependentDamageByPerkSlug }, { getTriggerDamageByPerkSlug }, { PROVIDER_RELATIONS }] = await Promise.all([
    import("../../lib/perks"), import("../../lib/independent-damage"),
    import("../../lib/trigger-damage"), import("../../lib/multiplier-data"),
  ]);
  const perks = getAllPerks();
  const independentDamage: Record<string, TriggerDamageEntry[]> = {};
  for (const perk of perks) {
    if (!options.includePreview && isPreview(perk)) continue;
    // The common API rereads all MDX. Use it only for actual weapon references.
    if (perk.independentDamageSources?.length) {
      independentDamage[perk.slug] = await getIndependentDamageByPerkSlug(perk.slug);
    } else {
      const trigger = getTriggerDamageByPerkSlug(perk.slug);
      if (trigger) independentDamage[perk.slug] = [trigger];
    }
  }
  return assembleCapture(root, { perks, independentDamage, relations: PROVIDER_RELATIONS }, options);
}
