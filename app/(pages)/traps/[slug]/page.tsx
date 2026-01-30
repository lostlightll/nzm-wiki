import { getMDXList, getMDXDetail } from "@/lib/mdx";
import { getTrapBySlug } from "@/lib/traps";
import { TrapDetailCard } from "@/components/TrapCard";
import { Credit } from "@/components/Credit";
import { LevelTable } from "@/components/LevelTable";
import { MDXRemote } from "next-mdx-remote/rsc";

const mdxComponents = {
  Credit,
  LevelTable,
};

export async function generateStaticParams() {
  const items = getMDXList("s0/traps");
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
  const { content } = getMDXDetail("s0/traps", slug);

  if (!trap) {
    return (
      <div className="mx-auto max-w-3xl p-10">
        <p className="text-zinc-500">陷阱不存在</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-10">
      <TrapDetailCard trap={trap} />

      {content.trim() && (
        <article className="prose prose-lg prose-invert mt-8 max-w-none">
          <MDXRemote source={content} components={mdxComponents} />
        </article>
      )}
    </div>
  );
}
