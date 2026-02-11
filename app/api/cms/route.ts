export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import matter from "gray-matter";
// 确保这里导入路径和你实际存放 schema.ts 的位置一致
import { FIELD_ORDER } from "@/constants/schema";

const DATA_DIR = path.join(process.cwd(), "data");

/**
 * 递归获取文件树结构的辅助函数
 * @param dir 当前遍历的目录绝对路径
 * @param base 当前目录相对于 data/ 的相对路径 (用于前端请求)
 */
function getFileTree(dir: string, base: string = ""): any[] {
  // 如果目录不存在，返回空数组
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir, { withFileTypes: true });

  return files.map((file) => {
    const relPath = path.join(base, file.name); // 例如: "weapons/死神猎手.mdx"

    if (file.isDirectory()) {
      return {
        name: file.name,
        path: relPath,
        type: "folder",
        children: getFileTree(path.join(dir, file.name), relPath),
      };
    } else {
      return {
        name: file.name,
        path: relPath,
        type: "file",
      };
    }
  });
}

/**
 * GET 请求：获取文件列表（左侧侧边栏使用）
 */
export async function GET() {
  try {
    const tree = getFileTree(DATA_DIR);
    return NextResponse.json({ tree });
  } catch (error) {
    console.error("Error generating file tree:", error);
    return NextResponse.json(
      { error: "Failed to load file tree" },
      { status: 500 },
    );
  }
}

/**
 * POST 请求：处理读取文件详情 和 保存文件
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, filePath, data, content } = body;

    // 防止访问 data 目录以外的文件（简单的安全检查）
    if (filePath.includes("..")) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const fullPath = path.join(DATA_DIR, filePath);

    // --- 动作 1: 读取文件详情 ---
    if (action === "read") {
      if (!fs.existsSync(fullPath)) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }

      const fileContent = fs.readFileSync(fullPath, "utf-8");
      // gray-matter 解析 Frontmatter 和 正文
      const { data: frontmatter, content: mdxBody } = matter(fileContent);

      return NextResponse.json({
        frontmatter,
        content: mdxBody,
      });
    }

    // --- 动作 2: 保存文件 (带自动排序) ---
    if (action === "save") {
      // 1. 构建一个新的对象，用于存放排序后的数据
      const orderedData: any = {};

      // 2. 第一轮：严格按照 FIELD_ORDER 定义的顺序填充数据
      FIELD_ORDER.forEach((key) => {
        // 只有当 data 中存在该字段（包括 null/false）时才写入
        if (data[key] !== undefined) {
          orderedData[key] = data[key];
        }
      });

      // 3. 第二轮：把那些存在于 data 中，但没在 Schema 里定义的“额外字段”补到最后
      //    (防止 Schema 更新滞后导致数据丢失)
      Object.keys(data).forEach((key) => {
        if (!FIELD_ORDER.includes(key)) {
          orderedData[key] = data[key];
        }
      });

      // 4. 使用 gray-matter 将对象转换回 YAML 格式字符串
      // matter.stringify 会自动处理 YAML 格式 (--- ... ---)
      const fileStr = matter.stringify(content || "", orderedData);

      // 5. 写入磁盘
      fs.writeFileSync(fullPath, fileStr, "utf-8");

      return NextResponse.json({ success: true });
    }

    // --- 动作 3: 新建 (Create) ---
    if (action === "create") {
      // 1. 检查文件是否存在
      if (fs.existsSync(fullPath)) {
        return NextResponse.json({ error: "文件已存在" }, { status: 400 });
      }

      // 2. 确保目录存在
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // 3. 生成默认数据 (根据 Schema)
      const defaultData: any = {};
      FIELD_ORDER.forEach((key) => (defaultData[key] = null)); // 默认给 null

      // 4. 写入初始文件
      const fileStr = matter.stringify("\n# 新建文档\n", defaultData);
      fs.writeFileSync(fullPath, fileStr, "utf-8");

      return NextResponse.json({ success: true });
    }

    // --- 动作 4: 删除 (Delete) ---
    if (action === "delete") {
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath); // 删除文件
        return NextResponse.json({ success: true });
      }
      return NextResponse.json({ error: "文件不存在" }, { status: 404 });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
