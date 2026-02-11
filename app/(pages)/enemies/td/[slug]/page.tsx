import { getMDXList, getMDXDetail } from "@/lib/mdx";
import { getTDEnemyBySlug, tdEnemyToEnemy } from "@/lib/td-enemies";
import { EnemyDetailCard } from "@/components/EnemyCard";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { mdxComponents } from "@/lib/mdx-components";

export async function generateStaticParams() {
  const items = getMDXList("s0/enemies/td");
  return items.map((item) => ({
    slug: item.slug,
  }));
}

export default async function TDEnemyDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const enemy = await getTDEnemyBySlug(slug);
  const { content } = getMDXDetail("s0/enemies/td", slug);

  if (!enemy) {
    return (
      <div className="mx-auto max-w-3xl py-6 sm:p-10">
        <p className="text-zinc-500">敌人不存在</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl py-6 sm:p-10">
      <EnemyDetailCard enemy={tdEnemyToEnemy(enemy)} />

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
