// 武器详情页

import { getMDXList, getMDXDetail } from "@/lib/mdx";
import { getAllWeapons } from "@/lib/weapons";
import { WeaponDetailCard } from "@/components/WeaponCard";
import { MDXRemote } from "next-mdx-remote/rsc";

// generateStaticParams - 静态路径生成
// Next.js 在 build 时自动调用，告诉框架需要生成哪些页面
export async function generateStaticParams() {
  const items = getMDXList("s0/weapons");
  return items.map((item) => ({
    slug: encodeURIComponent(item.slug),
  }));
}

export default async function WeaponDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);

  // 从 weapons.json 获取完整武器数据（用于 WeaponDetailCard）
  const weapons = await getAllWeapons();
  const weapon = weapons.find((w) => w.name === decodedSlug);

  // 从 MDX 获取正文内容
  const { content } = getMDXDetail("s0/weapons", slug);

  return (
    <div className="max-w-3xl mx-auto p-10">
      {/* 武器卡片 */}
      {weapon && <WeaponDetailCard weapon={weapon} />}

      {/* MDX 正文内容 */}
      {content.trim() && (
        <article className="prose prose-lg dark:prose-invert max-w-none mt-8">
          <MDXRemote source={content} />
        </article>
      )}
    </div>
  );
}
