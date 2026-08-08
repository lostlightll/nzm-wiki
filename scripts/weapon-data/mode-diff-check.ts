import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import weaponDataLockJson from "../../data/weapon-data-lock.json";
import { buildWeaponModeDiff } from "../../lib/weapon-mode-diff";
import { createWeaponResolver } from "../../lib/weapon-resolver";
import { validateWeaponSourceV2 } from "../../lib/weapon-source-v2";

const directory = path.join(process.cwd(), "data", "weapons");
const resolver = createWeaponResolver(weaponDataLockJson);
const issues: string[] = [];
let differenceCount = 0;

for (const file of fs
  .readdirSync(directory)
  .filter((name) => name.endsWith(".mdx"))
  .sort((left, right) => left.localeCompare(right, "zh-CN"))) {
  const filePath = path.join(directory, file);
  const document = matter(fs.readFileSync(filePath, "utf8"));
  const weapon = validateWeaponSourceV2(document.data);
  if (!weapon.game_modes.includes("lc") || !weapon.game_modes.includes("td")) {
    continue;
  }
  const slug = file.replace(/\.mdx$/, "");
  const rows = buildWeaponModeDiff(
    resolver.resolveWeapon(weapon, { slug, expectedTable: "lc" }),
    resolver.resolveWeapon(weapon, { slug, expectedTable: "td" }),
  );
  const hasMarker = /<WeaponModeDiff\s*\/>/.test(document.content);
  if (rows.length > 0) differenceCount += 1;
  if (rows.length > 0 && !hasMarker) {
    issues.push(`${file}: ${rows.length} mode differences require <WeaponModeDiff />`);
  }
  if (rows.length === 0 && hasMarker) {
    issues.push(`${file}: remove stale <WeaponModeDiff /> marker`);
  }
}

if (issues.length > 0) {
  throw new Error(`weapon mode difference check failed:\n- ${issues.join("\n- ")}`);
}

console.log(
  `Weapon mode difference markers are consistent (${differenceCount} weapons).`,
);
