import { getMDXList, getMDXDetail } from "@/lib/mdx";
import { BuffDetail } from "@/components/BuffCard";
import type { Metadata } from "next";

export async function generateStaticParams() {
  const items = getMDXList("cards");
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
  const { metadata } = getMDXDetail("cards", slugPath);
  const title = metadata.title || slugPath;
  return {
    title,
    description: `${title} — 逆战未来卡牌详情`,
    alternates: { canonical: `/cards/${slugPath}` },
  };
}

export default async function CardPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const slugPath = slug.map(decodeURIComponent).join("/");
  const { metadata } = getMDXDetail("cards", slugPath);

  return (
    <div className="mx-auto max-w-6xl p-10">
      {metadata.title && (
        <h1 className="text-2xl font-bold text-foreground mb-6">
          {metadata.title}
        </h1>
      )}
      <BuffDetail
        name={metadata.title as string}
        icon={metadata.icon as string}
        type={metadata.type as "buff" | "debuff"}
        effect={metadata.effect as string}
      />
    </div>
  );
}
