import { getMDXList, getMDXDetail } from "@/lib/mdx";
import { getBossBySlug, bossToEnemy } from "@/lib/bosses";
import { EnemyDetailCard } from "@/components/EnemyCard";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { mdxComponents } from "@/lib/mdx-components";

export async function generateStaticParams() {
  const items = getMDXList("s0/lc/boss");
  return items.map((item) => ({
    slug: item.slug,
  }));
}

export default async function BossDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const boss = await getBossBySlug(slug);
  const { content } = getMDXDetail("s0/lc/boss", slug);

  if (!boss) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:p-10">
        <p className="text-zinc-500">首领不存在</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:p-10">
      <EnemyDetailCard enemy={bossToEnemy(boss)} />

      {content.trim() && (
        <article className="prose prose-lg prose-invert mt-8 max-w-none">
          <MDXRemote
            source={content}
            components={mdxComponents}
            options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }}
          />
        </article>
      )}
    </div>
  );
}
