import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { getPerkSourceEntries } from "./source";
import { getActivePreview, getPreviewSeasonKey } from "../../lib/content-preview";
import { parsePerkPreviewCatalog, parsePerkIndependentDamageSnapshot } from "../../lib/perk-preview-catalog";
import type { Perk } from "../../types";
import { resolvePerkReferences } from "../../lib/perk-independent-damage";

export const PREVIEW_FILE = "data/perk-preview/preview.json";
const fingerprint = (file: string) => ({ path: file, sha256: createHash("sha256").update(fs.readFileSync(file)).digest("hex") });

export async function projectPerkIndependentDamage(perk: Perk, metadata: Record<string, unknown>) {
  return [
    ...parsePerkIndependentDamageSnapshot(metadata.independent_damage_snapshot),
    ...(await resolvePerkReferences(perk)),
  ];
}

/** Explicit publishing step. Never writes current MDX, shared locks, or overlimit. */
export async function projectPerkPreview() {
  const active = getActivePreview();
  if (!active) throw new Error("Register a preview before publishing perks");
  const sources = getPerkSourceEntries("preview");
  const entries = await Promise.all(sources.map(async ({ perk, content, metadata, sourcePath }) => ({
    perk, content, metadata, source: fs.readFileSync(sourcePath, "utf8"),
    // Explicit snapshots and reviewed references only; never inherit current trigger data.
    independentDamage: await projectPerkIndependentDamage(perk, metadata),
  })));
  const dependencies = new Set([
    ...sources.map(entry => entry.sourcePath),
    "data/perk-preview-modifiers.json", "data/num-modifier-semantics.json",
    "data/weapon-data-lock.json",
    ...sources.flatMap(entry => (entry.perk.independentDamageSources ?? []).map(ref => `data/weapons/${ref.weaponSlug}.mdx`)),
    ...sources.flatMap(entry => entry.perk.skillVariants?.length ? [
      "data/num-skill-lock.json", "data/num-skill-variants.json",
      ...entry.perk.skillVariants.map(variant => `data/weapons/${variant.reference.weapon_slug}.mdx`),
    ] : []),
  ]);
  const catalog = parsePerkPreviewCatalog({
    schemaVersion: 1,
    season: { id: active.version, key: getPreviewSeasonKey(active), label: active.label, status: "preload" },
    provenance: { files: [...dependencies].sort().map(fingerprint) }, entries,
  });
  fs.writeFileSync(PREVIEW_FILE, JSON.stringify(catalog, null, 2) + "\n");
  console.log(`Published ${catalog.entries.length} ${catalog.season.label} perks; current release untouched.`);
}

export function checkPerkPreview() {
  const raw: unknown = JSON.parse(fs.readFileSync(PREVIEW_FILE, "utf8"));
  if (raw === null) return;
  const active = getActivePreview();
  const catalog = parsePerkPreviewCatalog(raw);
  if (!active || catalog.season.id !== active.version || catalog.season.key !== getPreviewSeasonKey(active)) {
    throw new Error("Published perk preview does not match the configured version");
  }
  for (const entry of catalog.entries) {
    if (!entry.perk.icon) continue;
    for (const file of [`public/icons/perks/${entry.perk.icon}.png`, `public/webp/icons/perks/${entry.perk.icon}.webp`]) {
      if (!fs.existsSync(file)) throw new Error(`Missing published perk icon: ${file}`);
    }
  }
  // Shared weapon/Num changes do not invalidate or silently refresh a published snapshot.
  console.log(`Validated ${catalog.entries.length} isolated preview perks.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const command = process.argv[2];
  if (command === "check") checkPerkPreview();
  else if (command === "write" && process.argv[3] === "--channel" && process.argv[4] === "preview") {
    projectPerkPreview().catch(error => { console.error(error); process.exitCode = 1; });
  } else throw new Error("Usage: pnpm perks:project --channel preview | pnpm perks:check");
}
