import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import matter from "gray-matter";
import { getNumSkillValue, resolveWeaponSkills } from "../../lib/num-skill-data";
import { parseWeaponDataLock } from "../../lib/weapon-data-lock";
import { inventoryLegacyWeapon, migrateWeaponSource, reviewedBodyChanges, type MigrationBaseline } from "./migrate";

const root = process.cwd();
const baseline: MigrationBaseline = JSON.parse(readFileSync(path.join(root, "data/weapon-skill-migration-baseline.json"), "utf8"));
const lock = parseWeaponDataLock(JSON.parse(readFileSync(path.join(root, "data/weapon-data-lock.json"), "utf8")));
const directory = path.join(root, "data/weapons");

test("migration baseline covers every weapon, including empty skill inventories", () => {
  assert.equal(baseline.version, 1);
  const files = readdirSync(directory).filter((file) => file.endsWith(".mdx")).map((file) => file.slice(0, -4)).sort();
  assert.equal(files.length, 121);
  assert.deepEqual(baseline.weapons.map((weapon) => weapon.slug).sort(), files);
  assert.equal(new Set(baseline.weapons.map((weapon) => weapon.slug)).size, files.length);
  assert.deepEqual(baseline.expectedBodyChanges, reviewedBodyChanges);
  assert.deepEqual(baseline.expectedChanges, [{ slug: "天鹅之舞", skillId: "active-1", parameter: "panel_duration", before: 15, after: 12, evidence: "docs/architecture/weapon-skill-duration-evidence.md#天鹅之舞" }], "only independently audited corrections may change published values");
});

test("能源之影裸枪20秒、超频30秒、CD45秒在LC/TD迁移后保持不变", () => {
  const previous = baseline.weapons.find((weapon) => weapon.slug === "能源之影")!;
  const data = matter(readFileSync(path.join(directory, "能源之影.mdx"), "utf8")).data;
  for (const mode of ["lc", "td"] as const) {
    assert.equal(previous.activeSkillByMode[mode]?.cooldown, 45);
    assert.equal(previous.skills.find((skill) => skill.id === "active-1")?.expectedByMode[mode]?.cooldown, 45);
    assert.equal(resolveWeaponSkills(data, "能源之影", mode).find((skill) => skill.id === "active-1")?.parameters.cooldown, 45);
    const parameters = resolveWeaponSkills(data, "能源之影", mode).find((skill) => skill.id === "active-1")!.parameters;
    assert.equal(parameters.duration, 20);
    assert.equal(parameters.panel_duration, 20);
    const skill = resolveWeaponSkills(data, "能源之影", mode).find((entry) => entry.id === "active-1")!;
    assert.equal(getNumSkillValue(skill, "duration", 1312049001), 30);
    assert.throws(() => getNumSkillValue(skill, "duration", 999999), /Unaudited/);
  }
  assert.ok(baseline.expectedChanges.every((change) => change.parameter !== "cooldown"));
});

test("重新迁移时PVE同名持续参数冲突不能改变原值", () => {
  for (const slug of ["能源之影", "心有凌兮", "天鹅之舞"]) {
    const previous = baseline.weapons.find((weapon) => weapon.slug === slug)!;
    const migrated = migrateWeaponSource(previous.originalHeader! + previous.body, slug, lock, {}, []);
    assert.deepEqual(migrated.expectedChanges, []);
    const { data } = matter(migrated.source);
    for (const mode of ["lc", "td"] as const) {
      const skill = resolveWeaponSkills(data, slug, mode).find((entry) => entry.id === "active-1")!;
      assert.equal(skill.parameters.duration, previous.skills.find((entry) => entry.id === "active-1")!.expectedByMode[mode]!.duration);
      assert.equal(skill.parameters.panel_duration, previous.frontmatter.skill_duration);
    }
  }
});

