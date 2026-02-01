import { getMDXList, getMDXDetail } from "@/lib/mdx";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { mdxComponents, TableOfContents } from "@/lib/mdx-components";

export async function generateStaticParams() {
  const items = getMDXList("posts");
  return items.map((item) => ({
    slug: item.slug.split("/"),
  }));
}

// Tailwind max-width classes mapping
const PAGE_WIDTH_CLASSES: Record<string, string> = {
  sm: "max-w-xl",
  md: "max-w-2xl",
  lg: "max-w-3xl",
  xl: "max-w-4xl",
  "2xl": "max-w-5xl",
  "3xl": "max-w-6xl",
  full: "max-w-7xl",
};

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const slugPath = slug.map(decodeURIComponent).join("/");
  const { content, metadata } = getMDXDetail("posts", slugPath);
  const showToc = metadata.toc !== false;

  // Get page width class from frontmatter, default to lg (max-w-3xl)
  const pageWidth = metadata["page-width"] as string | undefined;
  const widthClass = pageWidth && PAGE_WIDTH_CLASSES[pageWidth]
    ? PAGE_WIDTH_CLASSES[pageWidth]
    : "max-w-3xl";

  return (
    <>
      <TableOfContents enabled={showToc} />
      <div className={`mx-auto ${widthClass} p-10`}>
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
