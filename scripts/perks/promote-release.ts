/** Explicitly promote reviewed perk sources after auditing the live client delta. */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";
import matter from "gray-matter";
import YAML from "yaml";
import { verifyVersion } from "../content-versions/store";

const { values } = parseArgs({ options: {
  "content-root": { type: "string" }, archive: { type: "string" },
  baseline: { type: "string" }, season: { type: "string" }, write: { type: "boolean" },
} });
assert.ok(values["content-root"] && values.archive && values.baseline && values.season,
  "Usage: promote-release.ts --content-root PATH --archive PATH --baseline PATH --season s4 [--write]");
const contentRoot = path.resolve(values["content-root"]);
const season = values.season;
const previewKey = `${season}-preview`;
const archive = path.resolve(values.archive);
verifyVersion(archive);
verifyVersion(path.resolve(values.baseline));
const readJson = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));
const rows = (file: string) => readJson(path.join(contentRoot, file))[0].Rows;
const mods = rows("DataTables/LuaDataTable/WeaponModItemData.json");
const numerical = rows("Attributes/AutoGenerate/numerical_modifier_config.json");
const lockedNumerical = readJson("data/num-modifier-lock.json").rows.lc;
const previewNumerical = readJson(path.join(archive, "files/evidence/data/perk-preview-modifiers.json"));
const baseline = new Map<string, Record<string, unknown>>();
for (const slot of [1, 2, 3, 4]) {
  const directory = path.join(values.baseline, `files/data/perks/slot-${slot}`);
  if (!fs.existsSync(directory)) continue;
  for (const file of fs.readdirSync(directory).filter(file => file.endsWith(".mdx"))) {
    const data = matter.read(path.join(directory, file)).data;
    baseline.set(String(data.id), data);
  }
}
const fields = ["ID", "Level", "AttributeName", "GPModifierOp", "BaseValue", "CoefValue"];
const plans: { source: string; target: string; text: string; id: string; snapshotRemoved: boolean }[] = [];
const changedBindings: { id: string; row: string; field: string }[] = [];
for (const slot of [1, 2, 3, 4]) {
  const directory = `data/perk-preview/slot-${slot}`;
  for (const file of fs.readdirSync(directory).filter(file => file.endsWith(".mdx"))) {
    const source = path.join(directory, file);
    const entry = matter.read(source);
    const data = structuredClone(entry.data);
    const id = String(data.id);
    assert.equal(data.season, previewKey, source);
    assert.ok(mods[id], `Missing live ItemID ${id}`);
    assert.ok(mods[id].MODSlotIndex.Values.includes(slot), `Slot drift ${id}`);
    for (const expression of Object.values(data.num_modifier_values ?? {}) as { row: string }[]) {
      const key = expression.row.replace(/^lc:/, "");
      assert.ok(numerical[key] && lockedNumerical[key], `Missing live Numerical evidence ${id}/${key}`);
      for (const field of fields) {
        assert.deepEqual(numerical[key][field], lockedNumerical[key].raw[field], `Stale live Lock ${id}/${key}/${field}`);
        if (numerical[key][field] !== previewNumerical.rows[key]?.[field]) changedBindings.push({ id, row: key, field });
      }
    }
    // Preserve introduction season for existing items; a channel is not an introduction date.
    const previous = baseline.get(id);
    if (previous?.season) data.season = previous.season;
    else if (previous) delete data.season;
    else data.season = season;
    delete data.preview_change;
    delete data.draft;
    // Official trigger damage is reviewed separately; never activate a frozen preload snapshot.
    const snapshotRemoved = data.independent_damage_snapshot !== undefined;
    delete data.independent_damage_snapshot;
    for (const field of ["CollectMODItem", "MakeMODItem", "IsCooked"]) data[field] = mods[id][field];
    for (const reference of data.skill_variants ?? []) {
      reference.variant = reference.variant.replace(`${previewKey}:`, "current:");
    }
    const target = `data/perks/slot-${slot}/${file}`;
    assert.ok(!fs.existsSync(target), `Refusing to overwrite ${target}`);
    plans.push({ source, target, id, snapshotRemoved, text: `---\n${YAML.stringify(data, { version: "1.1", lineWidth: 0 })}---\n${entry.content}` });
  }
}
assert.ok(plans.length > 0, "No reviewed preview sources to promote");
assert.equal(new Set(plans.map(plan => plan.id)).size, plans.length, "Duplicate ItemID");
if (values.write) {
  for (const plan of plans) {
    fs.mkdirSync(path.dirname(plan.target), { recursive: true });
    fs.writeFileSync(plan.target, plan.text, { flag: "wx" });
  }
  // All destination writes succeeded before removing the archived editable copies.
  for (const plan of plans) fs.unlinkSync(plan.source);
  fs.writeFileSync("data/perk-preview/preview.json", "null\n");
}
console.log(JSON.stringify({ write: Boolean(values.write), season, count: plans.length,
  removedSnapshots: plans.filter(plan => plan.snapshotRemoved).length,
  changedBindings,
  source: { path: contentRoot, modifierSha256: createHash("sha256").update(
    fs.readFileSync(path.join(contentRoot, "Attributes/AutoGenerate/numerical_modifier_config.json"))).digest("hex") },
}, null, 2));
