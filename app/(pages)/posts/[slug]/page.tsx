import { getMDXList, getMDXDetail } from "@/lib/mdx";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { mdxComponents, TableOfContents } from "@/lib/mdx-components";

export async function generateStaticParams() {
  const items = getMDXList("posts");
  return items.map((item) => ({
    slug: item.slug,
  }));
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { content, metadata } = getMDXDetail("posts", slug);
  const showToc = metadata.toc !== false;

  return (
    <>
      <TableOfContents enabled={showToc} />
      <div className="mx-auto max-w-3xl p-10">
        <article className="prose prose-lg prose-invert max-w-none">
          {metadata.title && <h1>{metadata.title}</h1>}
          <MDXRemote
            source={content}
            components={mdxComponents}
            options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }}
          />
        </article>
      </div>
    </>
  );
}
