import { getMDXList, getMDXDetail } from "@/lib/mdx";
import { MDXRemote } from "next-mdx-remote/rsc";
import { mdxComponents } from "@/lib/mdx-components";
import { mdxOptions } from "@/lib/mdx-options";
import { MDXDetailLayout } from "@/components/MDXDetailLayout";
import { PerkDetailCard } from "@/components/PerkCard";
import { RARITY_NUM_MAP } from "@/constants/common";
import type { Rarity } from "@/types";
import type { Metadata } from "next";

export async function generateStaticParams() {
  const items = getMDXList("perks");
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
  const { metadata } = getMDXDetail("perks", slugPath);
  const title = metadata.title || slugPath;
  return {
    title,
    description: `${title} — 逆战未来特性详情`,
    alternates: { canonical: `/perks/${slugPath}` },
  };
}

export default async function PerkDetailPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const slugPath = slug.map(decodeURIComponent).join("/");

  const { content, metadata } = getMDXDetail("perks", slugPath);

  const rarity: Rarity | undefined =
    typeof metadata.rarity === "number"
      ? RARITY_NUM_MAP[metadata.rarity]
      : metadata.rarity;

  const descriptionNode = metadata.description ? (
    <MDXRemote
      source={metadata.description}
      components={mdxComponents}
    />
  ) : undefined;

  return (
    <MDXDetailLayout
      pageWidth={metadata["page-width"]}
      toc={metadata.toc !== false}
    >
        <PerkDetailCard
          name={metadata.title}
          icon={metadata.icon}
          slot={metadata.slot}
          rarity={rarity}
          description={descriptionNode}
          weaponType={metadata.weaponType}
        />

        {content.trim() && (
          <article className="prose prose-lg prose-invert mt-8 max-w-none">
            <MDXRemote
              source={content}
              components={mdxComponents}
              options={mdxOptions}
            />
          </article>
        )}
    </MDXDetailLayout>
  );
}
