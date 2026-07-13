import { getMDXList, getMDXDetail } from "@/lib/mdx";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getMdxComponents } from "@/lib/mdx-components";
import { mdxOptions } from "@/lib/mdx-options";
import { getAllBosses } from "@/lib/bosses";
import { MDXDetailLayout } from "@/components/MDXDetailLayout";
import type { Metadata } from "next";

export async function generateStaticParams() {
  const items = getMDXList("posts");
  return items.map((item) => ({
    slug: item.slug.split("/"),
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const slugPath = slug.map(decodeURIComponent).join("/");
  const { metadata } = getMDXDetail("posts", slugPath);
  const title = metadata.title || slugPath;
  return {
    title,
    description: `${title} — 逆战未来攻略文章`,
    alternates: { canonical: `/posts/${slugPath}` },
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const slugPath = slug.map(decodeURIComponent).join("/");
  const { content, metadata } = getMDXDetail("posts", slugPath);

  // 加载 boss 数据，转换为 title -> Boss 的映射
  const bosses = await getAllBosses();
  const bossData = Object.fromEntries(bosses.map((b) => [b.title, b]));
  const mdxComponents = getMdxComponents(bossData);

  return (
    <MDXDetailLayout
      pageWidth={metadata["page-width"]}
      toc={metadata.toc !== false}
      className="md:p-10"
    >
        <article className="prose prose-lg prose-invert max-w-none">
          {metadata.title && <h1>{metadata.title}</h1>}
          <MDXRemote
            source={content}
            components={mdxComponents}
            options={mdxOptions}
          />
        </article>
    </MDXDetailLayout>
  );
}
