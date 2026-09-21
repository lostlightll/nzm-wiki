import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import type { Perk } from "../../types";
import type { TriggerDamageEntry } from "../../lib/trigger-damage";
import type { MultiplierRelation } from "../../lib/multiplier-data";
import { parseOverlimitCatalog } from "../../lib/overlimit-catalog";
import { catalogAssets, CURRENT_FILE } from "../overlimit/catalog";
import { isPreviewSeason } from "../../lib/content-preview";
import { parsePerkPreviewCatalog, type PerkPreviewEntry } from "../../lib/perk-preview-catalog";
import { isDeepStrictEqual } from "node:util";

export interface CaptureOptions { includePreview?: boolean }
export interface CaptureInput {
  perks: Perk[];
  independentDamage: Record<string, TriggerDamageEntry[]>;
  relations: readonly MultiplierRelation[];
}

const json = (value: unknown) => Buffer.from(JSON.stringify(value, null, 2) + "\n");
const isPreview = (perk: Perk) => isPreviewSeason(perk.season);

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
    const identity = `${isPreview(perk) ? "preview" : "current"}:${perk.itemId}`;
    if (!perk.itemId || identities.has(identity)) throw new Error(`Duplicate or missing perk ItemID: ${identity}`);
    const slugPattern = isPreview(perk) ? /^preview\/slot-[1-4]\/[^/\\]+$/ : /^slot-[1-4]\/[^/\\]+$/;
    if (!slugPattern.test(perk.slug) || perk.slug.includes("..") || slugs.has(perk.slug)) {
      throw new Error(`Invalid or duplicate perk slug: ${perk.slug}`);
    }
    identities.add(identity);
    slugs.add(perk.slug);
  }
  const perks = input.perks.filter(perk => options.includePreview || !isPreview(perk));
  const publishedPreview = new Map<string, PerkPreviewEntry>();
  if (perks.some(isPreview)) {
    const file = "data/perk-preview/preview.json";
    files[file] = read(file);
    const snapshot = parsePerkPreviewCatalog(JSON.parse(files[file].toString("utf8")));
    for (const entry of snapshot.entries) publishedPreview.set(entry.perk.slug, entry);
    if (snapshot.entries.length !== perks.filter(isPreview).length) {
      throw new Error("Published perk preview changed during capture");
    }
  }
  const selectedSlugs = new Set(perks.map(perk => perk.slug));
  const assets = new Set(catalogAssets(catalog));
  let previewSummary: { version: string; cards: number; bonds: number; mapPeriods: number } | undefined;
  let previewCatalog: ReturnType<typeof parseOverlimitCatalog> | undefined;
  let previewSeason: string | undefined;
  const previewFile = "data/overlimit/preview.json";
  if (options.includePreview && fs.existsSync(path.join(root, previewFile))) {
    const rawPreview: unknown = JSON.parse(read(previewFile).toString("utf8"));
    if (rawPreview !== null) {
      const preview = parseOverlimitCatalog(rawPreview);
      previewCatalog = preview;
      files[previewFile] = read(previewFile);
      const previewLinksFile = "data/overlimit/preview-links.json";
      files[previewLinksFile] = read(previewLinksFile);
      previewSeason = JSON.parse(files[previewLinksFile].toString("utf8")).season;
      if (!isPreviewSeason(previewSeason)) throw new Error("Preview links require an explicit preview season");
      for (const asset of catalogAssets(preview)) assets.add(asset);
      previewSummary = { version: preview.season.id, cards: preview.cards.length,
        bonds: preview.bonds?.length ?? 0, mapPeriods: preview.mapRotation?.periods.length ?? 0 };
    }
  }
  for (const perk of perks) {
    const relative = isPreview(perk)
      ? `data/perk-preview/${perk.slug.slice("preview/".length)}.mdx`
      : `data/perks/${perk.slug}.mdx`;
    if (isPreview(perk)) {
      const entry = publishedPreview.get(perk.slug);
      if (!entry || !isDeepStrictEqual(entry.perk, perk)) {
        throw new Error(`Published perk preview changed during capture: ${perk.slug}`);
      }
      files[relative] = Buffer.from(entry.source);
    } else {
      files[relative] = read(relative);
    }
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
    if (source?.type === "perk") return selectedSlugs.has(`${isPreviewSeason(source.season) ? "preview/" : ""}slot-${source.slot}/${source.slug}`);
    if (source?.type === "overlimit-card") return source.season
      ? source.season === previewSeason && previewCatalog?.cards.some(card => card.id === source.id) : cardIds.has(source.id);
    if (source?.type === "overlimit-bond") return (source.season
      ? source.season === previewSeason ? previewCatalog?.bonds : undefined
      : catalog.bonds)?.some(bond =>
      bond.name === source.name && bond.effects.some(effect => effect.count === source.count));
    return false;
  }));
  // Exact shared locks are archival evidence only. Weapons remain outside this version domain.
  const evidence = ["data/num-modifier-lock.json", "data/num-modifier-semantics.json"];
  if (perks.some(isPreview) || previewCatalog) evidence.push("data/perk-preview-modifiers.json");
  if (previewCatalog && fs.existsSync(path.join(root, "data/overlimit/preview-evidence.json"))) {
    evidence.push("data/overlimit/preview-evidence.json");
  }
  const currentEvidence = "data/overlimit/current-evidence.json";
  if (fs.existsSync(path.join(root, currentEvidence))) evidence.push(currentEvidence);
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
      ...(previewSummary ? { overlimitPreview: previewSummary } : {}),
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
  const [{ getAllPublishedPerks }, { getIndependentDamageByPerkSlug }, { getTriggerDamageByPerkSlug }, { PROVIDER_RELATIONS }, { getPerkPreviewEntry }] = await Promise.all([
    import("../../lib/perks"), import("../../lib/independent-damage"),
    import("../../lib/trigger-damage"), import("../../lib/multiplier-data"), import("../../lib/perk-preview"),
  ]);
  const perks = getAllPublishedPerks();
  const independentDamage: Record<string, TriggerDamageEntry[]> = {};
  for (const perk of perks) {
    if (!options.includePreview && isPreview(perk)) continue;
    // The common API rereads all MDX. Use it only for actual weapon references.
    if (isPreview(perk)) {
      independentDamage[perk.slug] = getPerkPreviewEntry(perk.slug)?.independentDamage ?? [];
    } else if (perk.independentDamageSources?.length) {
      independentDamage[perk.slug] = await getIndependentDamageByPerkSlug(perk.slug);
    } else {
      const trigger = getTriggerDamageByPerkSlug(perk.slug);
      if (trigger) independentDamage[perk.slug] = [trigger];
    }
  }
  return assembleCapture(root, { perks, independentDamage, relations: PROVIDER_RELATIONS }, options);
}
