import type { Metadata } from "next";
import { getBossBySlug } from "@/lib/bosses";
import { getMDXDetail, getMDXList } from "@/lib/mdx";

export const bossCatalogMetadata: Metadata = {
  title: "敌人图鉴",
  description: "逆战未来猎场敌人图鉴，按地图收录 Boss 资料、血量与攻略。",
  alternates: { canonical: "/bosses" },
};

export function getBossStaticParams() {
  return getMDXList("enemies/lc/boss").map((item) => ({
    slug: item.slug,
  }));
}

export async function getBossDetailMetadata(
  params: Promise<{ slug: string }>,
): Promise<Metadata> {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const boss = await getBossBySlug(decodedSlug);
  const { metadata } = getMDXDetail("enemies/lc/boss", decodedSlug);
  const title = metadata.title || boss?.title || decodedSlug;
  const maps = boss
    ? Array.isArray(boss.map)
      ? boss.map
      : [boss.map]
    : [];
  const description =
    boss?.description ||
    `${title}${maps.length > 0 ? ` - ${maps.join("、")}` : ""} Boss 首领资料与攻略。`;

  return {
    title,
    description,
    alternates: { canonical: `/bosses/${decodedSlug}` },
  };
}
