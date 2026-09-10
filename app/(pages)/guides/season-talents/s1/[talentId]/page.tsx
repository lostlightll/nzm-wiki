import type { Metadata } from "next";
import { LegacyTalentPage } from "@/components/season-talents/s0s1/LegacyTalentPage";
import { LEGACY_TALENT_CATALOG, legacyPresentation, legacyTalentHref } from "@/lib/s0s1-talent-presentation";

export const dynamicParams = false;
export function generateStaticParams() { return LEGACY_TALENT_CATALOG.filter(t=>t.season==="s1").map(t=>({talentId:t.id})); }
export async function generateMetadata({params}:{params:Promise<{talentId:string}>}):Promise<Metadata> {
  const {talentId}=await params;
  const talent=legacyPresentation("s1",talentId);
  return {title:talent?`${talent.name}天赋树（S1）`:"S1 赛季天赋",description:`逆战未来 S1 ${talent?.name??""}天赋节点、等级效果与模拟加点。`,alternates:{canonical:legacyTalentHref("s1",talentId)}};
}
export default async function Page({params}:{params:Promise<{talentId:string}>}) { const {talentId}=await params; return <LegacyTalentPage season="s1" id={talentId}/>; }