for (const previous of baseline.weapons) {
  test(`${previous.slug}: LC/TD all skill properties and full prose match recorded baseline`, () => {
    const source = readFileSync(path.join(directory, `${previous.slug}.mdx`), "utf8");
    const { data, content } = matter(source);
    const { skills, ...retained } = data;
    assert.ok(Array.isArray(skills));
    assert.deepEqual(retained, previous.frontmatter);
    assert.equal(new Set(skills.map((skill) => skill.id)).size, skills.length);
    const openings = [...content.matchAll(/<(ActiveSkill|PassiveSkill)\b([^>]*?)>/g)];
    assert.deepEqual(openings.map((match) => match[0]), previous.skills.map((skill) => `<${skill.kind === "active" ? "ActiveSkill" : "PassiveSkill"} skill="${skill.id}">`));
    let index = 0;
    let restoredBody = content.replace(/<(ActiveSkill|PassiveSkill)\b([^>]*?)>/g, () => previous.skills[index++].opening);
    for (const change of baseline.expectedBodyChanges.filter((entry) => entry.slug === previous.slug)) {
      assert.equal(restoredBody.split(change.after).length, 2);
      restoredBody = restoredBody.replace(change.after, change.before);
    }
    assert.equal(restoredBody.replace(/\r\n/g, "\n"), previous.body.replace(/\r\n/g, "\n"), "all child/prose content must survive, except checkout line endings and explicit reviewed changes");
    // The frontmatter addition is also reversible byte-for-byte, so SHA verifies
    // the evidence came from the original file rather than a reserialized copy.
    const sourceWithoutSkills = source.replace(/^skills:[\s\S]*?(?=^---\r?$)/m, "");
    const restoredHeader = sourceWithoutSkills.slice(0, sourceWithoutSkills.length - content.length);
    assert.equal(typeof previous.originalHeader, "string");
    assert.equal(restoredHeader.replace(/\r\n/g, "\n"), previous.originalHeader!.replace(/\r\n/g, "\n"));
    const restoredSource = previous.originalHeader! + previous.body;
    assert.equal(createHash("sha256").update(restoredSource).digest("hex"), previous.sha256);
    const reinventory = inventoryLegacyWeapon(restoredSource, previous.slug, lock);
    assert.deepEqual(reinventory, previous, "baseline freezes original resolver output and props");
    assert.equal(migrateWeaponSource(source, previous.slug, lock, {}, []).source, source, "migration is idempotent without refs");

    for (const mode of previous.frontmatter.game_modes as Array<"lc" | "td">) {
      const resolved = resolveWeaponSkills(data, previous.slug, mode);
      const visible = resolved.filter((skill) => skill.display);
      assert.deepEqual(visible.map((skill) => skill.id), previous.skills.map((skill) => skill.id));
      for (const legacy of previous.skills) {
        const actual = visible.find((skill) => skill.id === legacy.id)!;
        assert.equal(actual.kind, legacy.kind);
        const expected = legacy.expectedByMode[mode]!;
        for (const field of ["name", "icon", "tag"] as const) assert.equal(actual[field], expected[field], `${mode}:${legacy.id}.${field}`);
        for (const field of ["duration", "cooldown", "count"] as const) {
          const change = baseline.expectedChanges.find((entry) => entry.slug === previous.slug && entry.skillId === legacy.id && entry.parameter === field);
          assert.equal(actual.parameters[field], change?.after ?? expected[field], `${mode}:${legacy.id}.${field}`);
        }
      }
      for (const actual of resolved.filter((skill) => skill.kind === "active")) {
        assert.equal(actual.parameters.cooldown, previous.activeSkillByMode[mode]?.cooldown);
        assert.equal(actual.parameters.count, previous.activeSkillByMode[mode]?.count);
        assert.equal(actual.gameSkillId, previous.frontmatter.active_skill_id);
        assert.equal(actual.parameters.blocking, previous.frontmatter.skill_blocking);
        const change = baseline.expectedChanges.find((entry) => entry.slug === previous.slug && entry.skillId === actual.id && entry.parameter === "panel_duration");
        assert.equal(actual.parameters.panel_duration, change?.after ?? previous.frontmatter.skill_duration);
      }
      if (Number(previous.frontmatter.active_skill_id) > 0) assert.ok(resolved.some((skill) => skill.kind === "active"));
    }
  });
}
