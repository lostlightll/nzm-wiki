import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import exemptions from "../../data/status-effect-icon-exemptions.json";
import {
  extractStatusEffects,
  getSourceIconPath,
  readStatusEffectSourceTables,
  type StatusEffectIconOverride,
} from "./extract";

const root = process.cwd();
const dataPath = path.join(root, "data", "status-effects.json");
const iconRoot = path.join(root, "public", "webp", "icons", "status-effects");
const mode = process.argv[2];
const exemptionMap = exemptions as Record<string, StatusEffectIconOverride>;

function serialize(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function assertInsideIconRoot(filePath: string) {
  const relative = path.relative(iconRoot, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`状态图标路径越界：${filePath}`);
  }
}

function resolveIcons(iconAssets: Map<string, string>) {
  const missing: string[] = [];
  const resolved = [...iconAssets.entries()].flatMap(([publicPath, assetPath]) => {
    const sourcePath = getSourceIconPath(root, assetPath);
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      if (!exemptionMap[assetPath]) missing.push(`${assetPath} -> ${sourcePath ?? "无效路径"}`);
      return [];
    }
    const targetPath = path.join(root, "public", publicPath.replace(/^\//, ""));
    assertInsideIconRoot(targetPath);
    return [{ publicPath, assetPath, sourcePath, targetPath }];
  });

  if (missing.length > 0) {
    throw new Error(
      `以下 Buff 图标不存在且未豁免：\n${missing.map((item) => `- ${item}`).join("\n")}`,
    );
  }
  return resolved;
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<void>,
) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      await task(item);
    }
  });
  await Promise.all(workers);
}

async function refresh() {
  const result = extractStatusEffects(readStatusEffectSourceTables(root), exemptionMap);
  const icons = resolveIcons(result.iconAssets);
  fs.mkdirSync(iconRoot, { recursive: true });
  await runWithConcurrency(icons, 8, async ({ sourcePath, targetPath }) => {
    await sharp(sourcePath).webp({ quality: 88, effort: 4 }).toFile(targetPath);
  });

  const expectedFiles = new Set(icons.map(({ targetPath }) => path.resolve(targetPath)));
  for (const fileName of fs.readdirSync(iconRoot)) {
    const filePath = path.resolve(iconRoot, fileName);
    assertInsideIconRoot(filePath);
    if (fileName.endsWith(".webp") && !expectedFiles.has(filePath)) {
      fs.rmSync(filePath);
    }
  }

  fs.writeFileSync(dataPath, serialize(result.data), "utf8");
  console.log(
    `状态效果数据已刷新：敌方 ${result.data.summary.enemyEntries} 项，玩家 ${result.data.summary.playerEntries} 项，图标 ${icons.length} 个。`,
  );
}

function check() {
  const result = extractStatusEffects(readStatusEffectSourceTables(root), exemptionMap);
  const icons = resolveIcons(result.iconAssets);
  const errors: string[] = [];

  if (!fs.existsSync(dataPath)) {
    errors.push("缺少 data/status-effects.json");
  } else if (fs.readFileSync(dataPath, "utf8") !== serialize(result.data)) {
    errors.push("data/status-effects.json 与当前猎场导出不一致，请运行 status-effects:refresh");
  }

  for (const { publicPath, targetPath } of icons) {
    if (!fs.existsSync(targetPath)) errors.push(`缺少公开图标：${publicPath}`);
  }
  for (const [assetPath, override] of Object.entries(exemptionMap)) {
    if (!override.reason.trim()) errors.push(`图标豁免缺少原因：${assetPath}`);
    if (override.publicPath) {
      const targetPath = path.join(root, "public", override.publicPath.replace(/^\//, ""));
      if (!fs.existsSync(targetPath)) {
        errors.push(`图标替代路径不存在：${assetPath} -> ${override.publicPath}`);
      }
    }
  }
  if (fs.existsSync(iconRoot)) {
    const expected = new Set(icons.map(({ targetPath }) => path.resolve(targetPath)));
    for (const fileName of fs.readdirSync(iconRoot)) {
      const filePath = path.resolve(iconRoot, fileName);
      if (fileName.endsWith(".webp") && !expected.has(filePath)) {
        errors.push(`存在陈旧图标：${path.relative(root, filePath)}`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`状态效果数据校验失败：\n${errors.map((item) => `- ${item}`).join("\n")}`);
  }
  console.log(
    `状态效果数据校验通过：敌方 ${result.data.summary.enemyEntries} 项，玩家 ${result.data.summary.playerEntries} 项，图标 ${icons.length} 个。`,
  );
}

async function main() {
  if (mode === "refresh") {
    await refresh();
  } else if (mode === "check") {
    check();
  } else {
    throw new Error("用法：tsx scripts/status-effects/cli.ts <refresh|check>");
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
