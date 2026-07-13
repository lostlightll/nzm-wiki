import { getMDXList, getMDXDetail } from "@/lib/mdx";
import { getTDWeaponBySlug } from "@/lib/weapons";
import { WeaponDetailContent } from "@/components/WeaponDetailContent";
import type { Metadata } from "next";

export async function generateStaticParams() {
  const items = getMDXList("weapons_td");
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
  const { metadata } = getMDXDetail("weapons_td", slug);
  const title = metadata.title || slug;
  return {
    title: `${title}（塔防）`,
    description: `${title} — 逆战未来塔防武器详情`,
    alternates: { canonical: `/weapons/td/${slug}` },
  };
}

export default async function TDWeaponDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const weapon = await getTDWeaponBySlug(slug);
  const { content, metadata } = getMDXDetail("weapons_td", slug);

  if (!weapon) {
    return (
      <div className="mx-auto max-w-3xl py-6">
        <p className="text-zinc-500">武器不存在</p>
      </div>
    );
  }

  return <WeaponDetailContent weapon={weapon} content={content} metadata={metadata} />;
}
