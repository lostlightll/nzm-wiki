import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import matter from "gray-matter";

const NEXT_CACHE_DIR = path.join(process.cwd(), ".next");

function hasOverlimitPreview(): boolean {
  const previewFile = path.join(process.cwd(), "data", "overlimit", "preview.json");
  return fs.existsSync(previewFile) && JSON.parse(fs.readFileSync(previewFile, "utf8")) !== null;
}

function hasPerkPreview(): boolean {
  const previewFile = path.join(process.cwd(), "data", "perk-preview", "preview.json");
  const configFile = path.join(process.cwd(), "config", "content-version.json");
  const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
  return Boolean(config.preview) && fs.existsSync(previewFile)
    && JSON.parse(fs.readFileSync(previewFile, "utf8")) !== null;
}

const S4_TALENT_DATA_FILES = [
  "black-hole.json",
  "dual-star.json",
  "matrix-symbiosis.json",
  "passives.json",
];

function isS4SeasonTalentDraft(): boolean {
  const dataDir = path.join(process.cwd(), "data", "season-talents", "s4");
  return S4_TALENT_DATA_FILES.some((fileName) => {
    const filePath = path.join(dataDir, fileName);
    if (!fs.existsSync(filePath)) return true;
    const data = JSON.parse(fs.readFileSync(filePath, "utf8")) as {
      draft?: boolean;
    };
    return data.draft === true;
  });
}

function hasPublishedBuildGuides(): boolean {
  const buildsDir = path.join(process.cwd(), "data", "builds");
  if (!fs.existsSync(buildsDir)) return false;
  return fs
    .readdirSync(buildsDir)
    .filter((fileName) => fileName.endsWith(".mdx"))
    .some((fileName) => {
      const filePath = path.join(buildsDir, fileName);
      return matter(fs.readFileSync(filePath, "utf8")).data.draft !== true;
    });
}

const PATHS_TO_HIDE = [
  path.join("app", "api"),
  path.join("app", "editor"),
  ...(JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/overlimit/current.json"), "utf8")).withdrawn === true
    ? [path.join("app", "(pages)", "overlimit", "[id]")]
    : []),
  ...(!hasOverlimitPreview()
    ? [path.join("app", "(pages)", "overlimit", "preview")]
    : []),
  ...(!hasPerkPreview()
    ? [path.join("app", "(pages)", "perks", "preview")]
    : []),
  ...(!hasPublishedBuildGuides()
    ? [path.join("app", "(pages)", "builds", "[slug]")]
    : []),
  ...(isS4SeasonTalentDraft()
    ? [
        path.join("app", "(pages)", "guides", "season-talents", "s4"),
        path.join("public", "webp", "images", "season-talents", "s4"),
      ]
    : []),
];

interface DirPaths {
  original: string;
  hidden: string;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error;
}

function getPaths(relativePath: string): DirPaths {
  const original = path.join(process.cwd(), relativePath);
  return {
    original,
    hidden: path.join(path.dirname(original), `_${path.basename(original)}_hidden`),
  };
}

function moveDirectory(src: string, dest: string): void {
  if (fs.existsSync(src)) {
    try {
      fs.renameSync(src, dest);
      console.log(
        `[INFO] Directory moved: ${path.basename(src)} -> ${path.basename(dest)}`,
      );
    } catch (error: unknown) {
      if (isNodeError(error) && (error.code === "EBUSY" || error.code === "EPERM")) {
        console.error(`\n[CRITICAL ERROR] Windows 文件锁定: 无法移动 ${src}`);
        console.error(
          "请关闭 IDE (VSCode/Neovim) 或任何占用该文件夹的程序，然后重试。\n",
        );
      }
      throw error;
    }
  }
}

try {
  console.log("[START] Preparing for static build...");

  execSync("pnpm overlimit check", { stdio: "inherit" });
  execSync("pnpm perks:check", { stdio: "inherit" });

  console.log("[CHECK] Validating Num Modifier V2 data...");
  execSync("pnpm num-modifier:check", { stdio: "inherit" });

  console.log("[CHECK] Validating multiplier provider registry...");
  execSync("pnpm multiplier-index:check", { stdio: "inherit" });

  console.log("[CHECK] Validating weapon mode difference markers...");
  execSync("pnpm weapon-mode-diff:check", { stdio: "inherit" });

  // 1. 生成搜索索引和 sitemap
  console.log("[INDEX] Generating search index...");
  execSync("pnpm exec tsx scripts/generate-search-index.ts", { stdio: "inherit" });
  console.log("[SITEMAP] Generating sitemap...");
  execSync("pnpm exec tsx scripts/generate-sitemap.ts", { stdio: "inherit" });

  // 2. 删除 .next 缓存 (必须步骤)
  if (fs.existsSync(NEXT_CACHE_DIR)) {
    console.log("[CLEAN] Removing .next cache to prevent stale type errors...");
    fs.rmSync(NEXT_CACHE_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }

  // 3. 隐藏文件夹
  PATHS_TO_HIDE.forEach((relativePath) => {
    const { original, hidden } = getPaths(relativePath);
    // 清理残留
    if (fs.existsSync(hidden)) {
      if (fs.existsSync(original)) {
        fs.rmSync(hidden, { recursive: true, force: true });
      } else {
        fs.renameSync(hidden, original);
      }
    }
    moveDirectory(original, hidden);
  });

  // 4. 执行构建命令
  console.log("[BUILD] Running Next.js build with pnpm...");

  execSync("pnpm exec next build", { stdio: "inherit" });

  console.log("[SUCCESS] Build completed successfully.");
} catch (error) {
  console.error("\n[ERROR] Build failed.");
  console.error(error);
  process.exitCode = 1;
} finally {
  // 5. 还原文件夹
  console.log("[CLEANUP] Restoring directories...");

  PATHS_TO_HIDE.forEach((relativePath) => {
    const { original, hidden } = getPaths(relativePath);
    if (fs.existsSync(hidden)) {
      try {
        if (fs.existsSync(original)) {
          fs.rmSync(original, { recursive: true, force: true });
        }
        fs.renameSync(hidden, original);
        console.log(`[INFO] Restored: ${relativePath}`);
      } catch {
        console.error(
          `[WARN] Failed to restore ${relativePath}. Please check manually.`,
        );
      }
    }
  });

  console.log("[DONE] Process finished.");
}
