import { getMDXList, getMDXDetail } from "@/lib/mdx";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getMdxComponents, TableOfContents } from "@/lib/mdx-components";
import { mdxOptions } from "@/lib/mdx-options";
import { getAllBosses } from "@/lib/bosses";
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

// Check if value is a custom width (e.g., "1024px", "80rem")
function isCustomWidth(value: string): boolean {
  return /^\d+(px|rem|em|vw|%)$/.test(value);
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const slugPath = slug.map(decodeURIComponent).join("/");
  const { content, metadata } = getMDXDetail("posts", slugPath);
  const showToc = metadata.toc !== false;

  // 同名 Boss 优先让与显示名完全一致的 slug 响应旧的 title 引用。
  const bosses = await getAllBosses();
  const bossData = Object.fromEntries(bosses.map((boss) => [boss.slug, boss]));
  for (const boss of bosses) {
    if (!bossData[boss.title] || boss.slug === boss.title) {
      bossData[boss.title] = boss;
    }
  }
  const mdxComponents = getMdxComponents(bossData);

  // Get page width from frontmatter, default to lg (max-w-3xl)
  const pageWidth = metadata["page-width"] as string | undefined;
  const isCustom = pageWidth && isCustomWidth(pageWidth);
  const widthClass = isCustom
    ? ""
    : pageWidth && PAGE_WIDTH_CLASSES[pageWidth]
      ? PAGE_WIDTH_CLASSES[pageWidth]
      : "max-w-3xl";

  // Custom width style: specified width on desktop, full width on mobile
  const customStyle = isCustom ? { maxWidth: pageWidth } : undefined;

  return (
    <>
      <TableOfContents enabled={showToc} />
      <div
        className={`mx-auto ${widthClass} py-6 md:p-10 ${isCustom ? "max-md:max-w-full" : ""}`}
        style={customStyle}
      >
        <article className="prose prose-lg prose-invert max-w-none">
          {metadata.title && <h1>{metadata.title}</h1>}
          <MDXRemote
            source={content}
            components={mdxComponents}
            options={mdxOptions}
          />
        </article>
      </div>
    </>
  );
}
