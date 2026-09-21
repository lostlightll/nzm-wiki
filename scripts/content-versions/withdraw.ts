import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { verifyVersion } from "./store";
import { readRelease, releaseSchema, writeRelease } from "./release";
import { isPreviewSeason } from "../../lib/content-preview";
import { parseOverlimitCatalog } from "../../lib/overlimit-catalog";

/** Retire only bytes already preserved in an immutable, verified site snapshot. */
export function withdrawCurrent(root: string, archive: string, season: string, version: string) {
  const manifest = verifyVersion(archive);
  const release = readRelease(root);
  const files = manifest.files.filter(file => /^data\/perks\/slot-[1-4]\/[^/]+\.mdx$/.test(file.path));
  const catalogFile = manifest.files.find(file => file.path === "data/overlimit/current.json");
  if (manifest.identity.season !== release.season || !files.length || !catalogFile) {
    throw new Error("Archive must preserve the active season's perks and overlimit catalog");
  }
  for (const file of [...files, catalogFile]) {
    const bytes = fs.readFileSync(path.join(root, file.path));
    if (createHash("sha256").update(bytes).digest("hex") !== file.sha256) {
      throw new Error(`Active content differs from the archive: ${file.path}`);
    }
  }
  const nextRelease = releaseSchema.parse({ ...release, season, version, phase: "candidate", basedOn: release.version });
  const actualFiles = [1, 2, 3, 4].flatMap(slot => {
    const directory = path.join(root, `data/perks/slot-${slot}`);
    return fs.existsSync(directory) ? fs.readdirSync(directory).filter(name => name.endsWith(".mdx"))
      .map(name => `data/perks/slot-${slot}/${name}`) : [];
  });
  if (actualFiles.length !== files.length || actualFiles.some(file => !files.some(entry => entry.path === file))) {
    throw new Error("Archive must contain every active official perk before withdrawal");
  }
  const registryFile = path.join(root, "data/modifier-providers.json");
  const registry = JSON.parse(fs.readFileSync(registryFile, "utf8"));
  const retired = (entry: { source?: { type: string; season?: string } }) =>
    entry.source && ["perk", "overlimit-card", "overlimit-bond"].includes(entry.source.type) && !isPreviewSeason(entry.source.season);
  registry.providers = registry.providers.filter((entry: Parameters<typeof retired>[0]) => !retired(entry));
  registry.exclusions = registry.exclusions.filter((entry: Parameters<typeof retired>[0]) => !retired(entry));
  const catalog = parseOverlimitCatalog({
    schemaVersion: 1,
    season: { id: version, label: `${version.toUpperCase()}（待更新）`, status: "current", updatedAt: new Date().toISOString().slice(0, 10) },
    provenance: {
      contentRoot: "archives/content-versions",
      note: "上一赛季已归档并撤下；正式版内容尚未发布，预览不自动转正。",
      files: [{ path: path.relative(root, path.join(archive, "manifest.json")).replaceAll("\\", "/"),
        sha256: createHash("sha256").update(fs.readFileSync(path.join(archive, "manifest.json"))).digest("hex") }],
    },
    withdrawn: true, cards: [], independentDamage: {}, bonds: null, levels: null, mapRotation: null,
  });
  // Validate the new config before removing any archived files.
  writeRelease(root, nextRelease);
  for (const file of files) fs.unlinkSync(path.join(root, file.path));
  fs.writeFileSync(registryFile, JSON.stringify(registry, null, 2) + "\n");
  fs.writeFileSync(path.join(root, catalogFile.path), JSON.stringify(catalog, null, 2) + "\n");
  console.log(`Withdrew ${files.length} archived perks and the current overlimit catalog. Rebuild links and runtime projections.`);
}
