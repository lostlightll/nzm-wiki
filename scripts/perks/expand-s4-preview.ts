/** Explicit S3.2 -> S4 preview migration. Reads references in place; never writes current content. */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import matter from "gray-matter";
import YAML from "yaml";
import { getTriggerDamageByPerkSlug } from "../../lib/trigger-damage";
import { NUM_MODIFIER_SOURCE_PATH } from "../num-modifier/lock";

type Row = Record<string, unknown>;
const base = "refs/Exports/NZM/Content_S3.2";
const target = "refs/Exports/NZM/Content";
const numericalPath = NUM_MODIFIER_SOURCE_PATH;
function rows(root: string, file: string): Record<string, Row> {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"))[0].Rows;
}
function sources(root: string) {
  return [1, 2, 3, 4].flatMap(slot => {
    const dir = `${root}/slot-${slot}`;
    return fs.readdirSync(dir).filter(file => file.endsWith(".mdx")).map(file => {
      const filePath = `${dir}/${file}`;
      return { file: filePath, ...matter.read(filePath) };
    });
  });
}

const modsBefore = rows(base, "DataTables/LuaDataTable/WeaponModItemData.json");
const modsAfter = rows(target, "DataTables/LuaDataTable/WeaponModItemData.json");
const numBefore = rows(base, numericalPath);
const numAfter = rows(target, numericalPath);
const damageBefore = rows(base, "DataTables/numerical_config_composite.json");
const damageAfter = rows(target, "DataTables/numerical_config_composite.json");
const closed = new Set(Object.keys(modsBefore).filter(id =>
  modsBefore[id].CollectMODItem === 1 && modsAfter[id]?.CollectMODItem === 0));
