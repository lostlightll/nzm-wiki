/** Finish a reviewed release after perk and overlimit source migrations. */
import fs from "node:fs";
import assert from "node:assert/strict";
import { parseArgs } from "node:util";
import { parseModifierProviderRegistry } from "../../lib/modifier-provider-registry";

const { values } = parseArgs({ options: {
  season: { type: "string" }, "overlimit-providers": { type: "string" },
  "perk-providers": { type: "string" }, write: { type: "boolean" },
} });
assert.ok(values.season && values["overlimit-providers"],
  "Usage: promote-shared.ts --season s4 --overlimit-providers PATH [--perk-providers PATH] [--write]");
const key = `${values.season}-preview`;
const read = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));
const write = (file: string, value: unknown) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
const registry = read("data/modifier-providers.json");
const overlimit = read(values["overlimit-providers"]);
const extraPerks = values["perk-providers"] ? read(values["perk-providers"]) : { providers: [], exclusions: [] };
const liveCards = read("data/overlimit/current.json");
assert.equal(liveCards.season.status, "current");
assert.equal(liveCards.season.id, values.season);
const linkedPerks = new Set(liveCards.cards.map((card: { perkItemId?: string }) => card.perkItemId).filter(Boolean));
for (const group of ["providers", "exclusions"]) {
  registry[group] = registry[group].filter((entry: { source: { type: string } }) =>
    !["overlimit-card", "overlimit-bond"].includes(entry.source.type));
  for (const entry of registry[group]) {
    if (entry.source.season !== key) continue;
    delete entry.source.season;
    entry.id = entry.id.replace(`:${key}:`, ":");
    if (entry.source.type === "perk") entry.source.overlimitCard = linkedPerks.has(entry.source.itemId);
    if (entry.evidence?.basis) entry.evidence.basis.push(
      `${values.season}正式服转正：沿相同身份复核当前表及已引用Numerical，数值改用正式Lock；预载证据仅作为历史依据。`);
  }
  const replacements = extraPerks[group] ?? [];
  const replacementIds = new Set(replacements.map((entry: { id: string }) => entry.id));
  registry[group] = registry[group].filter((entry: { id: string }) => !replacementIds.has(entry.id));
  registry[group].push(...overlimit[group], ...replacements);
}
const validatedRegistry = parseModifierProviderRegistry(registry);
const variants = read("data/num-skill-variants.json");
const promoted = variants.variants.filter((variant: { channel: string }) => variant.channel === key)
  .map((variant: unknown) => JSON.parse(JSON.stringify(variant).replaceAll(`${key}:`, "current:").replaceAll(`"${key}"`, '"current"')));
const promotedKeys = new Set(promoted.map((variant: { key: string }) => variant.key));
variants.variants = [...variants.variants.filter((variant: { channel: string; key: string }) =>
  variant.channel !== key && !promotedKeys.has(variant.key)), ...promoted];
const lock = read("data/num-skill-lock.json");
// The following explicit current-channel refresh re-reads all promoted references from live sources.
for (const row of Object.keys(lock.rows)) if (row.startsWith(`${key}:`)) delete lock.rows[row];
const release = read("config/content-version.json");
assert.equal(release.season, values.season);
delete release.preview;
release.phase = "candidate";
if (values.write) {
  write("data/modifier-providers.json", validatedRegistry);
  write("data/num-skill-variants.json", variants);
  write("data/num-skill-lock.json", lock);
  write("config/content-version.json", release);
}
console.log(JSON.stringify({ write: Boolean(values.write), providers: registry.providers.length,
  exclusions: registry.exclusions.length, variants: variants.variants.length }, null, 2));
