/** Import only reviewed preview damage rows; never refresh the official weapon lock. */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import matter from "gray-matter";

const index = process.argv.indexOf("--source");
if (index < 0 || !process.argv[index + 1]) throw new Error("Required: --source <numerical_config_composite.json>");
const source = path.resolve(process.argv[index + 1]);
const bytes = fs.readFileSync(source);
const rows = JSON.parse(bytes.toString("utf8"))[0].Rows;
const selections = [
  { itemId: "20703040537", name: "极寒领域", numericalId: 120300174, trigger: "主动技能替换为持续12秒的冰霜光环，影响周围9米敌人", interval: "每1秒" },
  { itemId: "20703040538", name: "极寒之触", numericalId: 120300175, trigger: "激光模式攻击冰缓效果超过2层的敌人，触发半径2.5米爆炸", interval: "1秒" },
  { itemId: "20703040539", name: "极寒之痕", numericalId: 120300176, trigger: "冰凌弹直击击杀敌人或命中场景生成冰球，敌人靠近后爆炸", interval: "每2秒最多生成一枚，最多同时存在3枚" },
];
const entries = selections.map(({ numericalId, ...selection }) => {
  const slug = `slot-4/${selection.name}`;
  const { data } = matter.read(`data/perks/${slug}.mdx`);
  const rowName = `${numericalId}_1`;
  const raw = rows[rowName];
  if (String(data.id) !== selection.itemId || data.season !== "s4-preview" ||
      !String(data.description).includes(`{GPNumericalID:${numericalId}:HpCalScale:13}`)) {
    throw new Error(`Preview perk identity/token mismatch: ${selection.name}`);
  }
  if (!raw || raw.id !== numericalId || raw.Level !== 1 || !Number.isFinite(raw.HpCalScale)) {
    throw new Error(`Invalid Numerical row: ${rowName}`);
  }
  return { ...selection, slug, rowName, raw };
});
fs.writeFileSync("data/perk-preview-damage.json", JSON.stringify({
  schema_version: 1,
  source: { path: "DataTables/numerical_config_composite.json", sha256: createHash("sha256").update(bytes).digest("hex") },
  entries,
}, null, 2) + "\n");
console.log(`Imported ${entries.length} preview damage rows.`);
