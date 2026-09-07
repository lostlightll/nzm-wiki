import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { buildTrees, type Evidence } from "./extract";
import { VIDEO_VALUE_EVIDENCE, videoTimestamp } from "./video-values";

const output = process.argv.find(arg => arg.startsWith("--out="))?.slice(6);
const frameDir = process.argv.find(arg => arg.startsWith("--frames="))?.slice(9);
const trees = (["s0", "s1"] as const).flatMap(season => {
  const evidence: Evidence = JSON.parse(readFileSync(`data/season-talents/${season}/audit.json`, "utf8"));
  const result = buildTrees(evidence);
  if (process.argv.includes("--write")) writeFileSync(`data/season-talents/${season}/trees.json`, JSON.stringify(result, null, 2) + "\n");
  return result.filter(tree => tree.historicalStatus === "video-confirmed");
});
if (frameDir) {
  const hash = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");
  assert.equal(hash(join(frameDir, VIDEO_VALUE_EVIDENCE.source.fileName)), VIDEO_VALUE_EVIDENCE.source.sha256);
  for (const entry of VIDEO_VALUE_EVIDENCE.entries) assert.equal(hash(join(frameDir, entry.frame)), entry.frameSha256);
}
const lines = ["# S0 / S1 视频补充清单", "", "录像展示值尚未核实配置，不是实际伤害测试或乘区依据。只补本节点、本等级原有空缺；已有结构化配置不覆盖，未展示的等级不推算。", "",
  `录像：${VIDEO_VALUE_EVIDENCE.source.fileName}`, `SHA-256：\`${VIDEO_VALUE_EVIDENCE.source.sha256}\``, "",
  "| 赛季 | 分支 | 配置已核验 | 录像补充 | 用户补充 | 仍未填充 |", "| --- | --- | ---: | ---: | ---: | ---: |",
];
let count = 0;
for (const tree of trees) {
  const levels = tree.nodes.flatMap(node => node.levels);
  const reviewed = levels.reduce((sum, level) => sum + (level.valueReview?.resolvedCount ?? 0), 0);
  const video = levels.reduce((sum, level) => sum + (level.videoReview?.values.length ?? 0), 0);
  const reported = levels.reduce((sum, level) => sum + (level.reportedReview?.count ?? 0), 0);
  const missing = levels.reduce((sum, level) => sum + (level.valueReview?.remaining ?? 0), 0) - video - reported;
  lines.push(`| ${tree.season.toUpperCase()} | ${tree.name} | ${reviewed} | ${video} | ${reported} | ${missing} |`);
}
for (const entry of VIDEO_VALUE_EVIDENCE.entries) {
  const tree = trees.find(tree => tree.season === entry.season && tree.id === entry.treeId);
  const node = tree?.nodes.find(node => node.id === entry.nodeId);
  const level = node?.levels.find(level => level.level === entry.level);
  assert.ok(tree && node && level?.videoReview, `Unmatched observation: ${entry.nodeId}/${entry.level}`);
  assert.equal(node.name, entry.nodeName);
  lines.push("", `## ${tree.season.toUpperCase()} · ${tree.name} · ${node.name} · Lv.${entry.level}`, "",
    `节点：\`${entry.nodeId}\`；录像时间：**${videoTimestamp(entry.seconds)}**；等级依据：${entry.levelEvidence}。`, "",
    `[定位帧](${entry.frame}) · 帧 SHA-256：\`${entry.frameSha256}\``, "",
  );
  for (const value of entry.values) {
    lines.push(`${++count}. **${value.value}**（录像展示值，未核实配置）：${value.context.replace("〔数值待核实〕", `【${value.value}】`).replaceAll("\n", " ")}`);
  }
  if (entry.notes.length) lines.push("", ...entry.notes.map(note => `差异记录：${note}`));
}
const remaining = trees.flatMap(tree => tree.nodes.flatMap(node => node.levels)).reduce((sum, level) => sum + (level.valueReview?.remaining ?? 0), 0);
lines.push("", `合计 ${count} 处录像补充，${VIDEO_VALUE_EVIDENCE.entries.length} 个节点等级记录。配置待核实总数为 ${remaining}；其中录像已补 ${count} 处，不计入配置已核验数。`, "");
if (output) {
  const file = resolve(output);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, lines.join("\n"));
}
console.log(lines.slice(0, 15).join("\n"));
console.log(`Video display only: ${count} values / ${VIDEO_VALUE_EVIDENCE.entries.length} level records.`);
