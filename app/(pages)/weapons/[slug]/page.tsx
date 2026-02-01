import { getMDXList, getMDXDetail } from "@/lib/mdx";
import { getWeaponBySlug } from "@/lib/weapons";
import { WeaponDetailCard } from "@/components/WeaponCard";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { mdxComponents, TableOfContents } from "@/lib/mdx-components";

export async function generateStaticParams() {
  const items = getMDXList("s0/weapons");
  return items.map((item) => ({
    slug: item.slug,
  }));
}

export default async function WeaponDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const weapon = await getWeaponBySlug(slug);
  const { content, metadata } = getMDXDetail("s0/weapons", slug);
  const showToc = metadata.toc !== false;

  if (!weapon) {
    return (
      <div className="mx-auto max-w-3xl p-10">
        <p className="text-zinc-500">武器不存在</p>
      </div>
    );
  }

  return (
    <>
      <TableOfContents enabled={showToc} />
      <div className="mx-auto max-w-3xl p-10">
        <WeaponDetailCard weapon={weapon} />

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
    </>
  );
}
