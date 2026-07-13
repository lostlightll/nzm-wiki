import { getMDXList, getMDXDetail } from "@/lib/mdx";
import { MDXRemote } from "next-mdx-remote/rsc";
import { mdxComponents, TableOfContents } from "@/lib/mdx-components";
import { mdxOptions } from "@/lib/mdx-options";
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

const PAGE_WIDTH_CLASSES: Record<string, string> = {
  sm: "max-w-xl",
  md: "max-w-2xl",
  lg: "max-w-3xl",
  xl: "max-w-4xl",
  "2xl": "max-w-5xl",
  "3xl": "max-w-6xl",
  full: "max-w-7xl",
};

function isCustomWidth(value: string): boolean {
  return /^\d+(px|rem|em|vw|%)$/.test(value);
}

export default async function PerkDetailPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const slugPath = slug.map(decodeURIComponent).join("/");

  const { content, metadata } = getMDXDetail("perks", slugPath);
  const showToc = metadata.toc !== false;

  const pageWidth = metadata["page-width"] as string | undefined;
  const isCustom = pageWidth && isCustomWidth(pageWidth);
  const widthClass = isCustom
    ? ""
    : pageWidth && PAGE_WIDTH_CLASSES[pageWidth]
      ? PAGE_WIDTH_CLASSES[pageWidth]
      : "max-w-3xl";
  const customStyle = isCustom ? { maxWidth: pageWidth } : undefined;

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
    <>
      <TableOfContents enabled={showToc} />
      <div
        className={`mx-auto ${widthClass} py-6 ${isCustom ? "max-md:max-w-full" : ""}`}
        style={customStyle}
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
      </div>
    </>
  );
}