const current = sources("data/perks");
const drafts = sources("data/perk-preview");
const existing = new Map(drafts.map(entry => [String(entry.data.id), entry]));
const officialIds = new Set(current.map(entry => String(entry.data.id)));
const evidence = JSON.parse(fs.readFileSync("data/perk-preview-modifiers.json", "utf8"));
const changed = new Set([
  // Existing S3.2 identity reopened in S4; absence from current MDX does not make it new.
  "20703040104",
  "20703040346", "20703040354", "20703040333", "20703040345", "20703040170",
  "20703040423", "20703040424", "20703040425", "20703040445",
]);
const plans: { file: string; text: string; id: string; change: string }[] = [];
for (const entry of [...current,
  ...drafts.filter(entry => !officialIds.has(String(entry.data.id)))]) {
  const id = String(entry.data.id);
  const source = existing.get(id) ?? entry;
  const data = structuredClone(source.data);
  let content = source.content;
  const after = modsAfter[id];
  if (!after) throw new Error(`Missing current ItemID ${id}`);
  if (modsBefore[id] && modsBefore[id].PassiveSkill_ID !== after.PassiveSkill_ID) {
    throw new Error(`Review changed passive identity before migration: ${id}`);
  }
  data.season = "s4-preview";
  const baseSlug = entry.file.replace(/^data\/perks\//, "").replace(/\.mdx$/, "");
  const triggerDamage = officialIds.has(id) ? getTriggerDamageByPerkSlug(baseSlug) : undefined;
  if (triggerDamage) {
    const match = /^(\d+)(?:-(\d+))?$/.exec(triggerDamage.numericalId);
    if (!match) throw new Error(`Unreviewed damage identity: ${id}`);
    const first = Number(match[1]);
    const last = match[2] ? Number(match[1].slice(0, -match[2].length) + match[2]) : first;
    for (let numericalId = first; numericalId <= last; numericalId++) {
      const key = `${numericalId}_1`;
      const before = damageBefore[key];
      const after = damageAfter[key];
      const reviewedFields = key === "121500071_1" ? ["Settlements", "HpCalScale", "ToughnessBase", "ToughnessDamageType"]
        : key === "112042220_1" ? ["EnableAttributes", "HpCalScale", "ToughnessBase"] : [];
      const informational = ["Description", "CameraHitFeedBackTag", "DamageTextType", "DamageSourceType"];
      if (!before || !after || Object.keys(before).some(field => ![...informational, ...reviewedFields].includes(field) && JSON.stringify(before[field]) !== JSON.stringify(after[field]))) {
        throw new Error(`Review changed independent damage before inheriting: ${id}/${key}`);
      }
      if (reviewedFields.length) changed.add(id);
    }
    data.independent_damage_snapshot = [{ ...triggerDamage, perkSlug: `preview/${baseSlug}`, href: `/perks/preview/${baseSlug}` }];
    delete data.independent_damage_snapshot[0].overlimitId;
    const damage = data.independent_damage_snapshot[0];
    if (["121500071", "112042220"].includes(damage.numericalId)) {
      const row = damageAfter[`${damage.numericalId}_1`];
      if (row.HpCalBase !== 0 || row.ToughnessScale !== 0) throw new Error(`Review non-scalar damage: ${id}`);
      damage.damageValue = `${Number(row.HpCalScale) * 500}${damage.numericalId === "121500071" ? "/秒" : ""}`;
      damage.toughness = row.ToughnessBase;
    }
  }
  for (const key of ["CollectMODItem", "MakeMODItem", "IsCooked"]) data[key] = after[key];
  if (id === "20703040354") {
    data.num_modifier_values = { "all-damage": { row: "lc:111041003_1_0", field: "base" } };
    data.effect_values = [{ label: "全伤害", stages: [{ value: { ref: "all-damage", format: "signed-percent" } }] }];
    data.description = "召唤物存在时，全伤害提高<strong>{{num:all-damage|percent}}</strong>。";
    content = "\nS4 配置将增益属性从射击伤害改为全伤害，增益仍为 27%。原始描述尚未同步；此处按 Numerical 属性显示。\n";
  }
  if (["20703040423", "20703040424", "20703040425"].includes(id)) {
    data.weaponNames = [...new Set([...(data.weaponNames ?? []), "最佳拍档"])];
  }
  if (id === "20703040345") data.description = data.description.replace("（右键）", "");
  if (id === "20703040333") {
    data.description = "最多同时给<strong>8名</strong>敌人施加致命链接。满护盾状态下，带有链接状态的敌人死亡时，会将链接状态转移至另一名敌人。";
    content = "\nS4 调整了链接转移逻辑：转移前先清理死亡目标的旧链接。新旧执行逻辑均由敌人死亡事件触发，未发现新增必须由本人击杀的限制。\n\n原始文案将‘带有链接状态的敌人死亡时’改成了‘击杀带有链接状态的敌人时’，此处按执行逻辑保留死亡触发的表述。转移调用另有一个参数由 4 改为 8，但缺少底层函数参数定义，暂不据此宣称目标上限从 4 提高到 8。\n";
  }
  if (id === "20703040445") {
    delete data.num_modifier_values;
    delete data.effect_values;
    data.description = "射击伤害增益的旧数值配置已移除，S4 具体效果待核实。";
    content = "\nS3.2 引用的 Numerical 131522800_1_0 在当前资源中不存在，因此预览不沿用旧版 +36% 数值。该条目仍未开放收集与制造。\n";
  }
  if (id === "20703040453") {
    data.description = data.description.replaceAll("武器射击伤害", "武器伤害");
    for (const effect of data.effect_values ?? []) effect.label = effect.label.replace("射击伤害", "武器伤害");
  }
  for (const binding of Object.values(data.num_modifier_values ?? {}) as { row: string }[]) {
    const key = binding.row.replace(/^lc:/, "");
    if (!numAfter[key]) throw new Error(`Missing target Numerical: ${id}/${key}`);
    evidence.rows[key] = numAfter[key];
    if (officialIds.has(id) && numBefore[key] &&
      ["AttributeName", "GPModifierOp", "BaseValue", "CoefValue"].some(field => numBefore[key][field] !== numAfter[key][field])) changed.add(id);
  }
  const change = changed.has(id) ? "changed" : !officialIds.has(id) ? "new" : "existing";
  data.preview_change = change;
  const file = officialIds.has(id) ? entry.file.replace("data/perks/", "data/perk-preview/") : source.file;
  plans.push({ file, id, change, text: `---\n${YAML.stringify(data, { lineWidth: 0, defaultStringType: "QUOTE_DOUBLE" })}---\n${content}` });
}
for (const plan of plans) fs.writeFileSync(plan.file, plan.text);
evidence.source.sha256 = createHash("sha256").update(fs.readFileSync(path.join(target, numericalPath))).digest("hex");
fs.writeFileSync("data/perk-preview-modifiers.json", JSON.stringify(evidence, null, 2) + "\n");
// Bootstrap the additive classification schema before the explicit publisher loads the old snapshot.
const snapshotPath = "data/perk-preview/preview.json";
const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
for (const entry of snapshot?.entries ?? []) {
  const plan = plans.find(plan => plan.id === entry.perk.itemId);
  if (!plan) throw new Error(`Published preview item absent from migration: ${entry.perk.itemId}`);
  entry.perk.previewChange = plan.change;
  entry.metadata.preview_change = plan.change;
}
fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2) + "\n");
console.log(JSON.stringify({ total: plans.length, closed: closed.size,
  classes: Object.fromEntries(["new", "changed", "existing"].map(change => [change, plans.filter(p => p.change === change).length])) }));
console.log("Run pnpm perks:project --channel preview, then sync preview providers and run checks.");
