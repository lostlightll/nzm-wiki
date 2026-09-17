import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { archiveCatalog, activateCatalog, checkCatalog, CURRENT_FILE, readCatalog, sha256, verifyArchive } from "./catalog";
import { inspectOverlimit } from "./inspect";
import { projectOverlimitLinks } from "../../lib/overlimit-links";

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  "content-root": { type: "string" }, against: { type: "string" }, output: { type: "string" },
  catalog: { type: "string" }, review: { type: "string" }, season: { type: "string" },
} });
const root = process.cwd();
const command = positionals[0];
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const required = (key: keyof typeof values) => {
  const value = values[key];
  if (!value) throw new Error(`Missing --${key}`);
  return value;
};

async function main() {
  if (command === "check") {
    const file = path.resolve(values.catalog ?? CURRENT_FILE);
    const catalog = readCatalog(file);
    checkCatalog(catalog, root);
    if (!values.catalog && JSON.stringify(JSON.parse(fs.readFileSync("data/overlimit/links.json", "utf8"))) !== JSON.stringify(projectOverlimitLinks(catalog))) {
      throw new Error("Published links are stale; run pnpm overlimit project");
    }
    console.log(`${catalog.season.label}: ${catalog.cards.length} cards; catalog and assets valid; SHA-256 ${sha256(fs.readFileSync(file))}`);
  } else if (command === "project") {
    const catalog = readCatalog(CURRENT_FILE);
    fs.writeFileSync("data/overlimit/links.json", JSON.stringify(projectOverlimitLinks(catalog), null, 2) + "\n");
    console.log("Updated the cross-page links from the current catalog.");
  } else if (command === "archive") {
    const catalog = readCatalog(CURRENT_FILE);
    const { getProviderRelationsForSource } = await import("../../lib/multiplier-data");
    const relations = [
      ...catalog.cards.map(card => ({ type: "overlimit-card" as const, id: card.id })),
      ...(catalog.bonds ?? []).flatMap(bond => bond.effects.map(effect => ({ type: "overlimit-bond" as const, name: bond.name, count: effect.count }))),
    ].map(source => ({ source, relations: getProviderRelationsForSource(source) }));
    const output = values.output ?? `MD/_local/overlimit/archives/${catalog.season.id}-${stamp}`;
    const target = archiveCatalog(root, output, relations);
    verifyArchive(target);
    console.log(`Archived and verified: ${target}`);
  } else if (command === "verify-archive") {
    verifyArchive(required("output"));
    console.log("Archive checksums verified.");
  } else if (command === "prepare") {
    const season = required("season");
    if (!/^[a-z0-9][a-z0-9.-]*$/.test(season)) throw new Error("Invalid season identifier");
    const result = inspectOverlimit(required("content-root"), values.against);
    const output = path.resolve(values.output ?? `MD/_local/overlimit/candidates/${season}-${stamp}.json`);
    const base = path.resolve("MD/_local/overlimit/candidates");
    const relative = path.relative(base, output);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Candidates belong in MD/_local/overlimit/candidates");
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify({ season, ...result }, null, 2) + "\n", { flag: "wx" });
    console.log(`Unreviewed evidence only: ${output}`);
    console.log(JSON.stringify(result.facts));
  } else if (command === "activate") {
    const current = readCatalog(CURRENT_FILE);
    activateCatalog(root, required("catalog"), required("review"),
      values.output ?? `MD/_local/overlimit/archives/${current.season.id}-${stamp}`);
    fs.writeFileSync("data/overlimit/links.json", JSON.stringify(projectOverlimitLinks(readCatalog(CURRENT_FILE)), null, 2) + "\n");
    console.log("Local current catalog replaced. Run pnpm build before deploying.");
  } else {
    throw new Error("Usage: pnpm overlimit <check|project|archive|verify-archive|prepare|activate> [--content-root PATH --against PATH --season ID --catalog FILE --review FILE --output PATH]");
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
