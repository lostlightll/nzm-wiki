import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { auditS0ReviewedValues } from "./s0-reviewed-values";
import { auditS1ReviewedValues } from "./s1-reviewed-values";
import type { LegacyValueEvidence } from "./reviewed";

const evidence = (season: string): LegacyValueEvidence => JSON.parse(readFileSync(`data/season-talents/${season}/audit.json`, "utf8")).valueEvidence;
const s0 = evidence("s0").s0;
const s1 = evidence("s1").s1;
if (!s0 || !s1) throw new Error("Missing committed S0/S1 value evidence");
const reports = { s0: auditS0ReviewedValues(s0), s1: auditS1ReviewedValues(s1) };
console.log(JSON.stringify({ s0: reports.s0.summary, s1: reports.s1.summary }, null, 2));
const output = process.argv.find(arg => arg.startsWith("--out="))?.slice(6);
if (output) {
  const path = resolve(output);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(reports, null, 2) + "\n");
  console.log(`Detailed value provenance and missing evidence: ${path}`);
}
