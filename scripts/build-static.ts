import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const APP_DIR = path.join(process.cwd(), "app");
const NEXT_CACHE_DIR = path.join(process.cwd(), ".next");

const DIRS_TO_HIDE = ["api", "editor"];

interface DirPaths {
  original: string;
  hidden: string;
}

function getPaths(dirName: string): DirPaths {
  return {
    original: path.join(APP_DIR, dirName),
    hidden: path.join(APP_DIR, `_${dirName}_hidden`),
  };
}

function moveDirectory(src: string, dest: string): void {
  if (fs.existsSync(src)) {
    try {
      fs.renameSync(src, dest);
      console.log(
        `[INFO] Directory moved: ${path.basename(src)} -> ${path.basename(dest)}`,
      );
    } catch (err: any) {
      if (err.code === "EBUSY" || err.code === "EPERM") {
        console.error(`\n[CRITICAL ERROR] Windows 文件锁定: 无法移动 ${src}`);
        console.error(
          "请关闭 IDE (VSCode/Neovim) 或任何占用该文件夹的程序，然后重试。\n",
        );
      }
      throw err;
    }
  }
}

try {
  console.log("[START] Preparing for static build...");

  // 1. 删除 .next 缓存 (必须步骤)
  if (fs.existsSync(NEXT_CACHE_DIR)) {
    console.log("[CLEAN] Removing .next cache to prevent stale type errors...");
    fs.rmSync(NEXT_CACHE_DIR, { recursive: true, force: true });
  }

  // 2. 隐藏文件夹
  DIRS_TO_HIDE.forEach((dirName) => {
    const { original, hidden } = getPaths(dirName);
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

  // 3. 执行构建命令
  console.log("[BUILD] Running Next.js build with pnpm...");

  execSync("pnpm exec next build", { stdio: "inherit", shell: true } as any);

  console.log("[SUCCESS] Build completed successfully.");
} catch (error: any) {
  console.error("\n[ERROR] Build failed.");
  process.exit(1);
} finally {
  // 4. 还原文件夹
  console.log("[CLEANUP] Restoring directories...");

  DIRS_TO_HIDE.forEach((dirName) => {
    const { original, hidden } = getPaths(dirName);
    if (fs.existsSync(hidden)) {
      try {
        if (fs.existsSync(original)) {
          fs.rmSync(original, { recursive: true, force: true });
        }
        fs.renameSync(hidden, original);
        console.log(`[INFO] Restored: ${dirName}`);
      } catch (e) {
        console.error(
          `[WARN] Failed to restore ${dirName}. Please check manually.`,
        );
      }
    }
  });

  console.log("[DONE] Process finished.");
}
