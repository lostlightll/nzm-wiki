/**
 * 图片优化脚本
 * 将 PNG 图片转换为 WebP 格式，可选调整尺寸
 * 输出到 public/webp/ 目录，保留原始目录结构
 *
 * 用法:
 *   pnpm exec tsx scripts/optimize-images.ts [options] [path]
 *
 * 选项:
 *   --max-width=N   限制最大宽度（如 --max-width=800）
 *   --quality=N     WebP 质量 1-100（默认 80）
 *   --dry-run       预览模式，不实际转换(也就是列出转换前和转换后的文件路径列表)
 *   --delete-png    删除原始 PNG 文件（默认保留）
 *
 * 示例:
 *   pnpm exec tsx scripts/optimize-images.ts public/images
 *   pnpm exec tsx scripts/optimize-images.ts --max-width=800 --quality=85 public/images/icons
 */

import fs from "fs";
import path from "path";
import sharp from "sharp";

const PUBLIC_DIR = "public";
const WEBP_DIR = path.join(PUBLIC_DIR, "webp");

interface Options {
  maxWidth?: number;
  quality: number;
  dryRun: boolean;
  deletePng: boolean;
  targetPath: string;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {
    quality: 80,
    dryRun: false,
    deletePng: false,
    targetPath: "public/images",
  };

  for (const arg of args) {
    if (arg.startsWith("--max-width=")) {
      options.maxWidth = parseInt(arg.split("=")[1], 10);
    } else if (arg.startsWith("--quality=")) {
      options.quality = parseInt(arg.split("=")[1], 10);
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--delete-png") {
      options.deletePng = true;
    } else if (!arg.startsWith("--")) {
      options.targetPath = arg;
    }
  }

  return options;
}

function getAllPngFiles(dir: string): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dir)) {
    console.error(`Directory not found: ${dir}`);
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllPngFiles(fullPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".png")) {
      files.push(fullPath);
    }
  }

  return files;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

// 计算输出路径: public/images/foo/bar.png -> public/webp/images/foo/bar.webp
function getWebpOutputPath(pngPath: string): string {
  const cwd = process.cwd();
  const absolutePath = path.resolve(cwd, pngPath);
  const publicPath = path.resolve(cwd, PUBLIC_DIR);

  // 获取相对于 public 的路径
  const relativePath = path.relative(publicPath, absolutePath);
  // 替换扩展名
  const webpRelativePath = relativePath.replace(/\.png$/i, ".webp");
  // 拼接到 public/webp/
  return path.join(cwd, WEBP_DIR, webpRelativePath);
}

async function convertImage(
  pngPath: string,
  options: Options,
): Promise<{ saved: number; skipped: boolean }> {
  const webpPath = getWebpOutputPath(pngPath);

  // 跳过未变更的：webp 已存在且比 png 新
  if (fs.existsSync(webpPath)) {
    const pngMtime = fs.statSync(pngPath).mtimeMs;
    const webpMtime = fs.statSync(webpPath).mtimeMs;
    if (webpMtime >= pngMtime) {
      return { saved: 0, skipped: true };
    }
  }

  const originalSize = fs.statSync(pngPath).size;

  if (options.dryRun) {
    console.log(`[DRY-RUN] Would convert: ${pngPath} -> ${webpPath}`);
    return { saved: 0, skipped: false };
  }

  // 确保输出目录存在
  const outputDir = path.dirname(webpPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let pipeline = sharp(pngPath);

  // 调整尺寸（如果指定了 maxWidth）
  if (options.maxWidth) {
    const metadata = await sharp(pngPath).metadata();
    if (metadata.width && metadata.width > options.maxWidth) {
      pipeline = pipeline.resize(options.maxWidth, null, {
        withoutEnlargement: true,
      });
    }
  }

  // 转换为 WebP
  await pipeline
    .webp({ quality: options.quality, alphaQuality: 100 })
    .toFile(webpPath);

  const newSize = fs.statSync(webpPath).size;
  const saved = originalSize - newSize;
  const percent = ((saved / originalSize) * 100).toFixed(1);

  console.log(
    `[OK] ${pngPath} -> ${path.relative(process.cwd(), webpPath)} ` +
      `(${formatBytes(originalSize)} -> ${formatBytes(newSize)}, -${percent}%)`,
  );

  // 删除原始 PNG（如果指定）
  if (options.deletePng) {
    fs.unlinkSync(pngPath);
  }

  return { saved, skipped: false };
}

async function main() {
  const options = parseArgs();
  const targetDir = path.resolve(process.cwd(), options.targetPath);

  console.log("=".repeat(50));
  console.log("图片优化工具 - PNG to WebP");
  console.log("=".repeat(50));
  console.log(`目标目录: ${targetDir}`);
  console.log(`输出目录: ${path.resolve(process.cwd(), WEBP_DIR)}`);
  console.log(`质量: ${options.quality}`);
  if (options.maxWidth) console.log(`最大宽度: ${options.maxWidth}px`);
  if (options.dryRun) console.log("模式: 预览（不实际转换）");
  if (options.deletePng) console.log("删除原始 PNG: 是");
  console.log("=".repeat(50));

  const pngFiles = getAllPngFiles(targetDir);

  if (pngFiles.length === 0) {
    console.log("未找到 PNG 文件");
    return;
  }

  console.log(`找到 ${pngFiles.length} 个 PNG 文件\n`);

  let totalSaved = 0;
  let converted = 0;
  let skipped = 0;

  for (const file of pngFiles) {
    try {
      const result = await convertImage(file, options);
      if (result.skipped) {
        skipped++;
      } else {
        totalSaved += result.saved;
        converted++;
      }
    } catch (err) {
      console.error(`[ERROR] ${file}: ${err}`);
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`完成! 转换: ${converted}, 跳过: ${skipped}`);
  if (totalSaved > 0) {
    console.log(`总共节省: ${formatBytes(totalSaved)}`);
  }
}

main().catch(console.error);
