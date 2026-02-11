import { getMDXList, getMDXDetail } from "@/lib/mdx";
import { getTrapBySlug } from "@/lib/traps";
import { TrapDetailCard } from "@/components/TrapCard";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { mdxComponents } from "@/lib/mdx-components";

export async function generateStaticParams() {
  const items = getMDXList("traps");
  return items.map((item) => ({
    slug: item.slug,
  }));
}

export default async function TrapDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const trap = await getTrapBySlug(slug);

  if (!trap) {
    return (
      <div className="mx-auto max-w-3xl py-6 sm:p-10">
        <p className="text-zinc-500">陷阱不存在</p>
      </div>
    );
  }

  const { content } = getMDXDetail("traps", slug);

  return (
    <div className="mx-auto max-w-3xl py-6 sm:p-10">
      <TrapDetailCard trap={trap} />

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
