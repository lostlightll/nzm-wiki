import { getMDXList, getMDXDetail } from "@/lib/mdx";
import { getWeaponBySlug } from "@/lib/weapons";
import { WeaponDetailContent } from "@/components/WeaponDetailContent";
import type { Metadata } from "next";

export async function generateStaticParams() {
  const items = getMDXList("weapons");
  return items.map((item) => ({
    slug: item.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { metadata } = getMDXDetail("weapons", slug);
  const title = metadata.title || slug;
  return {
    title,
    description: `${title} — 逆战未来武器详情`,
    alternates: { canonical: `/weapons/${slug}` },
  };
}

export default async function WeaponDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const weapon = await getWeaponBySlug(slug);
  const { content, metadata } = getMDXDetail("weapons", slug);

  if (!weapon) {
    return (
      <div className="mx-auto max-w-3xl py-6">
        <p className="text-zinc-500">武器不存在</p>
      </div>
    );
  }

  return <WeaponDetailContent weapon={weapon} content={content} metadata={metadata} />;
}
