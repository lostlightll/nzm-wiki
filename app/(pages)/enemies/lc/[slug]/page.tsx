import { getMDXList, getMDXDetail } from "@/lib/mdx";
import { getBossBySlug, bossToEnemy } from "@/lib/bosses";
import { EnemyDetailCard } from "@/components/EnemyCard";
import { TableOfContents } from "@/components/TableOfContents";
import { MDXRemote } from "next-mdx-remote/rsc";
import { mdxComponents } from "@/lib/mdx-components";
import { mdxOptions } from "@/lib/mdx-options";
import type { Metadata } from "next";

export async function generateStaticParams() {
  const items = getMDXList("enemies/lc/boss");
  return items.map((item) => ({
    slug: item.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { metadata } = getMDXDetail("enemies/lc/boss", slug);
  const title = metadata.title || slug;
  return {
    title,
    description: `${title} — 逆战未来首领详情`,
    alternates: { canonical: `/enemies/lc/${slug}` },
  };
}

export default async function BossDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const boss = await getBossBySlug(slug);
  const { content, metadata } = getMDXDetail("enemies/lc/boss", slug);
  const showToc = metadata.toc !== false;

  if (!boss) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:p-10">
        <p className="text-zinc-500">首领不存在</p>
      </div>
    );
  }

  return (
    <>
      <TableOfContents enabled={showToc} />
      <div className="mx-auto max-w-3xl px-4 py-6 sm:p-10">
        <EnemyDetailCard enemy={bossToEnemy(boss)} />

        {content.trim() && (
          <article className="prose prose-lg prose-invert mt-8 max-w-none">
            <MDXRemote
              source={content}
              components={mdxComponents}
              options={mdxOptions}
            />
          </article>
        )}
      </div>
    </>
  );
}
