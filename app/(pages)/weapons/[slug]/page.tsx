// 武器详情页
//
// ============================================================
// [slug] 动态路由详解
// ============================================================
//
// 1. 文件夹命名 [slug] 表示这是一个「动态路由」
//    - 访问 /weapons/死神猎手 → slug = "死神猎手"
//    - 访问 /weapons/M416     → slug = "M416"
//    - [slug] 里的 "slug" 只是变量名，可以改成 [id]、[name] 等
//
// 2. 静态导出 (output: "export") 的要求
//    - 必须提供 generateStaticParams() 告诉 Next.js 要生成哪些页面
//    - 构建时会为每个 slug 生成一个独立的 HTML 文件
//
// 3. MDX 文件结构 (以 死神猎手.mdx 为例)
//    ---
//    title: 死神猎手       ← 这部分是 frontmatter (gray-matter 解析)
//    damage: 198           ← 存入 metadata 对象
//    ---
//    # 武器介绍            ← 这部分是 content (MDX 正文)
//    这是一把狙击枪...     ← 由 MDXRemote 渲染成 HTML
//
// ============================================================

import { getMDXDetail, getMDXList } from "@/lib/mdx";
import { MDXRemote } from "next-mdx-remote/rsc";

// 定义 frontmatter 的类型
interface WeaponMeta {
  title: string;
  damage?: number;
  fireRate?: number;
  weaknessMultiplier?: number;
  magazine?: number;
}

// ============================================================
// generateStaticParams - 静态路径生成
// ============================================================
// 作用：在 build 时告诉 Next.js 需要生成哪些页面
// 返回值：[{ slug: "死神猎手" }, { slug: "M416" }, ...]
// 结果：生成 /weapons/死神猎手/index.html, /weapons/M416/index.html 等
export async function generateStaticParams() {
  const items = getMDXList("s0/weapons");
  // 返回编码后的 slug，因为浏览器访问时 URL 会被编码
  const params = items.map((item) => ({
    slug: encodeURIComponent(item.slug),
  }));
  console.log("[generateStaticParams] params:", params);
  return params;
}

// ============================================================
// 页面组件
// ============================================================
// Next.js 15+ 中 params 是 Promise，需要 await
export default async function WeaponDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { content, metadata } = getMDXDetail("s0/weapons", slug);
  const meta = metadata as WeaponMeta;

  return (
    <div className="max-w-3xl mx-auto p-10">
      {/* 标题 */}
      <h1 className="text-4xl font-bold mb-6">{meta.title}</h1>

      {/* 武器属性卡片 - 展示 frontmatter 数据 */}
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mb-8">
        <h2 className="text-lg font-semibold mb-3">武器属性</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {meta.damage && (
            <div>
              <span className="text-gray-500">伤害：</span>
              <span className="font-medium">{meta.damage}</span>
            </div>
          )}
          {meta.fireRate && (
            <div>
              <span className="text-gray-500">射速：</span>
              <span className="font-medium">{meta.fireRate}</span>
            </div>
          )}
          {meta.weaknessMultiplier && (
            <div>
              <span className="text-gray-500">弱点倍率：</span>
              <span className="font-medium">{meta.weaknessMultiplier}x</span>
            </div>
          )}
          {meta.magazine && (
            <div>
              <span className="text-gray-500">弹匣：</span>
              <span className="font-medium">{meta.magazine}</span>
            </div>
          )}
        </div>
      </div>

      {/* MDX 正文内容 */}
      {/* prose: Tailwind Typography 插件的核心类 */}
      {/* prose-invert: 深色模式下反转颜色 */}
      {/* dark:prose-invert: 仅在深色模式时应用 prose-invert */}
      <article className="prose prose-lg dark:prose-invert max-w-none">
        <MDXRemote source={content} />
      </article>
    </div>
  );
}
