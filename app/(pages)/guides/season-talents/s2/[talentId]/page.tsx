import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { S2SeasonTalentBuilder } from "@/components/season-talents/s2/S2SeasonTalentBuilder";
import { getS2TalentTree, S2_TALENT_IDS } from "@/lib/s2-season-talents";

export function generateStaticParams() { return S2_TALENT_IDS.map(talentId => ({ talentId })); }
export const dynamicParams = false;
type Props = { params: Promise<{ talentId: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { talentId } = await params;
  const tree = getS2TalentTree(talentId);
  if (!tree) notFound();
  return { title: `${tree.name}天赋树（S2）`, description: `逆战未来 S2 ${tree.name}的专属天赋、通用天赋与被动配点。`, alternates: { canonical: `/guides/season-talents/s2/${talentId}` } };
}
export default async function Page({ params }: Props) {
  const tree = getS2TalentTree((await params).talentId);
  if (!tree) notFound();
  return <S2SeasonTalentBuilder key={tree.id} tree={tree} />;
}
